import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Screen } from "@/components/Screen";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  InlineError,
  LoadingView,
  SectionTitle,
} from "@/components/ui";
import { apiGet, apiPost, apiPut, getErrorMessage } from "@/lib/api";
import { colors, spacing } from "@/constants/theme";

type Tab = "knowledge" | "chat" | "queue" | "stats";

export default function AiScreen() {
  const [tab, setTab] = useState<Tab>("knowledge");
  return (
    <Screen title="AI" scroll={false}>
      <View style={styles.tabs}>
        <TabBtn label="Знания" active={tab === "knowledge"} onPress={() => setTab("knowledge")} />
        <TabBtn label="Чат" active={tab === "chat"} onPress={() => setTab("chat")} />
        <TabBtn label="Очередь" active={tab === "queue"} onPress={() => setTab("queue")} />
        <TabBtn label="Статистика" active={tab === "stats"} onPress={() => setTab("stats")} />
      </View>
      {tab === "knowledge" ? <KnowledgeTab /> : null}
      {tab === "chat" ? <ChatTab /> : null}
      {tab === "queue" ? <QueueTab /> : null}
      {tab === "stats" ? <StatsTab /> : null}
    </Screen>
  );
}

function KnowledgeTab() {
  const [blocks, setBlocks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<{ blocks: Record<string, string> }>("/admin/ai-knowledge");
      setBlocks(data.blocks || {});
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (key: string, value: string) => {
    setEditing(key);
    setDraft(value);
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      await apiPost(`/admin/ai-knowledge/${editing}`, { value: draft });
      setBlocks((b) => ({ ...b, [editing]: draft }));
      setEditing(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (key: string) => {
    setError("");
    try {
      const res = await apiPost<{ value: string }>(`/admin/ai-knowledge/${key}/reset`);
      setBlocks((b) => ({ ...b, [key]: res.value }));
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const entries = Object.entries(blocks);

  if (loading) {
    return (
      <View style={styles.flex}>
        <LoadingView />
      </View>
    );
  }

  return (
    <FlatList
      data={entries}
      keyExtractor={([key]) => key}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<InlineError text={error} />}
      renderItem={({ item: [key, value] }) =>
        editing === key ? (
          <Card style={styles.formCard}>
            <SectionTitle>{key}</SectionTitle>
            <Field
              label="Текст блока"
              value={draft}
              onChangeText={setDraft}
              multiline
            />
            <View style={styles.btnRow}>
              <Button title="Сохранить" onPress={save} loading={busy} icon="save-outline" />
              <Button title="Отмена" variant="ghost" onPress={() => setEditing(null)} />
            </View>
          </Card>
        ) : (
          <View style={styles.knowRow}>
            <Text style={styles.title}>{key}</Text>
            <Text style={styles.sub} numberOfLines={3}>
              {value}
            </Text>
            <View style={styles.knowActions}>
              <Pressable onPress={() => startEdit(key, value)} hitSlop={8}>
                <Text style={styles.edit}>Изменить</Text>
              </Pressable>
              <Pressable onPress={() => reset(key)} hitSlop={8}>
                <Text style={styles.reset}>Сбросить</Text>
              </Pressable>
            </View>
          </View>
        )
      }
      ListEmptyComponent={<EmptyState text={error || "База знаний пуста"} />}
    />
  );
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  pendingWrite?: { tool: string; params: Record<string, unknown> } | null;
}

function ChatTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  const send = async () => {
    const command = input.trim();
    if (!command || busy) return;
    setInput("");
    setError("");
    setMessages((m) => [...m, { role: "user", content: command }]);
    setBusy(true);
    try {
      const history = messages
        .filter((m) => !m.pendingWrite)
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await apiPost<any>("/admin/agent/chat", { command, history });
      if (res.type === "write") {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: res.description || "Подтвердить операцию?",
            pendingWrite: { tool: res.tool, params: res.params || {} },
          },
        ]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: res.text || "Готово" }]);
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const execute = async (msg: ChatMessage) => {
    if (!msg.pendingWrite) return;
    setBusy(true);
    setError("");
    try {
      const res = await apiPost<{ result: string }>("/admin/agent/execute", {
        tool: msg.pendingWrite.tool,
        params: msg.pendingWrite.params,
      });
      setMessages((m) =>
        m.map((x) =>
          x === msg
            ? { role: "assistant", content: res.result || "Выполнено", pendingWrite: null }
            : x,
        ),
      );
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        <InlineError text={error} />
        {messages.length === 0 ? (
          <EmptyState text="Напишите команду агенту, например: «Покажи последние 10 заказов»" />
        ) : (
          messages.map((m, i) => (
            <View
              key={i}
              style={[styles.bubbleWrap, m.role === "user" ? styles.bubbleUser : styles.bubbleAi]}
            >
              <View style={[styles.bubble, m.role === "user" ? styles.bubbleUserBg : styles.bubbleAiBg]}>
                <Text style={styles.bubbleText}>{m.content}</Text>
                {m.pendingWrite ? (
                  <View style={styles.confirmRow}>
                    <Button title="Выполнить" onPress={() => execute(m)} loading={busy} />
                    <Button
                      title="Отмена"
                      variant="ghost"
                      onPress={() =>
                        setMessages((all) =>
                          all.map((x) =>
                            x === m ? { role: "assistant", content: "Отменено", pendingWrite: null } : x,
                          ),
                        )
                      }
                    />
                  </View>
                ) : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Команда для BOOOM AI…"
          placeholderTextColor={colors.textMuted}
          style={styles.composerInput}
          multiline
          onSubmitEditing={send}
        />
        <Button title="→" onPress={send} loading={busy} />
      </View>
    </KeyboardAvoidingView>
  );
}

function QueueTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<{ items: any[] }>("/admin/agent-queue?status=pending");
      setItems(data.items || []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    setError("");
    try {
      await apiPost(`/admin/agent-queue/${id}/${action}`);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => String(i.id)}
      onRefresh={load}
      refreshing={loading}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<InlineError text={error} />}
      renderItem={({ item }) => (
        <View style={styles.queueCard}>
          <View style={styles.queueHeader}>
            <Text style={styles.title}>{item.title}</Text>
            <Badge tone={item.type === "seo" ? "info" : "warning"}>{item.type}</Badge>
          </View>
          <Text style={styles.sub}>{item.description}</Text>
          <Text style={styles.sub}>Инструмент: {item.tool}</Text>
          <View style={styles.queueActions}>
            <Button
              title="Подтвердить"
              onPress={() => act(item.id, "approve")}
              loading={busyId === item.id}
              icon="checkmark"
            />
            <Button
              title="Отклонить"
              variant="danger"
              onPress={() => act(item.id, "reject")}
              disabled={busyId === item.id}
              icon="close"
            />
          </View>
        </View>
      )}
      ListEmptyComponent={
        loading ? <LoadingView /> : <EmptyState text={error || "Очередь пуста"} />
      }
    />
  );
}

function StatsTab() {
  const [data, setData] = useState<{ status?: any; settings?: any; pendingCount?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settingsDraft, setSettingsDraft] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const d = await apiGet<any>("/admin/autonomous-agent/status");
      setData(d);
      setSettingsDraft((d.settings as Record<string, boolean>) || {});
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveSettings = async () => {
    setBusy(true);
    setError("");
    try {
      await apiPut("/admin/autonomous-agent/settings", settingsDraft);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.flex}>
        <LoadingView />
      </View>
    );
  }

  const boolSettings = Object.entries(settingsDraft).filter(([, v]) => typeof v === "boolean");

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <InlineError text={error} />
      <Card style={styles.card}>
        <SectionTitle>Автономный агент</SectionTitle>
        <View style={styles.statMeta}>
          <Text style={styles.sub}>В очереди на подтверждение</Text>
          <Text style={styles.statValue}>{data?.pendingCount ?? 0}</Text>
        </View>
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Настройки агента</SectionTitle>
        {boolSettings.map(([k, v]) => (
          <View key={k} style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{k}</Text>
            <Pressable
              onPress={() => setSettingsDraft((s) => ({ ...s, [k]: !v }))}
              style={[styles.toggle, v && styles.toggleOn]}
            >
              <View style={[styles.dot, v && styles.dotOn]} />
            </Pressable>
          </View>
        ))}
        <Button title="Сохранить настройки" onPress={saveSettings} loading={busy} icon="save-outline" />
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Статус</SectionTitle>
        <KeyValue data={data?.status} />
      </Card>
    </ScrollView>
  );
}

function KeyValue({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") return <EmptyState text="Нет данных" />;
  return (
    <View>
      {Object.entries(data as Record<string, unknown>).map(([k, v]) => (
        <View key={k} style={styles.kvRow}>
          <Text style={styles.kvKey}>{k}</Text>
          <Text style={styles.kvValue}>
            {typeof v === "object" ? JSON.stringify(v) : String(v)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: {
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.textMuted, fontWeight: "600", fontSize: 11 },
  tabTextActive: { color: colors.white },
  list: { paddingBottom: spacing.xxl },
  formCard: { margin: spacing.lg },
  btnRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  knowRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: 15, fontWeight: "600" },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  knowActions: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm },
  edit: { color: colors.accent, fontSize: 13 },
  reset: { color: colors.textMuted, fontSize: 13 },
  chatContent: { padding: spacing.lg, gap: spacing.md },
  bubbleWrap: { flexDirection: "row" },
  bubbleUser: { justifyContent: "flex-end" },
  bubbleAi: { justifyContent: "flex-start" },
  bubble: { maxWidth: "85%", padding: spacing.md, borderRadius: 14 },
  bubbleUserBg: { backgroundColor: colors.accent },
  bubbleAiBg: { backgroundColor: colors.surface },
  bubbleText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  confirmRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  composer: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-end",
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  composerInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    maxHeight: 110,
  },
  queueCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  queueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  queueActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  pad: { padding: spacing.lg, gap: spacing.lg },
  card: {},
  statMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statValue: { color: colors.text, fontSize: 18, fontWeight: "700" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  toggleLabel: { color: colors.text, fontSize: 14, flex: 1 },
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
});
