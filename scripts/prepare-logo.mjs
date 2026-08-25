// Готовит светлую (серебристую) версию логотипа BOOOMERANGS для шапки.
// Источник: boomerangs-logo.webp из репозитория сайта (тёмный логотип).
// Результат: assets/logo-light.png — прозрачный фон, светло-серебристые буквы.
// Запуск: node scripts/prepare-logo.mjs <src.webp>
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const src = process.argv[2] || "/tmp/logo-src.webp";

const img = sharp(src, { density: 300 });
const meta = await img.metadata();

// 1. Инвертируем яркость (тёмные буквы -> светлые), альфу не трогаем.
// 2. Лёгкий серебристый тон через tint.
// 3. Обрезаем по контенту и масштабируем до разумной ширины.
const buf = await sharp(src, { density: 300 })
  .negate({ alpha: false })
  .tint({ r: 226, g: 230, b: 238 })
  .trim()
  .png()
  .toBuffer();

writeFileSync("assets/logo-light.png", buf);
const out = await sharp(buf).metadata();
console.log(`OK assets/logo-light.png ${out.width}x${out.height} (src ${meta.width}x${meta.height})`);
