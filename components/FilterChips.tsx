import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/constants/theme";
import { hapticLight } from "@/lib/haptics";

/**
 * Горизонтальный ряд чипов-фильтров со счётчиками.
 * Используется в списках заказов и других разделах.
 */
export interface FilterChipOption {
  key: string;
  label: string;
  count?: number;
}

export function FilterChips({
  options,
  value,
  onChange,
}: {
  options: FilterChipOption[];
  /** Ключ выбранного чипа (или null — ничего не выбрано). */
  value: string | null;
  onChange: (key: string | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => {
              hapticLight();
              onChange(opt.key === value ? null : opt.key);
            }}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {opt.label}
            </Text>
            {typeof opt.count === "number" ? (
              <View style={[styles.badge, active && styles.badgeActive]}>
                <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
                  {opt.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  labelActive: {
    color: colors.accent,
  },
  badge: {
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: colors.border,
    alignItems: "center",
  },
  badgeActive: {
    backgroundColor: colors.accent,
  },
  badgeText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  badgeTextActive: {
    color: colors.white,
  },
});
