import React, { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { biometricsSupported, useAuth } from "@/context/AuthContext";
import { Button, InlineError } from "@/components/ui";
import { Splash } from "@/components/Splash";
import { getBioCredentials } from "@/lib/storage";
import { hapticSuccess, hapticWarning } from "@/lib/haptics";
import { colors, font, radius, spacing } from "@/constants/theme";
import * as LocalAuthentication from "expo-local-authentication";

const LOGO = require("@/assets/logo-light.png");

type Field = "email" | "password" | "apiKey" | null;

export default function LoginScreen() {
  const router = useRouter();
  const { login, user, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState<Field>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [bioBusy, setBioBusy] = useState(false);
  // Есть ли на устройстве отпечаток/FaceID (железо + хотя бы один отпечаток).
  const [bioReady, setBioReady] = useState(false);

  // ВАЖНО для Android: никакого состояния клавиатуры и никаких изменений
  // layout при фокусе. Иначе при открытии клавиатуры (adjustResize) форма
  // «прыгает» между перерисовками. Форма статична по своей природе.

  useEffect(() => {
    if (!biometricsSupported()) return;
    let alive = true;
    (async () => {
      try {
        const [hw, enrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        if (alive) setBioReady(hw && enrolled);
      } catch {
        // нет биометрии или ошибка платформы — кнопка просто не появится
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Кнопка видна, если на устройстве настроен отпечаток/FaceID.
  // Без сохранённых данных тап подскажет, как включить вход по биометрии.
  const bioAvailable = !isLoading && bioReady && !user;

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/(admin)");
    }
  }, [isLoading, user, router]);

  // Вход по биометрии: отпечаток/FaceID → автологин по сохранённым данным.
  const loginWithBiometrics = async () => {
    if (bioBusy) return;
    setError("");
    setBioBusy(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        setError("Биометрия не настроена на этом устройстве — войдите вручную");
        hapticWarning();
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Вход в админку BOOOM",
        cancelLabel: "Отмена",
      });
      if (!result.success) return; // пользователь отменил — молча
      const creds = await getBioCredentials();
      if (!creds) {
        setError("Войдите один раз вручную — доступ по отпечатку включится автоматически");
        return;
      }
      await login(creds.email, creds.password, creds.apiKey);
      hapticSuccess();
      router.replace("/(admin)");
    } catch (e) {
      setError((e as Error)?.message || "Ошибка биометрического входа");
      hapticWarning();
    } finally {
      setBioBusy(false);
    }
  };

  const submit = async () => {
    setError("");
    if (!email.trim() || !password || !apiKey.trim()) {
      setError("Заполните email, пароль и API-ключ");
      return;
    }
    setBusy(true);
    try {
      await login(email, password, apiKey);
      router.replace("/(admin)");
    } catch (e) {
      setError((e as Error)?.message || "Ошибка входа");
    } finally {
      setBusy(false);
    }
  };

  // При фокусе меняем ТОЛЬКО цвет рамки/иконки — без elevation, теней
  // и изменения размеров, чтобы Android не перерисовывал слой поля.
  const inputWrapStyle = (name: Exclude<Field, null>) => [
    styles.inputWrap,
    focused === name && { borderColor: colors.accent },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        enabled={Platform.OS === "ios"}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        >
          <View style={styles.header}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            <View style={styles.captionRow}>
              <View style={styles.captionLine} />
              <Text style={styles.caption}>АДМИН-ПАНЕЛЬ</Text>
              <View style={styles.captionLine} />
            </View>
          </View>

          <View style={styles.form}>
            <InlineError text={error} />

            <Text style={styles.label}>Email администратора</Text>
            <View style={inputWrapStyle("email")}>
              <Ionicons
                name="mail-outline"
                size={16}
                color={focused === "email" ? colors.accent : colors.textMuted}
              />
              <TextInput
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                placeholder="admin@booomerangs.ru"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>Пароль</Text>
            <View style={inputWrapStyle("password")}>
              <Ionicons
                name="lock-closed-outline"
                size={16}
                color={focused === "password" ? colors.accent : colors.textMuted}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>API-ключ админки</Text>
            <View style={inputWrapStyle("apiKey")}>
              <Ionicons
                name="key-outline"
                size={16}
                color={focused === "apiKey" ? colors.accent : colors.textMuted}
              />
              <TextInput
                value={apiKey}
                onChangeText={setApiKey}
                onFocus={() => setFocused("apiKey")}
                onBlur={() => setFocused(null)}
                placeholder="ADMIN_API_KEY"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                secureTextEntry
                style={styles.input}
              />
            </View>

            <View style={styles.submitWrap}>
              <Button
                title="Войти в админку"
                onPress={submit}
                loading={busy}
                icon="arrow-forward"
              />
            </View>

            {/* Кнопка отпечатка всегда занимает место (opacity 0), чтобы
                форма не сдвигалась, когда биометрия «догружается». */}
            <Pressable
              onPress={loginWithBiometrics}
              disabled={!bioAvailable || bioBusy || busy}
              style={({ pressed }) => [
                styles.bioButton,
                !bioAvailable && styles.bioButtonHidden,
                (pressed || bioBusy) && bioAvailable && { opacity: 0.75 },
              ]}
            >
              <Ionicons
                name="finger-print-outline"
                size={18}
                color={bioAvailable ? colors.accent : colors.textMuted}
              />
              <Text style={[styles.bioText, !bioAvailable && styles.bioTextHidden]}>
                Войти по отпечатку
              </Text>
            </Pressable>
          </View>

          <Text style={styles.hint}>
            Вход выполняется через ту же учётную запись администратора и
            API-ключ, что и на сайте booomerangs.ru/admin.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Заставку монтируем только до её завершения — после неё форма должна
          быть полностью доступна, даже если isLoading ещё проверяет сессию. */}
      {showSplash ? <Splash onDone={() => setShowSplash(false)} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  // Один неизменный контейнер: при открытии клавиатуры Android сжимает окно
  // (adjustResize), ScrollView сам прокрутит к активному полю — ничего
  // не «перецентрируется» и не прыгает.
  container: {
    flexGrow: 1,
    justifyContent: "flex-start",
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  logo: {
    width: 240,
    height: 99,
  },
  captionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  captionLine: {
    width: 36,
    height: 1,
    backgroundColor: colors.border,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "600",
  },
  form: {
    gap: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.sm,
    marginBottom: 2,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    color: colors.text,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  submitWrap: {
    marginTop: spacing.lg,
  },
  bioButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  bioButtonHidden: {
    opacity: 0,
    pointerEvents: "none",
  },
  bioText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  bioTextHidden: {
    color: colors.textMuted,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing.xl,
    lineHeight: 18,
  },
});
