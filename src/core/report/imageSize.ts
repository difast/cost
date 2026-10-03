// Определение размеров PNG/JPEG по заголовку (без внешних зависимостей).
export function imageSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}

export function fitSize(buf: Buffer, maxW: number, maxH: number) {
  const s = imageSize(buf) ?? { width: maxW, height: Math.round(maxW * 0.66) };
  const k = Math.min(1, maxW / s.width, maxH / s.height);
  return { width: Math.round(s.width * k), height: Math.round(s.height * k) };
}
