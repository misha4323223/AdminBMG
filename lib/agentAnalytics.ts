/**
 * Локальная аналитика для чата BOOOM AI.
 *
 * Серверный агент (/admin/agent/chat) умеет только одиночные инструменты
 * (get_orders, get_stats…) и не умеет агрегировать («на какую сумму заказали
 * мерч N?»). Такие вопросы перехватываем здесь: считаем сами по
 * /admin/orders — тому же эндпоинту, что использует раздел «Заказы».
 */
import { apiGet } from "./api";
import type { Order, OrderItem, Product } from "./types";

/** Слова-«стопперы», которые не являются названием товара. */
const STOP_WORDS = new Set([
  "на",
  "какую",
  "какая",
  "какой",
  "сумма",
  "сумму",
  "сумме",
  "суммы",
  "общая",
  "общий",
  "итого",
  "всего",
  "сколько",
  "стоимость",
  "стоило",
  "стоит",
  "стоят",
  "заказали",
  "заказать",
  "заказа",
  "заказов",
  "заказ",
  "заказы",
  "заказано",
  "купили",
  "куплено",
  "купили",
  "покупали",
  "покупок",
  "покупки",
  "приобрели",
  "продали",
  "продаж",
  "продажи",
  "выручка",
  "выручку",
  "выручки",
  "оборот",
  "оборота",
  "было",
  "были",
  "была",
  "суммарно",
  "мерч",
  "мерча",
  "мерче",
  "товар",
  "товара",
  "товары",
  "товаров",
  "позиции",
  "позиций",
  "штук",
  "шт",
  "руб",
  "рублей",
  "за",
  "все",
  "всё",
  "время",
  "сегодня",
  "вчера",
  "неделю",
  "недели",
  "месяц",
  "месяца",
  "год",
  "года",
  "и",
  "в",
  "по",
  "с",
  "от",
  "до",
  "у",
  "нас",
]);

const ANALYTICS_RE =
  /(выручк|оборот|продаж)|((сумм|сколько|на какую|итого)[^.\n]*(заказ|куп|прода|приобрет))|((заказали|купили|продали)[^.\n]*сумм)/i;

/** Команды-изменения не перехватываем — их ведёт серверный агент. */
const WRITE_CMD_RE =
  /(промокод|созда|измени|обнови|удали|скрой|скрыть|поменяй|отправь|напиши|запиши)/i;

interface Period {
  label: string;
  from: Date | null;
}

function detectPeriod(cmdLower: string): Period {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (/сегодняшн|за сегодня/.test(cmdLower)) return { label: "сегодня", from: startOfToday };
  if (/вчерашн|за вчера/.test(cmdLower))
    return { label: "вчера", from: new Date(startOfToday.getTime() - 86_400_000) };
  if (/недел|7\s*дн/.test(cmdLower))
    return { label: "последние 7 дней", from: new Date(now.getTime() - 7 * 86_400_000) };
  if (/30\s*дн/.test(cmdLower))
    return { label: "последние 30 дней", from: new Date(now.getTime() - 30 * 86_400_000) };
  if (/месяц/.test(cmdLower))
    return { label: "последний месяц", from: new Date(now.getTime() - 31 * 86_400_000) };
  if (/\bгод\b|за год/.test(cmdLower))
    return { label: "последний год", from: new Date(now.getTime() - 365 * 86_400_000) };
  return { label: "за всё время", from: null };
}

function extractTokens(cmd: string): string[] {
  return Array.from(
    new Set(
      cmd
        .toLowerCase()
        .replace(/[^a-zа-яё0-9\s-]/gi, " ")
        .split(/\s+/)
        .filter(
          (w) =>
            w.length >= 3 &&
            !STOP_WORDS.has(w) &&
            !/^\d+$/.test(w),
        ),
    ),
  );
}

function itemName(item: OrderItem): string {
  const raw = item.name ?? (item as Record<string, unknown>).productName;
  return typeof raw === "string" ? raw.toLowerCase() : "";
}

function rub(kopecks: number): string {
  return `${Math.round(kopecks / 100).toLocaleString("ru-RU")} ₽`;
}

