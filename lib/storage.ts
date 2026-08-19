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
