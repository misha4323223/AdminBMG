import { getStoredJson, setStoredJson } from "@/lib/storage";

/**
 * «Недавние»: последние открытые заказы/товары, чтобы возвращаться
 * к ним одним тапом с главной. Хранится локально (SecureStore/localStorage).
 */

export type RecentType = "order" | "product";

export interface RecentItem {
  type: RecentType;
  id: number;
  label: string;
  ts: number;
}

const RECENT_KEY = "admin_recent";
const MAX_ITEMS = 8;

export async function getRecent(): Promise<RecentItem[]> {
  const data = await getStoredJson(RECENT_KEY);
  return Array.isArray(data) ? (data as RecentItem[]) : [];
}

/** Записать открытый заказ/товар. Дубли обновляются, лимит соблюдается. */
export async function recordRecent(type: RecentType, id: number, label: string): Promise<void> {
  const current = await getRecent();
  const next = [
    { type, id, label, ts: Date.now() },
    ...current.filter((r) => !(r.type === type && r.id === id)),
  ].slice(0, MAX_ITEMS);
  await setStoredJson(RECENT_KEY, next);
}

/** Убрать один пункт из «Недавних» (например, свайпом с главной). */
export async function removeRecent(type: RecentType, id: number): Promise<void> {
  const current = await getRecent();
  await setStoredJson(
    RECENT_KEY,
    current.filter((r) => !(r.type === type && r.id === id)),
  );
}

export async function clearRecent(): Promise<void> {
  await setStoredJson(RECENT_KEY, []);
}
