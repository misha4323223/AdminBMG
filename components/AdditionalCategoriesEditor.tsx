import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card } from "./ui";
import { SelectField } from "./SelectField";
import {
  subcategoriesFor,
  subSubsFor,
  type CategoriesMap,
} from "@/lib/categories";
import { colors, spacing } from "@/constants/theme";

export interface AdditionalCategory {
  category: string;
  subcategory: string;
  subSubcategory?: string;
}

export function AdditionalCategoriesEditor({
  value,
  onChange,
  categories,
}: {
  value: AdditionalCategory[];
  onChange: (v: AdditionalCategory[]) => void;
  categories: CategoriesMap;
}) {
  const update = (i: number, patch: Partial<AdditionalCategory>) =>
    onChange(value.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const categoryOptions = Object.entries(categories).map(([slug, c]) => ({
    value: slug,
    label: c.name,
  }));

  return (
    <View>
      {value.length === 0 ? (
        <Text style={styles.empty}>
          Товар показывается только в основной категории. Нажмите «Добавить», чтобы
          показать его в другом разделе.
        </Text>
      ) : (
        value.map((ac, i) => (
          <AdditionalRow
            key={i}
            index={i}
            value={ac}
            categories={categories}
            categoryOptions={categoryOptions}
            onChange={(patch) => update(i, patch)}
            onRemove={() => remove(i)}
          />
        ))
      )}
      <Button
        title="Добавить категорию"
        variant="secondary"
        icon="add"
        onPress={() => onChange([...value, { category: "", subcategory: "" }])}
      />
    </View>
  );
}

function AdditionalRow({
  index,
  value,
  categories,
  categoryOptions,
  onChange,
  onRemove,
}: {
  index: number;
  value: AdditionalCategory;
  categories: CategoriesMap;
  categoryOptions: { value: string; label: string }[];
  onChange: (patch: Partial<AdditionalCategory>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  const subs = value.category ? subcategoriesFor(categories, value.category) : [];
  const subSubs = value.subcategory
    ? subSubsFor(categories, value.category, value.subcategory)
    : [];

  return (
    <Card style={styles.card}>
      <Pressable style={styles.header} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.index} numberOfLines={1}>
          Доп. категория #{index + 1}
          {value.category ? ` · ${categories[value.category]?.name || value.category}` : ""}
        </Text>
        <View style={styles.headerRight}>
          <Pressable onPress={onRemove} hitSlop={8} style={styles.trash}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </Pressable>
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textMuted}
          />
        </View>
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <SelectField
            label="Категория"
            value={value.category}
            options={categoryOptions}
            placeholder="Выберите категорию"
            onChange={(v) => onChange({ category: v, subcategory: "", subSubcategory: "" })}
          />
          <SelectField
            label="Подкатегория"
            value={value.subcategory}
            options={subs.map((s) => ({ value: s.name, label: s.name }))}
            placeholder="Все"
            allowEmpty={false}
            onChange={(v) => onChange({ subcategory: v, subSubcategory: "" })}
          />
          {subSubs.length > 0 ? (
            <SelectField
              label="Под-подкатегория"
              value={value.subSubcategory || ""}
              options={subSubs.map((s) => ({ value: s.name, label: s.name }))}
              placeholder="Все"
              onChange={(v) => onChange({ subSubcategory: v || "" })}
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.md, lineHeight: 19 },
  card: { marginBottom: spacing.md, padding: 0, overflow: "hidden" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  trash: { padding: 2 },
  index: { color: colors.textMuted, fontSize: 13, fontWeight: "700", flex: 1 },
  body: { padding: spacing.md, paddingTop: 0 },
});
