import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card, InlineError, SectionTitle } from "@/components/ui";
import { apiGet, apiPost, getErrorMessage } from "@/lib/api";
import { colors, spacing } from "@/constants/theme";

const MEASURES = [
  "Двухфакторная админ-авторизация (JWT + API-ключ)",
  "CORS — ограничение разрешённых доменов",
  "Secure cookies — httpOnly, secure, sameSite",
  "Helmet — security-заголовки (XSS, HSTS и др.)",
  "Rate-limit — логин/регистрация (10 попыток / 15 мин)",
  "Rate-limit — админ-верификация (5 попыток / 15 мин, блок IP)",
  "bcrypt — хеширование паролей",
  "JWT — авторизация через httpOnly cookie",
  "Подтверждение email при регистрации",
  "ЮKassa — проверка IP webhook",
  "T-Bank — проверка SHA-256 подписи webhook",
  "1С — доступ только через переключатель",
  "Zod — валидация входящих данных",
  "API-ключ — защита эндпоинтов синхронизации",
];

export default function SecurityScreen() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<{ enabled: boolean }>("/admin/1c-sync-status");
        setEnabled(res.enabled);
      } catch (e) {
        setError(getErrorMessage(e));
      }
    })();
  }, []);

  const toggle = async () => {
    if (enabled == null) return;
    setBusy(true);
    setError("");
    try {
      const res = await apiPost<{ enabled: boolean }>("/admin/1c-sync-toggle", {
        enabled: !enabled,
      });
      setEnabled(res.enabled);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Безопасность">
      <InlineError text={error} />

      <Card style={styles.card}>
        <SectionTitle>Приём данных из 1С</SectionTitle>
        <View style={styles.rowBetween}>
          <Text style={styles.desc}>
            {enabled
              ? "Сервер принимает данные от 1С"
              : "Сервер отклоняет запросы от 1С"}
          </Text>
          <Pressable
            onPress={toggle}
            disabled={busy || enabled == null}
            style={[styles.toggle, enabled && styles.toggleOn]}
          >
            <View style={[styles.dot, enabled && styles.dotOn]} />
          </Pressable>
        </View>
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Активные меры защиты</SectionTitle>
        {MEASURES.map((m, i) => (
          <View key={i} style={styles.measure}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.measureText}>{m}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  desc: { color: colors.textMuted, fontSize: 13, flex: 1 },
  toggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceAlt,
    padding: 3,
  },
  toggleOn: { backgroundColor: colors.success },
  dot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.textMuted },
  dotOn: { backgroundColor: colors.white, alignSelf: "flex-end" },
  measure: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  measureText: { color: colors.text, fontSize: 13, flex: 1 },
});
