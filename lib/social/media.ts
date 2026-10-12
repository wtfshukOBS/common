import { createHmac } from "node:crypto";
export function identifyImage(data: Uint8Array, mime: string) {
  if (mime === "image/png")
    return (
      data[0] === 137 &&
      data[1] === 80 &&
      data[2] === 78 &&
      data[3] === 71 &&
      data[4] === 13 &&
      data[5] === 10
    );
  if (mime === "image/jpeg")
    return data[0] === 255 && data[1] === 216 && data[2] === 255;
  if (mime === "image/webp")
    return (
      new TextDecoder().decode(data.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(data.slice(8, 12)) === "WEBP"
    );
  return false;
}
export function mp4Duration(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let i = 4; i < data.length - 32; i++) {
    if (
      data[i] === 109 &&
      data[i + 1] === 118 &&
      data[i + 2] === 104 &&
      data[i + 3] === 100
    ) {
      const size = view.getUint32(i - 4);
      if (size < 32 || size > data.length - (i - 4)) continue;
      const version = data[i + 4];
      let scale = 0,
        duration = 0;
      if (version === 0) {
        scale = view.getUint32(i + 16);
        duration = view.getUint32(i + 20);
      } else if (version === 1 && i + 36 < data.length) {
        scale = view.getUint32(i + 24);
        duration = Number(view.getBigUint64(i + 28));
      }
      if (scale > 0 && duration > 0)
        return Math.round((duration / scale) * 1000) / 1000;
    }
  }
  return null;
}
export function validationSignature(
  id: string,
  size: number,
  duration: number,
) {
  const key = process.env.MEDIA_VALIDATION_SECRET;
  if (!key)
    throw new Error("Media uploads are being configured. Try again shortly.");
  return createHmac("sha256", key)
    .update(id + ":" + size + ":" + duration)
    .digest("hex");
}
