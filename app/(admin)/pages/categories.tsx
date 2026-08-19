import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Button, Card, Field, InlineError, LoadingView, SectionTitle } from "@/components/ui";
import { apiGet, apiPost, getErrorMessage } from "@/lib/api";
import {
  type CategoriesMap,
  type CategoryConfig,
  type SubcategoryConfig,
  type SubSubcategoryConfig,
} from "@/lib/categories";
import { colors, radius, spacing } from "@/constants/theme";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9_-]/g, "");

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<CategoriesMap>({});
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [adding, setAdding] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<{ categories?: CategoriesMap; productCounts?: Record<string, number> }>(
        "/admin/categories",
      );
      setCategories(data?.categories || {});
      setProductCounts(data?.productCounts || {});
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError("");
    setSavedMsg("");
    try {
      await apiPost("/admin/categories", { categories });
      setSavedMsg("Категории сохранены ✓");
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmAdd = () => {
    if (!newSlug.trim() || !newName.trim()) {
      setError("Заполните slug и название");
      return;
    }
    const slug = slugify(newSlug);
    if (!slug) {
      setError("Slug — только латиница, цифры, - и _");
      return;
    }
    if (categories[slug]) {
      setError("Категория с таким slug уже существует");
      return;
    }
    setCategories((prev) => ({
      ...prev,
      [slug]: { name: newName.trim(), slug, subcategories: [] },
    }));
    setNewSlug("");
    setNewName("");
    setAdding(false);
  };

  if (loading) {
    return (
      <Screen title="Категории" scroll={false}>
        <LoadingView />
      </Screen>
    );
  }

  return (
    <Screen
      title="Категории"
      subtitle={`${Object.keys(categories).length} разделов`}
      right={
        <Pressable onPress={save} style={styles.saveBtn} disabled={saving}>
          <Ionicons name="save-outline" size={18} color={colors.accent} />
        </Pressable>
      }
      scroll
    >
      <InlineError text={error} />
      {savedMsg ? <Text style={styles.saved}>{savedMsg}</Text> : null}

      <Card style={styles.card}>
        <View style={styles.toolbarRow}>
          <Text style={styles.hint}>
            Изменения применяются только после «Сохранить» (иконка сверху справа).
          </Text>
          <Button
            title="Добавить"
            onPress={() => setAdding((v) => !v)}
            variant="secondary"
            icon="add"
          />
        </View>

        {adding ? (
          <View style={styles.addForm}>
            <Field
              label="Slug (латиницей, без пробелов)"
              value={newSlug}
              onChangeText={(v) => setNewSlug(slugify(v))}
              autoCapitalize="none"
              placeholder="new-category"
            />
            <Field label="Название" value={newName} onChangeText={setNewName} placeholder="Новая категория" />
            <View style={styles.rowActions}>
              <Button title="Добавить категорию" onPress={confirmAdd} icon="checkmark" />
              <Button title="Отмена" onPress={() => setAdding(false)} variant="ghost" />
            </View>
          </View>
        ) : null}
      </Card>

      {Object.entries(categories).map(([slug, cat]) => (
        <CategoryCard
          key={slug}
          slug={slug}
          category={cat}
          productCount={productCounts[slug] || 0}
          onChange={(next) =>
            setCategories((prev) => {
              if (next === null) {
                const copy = { ...prev };
                delete copy[slug];
                return copy;
              }
              return { ...prev, [slug]: next };
            })
          }
        />
      ))}

      <Button title="Сохранить все" onPress={save} loading={saving} icon="save-outline" />
    </Screen>
  );
}

