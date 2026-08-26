import React, { useEffect } from "react";
import { Redirect, Stack, useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { LoadingView } from "@/components/ui";
import { CommandPalette } from "@/components/CommandPalette";
import { ADMIN_SECTIONS } from "@/lib/sections";
import { isTypingTarget, registerHotkey } from "@/lib/hotkeys";
import { Platform } from "react-native";

/**
 * Явно указываем, что первым (корневым) экраном админки всегда должна быть
 * главная с ИИ-чатом и статистикой. Без этого expo-router при неоднозначном
 * адресе (например, прямой заход на /wholesale после перезапуска) может
 * выбрать другой экран стека, и кнопка «Назад» на нём ведёт в никуда.
 */
export const unstable_settings = {
  initialRouteName: "index",
};

export default function AdminLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // ПК-горячие клавиши: Ctrl+1…9 — разделы, Esc — назад.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const offs = ADMIN_SECTIONS.slice(0, 9).map((section, i) =>
      registerHotkey(
        `section-${section.key}`,
        { key: String(i + 1), ctrl: true },
        () => router.push(section.route as never),
      ),
    );
    const offEsc = registerHotkey(
      "layout-escape",
      { key: "escape" },
      () => {
        if (isTypingTarget()) return;
        if (router.canGoBack()) router.back();
      },
      10,
    );
    return () => {
      offs.forEach((off) => off());
      offEsc();
    };
  }, [router]);

  if (isLoading) {
    return <LoadingView />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <>
      <Stack
        initialRouteName="index"
        screenOptions={{ headerShown: false }}
      />
      {Platform.OS === "web" ? <CommandPalette /> : null}
    </>
  );
}
