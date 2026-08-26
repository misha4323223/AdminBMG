import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Badge, Button, Card, InlineError, SectionTitle } from "@/components/ui";
import { runDiagnostics, type CheckResult, type DiagnosticsReport } from "@/lib/diagnostics";
import { logger, type LogEntry } from "@/lib/logger";
import { formatDateTime } from "@/lib/format";
import { colors, radius, spacing } from "@/constants/theme";

const STATUS_META: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }
> = {
  ok: { icon: "checkmark-circle", color: colors.success, label: "OK" },
  warn: { icon: "warning", color: colors.warning, label: "Медленно" },
  fail: { icon: "close-circle", color: colors.danger, label: "Ошибка" },
  skipped: { icon: "remove-circle-outline", color: colors.textMuted, label: "Пропущено" },
};

const VERDICT_META = {
  ok: { tone: "success" as const, text: "Всё работает" },
  warn: { tone: "warning" as const, text: "Есть замечания" },
  fail: { tone: "danger" as const, text: "Есть проблемы" },
};

function CheckRow({ check }: { check: CheckResult }) {
  const meta = STATUS_META[check.status] || STATUS_META.fail;
  return (
    <View style={styles.checkRow}>
      <Ionicons name={meta.icon} size={18} color={meta.color} />
      <View style={styles.checkBody}>
        <Text style={styles.checkLabel} numberOfLines={1}>
          {check.label}
        </Text>
        {check.detail ? (
          <Text style={styles.checkDetail} numberOfLines={2}>
            {check.detail}
          </Text>
        ) : null}
      </View>
      <View style={styles.checkRight}>
        {check.ms != null ? <Text style={styles.checkMs}>{check.ms} мс</Text> : null}
        <Badge tone={check.status === "ok" ? "success" : check.status === "warn" ? "warning" : check.status === "fail" ? "danger" : "neutral"}>
          {meta.label}
        </Badge>
      </View>
    </View>
  );
}

export default function DiagnosticsScreen() {
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>(logger.entries());

  const refreshLogs = useCallback(() => setLogs(logger.entries()), []);
  useEffect(() => logger.subscribe(refreshLogs), [refreshLogs]);

  const run = async () => {
    setRunning(true);
    setError("");
    try {
      setReport(await runDiagnostics());
    } catch (e) {
      setError(String((e as Error)?.message || e));
      logger.error(`Диагностика упала: ${String((e as Error)?.message || e)}`, "diagnostics");
    } finally {
      setRunning(false);
    }
  };

  const verdictMeta = report ? VERDICT_META[report.verdict] : null;

  return (
    <Screen title="Диагностика">
      <InlineError text={error} />

      <Card style={styles.card}>
        <SectionTitle>Состояние системы</SectionTitle>
        <Text style={styles.desc}>
          Проверяет живость сервера (/healthz) и отклик ключевых API магазина. Если сервер лежит или
          пропал интернет — будет видно сразу.
        </Text>
        <Button
          title={running ? "Проверяю…" : report ? "Проверить снова" : "Запустить проверку"}
          onPress={run}
          loading={running}
          icon="pulse-outline"
        />
        {report && verdictMeta ? (
          <>
            <View style={styles.verdictRow}>
              <Badge tone={verdictMeta.tone}>{verdictMeta.text}</Badge>
              <Text style={styles.ranAt}>проверено в {formatDateTime(report.ranAt)}</Text>
            </View>

            <CheckRow check={report.server} />
            {report.checks.map((c) => (
              <CheckRow key={c.id} check={c} />
            ))}
          </>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <View style={styles.logsHeader}>
          <SectionTitle>Журнал событий</SectionTitle>
          <Pressable onPress={() => logger.clear()} hitSlop={8}>
            <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
        {logs.length === 0 ? (
          <Text style={styles.logEmpty}>Пока пусто — ошибки и события появятся здесь.</Text>
        ) : (
          <ScrollView style={styles.logsList} nestedScrollEnabled>
            {logs.map((entry, i) => {
              const meta = STATUS_META[entry.level === "error" ? "fail" : entry.level === "warn" ? "warn" : "ok"];
              return (
                <View key={`${entry.at}-${i}`} style={styles.logRow}>
                  <Ionicons name={meta.icon} size={12} color={meta.color} />
                  <View style={styles.logBody}>
                    <Text style={styles.logMessage}>{entry.message}</Text>
                    <Text style={styles.logMeta}>
                      {formatDateTime(entry.at)}
                      {entry.context ? ` · ${entry.context}` : ""}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  desc: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  verdictRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  ranAt: { color: colors.textMuted, fontSize: 12, flex: 1 },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  checkBody: { flex: 1, minWidth: 0 },
  checkLabel: { color: colors.text, fontSize: 14, fontWeight: "600" },
  checkDetail: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  checkRight: { alignItems: "flex-end", gap: 3 },
  checkMs: { color: colors.textMuted, fontSize: 11 },
  logsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logsList: { maxHeight: 280, marginTop: spacing.sm },
  logEmpty: { color: colors.textMuted, fontSize: 12, paddingVertical: spacing.md },
  logRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  logBody: { flex: 1, minWidth: 0 },
  logMessage: { color: colors.text, fontSize: 13 },
  logMeta: { color: colors.textMuted, fontSize: 10, marginTop: 1 },
});
