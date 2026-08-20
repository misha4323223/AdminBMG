import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { SchemaEditor } from "@/components/SchemaEditor";
import { Badge, Button, EmptyState, InlineError, LoadingView } from "@/components/ui";
import { apiDelete, apiGet, apiPost, getErrorMessage } from "@/lib/api";
import { colors, radius, spacing } from "@/constants/theme";

const DEFAULT_ORDER = [
  "hero",
  "reels",
  "categories",
  "popular",
  "featuredDrop",
  "benefits",
  "philosophy",
  "blog",
  "promo_banner",
  "newsletter",
  "marquee",
];

const SECTION_NAMES: Record<string, string> = {
  hero: "Hero (главный баннер)",
  reels: "Обзоры (видео-рилсы)",
  categories: "Категории",
  popular: "Популярное",
  featuredDrop: "Капсула времени (Pre-drop)",
  benefits: "Преимущества",
  philosophy: "Философия",
  blog: "Блог",
  promo_banner: "Промо-баннер",
  newsletter: "Подписка",
  marquee: "Бегущая строка",
  artists: "Наши артисты",
  sectionOrder: "Порядок секций",
};

const CUSTOM_TYPES: Array<{ type: string; name: string; desc: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { type: "custom_hits", name: "Хиты продаж", desc: "Подборка популярных товаров", icon: "trending-up-outline" },
  { type: "custom_promo_banner", name: "Промо-баннер", desc: "Акционный баннер с кнопкой", icon: "megaphone-outline" },
  { type: "custom_text", name: "Текстовый блок", desc: "Заголовок, текст и картинка", icon: "document-text-outline" },
];

function ArtistsOrderEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const obj = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const items = Array.isArray(obj.items) ? (obj.items as Record<string, unknown>[]) : [];

  const setItems = (next: Record<string, unknown>[]) => onChange({ ...obj, items: next });
  const move = (i: number, dir: -1 | 1) => {
    const to = i + dir;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[i], next[to]] = [next[to], next[i]];
    setItems(next);
  };

  if (items.length === 0) {
    return (
      <View style={styles.artistsHint}>
        <Text style={styles.artistsHintText}>
          Артистов пока нет. Добавьте их на вкладке «Страницы артистов», затем здесь задайте порядок.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.artistsBox}>
      <Text style={styles.artistsTitle}>Порядок артистов на главной</Text>
      {items.map((it, i) => (
        <View key={i} style={styles.artistRow}>
          <View style={styles.artistMoveCol}>
            <Pressable
              onPress={() => move(i, -1)}
              disabled={i === 0}
              hitSlop={4}
              style={[styles.artistMoveBtn, i === 0 && styles.artistMoveDisabled]}
            >
              <Ionicons name="chevron-up" size={14} color={i === 0 ? colors.textMuted : colors.text} />
            </Pressable>
            <Pressable
              onPress={() => move(i, 1)}
              disabled={i === items.length - 1}
              hitSlop={4}
              style={[styles.artistMoveBtn, i === items.length - 1 && styles.artistMoveDisabled]}
            >
              <Ionicons name="chevron-down" size={14} color={i === items.length - 1 ? colors.textMuted : colors.text} />
            </Pressable>
          </View>
          <View style={styles.artistInfo}>
            <Text style={styles.artistName} numberOfLines={1}>
              {String(it.name || "Без названия")}
            </Text>
            {it.slug ? (
              <Text style={styles.artistSlug} numberOfLines={1}>
                {String(it.slug)}
              </Text>
            ) : null}
          </View>
          <Text style={styles.artistIndex}>{i + 1}</Text>
        </View>
      ))}
      <Text style={styles.artistsHintText}>
        Порядок сохранится при нажатии «Сохранить секцию».
      </Text>
    </View>
  );
}

const CUSTOM_DEFAULTS: Record<string, Record<string, unknown>> = {
  custom_hits: { type: "custom_hits", title: "Хиты продаж", subtitle: "Лучшие товары", count: "8", mode: "manual", pinnedProductIds: [], visible: true },
  custom_promo_banner: { type: "custom_promo_banner", title: "НОВАЯ КОЛЛЕКЦИЯ", subtitle: "Описание акции", buttonText: "Смотреть", buttonLink: "/products", bgImage: "", bgColor: "black", textColor: "light", size: "medium", rounded: false, effect: "gradient-overlay", visible: true },
  custom_text: { type: "custom_text", title: "Заголовок", text: "", image: "", visible: true },
};

function sectionName(id: string, data: Record<string, unknown>): string {
  if (SECTION_NAMES[id]) return SECTION_NAMES[id];
  if (id.startsWith("custom_")) {
    const s = data[id] as Record<string, unknown> | undefined;
    if (s && typeof s.title === "string" && s.title) return s.title;
    const t = CUSTOM_TYPES.find((c) => c.type === id.replace(/_\d+$/, ""));
    return t ? t.name : id;
  }
  return id;
}