/**
 * Пытается ответить на аналитический вопрос локально.
 * Возвращает текст ответа или null, если это не аналитика
 * (тогда команду получает обычный серверный агент).
 */
export async function tryLocalOrderAnalytics(command: string): Promise<string | null> {
  if (!ANALYTICS_RE.test(command)) return null;
  if (WRITE_CMD_RE.test(command)) return null;

  const cmdLower = command.toLowerCase();
  const period = detectPeriod(cmdLower);
  let tokens = extractTokens(command);

  let orders: Order[];
  try {
    orders = await apiGet<Order[]>("/admin/orders");
  } catch {
    return null; // не смогли получить данные — пусть отвечает серверный агент
  }

  const eligible = orders.filter((o) => {
    if ((o as Record<string, unknown>).isDraft) return false;
    if (o.status === "cancelled") return false;
    if (!o.items || !Array.isArray(o.items)) return false;
    if (period.from && o.createdAt && new Date(o.createdAt) < period.from) return false;
    return true;
  });

  // Ослабление поиска: слова, которых нет ни в одном названии товара
  // («продалось», «заказали», «сколько»…), отбрасываем — остаются только
  // реально встречающиеся части названий.
  if (tokens.length) {
    const allNames: string[] = [];
    for (const o of eligible)
      for (const it of o.items || []) {
        const n = itemName(it);
        if (n) allNames.push(n);
      }
    tokens = tokens.filter((t) => allNames.some((n) => n.includes(t)));
  }

  interface Agg {
    name: string;
    qty: number;
    amount: number;
  }
  const byItem = new Map<string, Agg>();
  let totalAmount = 0;
  let totalQty = 0;
  const ordersWithMatch = new Set<number>();

  for (const o of eligible) {
    for (const item of o.items || []) {
      const name = itemName(item);
      if (!name) continue;
      if (tokens.length && !tokens.every((t) => name.includes(t))) continue;
      const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
      const price = Number(item.price) || 0;
      const amount = price * qty;
      totalAmount += amount;
      totalQty += qty;
      ordersWithMatch.add(o.id);
      const key = name;
      const agg = byItem.get(key) || { name, qty: 0, amount: 0 };
      agg.qty += qty;
      agg.amount += amount;
      byItem.set(key, agg);
    }
  }

  const subject = tokens.length ? `«${tokens.join(" ")}»` : "по всем товарам";
  const lines: string[] = [`📊 ${subject} — ${rub(totalAmount)} (${period.label}).`];

  if (!eligible.length) {
    lines.push("Заказов за выбранный период нет.");
    return lines.join("\n");
  }

  if (tokens.length && !byItem.size) {
    lines.push(
      `Товаров с названием ${subject} в заказах не найдено — показываю общие итоги.`,
    );
  }

  if (!tokens.length || byItem.size === 0) {
    // Общие итоги периода без фильтра по названию.
    let allAmount = 0;
    let allQty = 0;
    for (const o of eligible)
      for (const it of o.items || []) {
        const qty = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
        allAmount += (Number(it.price) || 0) * qty;
        allQty += qty;
      }
    lines.push(`Всего заказано на ${rub(allAmount)} (${allQty} позиций, заказов: ${eligible.length}).`);
    return lines.join("\n");
  }

  lines.push(`Позиций: ${totalQty}, заказов с ними: ${ordersWithMatch.size}.`);

  const top = [...byItem.values()].sort((a, b) => b.amount - a.amount).slice(0, 8);
  if (top.length) {
    lines.push("Топ позиций:");
    for (const t of top) {
      lines.push(
        `• ${t.name} — ${t.qty} шт. на ${rub(t.amount)}`,
      );
    }
    if (byItem.size > top.length) lines.push(`…и ещё ${byItem.size - top.length} поз.`);
  }

  return lines.join("\n");
}

