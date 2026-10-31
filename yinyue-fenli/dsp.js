/* ============================================================
 * demucs-web · FFT / STFT / ISTFT 核心
 * 与 demucs (htdemucs) 严格对齐：nfft=4096, hop=1024, hann 窗, reflect 填充
 * ============================================================ */

export const NFFT = 4096;
export const HOP = 1024;
export const PAD = (HOP >> 1) * 3; // = 1536，与 demucs/spec.py 一致
export const SR = 44100;

/* ---------- 迭代基 2 FFT（原地，输入输出都是实/虚分离数组） ---------- */
export function makeFFT(n) {
  const levels = Math.log2(n) | 0;
  if (1 << levels !== n) throw new Error('FFT size must be power of 2');
  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = Math.sin((2 * Math.PI * i) / n);
  }
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let x = i, r = 0;
    for (let j = 0; j < levels; j++) { r = (r << 1) | (x & 1); x >>= 1; }
    rev[i] = r;
  }

  // forward: re/im 原地变换
  function transform(re, im, inverse) {
    const N = n;
    for (let i = 0; i < N; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let size = 2; size <= N; size <<= 1) {
      const half = size >> 1;
      const step = N / size;
      for (let i = 0; i < N; i += size) {
        for (let j = i, k = 0; j < i + half; j++, k += step) {
          const l = j + half;
          const c = cos[k];
          const s = inverse ? sin[k] : -sin[k];
          const tre = re[l] * c - im[l] * s;
          const tim = re[l] * s + im[l] * c;
          re[l] = re[j] - tre;
          im[l] = im[j] - tim;
          re[j] += tre;
          im[j] += tim;
        }
      }
    }
    if (inverse) {
      for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N; }
    }
  }

  return {
    forward(re, im) { transform(re, im, false); },
    inverse(re, im) { transform(re, im, true); },
  };
}

export const FFT = makeFFT(NFFT);

/* ---------- Hann 窗（periodic，与 torch.hann_window 默认一致） ---------- */
export const WINDOW = (() => {
  const w = new Float64Array(NFFT);
  for (let i = 0; i < NFFT; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / NFFT);
  return w;
})();

/* ---------- reflect 填充（与 F.pad mode='reflect' 一致） ---------- */
/* 注意：torch 的 reflect 不含边界点，pad=PAD 时首尾各取 PAD 个 */
export function reflectPad(sig, pad) {
  const n = sig.length;
  const out = new Float32Array(n + 2 * pad);
  // 头部
  for (let i = 0; i < pad; i++) {
    let idx = pad - i;            // 反射：不含第 0 个
    if (idx >= n) idx = reflectIndex(idx, n);
    out[i] = sig[idx];
  }
  out.set(sig, pad);
  // 尾部
  for (let i = 0; i < pad; i++) {
    let idx = n - 2 - i;
    if (idx < 0) idx = reflectIndex(idx, n);
    out[pad + n + i] = sig[idx];
  }
  return out;
}

function reflectIndex(idx, n) {
  // 循环反射，处理 pad > n 的极端情况
  while (idx < 0 || idx >= n) {
    if (idx < 0) idx = -idx;
    if (idx >= n) idx = 2 * n - 2 - idx;
  }
  return idx;
}

/* ---------- STFT：单声道 float32 -> 复数谱 ----------
 * 返回 { re: Float32Array[bins*frames], im: ..., frames }
 * bins = NFFT/2（丢掉最后一个频点，与 demucs 一致：z[..., :-1, :]）
 */
export function stft(channel, opts = {}) {
  const nfft = opts.nfft || NFFT;
  const hop = opts.hop || HOP;
  const pad = opts.pad !== undefined ? opts.pad : PAD;
  const dropLast = opts.dropLast !== false; // 默认丢最后一个频点

  const x = pad ? reflectPad(channel, pad) : channel;
  const frames = Math.max(1, Math.ceil(x.length / hop));
  const bins = dropLast ? nfft / 2 : nfft / 2 + 1;

  const re = new Float32Array(bins * frames);
  const im = new Float32Array(bins * frames);

  const bufRe = new Float64Array(nfft);
  const bufIm = new Float64Array(nfft);

  for (let f = 0; f < frames; f++) {
    const off = f * hop;
    for (let i = 0; i < nfft; i++) {
      const s = off + i;
      bufRe[i] = s < x.length ? x[s] * WINDOW[i] : 0;
      bufIm[i] = 0;
    }
    FFT.forward(bufRe, bufIm);
    for (let b = 0; b < bins; b++) {
      re[b * frames + f] = bufRe[b];
      im[b * frames + f] = bufIm[b];
    }
  }
  return { re, im, bins, frames, length: channel.length };
}

/* ---------- ISTFT：复数谱 -> 单声道 float32（overlap-add + 窗归一化） ---------- */
export function istft(spec, opts = {}) {
  const nfft = opts.nfft || NFFT;
  const hop = opts.hop || HOP;
  const pad = opts.pad !== undefined ? opts.pad : PAD;
  const outLen = opts.length; // 原始（未 padding 的）长度

  const { re, im, frames } = spec;
  const bins = spec.bins;
  const fullBins = nfft / 2 + 1;

  const total = hop * frames + nfft;
  const acc = new Float32Array(total);
  const wsum = new Float32Array(total);

  const bufRe = new Float64Array(nfft);
  const bufIm = new Float64Array(nfft);

  for (let f = 0; f < frames; f++) {
    bufRe.fill(0);
    bufIm.fill(0);
    for (let b = 0; b < bins; b++) {
      bufRe[b] = re[b * frames + f];
      bufIm[b] = im[b * frames + f];
      // 共轭对称重建（丢掉的最后一个频点本来就是 0 附近）
      if (b > 0 && b < fullBins - 1) {
        bufRe[nfft - b] = bufRe[b];
        bufIm[nfft - b] = -bufIm[b];
      }
    }
    FFT.inverse(bufRe, bufIm);

    const off = f * hop;
    for (let i = 0; i < nfft; i++) {
      const w = WINDOW[i];
      acc[off + i] += bufRe[i] * w;
      wsum[off + i] += w * w;
    }
  }

  const start = pad;
  const end = outLen !== undefined ? start + outLen : acc.length - pad;
  const out = new Float32Array(Math.max(0, end - start));
  for (let i = start; i < end; i++) {
    const w = wsum[i];
    out[i - start] = w > 1e-8 ? acc[i] / w : 0;
  }
  return out;
}

/* ---------- WAV 编码（16bit PCM，立体声） ---------- */
export function encodeWav(left, right, sampleRate = SR) {
  const n = left.length;
  const ch = right ? 2 : 1;
  const bytes = 44 + n * ch * 2;
  const buf = new ArrayBuffer(bytes);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };

  w(0, 'RIFF'); v.setUint32(4, bytes - 8, true); w(8, 'WAVE');
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, ch, true); v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * ch * 2, true); v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * ch * 2, true);

  let o = 44;
  for (let i = 0; i < n; i++) {
    let s = Math.max(-1, Math.min(1, left[i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
    if (ch === 2) {
      s = Math.max(-1, Math.min(1, right[i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}
