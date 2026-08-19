import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  InlineError,
  SectionTitle,
} from "@/components/ui";
import { apiGet, apiPost, getErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { colors, spacing } from "@/constants/theme";

interface PushHistoryEntry {
  title: string;
  body: string;
  url?: string;
  image?: string;
  sentAt: string;
  sent: number;
  failed: number;
  total: number;
}

export default function IntegrationsScreen() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [ozon, setOzon] = useState<Record<string, unknown> | null>(null);
  const [pushTotal, setPushTotal] = useState<number | null>(null);
  const [adminPush, setAdminPush] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<PushHistoryEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Push send form
  const [pushForm, setPushForm] = useState({ title: "", body: "", url: "", image: "" });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");

  const load = async () => {
    setError("");
    try {
      const [sync, ozonData, pushData, adminPushData, historyData] = await Promise.all([
        apiGet<{ enabled: boolean }>("/admin/1c-sync-status"),
        apiGet<Record<string, unknown>>("/admin/ozon-delivery/settings").catch(() => null),
        apiGet<{ total: number }>("/admin/push/stats").catch(() => null),
        apiGet<Record<string, unknown>>("/admin/push/admin-stats").catch(() => null),
        apiGet<PushHistoryEntry[]>("/admin/push/history").catch(() => []),
      ]);
      setEnabled(sync.enabled);
      setOzon(ozonData);
      setPushTotal(pushData?.total ?? null);
      setAdminPush(adminPushData);
      setHistory(Array.isArray(historyData) ? historyData : []);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle1c = async () => {
    if (enabled == null) return;
    setBusy(true);
    try {
      const res = await apiPost<{ enabled: boolean }>("/admin/1c-sync-toggle", { enabled: !enabled });
      setEnabled(res.enabled);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const flushCache = async () => {
    setBusy(true);
    try {
      await apiPost("/admin/cache/flush");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const sendPush = async (testOnly = false) => {
    if (!pushForm.title.trim() || !pushForm.body.trim()) {
      setResult("Заполните заголовок и текст");
      return;
    }
    setSending(true);
    setResult("");
    setError("");
    try {
      const body = {
        title: pushForm.title.trim(),
        body: pushForm.body.trim(),
        url: pushForm.url.trim() || undefined,
        image: pushForm.image.trim() || undefined,
      };
      const res = await apiPost<any>(testOnly ? "/admin/push/test" : "/admin/push/send", body);
      setResult(`Отправлено: ${res.sent ?? 0}, ошибок: ${res.failed ?? 0}, всего: ${res.total ?? 0}`);
      setPushForm({ title: "", body: "", url: "", image: "" });
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const cleanDev = async () => {
    setBusy(true);
    try {
      await apiPost("/admin/push/clean-dev-subs");
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Интеграции">
      <InlineError text={error} />

      <Card style={styles.card}>
        <SectionTitle>1С: обмен данными</SectionTitle>
        <View style={styles.rowBetween}>
          <Text style={styles.desc}>
            {enabled == null ? "Проверка…" : enabled ? "Обмен включён" : "Обмен выключен"}
          </Text>
          <Pressable
            onPress={toggle1c}
            disabled={busy || enabled == null}
            style={[styles.toggle, enabled && styles.toggleOn]}
          >
            <View style={[styles.dot, enabled && styles.dotOn]} />
          </Pressable>
        </View>
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Ozon Delivery</SectionTitle>
        {ozon ? (
          <View>
            {Object.entries(ozon).map(([k, v]) => (
              <View key={k} style={styles.kvRow}>
                <Text style={styles.kvKey}>{k}</Text>
                <Text style={styles.kvValue}>{String(v)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.desc}>Не настроено</Text>
        )}
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Push-уведомления</SectionTitle>
        <View style={styles.rowBetween}>
          <Text style={styles.desc}>
            Подписчиков: {pushTotal == null ? "—" : pushTotal}
          </Text>
          <Text style={styles.desc}>
            Админов: {adminPush ? String((adminPush as any)?.total ?? "—") : "—"}
          </Text>
        </View>

        <View style={styles.pushForm}>
          <Field label="Заголовок" value={pushForm.title} onChangeText={(v) => setPushForm((f) => ({ ...f, title: v }))} />
          <Field label="Текст" value={pushForm.body} onChangeText={(v) => setPushForm((f) => ({ ...f, body: v }))} multiline />
          <Field label="Ссылка (url)" value={pushForm.url} onChangeText={(v) => setPushForm((f) => ({ ...f, url: v }))} autoCapitalize="none" />
          <Field label="Картинка (url)" value={pushForm.image} onChangeText={(v) => setPushForm((f) => ({ ...f, image: v }))} autoCapitalize="none" />
          {result ? <Text style={styles.result}>{result}</Text> : null}
          <View style={styles.pushActions}>
            <Button title="Отправить всем" onPress={() => sendPush(false)} loading={sending} icon="paper-plane" />
            <Button title="Тест админам" variant="secondary" onPress={() => sendPush(true)} loading={sending} icon="flask-outline" />
          </View>
        </View>

        <Text style={styles.historyTitle}>История рассылок</Text>
        {history.length === 0 ? (
          <EmptyState text="История пуста" />
        ) : (
          history.map((h, i) => (
            <View key={i} style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTitle2}>{h.title}</Text>
                <Text style={styles.desc} numberOfLines={2}>{h.body}</Text>
                <Text style={styles.historyMeta}>{formatDateTime(h.sentAt)}</Text>
              </View>
              <Badge tone={h.failed > 0 ? "warning" : "success"}>
                {h.sent}/{h.total}
              </Badge>
            </View>
          ))
        )}
        <View style={styles.cleanWrap}>
          <Button title="Очистить dev-подписки" variant="ghost" onPress={cleanDev} loading={busy} />
        </View>
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Кэш</SectionTitle>
        <Button title="Сбросить кэш" onPress={flushCache} loading={busy} variant="secondary" icon="refresh" />
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
  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: colors.surfaceAlt, padding: 3 },
  toggleOn: { backgroundColor: colors.success },
  dot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.textMuted },
  dotOn: { backgroundColor: colors.white, alignSelf: "flex-end" },
  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  kvKey: { color: colors.textMuted, fontSize: 12, flex: 1 },
  kvValue: { color: colors.text, fontSize: 12, textAlign: "right", flexShrink: 1 },
  pushForm: { marginTop: spacing.md },
  pushActions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  result: { color: colors.success, fontSize: 13, marginBottom: spacing.sm },
  historyTitle: { color: colors.text, fontSize: 14, fontWeight: "700", marginTop: spacing.lg, marginBottom: spacing.sm },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  historyTitle2: { color: colors.text, fontSize: 13, fontWeight: "600" },
  historyMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  cleanWrap: { marginTop: spacing.md },
});
