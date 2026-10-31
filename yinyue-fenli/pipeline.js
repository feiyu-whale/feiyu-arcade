/* ============================================================
 * demucs-web · 推理管道
 * 流程：音频 -> 重采样/分声道 -> 7 秒分片 -> STFT -> 4通道打包
 *      -> ONNX -> 掩码 -> 乘回原谱 -> ISTFT -> 重叠拼接
 * ============================================================ */

import { NFFT, HOP, PAD, SR, stft, istft } from './dsp.js';

export const SEGMENT_FRAMES = 302;          // 导出时固定，不能改
export const CHUNK_SAMPLES = SEGMENT_FRAMES * HOP; // 302*1024 = 309248 ≈ 7.01 秒
export const OVERLAP = 0.25;                // 25% 重叠，与 demucs apply_model 一致
export const SOURCES = ['drums', 'bass', 'other', 'vocals'];

/* ---------- 音频解码 + 转 44.1k 立体声 ---------- */
export async function decodeToStereo(arrayBuffer) {
  const ctx = new OfflineAudioContext(2, 1, SR);
  const decoded = await ctx.decodeAudioData(arrayBuffer);
  if (decoded.numberOfChannels >= 2 && decoded.sampleRate === SR) {
    return [decoded.getChannelData(0), decoded.getChannelData(1)];
  }
  // 需要重采样
  const len = Math.ceil((decoded.length / decoded.sampleRate) * SR);
  const off = new OfflineAudioContext(2, len, SR);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const out = await off.startRendering();
  return [out.getChannelData(0), out.getChannelData(1)];
}

/* ---------- 把一帧（4 通道实数谱）拼成 ONNX 输入 ---------- */
/* 输入形状 [1, 4, 2048, T]：左实、左虚、右实、右虚 */
function packInput(specL, specR, frames) {
  const bins = specL.bins; // 2048
  const n = 4 * bins * frames;
  const arr = new Float32Array(n);
  const plane = bins * frames;
  for (let f = 0; f < frames; f++) {
    for (let b = 0; b < bins; b++) {
      const i = b * frames + f;
      const o = b * frames + f;
      arr[0 * plane + o] = specL.re[i];
      arr[1 * plane + o] = specL.im[i];
      arr[2 * plane + o] = specR.re[i];
      arr[3 * plane + o] = specR.im[i];
    }
  }
  return arr;
}

/* ---------- 从 ONNX 输出解出某音轨的 4 通道掩码 ---------- */
/* 输出形状 [1, 4(音轨), 4(通道), 2048, T] */
function unpackMask(data, srcIdx, frames, bins) {
  const plane = bins * frames;
  const base = srcIdx * 4 * plane;
  return {
    re: data.subarray(base + 0 * plane, base + 1 * plane),
    im: data.subarray(base + 1 * plane, base + 2 * plane),
    // 另外两个平面同理，由调用方按声道取
    _base: base,
    _plane: plane,
    _data: data,
  };
}

/* ---------- 复数乘法：(a+bi)(c+di) ---------- */
function cmul(ar, ai, br, bi) {
  return [ar * br - ai * bi, ar * bi + ai * br];
}

