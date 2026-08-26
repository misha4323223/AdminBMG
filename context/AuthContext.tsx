import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "@/lib/api";
import {
  clearAuth,
  clearBioCredentials,
  getBioCredentials,
  getStoredApiKey,
  getStoredToken,
  getStoredUser,
  setBioCredentials,
  storeApiKey,
  storeToken,
  storeUser,
} from "@/lib/storage";
import { Platform } from "react-native";
import type { AdminUser } from "@/lib/types";

interface AuthContextValue {
  user: AdminUser | null;
  isLoading: boolean;
  login: (email: string, password: string, apiKey: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  /** Есть ли сохранённые данные для биометрического входа (только натив). */
  hasBiometricCredentials: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  isAdmin: false,
  hasBiometricCredentials: false,
});

/** Биометрический вход доступен только на нативных платформах. */
export function biometricsSupported(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasBiometricCredentials, setHasBiometricCredentials] = useState(false);

  useEffect(() => {
    if (!biometricsSupported()) return;
    getBioCredentials().then((c) => setHasBiometricCredentials(!!c));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [token, apiKey, storedUser] = await Promise.all([
          getStoredToken(),
          getStoredApiKey(),
          getStoredUser(),
        ]);
        if (token && apiKey) {
          const parsed = storedUser ? (JSON.parse(storedUser) as AdminUser) : null;
          // Быстрая проверка валидности сессии через /auth/me.
          try {
            const me = await api.get("/auth/me");
            const meUser = me.data?.user as AdminUser | undefined;
            if (meUser && meUser.role === "admin") {
              setUser(meUser);
            } else if (parsed && parsed.role === "admin") {
              setUser(parsed);
            }
          } catch {
            if (parsed && parsed.role === "admin") setUser(parsed);
          }
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string, apiKey: string) => {
    // 1) Получаем JWT + пользователя (бэкенд уже умеет отдавать токен для мобилки).
    const res = await api.post("/auth/mobile-login", {
      email: email.trim().toLowerCase(),
      password,
    });

    const token: string | undefined = res.data?.token;
    const loginUser: AdminUser | undefined = res.data?.user;

    if (!token || !loginUser) {
      throw new Error("Не удалось войти: сервер не вернул токен");
    }
    if (loginUser.role !== "admin") {
      throw new Error("У вашего аккаунта нет прав администратора");
    }

    // Сохраняем до проверки API-ключа, чтобы интерсептор подставил заголовки.
    await storeToken(token);
    await storeApiKey(apiKey.trim());

    // 2) Валидируем API-ключ тем же способом, что и веб-админка.
    try {
      await api.post("/admin/verify");
    } catch (err) {
      await clearAuth();
      const msg = (err as Error)?.message || "Неверный API-ключ";
      throw new Error(msg);
    }

    await storeUser(JSON.stringify(loginUser));
    setUser(loginUser);

    // Сохраняем учётные данные для быстрого биометрического входа в следующий раз.
    if (biometricsSupported()) {
      await setBioCredentials({ email: email.trim().toLowerCase(), password, apiKey: apiKey.trim() });
      setHasBiometricCredentials(true);
    }
  }, []);

  const logout = useCallback(async () => {
    await clearAuth();
    await clearBioCredentials();
    setHasBiometricCredentials(false);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      login,
      logout,
      isAdmin: user?.role === "admin",
      hasBiometricCredentials,
    }),
    [user, isLoading, login, logout, hasBiometricCredentials],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