function CategoryCard({
  slug,
  category,
  productCount,
  onChange,
}: {
  slug: string;
  category: CategoryConfig;
  productCount: number;
  onChange: (next: CategoryConfig | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newSub, setNewSub] = useState("");

  const setSubs = (subcategories: SubcategoryConfig[]) =>
    onChange({ ...category, subcategories });

  const addSub = () => {
    if (!newSub.trim()) return;
    setSubs([...category.subcategories, { name: newSub.trim(), slug: "" }]);
    setNewSub("");
  };

  return (
    <Card style={styles.catCard}>
      <Pressable style={styles.catHeader} onPress={() => setOpen((v) => !v)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.catName}>{category.name}</Text>
          <Text style={styles.catSlug}>
            {slug} · {category.subcategories.length} подкат.
            {productCount > 0 ? ` · ${productCount} тов.` : ""}
          </Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
      </Pressable>

      {open ? (
        <View style={styles.catBody}>
          <Field label="Название" value={category.name} onChangeText={(v) => onChange({ ...category, name: v })} />
          <Field label="Slug" value={slug} editable={false} />

          <SectionTitle>Подкатегории</SectionTitle>
          {category.subcategories.map((sub, idx) => (
            <SubcategoryCard
              key={idx}
              sub={sub}
              onChange={(next) =>
                setSubs(category.subcategories.map((s, i) => (i === idx ? next : s)))
              }
              onDelete={() => setSubs(category.subcategories.filter((_, i) => i !== idx))}
            />
          ))}

          <View style={styles.addSubRow}>
            <TextInput
              value={newSub}
              onChangeText={setNewSub}
              placeholder="Новая подкатегория…"
              placeholderTextColor={colors.textMuted}
              style={styles.addSubInput}
              onSubmitEditing={addSub}
              returnKeyType="done"
            />
            <Button title="Добавить" onPress={addSub} variant="secondary" icon="add" />
          </View>

          <Button
            title="Удалить категорию"
            onPress={() => onChange(null)}
            variant="danger"
            icon="trash-outline"
          />
        </View>
      ) : null}
    </Card>
  );
}

function SubcategoryCard({
  sub,
  onChange,
  onDelete,
}: {
  sub: SubcategoryConfig;
  onChange: (next: SubcategoryConfig) => void;
  onDelete: () => void;
}) {
  const [showSubSubs, setShowSubSubs] = useState(false);
  const [newSubSub, setNewSubSub] = useState("");

  const subSubs = sub.subSubcategories || [];

  const setSubSubs = (list: SubSubcategoryConfig[]) =>
    onChange({ ...sub, subSubcategories: list });

  const addSubSub = () => {
    if (!newSubSub.trim()) return;
    setSubSubs([...subSubs, { name: newSubSub.trim(), slug: "" }]);
    setNewSubSub("");
  };

  return (
    <View style={styles.subCard}>
      <View style={styles.subRow}>
        <View style={styles.subFields}>
          <Field
            label="Название"
            value={sub.name}
            onChangeText={(v) => onChange({ ...sub, name: v })}
          />
          <Field
            label="Slug (необязательно)"
            value={sub.slug || ""}
            onChangeText={(v) => onChange({ ...sub, slug: slugify(v) })}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.subActions}>
          <Pressable onPress={() => setShowSubSubs((v) => !v)} hitSlop={8} style={styles.subBtn}>
            <Ionicons
              name={showSubSubs ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.textMuted}
            />
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={8} style={styles.subBtn}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </Pressable>
        </View>
      </View>

      {showSubSubs ? (
        <View style={styles.subSubBlock}>
          <Text style={styles.subSubLabel}>Под-подкатегории (3-й уровень)</Text>
          {subSubs.map((ss, i) => (
            <View key={i} style={styles.subSubRow}>
              <TextInput
                value={ss.name || ""}
                onChangeText={(v) =>
                  setSubSubs(subSubs.map((s, j) => (j === i ? { ...s, name: v } : s)))
                }
                placeholder="Название"
                placeholderTextColor={colors.textMuted}
                style={styles.subSubInput}
              />
              <TextInput
                value={ss.slug || ""}
                onChangeText={(v) =>
                  setSubSubs(subSubs.map((s, j) => (j === i ? { ...s, slug: slugify(v) } : s)))
                }
                placeholder="slug"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                style={styles.subSubInput}
              />
              <Pressable
                onPress={() => setSubSubs(subSubs.filter((_, j) => j !== i))}
                hitSlop={8}
              >
                <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
          ))}
          <View style={styles.addSubSubRow}>
            <TextInput
              value={newSubSub}
              onChangeText={setNewSubSub}
              placeholder="Новая под-подкатегория…"
              placeholderTextColor={colors.textMuted}
              style={styles.subSubInput}
              onSubmitEditing={addSubSub}
              returnKeyType="done"
            />
            <Button title="Добавить" onPress={addSubSub} variant="secondary" icon="add" />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  saveBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  saved: { color: colors.success, fontSize: 13, marginBottom: spacing.sm },
  card: { marginBottom: spacing.lg },
  toolbarRow: { gap: spacing.md },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  addForm: { marginTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md },
  rowActions: { flexDirection: "row", gap: spacing.sm },
  catCard: { marginBottom: spacing.md, padding: 0, overflow: "hidden" },
  catHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  catName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  catSlug: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  catBody: { padding: spacing.lg, paddingTop: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  subCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceAlt,
  },
  subRow: { flexDirection: "row", gap: spacing.sm },
  subFields: { flex: 1 },
  subActions: { justifyContent: "flex-start", gap: spacing.sm, paddingTop: spacing.xl },
  subBtn: { padding: 4 },
  subSubBlock: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  subSubLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  subSubRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm },
  subSubInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 13,
  },
  addSubSubRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  addSubRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center", marginBottom: spacing.md },
  addSubInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 14,
  },
});