/* ---------- 主流程 ---------- */
export async function separate(session, left, right, { onProgress, signal } = {}) {
  const total = left.length;
  const chunk = CHUNK_SAMPLES;
  const stride = Math.floor(chunk * (1 - OVERLAP));

  // 每轨累积缓冲
  const acc = SOURCES.map(() => [new Float32Array(total), new Float32Array(total)]);
  const wsum = new Float32Array(total);

  // 汉宁窗加权（用于分片重叠平均）
  const win = new Float32Array(chunk);
  for (let i = 0; i < chunk; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / chunk);

  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];

  let pos = 0;
  let step = 0;
  const steps = Math.max(1, Math.ceil((total - chunk) / stride) + 1);

  while (pos < total) {
    if (signal?.aborted) throw new Error('已取消');

    const end = Math.min(pos + chunk, total);
    const len = end - pos;

    // 取片（不足则补零到固定长度）
    const chunkL = new Float32Array(chunk);
    const chunkR = new Float32Array(chunk);
    chunkL.set(left.subarray(pos, end));
    chunkR.set(right.subarray(pos, end));

    // STFT：每声道得到 [2048, frames] 复数谱
    const specL = stft(chunkL, { dropLast: true });
    const specR = stft(chunkR, { dropLast: true });

    // 时长必须正好 302 帧
    let frames = specL.frames;
    if (frames > SEGMENT_FRAMES) {
      // 截断
      frames = SEGMENT_FRAMES;
      specL.re = specL.re.slice(0, specL.bins * frames);
      specL.im = specL.im.slice(0, specL.bins * frames);
      specR.re = specR.re.slice(0, specR.bins * frames);
      specR.im = specR.im.slice(0, specR.bins * frames);
      specL.frames = specR.frames = frames;
    } else if (frames < SEGMENT_FRAMES) {
      // 补齐（补零）
      const padFrames = SEGMENT_FRAMES - frames;
      const padLen = specL.bins * padFrames;
      const ex = (a) => { const b = new Float32Array(a.length + padLen); b.set(a); return b; };
      specL.re = ex(specL.re); specL.im = ex(specL.im);
      specR.re = ex(specR.re); specR.im = ex(specR.im);
      frames = SEGMENT_FRAMES;
      specL.frames = specR.frames = frames;
    }

    const bins = specL.bins; // 2048

    // 打包 -> ONNX
    const input = packInput(specL, specR, frames);
    const feeds = {};
    feeds[inputName] = new (await getTensorCtor(session))(input, [1, 4, bins, frames]);
    const outputs = await session.run(feeds);
    const mask = outputs[outputName].data;
    const plane = bins * frames;

    // 逐音轨还原时域
    for (let s = 0; s < SOURCES.length; s++) {
      const mBase = s * 4 * plane;
      // 左声道用平面 0(实) / 1(虚)，右声道用 2 / 3
      const outL = applyMask(specL, mask, mBase + 0 * plane, mBase + 1 * plane, frames);
      const outR = applyMask(specR, mask, mBase + 2 * plane, mBase + 3 * plane, frames);

      const wavL = istft(outL, { length: len });
      const wavR = istft(outR, { length: len });

      const aL = acc[s][0], aR = acc[s][1];
      for (let i = 0; i < len; i++) {
        const w = win[i];
        aL[pos + i] += wavL[i] * w;
        aR[pos + i] += wavR[i] * w;
      }
    }
    for (let i = 0; i < len; i++) wsum[pos + i] += win[i];

    step++;
    onProgress?.(step / steps, pos / total);

    if (end >= total) break;
    pos += stride;

    // 让出主线程，避免页面卡死
    await new Promise((r) => setTimeout(r, 0));
  }

  // 归一化
  const result = {};
  for (let s = 0; s < SOURCES.length; s++) {
    const aL = acc[s][0], aR = acc[s][1];
    for (let i = 0; i < total; i++) {
      const w = wsum[i];
      if (w > 1e-6) { aL[i] /= w; aR[i] /= w; }
    }
    result[SOURCES[s]] = [aL, aR];
  }
  return result;
}

/* 掩码复用于频谱：spec 复数 × mask 复数 */
function applyMask(spec, mask, reOff, imOff, frames) {
  const bins = spec.bins;
  const re = new Float32Array(bins * frames);
  const im = new Float32Array(bins * frames);
  for (let i = 0; i < bins * frames; i++) {
    const [r, m] = cmul(spec.re[i], spec.im[i], mask[reOff + i], mask[imOff + i]);
    re[i] = r; im[i] = m;
  }
  return { re, im, bins, frames };
}

let _TensorCtor = null;
async function getTensorCtor() {
  if (_TensorCtor) return _TensorCtor;
  const ort = window.ort;
  _TensorCtor = ort.Tensor;
  return _TensorCtor;
}
