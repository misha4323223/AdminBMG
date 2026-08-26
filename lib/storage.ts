import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "admin_jwt_token";
const API_KEY_KEY = "admin_api_key";
const USER_KEY = "admin_user";

function webGet(key: string): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function webSet(key: string, value: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  } catch {}
}

function webRemove(key: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  } catch {}
}

export async function getStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return webGet(TOKEN_KEY);
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function storeToken(token: string): Promise<void> {
  try {
    if (Platform.OS === "web") webSet(TOKEN_KEY, token);
    else await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {}
}

/** Произвольные JSON-данные (история чата и т.п.). На web — localStorage,
 * на нативе — SecureStore (лимит ~2 КБ на значение, вызывающий сам ужимает payload). */
export async function getStoredJson(key: string): Promise<unknown | null> {
  try {
    const raw =
      Platform.OS === "web" ? webGet(key) : await SecureStore.getItemAsync(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setStoredJson(key: string, value: unknown): Promise<void> {
  try {
    const raw = JSON.stringify(value);
    if (Platform.OS === "web") webSet(key, raw);
    else await SecureStore.setItemAsync(key, raw);
  } catch {}
}

export async function getStoredApiKey(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return webGet(API_KEY_KEY);
    return await SecureStore.getItemAsync(API_KEY_KEY);
  } catch {
    return null;
  }
}

export async function storeApiKey(key: string): Promise<void> {
  try {
    if (Platform.OS === "web") webSet(API_KEY_KEY, key);
    else await SecureStore.setItemAsync(API_KEY_KEY, key);
  } catch {}
}

export async function getStoredUser(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return webGet(USER_KEY);
    return await SecureStore.getItemAsync(USER_KEY);
  } catch {
    return null;
  }
}

export async function storeUser(user: string): Promise<void> {
  try {
    if (Platform.OS === "web") webSet(USER_KEY, user);
    else await SecureStore.setItemAsync(USER_KEY, user);
  } catch {}
}

// ─── Учётные данные для быстрого биометрического входа ─────────────
// Хранятся в SecureStore (натив) / localStorage (web). Используются только
// после успешной проверки биометрии на устройстве.

interface BioCredentials {
  email: string;
  password: string;
  apiKey: string;
}

const BIO_CRED_KEY = "admin_biometric_credentials";

export async function getBioCredentials(): Promise<BioCredentials | null> {
  const data = await getStoredJson(BIO_CRED_KEY);
  if (!data || typeof data !== "object") return null;
  const c = data as Partial<BioCredentials>;
  if (!c.email || !c.password || !c.apiKey) return null;
  return c as BioCredentials;
}

export async function setBioCredentials(creds: BioCredentials): Promise<void> {
  await setStoredJson(BIO_CRED_KEY, creds);
}

export async function clearBioCredentials(): Promise<void> {
  try {
    if (Platform.OS === "web") webRemove(BIO_CRED_KEY);
    else await SecureStore.deleteItemAsync(BIO_CRED_KEY);
  } catch {}
}

// ─── Черновики (автосохранение незавершённых форм) ────────────────

export async function getStoredDraft(
  key: string,
): Promise<Record<string, unknown> | null> {
  const data = await getStoredJson(`draft_${key}`);
  return data && typeof data === "object"
    ? (data as Record<string, unknown>)
    : null;
}

export async function setStoredDraft(key: string, value: unknown): Promise<void> {
  await setStoredJson(`draft_${key}`, value);
}

export async function clearStoredDraft(key: string): Promise<void> {
  try {
    const full = `draft_${key}`;
    if (Platform.OS === "web") webRemove(full);
    else await SecureStore.deleteItemAsync(full);
  } catch {}
}

export async function clearAuth(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      webRemove(TOKEN_KEY);
      webRemove(API_KEY_KEY);
      webRemove(USER_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(API_KEY_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    }
  } catch {}
}
