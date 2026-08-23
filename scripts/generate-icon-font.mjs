// Генерирует lib/ionicons-font-data.ts с шрифтом Ionicons в base64.
// Запуск: bun run gen:fonts (или node scripts/generate-icon-font.mjs)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ttfPath = path.join(
  root,
  "node_modules",
  "@expo",
  "vector-icons",
  "build",
  "vendor",
  "react-native-vector-icons",
  "Fonts",
  "Ionicons.ttf"
);
const outPath = path.join(root, "lib", "ionicons-font-data.ts");

const buf = readFileSync(ttfPath);
const b64 = buf.toString("base64");

const content = `// СГЕНЕРИРОВАНО автоматически: scripts/generate-icon-font.mjs — не редактировать вручную.
// Шрифт Ionicons встроен как base64, чтобы иконки работали без сетевой загрузки
// (браузер, Electron, прокси — везде одинаково).
export const IONICONS_FONT_FAMILY = "ionicons";
export const IONICONS_TTF_BASE64 =
  "${b64}";
`;

writeFileSync(outPath, content);
console.log(`✅ ${path.relative(root, outPath)} создан (${Math.round(buf.length / 1024)} KB шрифта)`);
