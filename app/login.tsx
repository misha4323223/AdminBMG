import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
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
  const { login, user, isLoading, hasBiometricCredentials } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState<Field>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [bioBusy, setBioBusy] = useState(false);

  // Доступна ли биометрия: нативная платформа + сохранённые данные.
  const bioAvailable =
    !isLoading && biometricsSupported() && hasBiometricCredentials && !user;

  // Плавное появление формы после заставки
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formTranslate = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (!showSplash) {
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(formTranslate, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]).start();
    }
  }, [showSplash, formOpacity, formTranslate]);

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
        setError("Сохранённые данные не найдены — войдите вручную");
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

  const inputStyle = (name: Exclude<Field, null>) => [
    styles.inputWrap,
    focused === name && styles.inputWrapFocused,
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[styles.header, { opacity: formOpacity }]}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            <View style={styles.captionRow}>
              <View style={styles.captionLine} />
              <Text style={styles.caption}>АДМИН-ПАНЕЛЬ</Text>
              <View style={styles.captionLine} />
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.form,
              { opacity: formOpacity, transform: [{ translateY: formTranslate }] },
            ]}
          >
            <InlineError text={error} />

            <Text style={styles.label}>Email администратора</Text>
            <View style={inputStyle("email")}>
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
            <View style={inputStyle("password")}>
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
            <View style={inputStyle("apiKey")}>
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

            {bioAvailable ? (
              <Pressable
                onPress={loginWithBiometrics}
                disabled={bioBusy || busy}
                style={({ pressed }) => [
                  styles.bioButton,
                  (pressed || bioBusy) && { opacity: 0.75 },
                ]}
              >
                <Ionicons
                  name="finger-print-outline"
                  size={18}
                  color={colors.accent}
                />
                <Text style={styles.bioText}>Войти по отпечатку</Text>
              </Pressable>
            ) : null}
          </Animated.View>

          <Animated.Text style={[styles.hint, { opacity: formOpacity }]}>
            Вход выполняется через ту же учётную запись администратора и
            API-ключ, что и на сайте booomerangs.ru/admin.
          </Animated.Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {showSplash || isLoading ? <Splash onDone={() => setShowSplash(false)} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
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
  inputWrapFocused: {
    borderColor: colors.accent,
    shadowColor: colors.glowAccent,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
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
  bioText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing.xl,
    lineHeight: 18,
  },
});
