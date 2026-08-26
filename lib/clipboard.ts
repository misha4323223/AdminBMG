import * as Clipboard from "expo-clipboard";
import { hapticMedium } from "@/lib/haptics";

/**
 * Копирование текста в буфер обмена (натив + web) с тактильным откликом.
 * Возвращает true, если удалось.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    hapticMedium();
    return true;
  } catch {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        hapticMedium();
        return true;
      }
    } catch {}
    return false;
  }
}
