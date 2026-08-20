import { execSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktop = path.join(root, "desktop");
const desktopDist = path.join(desktop, "dist");

function pickPm() {
  try {
    execSync("bun --version", { stdio: "ignore" });
    return "bun";
  } catch {
    try {
      execSync("npm --version", { stdio: "ignore" });
      return "npm";
    } catch {
      console.error(
        "❌ Не найден ни bun, ни npm. Установи Bun (https://bun.sh) или Node.js (https://nodejs.org)."
      );
      process.exit(1);
    }
  }
}

const pm = pickPm();
console.log(`Использую пакетный менеджер: ${pm}`);

const step = (msg) => console.log(`\n=== ${msg} ===`);

step("1/4 Сборка web-версии (expo export)");
execSync(`${pm} run export:web`, { cwd: root, stdio: "inherit" });

step("2/4 Копирование web-сборки в desktop/dist");
rmSync(desktopDist, { recursive: true, force: true });
cpSync(path.join(root, "dist"), desktopDist, { recursive: true });

step("3/4 Установка Electron (electron + electron-builder)");
execSync(`${pm} install`, { cwd: desktop, stdio: "inherit" });

step("4/4 Сборка Windows-установщика (.exe)");
execSync(`${pm} run dist`, { cwd: desktop, stdio: "inherit" });

console.log("\n✅ Готово! Установщик лежит в папке: desktop/release/");
