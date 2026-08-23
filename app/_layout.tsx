import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/context/AuthContext";
import { colors } from "@/constants/theme";
import { IONICONS_FONT_FAMILY, IONICONS_TTF_BASE64 } from "@/lib/ionicons-font-data";

/**
 * На web встраиваем шрифт Ionicons как base64 data-URI — никакой сетевой
 * загрузки, поэтому иконки не ломаются ни в браузере, ни в Electron,
 * даже если прокси/MIME/CORS мешают загрузке .ttf по сети.
 */
function useWebIconFont(): boolean {
  const [ready, setReady] = useState(Platform.OS !== "web");

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const styleId = "ionicons-inline-font";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent =
        `@font-face{font-family:"${IONICONS_FONT_FAMILY}";` +
        `src:url(data:font/ttf;base64,${IONICONS_TTF_BASE64}) format("truetype");` +
        "font-weight:normal;font-style:normal;font-display:block}";
      document.head.appendChild(style);
    }
    let cancelled = false;
    const done = () => {
      if (!cancelled) setReady(true);
    };
    // Ждём фактической готовности шрифта (быстро, т.к. он уже в HTML), но не дольше 2 сек.
    const timer = window.setTimeout(done, 2000);
    document.fonts
      .load(`16px "${IONICONS_FONT_FAMILY}"`)
      .then(done)
      .catch(done)
      .finally(() => window.clearTimeout(timer));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return ready;
}

export default function RootLayout() {
  // Явно грузим шрифт иконок на нативных платформах (Android/iOS).
  // На web НЕ используем useFonts(Ionicons.font): expo-font вставляет свой
  // @font-face со ссылкой на .ttf по сети, который в прокси-окружении может быть
  // заблокирован и перебить встроенный base64-шрифт. На web хватает base64 из
  // useWebIconFont().
  const [fontsLoaded, fontError] = useFonts(
    Platform.OS === "web" ? {} : Ionicons.font,
  );
  const webFontReady = useWebIconFont();
  const fontsReady = Platform.OS === "web" ? webFontReady : fontsLoaded || !!fontError;

  if (!fontsReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
