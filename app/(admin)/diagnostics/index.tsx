import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Badge, Button, Card, InlineError, SectionTitle } from "@/components/ui";
import {
  runDiagnostics,
  type CheckResult,
  type DiagnosticsReport,
  type DetailState,
  type ServerCacheState,
  type ServerDetailBlock,
  type ServerLogEntry,
  type ServerRequestStats,
} from "@/lib/diagnostics";
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

function DetailHeader({ label, ms }: { label: string; ms?: number }) {
  return (
    <View style={styles.detailHeader}>
      <Text style={styles.detailTitle}>{label}</Text>
      {ms != null ? <Text style={styles.checkMs}>{ms} мс</Text> : null}
    </View>
  );
}

function DetailNotice({ state, detail }: { state: DetailState; detail?: string }) {
  const meta =
    state === "deploy"
      ? {
          icon: "remove-circle-outline" as const,
          color: colors.textMuted,
          text: detail ?? "Эндпоинт появится после деплоя сайта",
        }
      : state === "auth"
        ? {
            icon: "warning" as const,
            color: colors.warning,
            text: detail ?? "Сервер ответил 401/403 — проверьте API-ключ",
          }
        : {
            icon: "close-circle" as const,
            color: colors.danger,
            text: detail ?? "Не удалось получить данные",
          };
  return (
    <View style={styles.noticeRow}>
      <Ionicons name={meta.icon} size={16} color={meta.color} />
      <Text style={[styles.noticeText, { color: meta.color }]}>{meta.text}</Text>
    </View>
  );
}

function ServerLogsBlock({ block }: { block: ServerDetailBlock<ServerLogEntry[]> }) {
  const entries = block.data ?? [];
  return (
    <View style={styles.detailSection}>
      <DetailHeader label={block.label} ms={block.ms} />
      {block.state !== "ok" ? (
        <DetailNotice state={block.state} detail={block.detail} />
      ) : entries.length === 0 ? (
        <Text style={styles.detailOk}>Ошибок и предупреждений нет — всё чисто.</Text>
      ) : (
        entries.slice(0, 20).map((entry, i) => (
          <View key={`${entry.ts}-${i}`} style={styles.logRow}>
            <Ionicons
              name={entry.level === "error" ? "close-circle" : "warning"}
              size={12}
              color={entry.level === "error" ? colors.danger : colors.warning}
            />
            <View style={styles.logBody}>
              <Text style={styles.logMessage} numberOfLines={2}>
                {entry.message}
              </Text>
              <Text style={styles.logMeta}>
                {formatDateTime(new Date(entry.ts))}
                {entry.source ? ` · ${entry.source}` : ""}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function ServerRequestsBlock({ block }: { block: ServerDetailBlock<ServerRequestStats> }) {
  const stats = block.data;
  const buckets: Array<{ key: string; color: string }> = [
    { key: "5xx", color: colors.danger },
    { key: "4xx", color: colors.warning },
    { key: "3xx", color: colors.info },
    { key: "2xx", color: colors.success },
  ];
  return (
    <View style={styles.detailSection}>
      <DetailHeader label={block.label} ms={block.ms} />
      {block.state !== "ok" || !stats ? (
        <DetailNotice state={block.state} detail={block.detail} />
      ) : (
        <>
          <View style={styles.statsRow}>
            {buckets.map((b) => (
              <View key={b.key} style={styles.statChip}>
                <Text style={[styles.statNum, { color: b.color }]}>{stats.byStatus?.[b.key] ?? 0}</Text>
                <Text style={styles.statLabel}>{b.key}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.detailMuted}>
            За 60 мин: {stats.total} запросов · avg {stats.avgMs} мс · p95 {stats.p95Ms} мс · ошибок в логе
            за час: {stats.errorsLastHour}
          </Text>
          {stats.slowest && stats.slowest.length > 0 ? (
            <View style={styles.slowList}>
              <Text style={styles.detailSub}>Самые медленные:</Text>
              {stats.slowest.slice(0, 3).map((r, i) => (
                <View key={`${r.ts}-${i}`} style={styles.slowRow}>
                  <Text style={styles.slowPath} numberOfLines={1}>
                    {r.method} {r.path}
                  </Text>
                  <Text style={[styles.slowMs, r.ms > 1500 ? { color: colors.warning } : null]}>
                    {r.ms} мс
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function ServerCacheBlock({ block }: { block: ServerDetailBlock<ServerCacheState> }) {
  return (
    <View style={styles.detailSection}>
      <DetailHeader label={block.label} ms={block.ms} />
      {block.state !== "ok" || !block.data ? (
        <DetailNotice state={block.state} detail={block.detail} />
      ) : (
        Object.entries(block.data).map(([name, entry]) => (
          <View key={name} style={styles.cacheRow}>
            <Text style={styles.cacheName}>{name}</Text>
            <Text style={styles.cacheMeta}>
              {entry.size} шт
              {entry.ttlSec != null ? ` · ttl ${entry.ttlSec} с` : ""}
              {entry.ageSec != null ? ` · возраст ${entry.ageSec} с` : ""}
            </Text>
          </View>
        ))
      )}
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
        <SectionTitle>Сервер: подробно</SectionTitle>
        <Text style={styles.desc}>
          Журнал ошибок, статистика запросов и состояние кэшей с сервера (эндпоинты
          /api/admin/diagnostics/*). Пока сайт не задеплоен — блоки показывают «ожидает деплоя».
        </Text>
        {report ? (
          <>
            <ServerLogsBlock block={report.serverDetail.logs} />
            <ServerRequestsBlock block={report.serverDetail.requests} />
            <ServerCacheBlock block={report.serverDetail.cache} />
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

  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  detailTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  detailSection: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailOk: { color: colors.success, fontSize: 12 },
  detailMuted: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  noticeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  noticeText: { fontSize: 12, flex: 1 },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  statChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  statNum: { fontSize: 16, fontWeight: "700" },
  statLabel: { color: colors.textMuted, fontSize: 10, marginTop: 1 },
  slowList: { marginTop: spacing.sm },
  detailSub: { color: colors.textMuted, fontSize: 11, marginBottom: spacing.xs },
  slowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  slowPath: { color: colors.text, fontSize: 12, flex: 1, minWidth: 0 },
  slowMs: { color: colors.textMuted, fontSize: 12 },
  cacheRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  cacheName: { color: colors.text, fontSize: 13, fontWeight: "600" },
  cacheMeta: { color: colors.textMuted, fontSize: 12 },
});
