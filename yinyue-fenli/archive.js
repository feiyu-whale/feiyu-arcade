/* ============================================================
 * 压缩包自动解压
 * 支持：.zip / .tar / .tar.gz / .tgz
 * 思路：fflate 负责解压，tar 头自己解析（格式很简单）
 * ============================================================ */

const AUDIO_EXT = ['mp3', 'wav', 'flac', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'wma', 'aiff', 'aif', 'webm'];
const VIDEO_EXT = ['mp4', 'mkv', 'mov', 'avi', 'flv', 'wmv', 'm4v', 'mpg', 'mpeg', 'ts', '3gp'];
const ARCHIVE_EXT = ['zip', 'tar', 'gz', 'tgz'];

const JUNK = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|\.git|node_modules)(\/|$)/i;

export function extOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}

export function isArchive(name) {
  const n = (name || '').toLowerCase();
  return n.endsWith('.zip') || n.endsWith('.tar') || n.endsWith('.tar.gz') || n.endsWith('.tgz');
}

export function isMedia(name) {
  const e = extOf(name);
  return AUDIO_EXT.includes(e) || VIDEO_EXT.includes(e);
}

export function isVideo(name) {
  return VIDEO_EXT.includes(extOf(name));
}

/* ---------- tar 头解析 ---------- */
function parseTar(buf) {
  const u8 = new Uint8Array(buf);
  const files = [];
  let off = 0;
  const dec = new TextDecoder();

  const readStr = (o, len) => {
    let end = o;
    while (end < o + len && u8[end] !== 0) end++;
    return dec.decode(u8.subarray(o, end));
  };
  const readOct = (o, len) => {
    const s = readStr(o, len).trim();
    return s ? parseInt(s, 8) : 0;
  };

  while (off + 512 <= u8.length) {
    const name = readStr(off, 100);
    if (!name) break;                       // 遇到全零块 = 结束
    const size = readOct(off + 124, 12);
    const type = String.fromCharCode(u8[off + 156] || 48); // '0'=普通文件
    const prefix = readStr(off + 345, 155); // ustar 长名
    const full = prefix ? prefix + '/' + name : name;
    off += 512;
    if (type === '0' || type === '\0' || u8[off - 512 + 156] === 0) {
      if (size > 0) files.push({ name: full, data: u8.subarray(off, off + size) });
    }
    off += Math.ceil(size / 512) * 512;
  }
  return files;
}

/* ---------- 主入口：返回 [{name, blob}] ---------- */
export async function unarchive(file) {
  const { unzipSync, gunzipSync } = await import(
    'https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js'
  );
  const n = file.name.toLowerCase();
  const buf = new Uint8Array(await file.arrayBuffer());
  let entries = [];

  if (n.endsWith('.zip')) {
    const out = unzipSync(buf);
    entries = Object.entries(out).map(([name, data]) => ({ name, data }));
  } else if (n.endsWith('.tar.gz') || n.endsWith('.tgz')) {
    const raw = gunzipSync(buf);
    entries = parseTar(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  } else if (n.endsWith('.tar')) {
    entries = parseTar(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  } else if (n.endsWith('.gz')) {
    // 单文件压缩：xxx.mp3.gz → xxx.mp3
    const raw = gunzipSync(buf);
    const outName = file.name.replace(/\.gz$/i, '');
    entries = [{ name: outName, data: raw }];
  } else {
    throw new Error('不认识的压缩格式');
  }

  // 过滤垃圾 + 只留媒体文件
  return entries
    .filter((e) => !JUNK.test(e.name) && !e.name.endsWith('/'))
    .filter((e) => isMedia(e.name))
    .map((e) => ({
      name: e.name.split('/').pop(),
      path: e.name,
      blob: new Blob([e.data], { type: guessMime(e.name) }),
    }));
}

function guessMime(name) {
  const e = extOf(name);
  const map = {
    mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg',
    oga: 'audio/ogg', opus: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac',
    webm: 'video/webm', mp4: 'video/mp4', mkv: 'video/x-matroska',
    mov: 'video/quicktime', avi: 'video/x-msvideo', m4v: 'video/mp4',
  };
  return map[e] || 'application/octet-stream';
}
