export function formatRub(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  // Бэкенд хранит все деньги в копейках — переводим в рубли.
  return `${(Number(value) / 100).toLocaleString("ru-RU")} ₽`;
}

export function formatDate(value: unknown): string {
  if (value == null || value === "") return "—";
  const d = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function formatDateTime(value: unknown): string {
  if (value == null || value === "") return "—";
  const d = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Безопасно превращает значение из API в строку для отображения.
 * Бэкенд (YDB) иногда сериализует текстовые поля как Buffer:
 * { type: "Buffer", data: [78, 69, 87] } → "NEW".
 */
export function asText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.type === "Buffer" && Array.isArray(obj.data)) {
      const bytes = (obj.data as unknown[]).map((b) => Number(b) & 0xff);
      try {
        return decodeURIComponent(
          bytes.map((b) => `%${b.toString(16).padStart(2, "0")}`).join(""),
        );
      } catch {
        return bytes.map((b) => String.fromCharCode(b)).join("");
      }
    }
    return "";
  }
  return String(value);
}

export function orderStatusLabel(status?: string | null): string {
  switch ((status || "").toLowerCase()) {
    case "new":
      return "Новый";
    case "pending":
      return "Ожидает оплаты";
    case "paid":
      return "Оплачен";
    case "processing":
      return "В обработке";
    case "shipped":
      return "Отправлен";
    case "delivered":
      return "Доставлен";
    case "ready_for_pickup":
      return "Готов к выдаче";
    case "cancelled":
      return "Отменён";
    case "draft":
      return "Черновик";
    default:
      return status || "—";
  }
}

/** Статус партнёра (заявка на участие). */
export function partnerStatusLabel(status?: string | null): string {
  switch ((status || "").toLowerCase()) {
    case "pending":
      return "На модерации";
    case "approved":
      return "Одобрен";
    case "rejected":
      return "Отклонён";
    case "blocked":
      return "Заблокирован";
    default:
      return status || "—";
  }
}

/** Юридический статус партнёра. */
export function legalStatusLabel(status?: string | null): string {
  switch ((status || "").toLowerCase()) {
    case "self_employed":
      return "Самозанятый";
    case "ip":
      return "ИП";
    case "ooo":
      return "Юр. лицо";
    default:
      return status || "—";
  }
}

/** Статус выплаты партнёру. */
export function payoutStatusLabel(status?: string | null): string {
  switch ((status || "").toLowerCase()) {
    case "awaiting_invoice":
      return "Ждём счёт";
    case "invoice_uploaded":
      return "Счёт получен";
    case "paid_pending_receipt":
      return "Оплачено, ждём чек";
    case "paid_pending_act":
      return "Оплачено, ждём акт";
    case "completed":
      return "Завершено";
    case "rejected":
      return "Отклонено";
    default:
      return status || "—";
  }
}

/** Статус комиссии партнёра. */
export function commissionStatusLabel(status?: string | null): string {
  switch ((status || "").toLowerCase()) {
    case "confirmed":
      return "Готово к выплате";
    case "paid":
      return "Выплачено";
    case "cancelled":
      return "Отменено";
    case "pending":
      return "Ожидает оплаты";
    default:
      return status || "—";
  }
}

/** Статус подарочного сертификата. */
export function giftCardStatusLabel(status?: string | null): string {
  switch ((status || "").toLowerCase()) {
    case "active":
      return "Активен";
    case "pending":
      return "Ожидает";
    case "used":
      return "Использован";
    case "expired":
      return "Истёк";
    default:
      return status || "—";
  }
}

/** Статус предзаказа (в т.ч. оптового). */
export function preorderStatusLabel(status?: string | null): string {
  switch ((status || "").toLowerCase()) {
    case "production":
      return "В производстве";
    case "shipping":
      return "Отправка";
    case "shipped":
      return "Отправлено";
    case "cancelled":
      return "Отменено";
    case "pending":
      return "Ожидает";
    case "collecting":
      return "Сбор заказов";
    case "completed":
      return "Завершено";
    default:
      return status || "—";
  }
}

/** Человекочитаемая подпись типа страницы в SEO-списке. */
export function seoPageTypeLabel(type?: string | null): string {
  switch ((type || "").toLowerCase()) {
    case "home":
      return "Главная";
    case "product":
      return "Товар";
    case "categories":
      return "Категории";
    case "artist":
    case "artist_pages":
      return "Артист";
    case "blog":
    case "blog_pages":
      return "Блог";
    case "static":
    case "static_pages":
      return "Статичная";
    case "vacancies":
      return "Вакансии";
    case "concept":
      return "Концепт";
    case "checkout":
      return "Оформление";
    case "navbar":
      return "Навбар";
    case "footer":
      return "Футер";
    default:
      return type || "";
  }
}
