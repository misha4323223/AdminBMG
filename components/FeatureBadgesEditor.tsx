import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@/constants/theme";
import { apiGet } from "@/lib/api";
import { SectionTitle } from "./ui";

interface Template {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export function FeatureBadgesEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<Record<string, { icon?: string; title?: string; description?: string }>>(
          "/page-settings/product_feature_templates",
        );
        const list = Object.entries(data || {}).map(([id, t]) => ({
          id,
          icon: t?.icon || "Sparkles",
          title: t?.title || id,
          description: t?.description || "",
        }));
        setTemplates(list);
      } catch {
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (id: string) => {
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id],
    );
  };

  if (loading) {
    return <Text style={styles.hint}>Загрузка шаблонов…</Text>;
  }

  if (templates.length === 0) {
    return (
      <Text style={styles.hint}>
        Шаблонов пока нет — создайте их в разделе «Страницы → Бейджи товаров».
      </Text>
    );
  }

  return (
    <View>
      <SectionTitle>Значки-характеристики</SectionTitle>
      <Text style={styles.hint}>
        Отметьте блоки, которые покажутся под кнопкой «В корзину».
      </Text>
      <View style={styles.chips}>
        {templates.map((t) => {
          const active = value.includes(t.id);
          return (
            <Pressable
              key={t.id}
              onPress={() => toggle(t.id)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Ionicons
                name={active ? "checkmark-circle" : "ellipse-outline"}
                size={15}
                color={active ? colors.accent : colors.textMuted}
              />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {t.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm, lineHeight: 17 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipText: { color: colors.textMuted, fontSize: 13 },
  chipTextActive: { color: colors.accent, fontWeight: "600" },
});
