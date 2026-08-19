import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Accordion } from "@/components/Accordion";
import { Button, Card, Field, InlineError, LoadingView, SectionTitle } from "@/components/ui";
import { apiDelete, apiGet, apiPost, getErrorMessage } from "@/lib/api";
import { FEATURE_BADGE_ICON_OPTIONS, featureBadgeIcon } from "@/lib/featureBadgeIcons";
import { colors, radius, spacing } from "@/constants/theme";

interface Template {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export default function FeatureBadgeTemplatesScreen() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [icon, setIcon] = useState("Sparkles");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<Record<string, { icon?: string; title?: string; description?: string }>>(
        "/page-settings/product_feature_templates",
      );
      setTemplates(
        Object.entries(data || {}).map(([id, t]) => ({
          id,
          icon: t?.icon || "Sparkles",
          title: t?.title || id,
          description: t?.description || "",
        })),
      );
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetDraft = () => {
    setEditingId(null);
    setIcon("Sparkles");
    setTitle("");
    setDescription("");
  };

  const save = async () => {
    if (!title.trim()) {
      setError("Укажите заголовок");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const id = editingId || `badge_${Date.now()}`;
      await apiPost(`/admin/page-settings/product_feature_templates/${id}`, {
        icon,
        title: title.trim(),
        description: description.trim(),
      });
      resetDraft();
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setError("");
    try {
      await apiDelete(`/admin/page-settings/product_feature_templates/${id}`);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  if (loading) {
    return (
      <Screen title="Бейджи товаров" scroll={false}>
        <LoadingView />
      </Screen>
    );
  }

  return (
    <Screen title="Бейджи товаров" subtitle={`${templates.length} шаблонов`} scroll>
      <InlineError text={error} />

      <Card style={styles.card}>
        <SectionTitle>{editingId ? "Редактировать шаблон" : "Новый шаблон"}</SectionTitle>
        <Text style={styles.hint}>
          Иконка + заголовок + подпись (например «100% хлопок» / «Приятная к телу»).
        </Text>

        <Text style={styles.label}>Иконка</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconRow}>
          {FEATURE_BADGE_ICON_OPTIONS.map((o) => {
            const active = icon === o.name;
            return (
              <Pressable
                key={o.name}
                onPress={() => setIcon(o.name)}
                style={[styles.iconBtn, active && styles.iconBtnActive]}
              >
                <Ionicons
                  name={o.icon}
                  size={20}
                  color={active ? colors.white : colors.textMuted}
                />
              </Pressable>
            );
          })}
        </ScrollView>

        <Field label="Заголовок" value={title} onChangeText={setTitle} placeholder="100% хлопок" />
        <Field
          label="Подпись"
          value={description}
          onChangeText={setDescription}
          placeholder="Приятная к телу"
        />
        <View style={styles.actions}>
          <Button
            title={editingId ? "Сохранить изменения" : "Добавить шаблон"}
            onPress={save}
            loading={saving}
            icon="save-outline"
          />
          {editingId ? (
            <Button title="Отмена" onPress={resetDraft} variant="ghost" />
          ) : null}
        </View>
      </Card>

      <Text style={styles.sectionLabel}>Существующие шаблоны</Text>
      {templates.length === 0 ? (
        <Text style={styles.empty}>Пока нет ни одного шаблона.</Text>
      ) : (
        templates.map((t) => (
          <Card key={t.id} style={styles.rowCard}>
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name={featureBadgeIcon(t.icon)} size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t.title}</Text>
                {t.description ? <Text style={styles.rowSub}>{t.description}</Text> : null}
              </View>
              <Pressable
                onPress={() => {
                  setEditingId(t.id);
                  setIcon(t.icon);
                  setTitle(t.title);
                  setDescription(t.description);
                }}
                hitSlop={8}
                style={styles.rowBtn}
              >
                <Ionicons name="create-outline" size={18} color={colors.textMuted} />
              </Pressable>
              <Pressable onPress={() => remove(t.id)} hitSlop={8} style={styles.rowBtn}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.md, lineHeight: 17 },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs },
  iconRow: { gap: spacing.sm, paddingBottom: spacing.md, paddingRight: spacing.lg },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  sectionLabel: { color: colors.text, fontSize: 15, fontWeight: "700", marginBottom: spacing.sm },
  empty: { color: colors.textMuted, fontSize: 13, fontStyle: "italic" },
  rowCard: { marginBottom: spacing.sm, padding: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
  rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  rowBtn: { padding: 4 },
});
