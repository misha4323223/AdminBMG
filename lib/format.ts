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
