import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { API_BASE_URL } from "./api";
import { getStoredApiKey, getStoredToken } from "./storage";

export interface ExportColumn {
  key: string;
  label: string;
}

export type ExportRow = Record<string, unknown>;

function cell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (Array.isArray(value)) return value.join(", ");
  return String(value).replace(/\r?\n/g, " ").trim();
}

function escapeCsv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function safeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9а-яА-Я_-]+/g, "-").replace(/^-+|-+$/g, "") || "export";
}

function tableRows(columns: ExportColumn[], rows: ExportRow[]): string[][] {
  return [
    columns.map((column) => column.label),
    ...rows.map((row) => columns.map((column) => cell(row[column.key]))),
  ];
}

function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function toExcelHtml(title: string, rows: string[][]): string {
  const body = rows
    .map(
      (row, rowIndex) =>
        `<tr>${row
          .map((value) => `<${rowIndex === 0 ? "th" : "td"}>${escapeHtml(value)}</${rowIndex === 0 ? "th" : "td"}>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;color:#111}h1{font-size:18px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:6px 8px;text-align:left;vertical-align:top}th{background:#eee}</style></head><body><h1>${escapeHtml(title)}</h1><table>${body}</table></body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function webDownload(content: string, filename: string, mimeType: string): void {
  if (typeof document === "undefined" || typeof URL === "undefined") return;
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function nativeShare(content: string, filename: string, mimeType: string): Promise<string | undefined> {
  const file = new File(Paths.cache, filename);
  file.write(content, { encoding: "utf8" });
  const uri = file.uri;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType,
      dialogTitle: "Поделиться выгрузкой",
      UTI: mimeType,
    });
  }
  return uri;
}

export async function exportExcel(
  title: string,
  columns: ExportColumn[],
  rows: ExportRow[],
): Promise<void> {
  const table = tableRows(columns, rows);
  const filename = `${safeFilename(title)}.xls`;
  const html = toExcelHtml(title, table);
  if (Platform.OS === "web") {
    webDownload(html, filename, "application/vnd.ms-excel");
    return;
  }
  await nativeShare(html, filename, "application/vnd.ms-excel");
}

export async function exportPdf(
  title: string,
  columns: ExportColumn[],
  rows: ExportRow[],
): Promise<void> {
  const table = tableRows(columns, rows);
  const html = toExcelHtml(title, table);
  if (Platform.OS === "web") {
    const popup = window.open("", "_blank");
    if (!popup) {
      window.print();
      return;
    }
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.setTimeout(() => popup.print(), 250);
    return;
  }
  const result = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, {
      mimeType: "application/pdf",
      dialogTitle: "Поделиться PDF-отчётом",
      UTI: "com.adobe.pdf",
    });
  }
}

export function rowsFrom<T extends Record<string, unknown>>(
  values: T[],
  columns: ExportColumn[],
): ExportRow[] {
  return values.map((value) => {
    const row: ExportRow = {};
    for (const column of columns) row[column.key] = value[column.key];
    return row;
  });
}

export function toExportError(error: unknown): string {
  return error instanceof Error ? error.message : "Не удалось подготовить файл";
}

/**
 * Скачивание файла, который сервер формирует сам (например, XLS-отчёт по продажам).
 * На web — обычное скачивание, на Android/Windows — системное «Поделиться».
 */
export async function downloadServerFile(url: string, filename: string): Promise<void> {
  const token = await getStoredToken();
  const apiKey = await getStoredApiKey();
  const headers: Record<string, string> = {};
  if (apiKey) headers["x-api-key"] = apiKey;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${url}`, { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `HTTP ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const mime =
    filename.endsWith(".xlsx")
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : filename.endsWith(".xls")
        ? "application/vnd.ms-excel"
        : "application/octet-stream";

  if (Platform.OS === "web") {
    const blob = new Blob([arrayBuffer], { type: mime });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return;
  }

  const file = new File(Paths.cache, filename);
  file.write(new Uint8Array(arrayBuffer));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: mime,
      dialogTitle: "Поделиться файлом",
      UTI: mime,
    });
  }
}
