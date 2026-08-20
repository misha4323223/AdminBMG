import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Button, Card, Field, InlineError, LoadingView, SectionTitle } from "@/components/ui";
import { apiGet, apiPost, getErrorMessage } from "@/lib/api";
import { colors, spacing } from "@/constants/theme";

type Tab = "faq" | "about" | "privacy" | "terms" | "care";

function parseStatic(raw: unknown): Record<string, any> | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as Record<string, any>;
  return null;
}

export default function StaticPagesScreen() {
  const [tab, setTab] = useState<Tab>("faq");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await apiGet<Record<string, unknown>>("/page-settings/static_pages"));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (pageKey: string, settings: Record<string, unknown>) => {
    setSaving(true);
    setError("");
    setMsg("");
    try {
      await apiPost(`/admin/page-settings/static_pages/${pageKey}_data`, settings);
      setMsg("Сохранено ✓");
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen title="Статичные страницы" scroll={false}>
        <LoadingView />
      </Screen>
    );
  }

  const raw = (key: Tab) => data?.[`${key}_data`];
  const parsed = (key: Tab) => parseStatic(raw(key));

  return (
    <Screen title="Статичные страницы" scroll={false}>
      <View style={styles.tabs}>
        <TabBtn label="FAQ" active={tab === "faq"} onPress={() => setTab("faq")} />
        <TabBtn label="О бренде" active={tab === "about"} onPress={() => setTab("about")} />
        <TabBtn label="Политика" active={tab === "privacy"} onPress={() => setTab("privacy")} />
        <TabBtn label="Оферта" active={tab === "terms"} onPress={() => setTab("terms")} />
        <TabBtn label="Уход" active={tab === "care"} onPress={() => setTab("care")} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <InlineError text={error} />
        {msg ? <Text style={styles.saved}>{msg}</Text> : null}

        {tab === "faq" ? <FaqEditor value={parsed("faq")} onSave={save} saving={saving} /> : null}
        {tab === "about" ? <AboutEditor value={parsed("about")} onSave={save} saving={saving} /> : null}
        {tab === "privacy" || tab === "terms" || tab === "care" ? (
          <HtmlEditor tab={tab} value={parsed(tab)} onSave={save} saving={saving} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function FaqEditor({
  value,
  onSave,
  saving,
}: {
  value: Record<string, any> | null;
  onSave: (key: string, settings: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [items, setItems] = useState<Array<{ question: string; answer: string }>>([]);

  useEffect(() => {
    const raw = Array.isArray(value?.items) ? value.items : [];
    setItems(raw.length > 0 ? raw : [{ question: "", answer: "" }]);
  }, [value]);

  const update = (i: number, patch: Partial<{ question: string; answer: string }>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const remove = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const move = (i: number, dir: -1 | 1) => {
    const to = i + dir;
    if (to < 0 || to >= items.length) return;
    setItems((prev) => {
      const next = [...prev];
      [next[i], next[to]] = [next[to], next[i]];
      return next;
    });
  };

  return (
    <View style={styles.editor}>
      <SectionTitle>Вопросы и ответы</SectionTitle>
      {items.map((it, i) => (
        <Card key={i} style={styles.faqCard}>
          <View style={styles.faqHeader}>
            <Text style={styles.faqIndex}>#{i + 1}</Text>
            <View style={styles.faqHeaderActions}>
              <Pressable
                onPress={() => move(i, -1)}
                disabled={i === 0}
                hitSlop={8}
                style={[styles.faqMoveBtn, i === 0 && styles.faqMoveDisabled]}
              >
                <Ionicons name="chevron-up" size={16} color={i === 0 ? colors.textMuted : colors.text} />
              </Pressable>
              <Pressable
                onPress={() => move(i, 1)}
                disabled={i === items.length - 1}
                hitSlop={8}
                style={[styles.faqMoveBtn, i === items.length - 1 && styles.faqMoveDisabled]}
              >
                <Ionicons name="chevron-down" size={16} color={i === items.length - 1 ? colors.textMuted : colors.text} />
              </Pressable>
              <Pressable onPress={() => remove(i)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
          </View>
          <Field label="Вопрос" value={it.question} onChangeText={(v) => update(i, { question: v })} />
          <Field label="Ответ" value={it.answer} onChangeText={(v) => update(i, { answer: v })} multiline />
        </Card>
      ))}
      <Button
        title="Добавить вопрос"
        variant="secondary"
        icon="add"
        onPress={() => setItems((prev) => [...prev, { question: "", answer: "" }])}
      />
      <View style={styles.saveRow}>
        <Button
          title="Сохранить FAQ"
          onPress={() => onSave("faq", { items: items.filter((i) => i.question.trim()) })}
          loading={saving}
          icon="save-outline"
        />
      </View>
    </View>
  );
}

function AboutEditor({
  value,
  onSave,
  saving,
}: {
  value: Record<string, any> | null;
  onSave: (key: string, settings: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [fields, setFields] = useState<Record<string, string>>({
    title: "Мы —",
    titleAccent: "Boomerangs",
    description: "",
    image1: "",
    image1Alt: "",
    image2: "",
    image2Alt: "",
    quote: "",
  });

  useEffect(() => {
    if (value) {
      setFields((f) => ({
        ...f,
        ...Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, typeof v === "string" ? v : ""]),
        ),
      }));
    }
  }, [value]);

  const set = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }));

  return (
    <View style={styles.editor}>
      <SectionTitle>Страница «О бренде»</SectionTitle>
      <Field label="Заголовок (до акцента)" value={fields.title} onChangeText={(v) => set("title", v)} />
      <Field label="Акцент" value={fields.titleAccent} onChangeText={(v) => set("titleAccent", v)} />
      <Field label="Описание" value={fields.description} onChangeText={(v) => set("description", v)} multiline />
      <Field label="Фото 1 (URL)" value={fields.image1} onChangeText={(v) => set("image1", v)} autoCapitalize="none" />
      <Field label="Alt фото 1" value={fields.image1Alt} onChangeText={(v) => set("image1Alt", v)} />
      <Field label="Фото 2 (URL)" value={fields.image2} onChangeText={(v) => set("image2", v)} autoCapitalize="none" />
      <Field label="Alt фото 2" value={fields.image2Alt} onChangeText={(v) => set("image2Alt", v)} />
      <Field label="Цитата" value={fields.quote} onChangeText={(v) => set("quote", v)} multiline />
      <Button title="Сохранить" onPress={() => onSave("about", fields)} loading={saving} icon="save-outline" />
    </View>
  );
}

function HtmlEditor({
  tab,
  value,
  onSave,
  saving,
}: {
  tab: "privacy" | "terms" | "care";
  value: Record<string, any> | null;
  onSave: (key: string, settings: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [content, setContent] = useState("");

  useEffect(() => {
    setContent(typeof value?.content === "string" ? value.content : "");
  }, [value]);

  const labels: Record<typeof tab, string> = {
    privacy: "Политика конфиденциальности",
    terms: "Публичная оферта",
    care: "Уход за товаром",
  };

  return (
    <View style={styles.editor}>
      <SectionTitle>{labels[tab]}</SectionTitle>
      <Field label="HTML-контент" value={content} onChangeText={setContent} multiline />
      <Button title="Сохранить" onPress={() => onSave(tab, { content })} loading={saving} icon="save-outline" />
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
  tabs: {
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.lg,
    paddingBottom: spacing.sm,
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
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  editor: {},
  faqCard: { marginBottom: spacing.md },
  faqHeaderActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  faqMoveBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  faqMoveDisabled: { opacity: 0.4 },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  faqIndex: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  saveRow: { marginTop: spacing.md },
  saved: { color: colors.success, fontSize: 13, marginBottom: spacing.sm },
});
