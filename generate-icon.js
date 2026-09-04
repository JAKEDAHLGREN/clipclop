const fs = require("fs");
const zlib = require("zlib");
const { execSync } = require("child_process");

// ---- Render at 4x supersample (4096x4096), then downscale with sips ----
const BASE = 1024;
const SS = 4;
const W = BASE * SS, H = BASE * SS;
const pixels = Buffer.alloc(W * H * 4, 0);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  const srcA = a / 255;
  const dstA = pixels[i + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA > 0) {
    pixels[i]     = (r * srcA + pixels[i]     * dstA * (1 - srcA)) / outA;
    pixels[i + 1] = (g * srcA + pixels[i + 1] * dstA * (1 - srcA)) / outA;
    pixels[i + 2] = (b * srcA + pixels[i + 2] * dstA * (1 - srcA)) / outA;
    pixels[i + 3] = outA * 255;
  }
}

const S = W;

function fillRect(x1, y1, x2, y2, r, g, b, a = 255) {
  const x1i = Math.max(0, Math.round(x1)), x2i = Math.min(S - 1, Math.round(x2));
  const y1i = Math.max(0, Math.round(y1)), y2i = Math.min(S - 1, Math.round(y2));
  for (let y = y1i; y <= y2i; y++)
    for (let x = x1i; x <= x2i; x++)
      setPixel(x, y, r, g, b, a);
}

// Rounded rect via signed-distance soft edges (per-pixel)
function roundedRect(cx, cy, halfW, halfH, radius, r, g, b, a = 255) {
  for (let y = Math.floor(cy - halfH); y <= Math.ceil(cy + halfH); y++) {
    for (let x = Math.floor(cx - halfW); x <= Math.ceil(cx + halfW); x++) {
      const dx = Math.max(Math.abs(x - cx) - (halfW - radius), 0);
      const dy = Math.max(Math.abs(y - cy) - (halfH - radius), 0);
      const d = Math.sqrt(dx * dx + dy * dy) - radius;
      if (d < 1) setPixel(x, y, r, g, b, a * Math.max(0, Math.min(1, 1 - d)));
    }
  }
}

const px = (v) => v * SS;

// Background: rounded square, dark blue-gray with subtle vertical gradient
const bgTop = { r: 44, g: 46, b: 84 };
const bgBot = { r: 20, g: 21, b: 46 };
for (let y = 0; y < S; y++) {
  const t = y / S;
  const r = Math.round(bgTop.r + (bgBot.r - bgTop.r) * t);
  const g = Math.round(bgTop.g + (bgBot.g - bgTop.g) * t);
  const b = Math.round(bgTop.b + (bgBot.b - bgTop.b) * t);
  for (let x = 0; x < S; x++) {
    // rounded square centered, radius ~22% 
    const dx = Math.max(Math.abs(x - S / 2) - (S / 2 - px(180)), 0);
    const dy = Math.max(Math.abs(y - S / 2) - (S / 2 - px(180)), 0);
    const d = Math.sqrt(dx * dx + dy * dy) - px(180);
    if (d < 1.4) setPixel(x, y, r, g, b, 255 * Math.max(0, Math.min(1, 1.4 - d)));
  }
}

// Clipboard body: light gray rounded rect with border
const body = { cx: S / 2, cy: px(540), halfW: px(280), halfH: px(300), radius: px(56) };
roundedRect(body.cx, body.cy, body.halfW, body.halfH, body.radius, 233, 235, 246, 255);
// border band (slightly larger rounded rect underneath in darker tone)
roundedRect(body.cx, body.cy, body.halfW + px(14), body.halfH + px(14), body.radius + px(14), 122, 124, 150, 255);

// Clip at top: gold rounded rect
const clip = { cx: S / 2, cy: px(215), halfW: px(130), halfH: px(75), radius: px(30) };
roundedRect(clip.cx, clip.cy - px(22), clip.halfW + px(34), px(30), px(26), 180, 130, 52, 255);
roundedRect(clip.cx, clip.cy, clip.halfW, clip.halfH, clip.radius, 216, 160, 74, 255);

// Text lines on clipboard body
const lines = [px(120), px(150), px(138)];
const lineW = px(330);
for (let i = 0; i < lines.length; i++) {
  const y = lines[i];
  const len = lineW - px(30) * (i % 2);
  roundedRect(S / 2, y, len / 2, px(22), px(22), 96, 98, 128, 235);
}

// ---- Encode PNG ----
const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0;
  pixels.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
}

function crc32(buf) {
  let c = 0xffffffff;
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let v = n;
    for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
    table[n] = v;
  }
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const tbd = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(tbd));
  return Buffer.concat([len, tbd, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6;

const compressed = zlib.deflateSync(raw, { level: 9 });
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", compressed),
  chunk("IEND", Buffer.alloc(0)),
]);

const dir = "build";
if (!fs.existsSync(dir)) fs.mkdirSync(dir);
const big = `${dir}/icon.4096.png`;
fs.writeFileSync(big, png);
console.log("Rendered 4096x4096 icon:", big);

// Downscale to 1024 master
execSync(`sips -z 1024 1024 ${big} --out ${dir}/icon.png`, { stdio: "inherit" });
console.log("Master 1024 icon written");