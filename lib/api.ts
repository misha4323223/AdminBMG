import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { getStoredApiKey, getStoredToken } from "./storage";

// Единый base URL: все пути в коде относительны (например "/admin/products").
// Для локальной разработки можно переопределить через EXPO_PUBLIC_API_URL.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://booomerangs.ru/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config) => {
  const token = await getStoredToken();
  const apiKey = await getStoredApiKey();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (apiKey && !config.headers["x-api-key"]) {
    config.headers["x-api-key"] = apiKey;
  }
  return config;
});

export interface ApiErrorInfo {
  message: string;
  status?: number;
  data?: unknown;
}

export function toApiError(error: unknown): ApiErrorInfo {
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<{ error?: string; message?: string }>;
    const data = ax.response?.data;
    const message =
      data?.error || data?.message || ax.message || "Ошибка запроса";
    return { message, status: ax.response?.status, data };
  }
  if (error instanceof Error) return { message: error.message };
  return { message: "Неизвестная ошибка" };
}

export function getErrorMessage(error: unknown): string {
  return toApiError(error).message;
}

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.get<T>(url, config);
  return res.data;
}

export async function apiPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.post<T>(url, body, config);
  return res.data;
}

export async function apiPut<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.put<T>(url, body, config);
  return res.data;
}

export async function apiPatch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.patch<T>(url, body, config);
  return res.data;
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.delete<T>(url, config);
  return res.data;
}

/**
 * Загрузка изображения. Бэкенд принимает СЫРОЕ тело (не multipart)
 * на /api/admin/upload-image и возвращает { url, success }.
 * `localUri` — file:// URI из expo-image-picker.
 */
export async function uploadImage(localUri: string, filename?: string): Promise<string> {
  const token = await getStoredToken();
  const apiKey = await getStoredApiKey();

  const name = filename || `mobile_${Date.now()}.jpg`;
  const blob: Blob = await fetch(localUri).then((r) => r.blob());

  const res = await fetch(`${API_BASE_URL}/admin/upload-image`, {
    method: "POST",
    body: blob,
    headers: {
      "x-api-key": apiKey || "",
      "x-filename": encodeURIComponent(name),
      "Content-Type": blob.type || "image/jpeg",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data?.url) throw new Error("Сервер не вернул URL");
  return data.url as string;
}
