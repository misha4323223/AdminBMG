import { Platform } from "react-native";

/**
 * Хаптика: лёгкий тактильный отклик на действия пользователя.
 * На web и при отсутствии модуля — тихо ничего не делает.
 */

type HapticsModule = typeof import("expo-haptics");

// Динамический require, чтобы web-сборка не тянула нативный модуль.
let Haptics: HapticsModule | null = null;
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Haptics = require("expo-haptics") as HapticsModule;
  } catch {
    Haptics = null;
  }
}

/** Лёгкий клик — нажатия кнопок, выбор чипов, начало перетаскивания. */
export function hapticLight(): void {
  try {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}

/** Средний отклик — успешное сохранение, перемещение элемента. */
export function hapticMedium(): void {
  try {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
}

/** Успех — действие завершилось успешно (сохранение, одобрение). */
export function hapticSuccess(): void {
  try {
    Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}

/** Предупреждение — не критичная ошибка, «есть замечания». */
export function hapticWarning(): void {
  try {
    Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {}
}

/** Ошибка — действие провалилось. */
export function hapticError(): void {
  try {
    Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {}
}