/** Утреннее резюме: заказы за 24ч, зависшие заказы, проблемы каталога. */
async function buildDigest(): Promise<string> {
  const [orders, products] = await Promise.all([
    apiGet<Order[]>("/admin/orders"),
    fetchAdminProducts(),
  ]);

  const now = Date.now();
  const dayAgo = now - 86_400_000;
  const real = orders.filter(
    (o) => !(o as Record<string, unknown>).isDraft && o.status !== "cancelled"
  );
  const last24 = real.filter((o) => o.createdAt && new Date(o.createdAt).getTime() >= dayAgo);
  const revenue24 = last24.reduce((s, o) => s + itemSum(o), 0);
  const paid = new Set(["paid", "shipped", "delivered"]);
  const paidRevenueAll = real
    .filter((o) => paid.has(o.status || ""))
    .reduce((s, o) => s + itemSum(o), 0);
  const stuckOrders = real.filter(
    (o) =>
      ["paid", "processing", "awaiting_payment"].includes(o.status || "") &&
      o.createdAt &&
      now - new Date(o.createdAt).getTime() > 3 * 86_400_000
  );
  const prods = products as Array<Record<string, unknown>>;
  const noSeo = prods.filter((p) => !p.seoTitle || !p.seoDescription);
  const hidden = prods.filter((p) => p.isHidden);
  const noStock = prods.filter((p) => !p.isHidden && Number(p.stock) === 0);

  const lines: string[] = [
    `🌅 Доброе утро! Сводка BOOOM AI:`,
    ``,
    `📦 За 24 часа: ${last24.length} заказ(ов) на ${rub(revenue24)}.`,
    `💰 Выручка (оплаченные, всё время): ${rub(paidRevenueAll)}.`,
  ];
  if (last24.length) {
    lines.push("Последние заказы:");
    for (const o of last24.slice(-5)) {
      lines.push(
        `• №${o.id} — ${o.customerName || "—"}, ${Math.round(itemSum(o) / 100).toLocaleString("ru-RU")} ₽, ${o.status || "—"}`
      );
    }
  }
  lines.push(``, `⚠️ Требует внимания:`);
  if (stuckOrders.length)
    lines.push(`• ${stuckOrders.length} заказ(ов) висят в обработке дольше 3 дней («покажи зависшие заказы»)`);
  if (noSeo.length)
    lines.push(`• ${noSeo.length} товар(ов) без SEO-заголовка/описания («товары без seo»)`);
  if (noStock.length)
    lines.push(`• ${noStock.length} видимых товар(ов) с нулевым остатком («нет в наличии»)`);
  if (hidden.length) lines.push(`• ${hidden.length} скрытых товар(ов)`);
  if (!stuckOrders.length && !noSeo.length && !noStock.length)
    lines.push("• Всё чисто, проблем не найдено 👍");

  return lines.join("\n");
}