export default function HomeSectionsScreen() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiGet<Record<string, unknown>>("/page-settings/home");
      setData(res);
      const sectionOrder = (res.sectionOrder as { order?: unknown } | undefined)?.order;
      const saved = Array.isArray(sectionOrder) ? sectionOrder.filter((x): x is string => typeof x === "string") : [];
      const custom = Object.keys(res).filter((k) => k.startsWith("custom_"));
      const merged = [...new Set([...saved, ...DEFAULT_ORDER, ...custom])].filter(
        (k) => k !== "sectionOrder",
      );
      setOrder(merged);
      setSelected((prev) => (prev && prev in res ? prev : null));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveOrder = async (next: string[]) => {
    setOrder(next);
    await apiPost("/admin/page-settings/home/sectionOrder", { order: next });
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...order];
    const to = idx + dir;
    if (to < 0 || to >= next.length) return;
    [next[idx], next[to]] = [next[to], next[idx]];
    setError("");
    try {
      await saveOrder(next);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const addCustom = async (type: string) => {
    const id = `${type}_${Date.now()}`;
    setAddOpen(false);
    setError("");
    setSaving(true);
    try {
      await apiPost(`/admin/page-settings/home/${id}`, CUSTOM_DEFAULTS[type]);
      await saveOrder([...order, id]);
      await load();
      setSelected(id);
      setDraft(CUSTOM_DEFAULTS[type]);
      setSavedMsg(`Секция «${CUSTOM_TYPES.find((t) => t.type === type)?.name}» добавлена`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const removeCustom = async (id: string) => {
    setError("");
    setSaving(true);
    try {
      await apiPost("/admin/page-settings/home/sectionOrder", { order: order.filter((s) => s !== id) });
      await apiDelete(`/admin/page-settings/home/${id}`);
      await load();
      setSavedMsg("Секция удалена");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const openSection = (id: string) => {
    if (selected === id) {
      setSelected(null);
      setDraft(null);
      return;
    }
    setSelected(id);
    setDraft(data?.[id]);
    setSavedMsg("");
  };

  const saveSection = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    setSavedMsg("");
    try {
      await apiPost(`/admin/page-settings/home/${selected}`, draft);
      setData((prev) => ({ ...(prev || {}), [selected]: draft }));
      setSavedMsg(`Секция «${sectionName(selected, data || {})}» сохранена`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen title="Главная" scroll={false}>
        <LoadingView />
      </Screen>
    );
  }

  return (
    <Screen title="Главная" subtitle="Секции и порядок главной страницы">
      <InlineError text={error} />
      {savedMsg ? <Text style={styles.saved}>{savedMsg}</Text> : null}

      <Text style={styles.hint}>
        Секции показываются в порядке сверху вниз. Стрелками меняйте порядок, кастомные секции можно удалять. Нажмите на секцию, чтобы отредактировать её поля.
      </Text>

      <Button title="Добавить секцию" variant="secondary" icon="add" onPress={() => setAddOpen(true)} loading={saving} />

      {order.length === 0 ? (
        <EmptyState text="Секций пока нет — добавьте первую" />
      ) : (
        order.map((id, idx) => {
          const isCustom = id.startsWith("custom_");
          const hasData = !!data?.[id];
          return (
            <View key={id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardControls}>
                  <Pressable onPress={() => move(idx, -1)} disabled={idx === 0} hitSlop={6} style={({ pressed }) => [styles.moveBtn, (idx === 0 || pressed) && { opacity: 0.35 }]}>
                    <Ionicons name="chevron-up" size={16} color={colors.textMuted} />
                  </Pressable>
                  <Pressable onPress={() => move(idx, 1)} disabled={idx === order.length - 1} hitSlop={6} style={({ pressed }) => [styles.moveBtn, (idx === order.length - 1 || pressed) && { opacity: 0.35 }]}>
                    <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                  </Pressable>
                </View>
                <Pressable style={styles.cardTitleWrap} onPress={() => openSection(id)}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {sectionName(id, data || {})}
                  </Text>
                  {hasData ? <Badge tone="accent">настроено</Badge> : isCustom ? <Badge tone="warning">новое</Badge> : <Badge tone="neutral">по умолчанию</Badge>}
                </Pressable>
                {isCustom ? (
                  <Pressable onPress={() => removeCustom(id)} hitSlop={8} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </Pressable>
                ) : null}
              </View>

              {selected === id ? (
                <View style={styles.cardBody}>
                  {id === "artists" ? (
                    <ArtistsOrderEditor value={draft} onChange={setDraft} />
                  ) : null}
                  <SchemaEditor value={draft} onChange={setDraft} />
                  <View style={styles.actions}>
                    <Button title="Сохранить секцию" onPress={saveSection} loading={saving} icon="save-outline" />
                    <Button title="Закрыть" variant="ghost" onPress={() => { setSelected(null); setDraft(null); }} />
                  </View>
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAddOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Добавить секцию</Text>
              <Pressable onPress={() => setAddOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            {CUSTOM_TYPES.map((t) => (
              <Pressable key={t.type} style={styles.option} onPress={() => addCustom(t.type)}>
                <View style={styles.optionIcon}>
                  <Ionicons name={t.icon} size={18} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{t.name}</Text>
                  <Text style={styles.optionDesc}>{t.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: spacing.md },
  saved: { color: colors.success, fontSize: 13, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginTop: spacing.md,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardControls: {
    flexDirection: "column",
    gap: 2,
  },
  moveBtn: {
    width: 24,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "600", flexShrink: 1 },
  deleteBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    backgroundColor: "#2a1114",
  },
  cardBody: {
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing.xl,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
  optionDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  artistsBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  artistsTitle: { color: colors.text, fontSize: 14, fontWeight: "700", marginBottom: spacing.xs },
  artistsHint: { marginBottom: spacing.md },
  artistsHintText: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs, lineHeight: 17 },
  artistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  artistMoveCol: { gap: 2 },
  artistMoveBtn: {
    width: 24,
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  artistMoveDisabled: { opacity: 0.4 },
  artistInfo: { flex: 1, minWidth: 0 },
  artistName: { color: colors.text, fontSize: 13, fontWeight: "600" },
  artistSlug: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  artistIndex: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
});
