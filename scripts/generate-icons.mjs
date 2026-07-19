// Generates CardsGuru PWA icons as PNGs with no external dependencies.
// Renders the brand mark (a vibrant gradient tile with a white credit card and a
// sparkle, matching public/favicon.svg) full-bleed for maskable safety, encoding
// PNG via Node's zlib.
import zlib from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const SS = 3; // supersampling factor for anti-aliasing

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const blend = (dst, src, a) => [lerp(dst[0], src[0], a), lerp(dst[1], src[1], a), lerp(dst[2], src[2], a)];

const BLUE = [124, 196, 255];
const VIOLET = [169, 139, 255];
const PINK = [255, 143, 208];
const WHITE = [255, 255, 255];
const CARD_EDGE = [232, 239, 252];
const STRIPE = [35, 42, 61];
const GOLD = [242, 209, 128];
const ACCENT = [169, 139, 255];

function insideRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const rr = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
  const cx = x < x0 + rr ? x0 + rr : x > x1 - rr ? x1 - rr : x;
  const cy = y < y0 + rr ? y0 + rr : y > y1 - rr ? y1 - rr : y;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= rr * rr;
}

function colorAt(x, y, N) {
  // Full-bleed diagonal brand gradient (maskable-safe — no transparent corners).
  const t = (x + y) / (2 * N);
  let color = t < 0.5 ? mix(BLUE, VIOLET, t * 2) : mix(VIOLET, PINK, (t - 0.5) * 2);

  // Soft top-left sheen.
  const sheen = 1 - Math.min(1, (x + y) / (N * 0.9));
  if (sheen > 0) color = blend(color, WHITE, sheen * 0.14);

  // White credit card, centered (safe zone for maskable icons).
  const x0 = 0.172 * N;
  const x1 = 0.828 * N;
  const y0 = 0.359 * N;
  const y1 = 0.781 * N;
  const radius = 0.078 * N;

  // Soft drop shadow beneath the card.
  if (insideRoundedRect(x, y - 0.016 * N, x0, y0, x1, y1 + 0.022 * N, radius)) {
    color = blend(color, [0, 0, 0], 0.2);
  }

  if (insideRoundedRect(x, y, x0, y0, x1, y1, radius)) {
    // Card face with a faint vertical shade.
    color = mix(WHITE, CARD_EDGE, (y - y0) / (y1 - y0));

    // Magnetic stripe near the top.
    const sy0 = y0 + 0.2 * (y1 - y0);
    const sy1 = y0 + 0.41 * (y1 - y0);
    if (y >= sy0 && y <= sy1) color = STRIPE;

    // Chip (gold), lower-left.
    if (insideRoundedRect(x, y, x0 + 0.075 * N, y0 + 0.6 * (y1 - y0), x0 + 0.215 * N, y0 + 0.87 * (y1 - y0), 0.028 * N)) {
      color = GOLD;
    }

    // Accent number bar.
    if (insideRoundedRect(x, y, x0 + 0.27 * N, y0 + 0.7 * (y1 - y0), x0 + 0.55 * N, y0 + 0.82 * (y1 - y0), 0.02 * N)) {
      color = ACCENT;
    }
  }

  // Sparkle (top-right): a concave 4-point star (astroid).
  const scx = 0.758 * N;
  const scy = 0.235 * N;
  const sr = 0.11 * N;
  const sdx = Math.abs(x - scx);
  const sdy = Math.abs(y - scy);
  if (Math.pow(sdx, 2 / 3) + Math.pow(sdy, 2 / 3) <= Math.pow(sr, 2 / 3)) {
    color = WHITE;
  }

  return color;
}

function renderRGBA(N) {
  const M = N * SS;
  const out = Buffer.alloc(N * N * 4);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sj = 0; sj < SS; sj++) {
        for (let si = 0; si < SS; si++) {
          const x = (i * SS + si + 0.5) / SS;
          const y = (j * SS + sj + 0.5) / SS;
          const c = colorAt(x, y, N);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const n = SS * SS;
      const idx = (j * N + i) * 4;
      out[idx] = Math.round(r / n);
      out[idx + 1] = Math.round(g / n);
      out[idx + 2] = Math.round(b / n);
      out[idx + 3] = 255;
    }
  }
  return { data: out, size: N, big: M };
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function encodePNG(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const targets = [
  { size: 512, file: 'pwa-512x512.png' },
  { size: 192, file: 'pwa-192x192.png' },
  { size: 180, file: 'apple-touch-icon.png' },
  { size: 32, file: 'favicon-32x32.png' },
];

for (const { size, file } of targets) {
  const { data } = renderRGBA(size);
  const png = encodePNG(data, size);
  writeFileSync(path.join(OUT_DIR, file), png);
  console.log(`wrote public/${file} (${png.length} bytes)`);
}