/** Поиск проблем по ключевому слову в запросе. */
async function findProblems(command: string): Promise<string | null> {
  const cmdLower = command.toLowerCase();
  const wantsSeo = /без\s*seo|без описания|не заполнен/.test(cmdLower);
  const wantsStuck = /висят|висит|зависли|зависших/.test(cmdLower);
  const wantsStock = /нет в наличии|закончил|нулевой остаток|out of stock/.test(cmdLower);
  // Если ни одна конкретная проблема не названа — это общий вопрос о проблемах,
  // покажем всё сразу.
  const showAll = !wantsSeo && !wantsStuck && !wantsStock;

  const [orders, products] = await Promise.all([
    apiGet<Order[]>("/admin/orders"),
    fetchAdminProducts(),
  ]);
  const now = Date.now();
  const real = orders.filter(
    (o) => !(o as Record<string, unknown>).isDraft && o.status !== "cancelled"
  );
  const prods = products as Array<Record<string, unknown>>;

  if (wantsStuck || showAll) {
    const stuck = real.filter(
      (o) =>
        ["paid", "processing", "awaiting_payment"].includes(o.status || "") &&
        o.createdAt &&
        now - new Date(o.createdAt).getTime() > 3 * 86_400_000
    );
    if (wantsStuck) {
      if (!stuck.length) return "✅ Зависших заказов нет — всё обработано вовремя.";
      const lines = [`⏳ Зависшие заказы (${stuck.length}):`];
      for (const o of stuck.slice(0, 15)) {
        const days = Math.floor((now - new Date(o.createdAt!).getTime()) / 86_400_000);
        lines.push(`• №${o.id} — ${o.customerName || "—"}, ${days} дн., ${o.status}`);
      }
      if (stuck.length > 15) lines.push(`…и ещё ${stuck.length - 15}`);
      return lines.join("\n");
    }
  }

  if (wantsSeo || showAll) {
    const noSeo = prods.filter((p) => !p.seoTitle || !p.seoDescription);
    if (wantsSeo) {
      if (!noSeo.length) return "✅ У всех товаров заполнены SEO-заголовки и описания.";
      const lines = [`🔍 Товаров без SEO: ${noSeo.length}. Первые:`];
      for (const p of noSeo.slice(0, 12)) {
        lines.push(`• [ID: ${p.id}] ${p.name}${p.isHidden ? " 🚫" : ""}`);
      }
      if (noSeo.length > 12) lines.push(`…и ещё ${noSeo.length - 12}`);
      return lines.join("\n");
    }
  }

  if (wantsStock || showAll) {
    const noStock = prods.filter((p) => !p.isHidden && Number(p.stock) === 0);
    if (wantsStock) {
      if (!noStock.length) return "✅ Все видимые товары есть в наличии.";
      const lines = [`📦 Видимых товаров с нулевым остатком: ${noStock.length}:`];
      for (const p of noStock.slice(0, 12)) {
        lines.push(`• [ID: ${p.id}] ${p.name}`);
      }
      if (noStock.length > 12) lines.push(`…и ещё ${noStock.length - 12}`);
      return lines.join("\n");
    }
  }

  if (showAll) {
    const stuck = real.filter(
      (o) =>
        ["paid", "processing", "awaiting_payment"].includes(o.status || "") &&
        o.createdAt &&
        now - new Date(o.createdAt).getTime() > 3 * 86_400_000
    );
    const noSeo = prods.filter((p) => !p.seoTitle || !p.seoDescription);
    const noStock = prods.filter((p) => !p.isHidden && Number(p.stock) === 0);
    return [
      `⚠️ Проблемы магазина:`,
      `• Зависших заказов (>3 дней): ${stuck.length}`,
      `• Товаров без SEO: ${noSeo.length}`,
      `• Видимых товаров без остатка: ${noStock.length}`,
      ``,
      `Уточни: «покажи зависшие заказы», «товары без seo», «нет в наличии».`,
    ].join("\n");
  }

  return null;
}

/**
 * Локальный перехват ТОЛЬКО того, чего у серверного агента нет:
 * утреннее резюме и поиск проблем. Аналитика продаж больше НЕ перехватывается —
 * сервер умеет analyze_orders через Groq и понимает естественную речь лучше.
 */
export async function tryLocalAssistant(command: string): Promise<string | null> {
  try {
    if (DIGEST_RE.test(command)) return await buildDigest();
    if (PROBLEMS_RE.test(command)) {
      const res = await findProblems(command);
      if (res !== null) return res;
    }
  } catch {
    // данные недоступны — пусть пробует серверный агент
  }
  return null;
}

/**
 * Мгновенный фолбэк при ошибке сервера: считаем аналитику продаж,
 * резюме и проблемы на клиенте, чтобы чат не молчал.
 */
export async function tryLocalFallback(command: string): Promise<string | null> {
  try {
    const direct = await tryLocalAssistant(command);
    if (direct !== null) return direct;
  } catch {
    // ignore
  }
  try {
    return await tryLocalOrderAnalytics(command);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Утреннее резюме и поиск проблем — тоже считаем локально             */
/* ------------------------------------------------------------------ */

const DIGEST_RE = /(доброе утро|сводк|дайджест|что нового|резюме|итоги за|как дела у магазина)/i;
const PROBLEMS_RE =
  /(проблем|без\s*seo|без описания|не заполнен|висят|висит|зависли|зависших|нет в наличии|закончил|нулевой остаток|out of stock)/i;

async function fetchAdminProducts(): Promise<Product[]> {
  const data = await apiGet<{ products?: Product[] }>('/products?limit=5000&admin=true');
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data)) return data as unknown as Product[];
  return [];
}

function itemSum(o: Order): number {
  let sum = 0;
  for (const it of o.items || []) {
    const qty = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
    sum += (Number(it.price) || 0) * qty;
  }
  return sum;
}


