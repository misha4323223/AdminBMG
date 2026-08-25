// Генератор иконок AdminBMG: тёмный фон + оранжевый бумеранг (фирменные цвета).
// Запуск: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const S = 1024; // размер холста
const BG = [11, 11, 15]; // #0b0b0f
const ORANGE_TOP = [255, 138, 61]; // #ff8a3d
const ORANGE_BOT = [255, 90, 31]; // #ff5a1f
const GLOW = [42, 22, 16]; // #2a1610

// --- минимальный PNG-энкодер ---
const crcTable = (() => {
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
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- геометрия бумеранга (галочка/V с круглыми концами) ---
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx,
    cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
function scalePt(p, c, k) {
  return [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k];
}

/**
 * Рисует бумеранг на холсте.
 * @param transparentBg true — прозрачный фон (для adaptive/splash)
 * @param shrink масштаб фигуры относительно центра
 */
function render({ transparentBg = false, shrink = 1 } = {}) {
  const buf = Buffer.alloc(S * S * 4);
  const C = [S / 2, S / 2];
  // опорные точки формы «бумеранг»
  let A = [268, 296],
    B = [512, 744],
    D = [756, 296];
  let r = 92;
  if (shrink !== 1) {
    A = scalePt(A, C, shrink);
    B = scalePt(B, C, shrink);
    D = scalePt(D, C, shrink);
    r *= shrink;
  }
  const glowC = [C[0], C[1] - 20];
  const glowR = S * 0.52;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      let col = null;
      // свечение под фигурой
      const gd = Math.hypot(x - glowC[0], y - glowC[1]) / glowR;
      const glow = Math.max(0, 1 - gd) ** 2 * 0.9;

      // расстояние до двух рёбер бумеранга
      const d = Math.min(distToSeg(x, y, ...A, ...B), distToSeg(x, y, ...B, ...D));
      const edge = r - d;
      if (edge > -2) {
        // вертикальный градиент по форме
        const t = Math.max(0, Math.min(1, (y - A[1]) / (B[1] - A[1])));
        const base = [
          ORANGE_TOP[0] + (ORANGE_BOT[0] - ORANGE_TOP[0]) * t,
          ORANGE_TOP[1] + (ORANGE_BOT[1] - ORANGE_TOP[1]) * t,
          ORANGE_TOP[2] + (ORANGE_BOT[2] - ORANGE_TOP[2]) * t,
        ];
        // мягкое ребро (сглаживание 2px)
        const a = Math.max(0, Math.min(1, (edge + 2) / 4));
        col = base.map((v) => v * a);
        if (!transparentBg && a > 0) {
          // под фигурой просвечивает фон+свечение
          col = col.map((v, ch) => v + (BG[ch] + GLOW[ch] * glow) * (1 - a));
        }
      }

      if (col === null) {
        if (transparentBg) {
          buf[i + 3] = 0;
          continue;
        }
        col = [BG[0] + GLOW[0] * glow, BG[1] + GLOW[1] * glow, BG[2] + GLOW[2] * glow];
      }
      buf[i] = Math.round(Math.min(255, col[0]));
      buf[i + 1] = Math.round(Math.min(255, col[1]));
      buf[i + 2] = Math.round(Math.min(255, col[2]));
      buf[i + 3] = transparentBg ? Math.round(255 * Math.max(0, Math.min(1, (edge + 2) / 4))) : 255;
    }
  }
  return encodePng(S, S, buf);
}

mkdirSync(path.resolve("assets"), { recursive: true });
writeFileSync(path.resolve("assets/icon.png"), render({ transparentBg: false }));
console.log("✓ assets/icon.png");
writeFileSync(
  path.resolve("assets/adaptive-icon.png"),
  render({ transparentBg: true, shrink: 0.66 })
);
console.log("✓ assets/adaptive-icon.png");
writeFileSync(path.resolve("assets/splash-icon.png"), render({ transparentBg: true }));
console.log("✓ assets/splash-icon.png");
console.log("Готово.");
