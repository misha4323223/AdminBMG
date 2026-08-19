import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { Button, InlineError } from "@/components/ui";
import { colors, font, radius, spacing } from "@/constants/theme";

export default function LoginScreen() {
  const router = useRouter();
  const { login, user, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/(admin)");
    }
  }, [isLoading, user]);

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
          <View style={styles.logo}>
            <Ionicons name="flash" size={34} color={colors.accent} />
            <Text style={styles.brand}>BOOOMERANGS</Text>
            <Text style={styles.caption}>Админ-панель</Text>
          </View>

          <View style={styles.form}>
            <InlineError text={error} />

            <Text style={styles.label}>Email администратора</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="admin@booomerangs.ru"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>Пароль</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>API-ключ админки</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="key-outline" size={16} color={colors.textMuted} />
              <TextInput
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="ADMIN_API_KEY"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                secureTextEntry
                style={styles.input}
              />
            </View>

            <Button
              title="Войти в админку"
              onPress={submit}
              loading={busy}
              icon="arrow-forward"
            />
          </View>

          <Text style={styles.hint}>
            Вход выполняется через ту же учётную запись администратора и
            API-ключ, что и на сайте booomerangs.ru/admin.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
  logo: {
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  brand: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    fontFamily: font.bold,
    letterSpacing: 1,
    marginTop: spacing.sm,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  form: {
    gap: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    color: colors.text,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing.xl,
    lineHeight: 18,
  },
});
