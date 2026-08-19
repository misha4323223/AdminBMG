import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/constants/theme";

export interface SizesValue {
  sizes: string[];
  sizeStock: Record<string, number>;
  sizeDiscounts: Record<string, number>;
  disabledNotifySizes: string[];
  noSize: boolean;
}

const PRESET_SIZES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
  "4XL",
  "OneSize",
  "40-45",
  "34-39",
];

export function SizesEditor({
  value,
  onChange,
  priceKopeks = 0,
}: {
  value: SizesValue;
  onChange: (next: SizesValue) => void;
  priceKopeks?: number;
}) {
  const allSizes = useMemo(() => {
    const set = new Set<string>([...PRESET_SIZES, ...value.sizes]);
    return Array.from(set);
  }, [value.sizes]);

  const set = (partial: Partial<SizesValue>) => onChange({ ...value, ...partial });

  const toggleSize = (size: string) => {
    if (value.sizes.includes(size)) {
      const sizeStock = { ...value.sizeStock };
      delete sizeStock[size];
      const sizeDiscounts = { ...value.sizeDiscounts };
      delete sizeDiscounts[size];
      set({
        sizes: value.sizes.filter((s) => s !== size),
        sizeStock,
        sizeDiscounts,
        disabledNotifySizes: value.disabledNotifySizes.filter((s) => s !== size),
      });
    } else {
      set({ sizes: [...value.sizes, size] });
    }
  };

  const setStock = (size: string, text: string) => {
    const next = { ...value.sizeStock };
    const val = parseInt(text, 10);
    if (text === "" || Number.isNaN(val) || val < 0) delete next[size];
    else next[size] = val;
    set({ sizeStock: next });
  };

  const setDiscount = (size: string, text: string) => {
    const next = { ...value.sizeDiscounts };
    const val = parseInt(text, 10);
    if (text === "" || Number.isNaN(val) || val <= 0) delete next[size];
    else next[size] = Math.min(val, 99);
    set({ sizeDiscounts: next });
  };

  const toggleNotify = (size: string) => {
    const has = value.disabledNotifySizes.includes(size);
    set({
      disabledNotifySizes: has
        ? value.disabledNotifySizes.filter((s) => s !== size)
        : [...value.disabledNotifySizes, size],
    });
  };

  return (
    <View>
      {/* Без размера */}
      <Pressable
        style={styles.noSizeRow}
        onPress={() => set({ noSize: !value.noSize })}
      >
        <Text style={styles.noSizeText}>Без размера (авто OneSize)</Text>
        <View style={[styles.check, value.noSize && styles.checkOn]}>
          {value.noSize ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
        </View>
      </Pressable>

      <Text style={styles.subLabel}>Размеры</Text>
      <View style={styles.chips}>
        {allSizes.map((size) => {
          const active = value.sizes.includes(size);
          return (
            <Pressable
              key={size}
              onPress={() => toggleSize(size)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {size}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {value.sizes.length > 0 && !value.noSize ? (
        <View style={styles.blocks}>
          {/* Остаток по размерам */}
          <Text style={styles.subLabel}>Остаток по размерам</Text>
          <View style={styles.grid}>
            {value.sizes.map((size) => (
              <View key={size} style={styles.cell}>
                <Text style={styles.cellLabel}>{size}</Text>
                <TextInput
                  value={
                    value.sizeStock[size] !== undefined
                      ? String(value.sizeStock[size])
                      : ""
                  }
                  onChangeText={(t) => setStock(size, t)}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.cellInput}
                />
              </View>
            ))}
          </View>

          {/* Скидка по размеру */}
          <Text style={styles.subLabel}>Скидка по размеру (%)</Text>
          <Text style={styles.hint}>
            Скидка на размер перекрывает общую скидку товара. 0 — без скидки.
          </Text>
          <View style={styles.grid}>
            {value.sizes.map((size) => (
              <View key={size} style={styles.cell}>
                <Text style={styles.cellLabel}>{size}</Text>
                <TextInput
                  value={
                    value.sizeDiscounts[size] !== undefined
                      ? String(value.sizeDiscounts[size])
                      : ""
                  }
                  onChangeText={(t) => setDiscount(size, t)}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.cellInput}
                />
              </View>
            ))}
          </View>
          {Object.keys(value.sizeDiscounts).length > 0 && priceKopeks > 0 ? (
            <View style={styles.preview}>
              {Object.entries(value.sizeDiscounts).map(([size, pct]) => (
                <Text key={size} style={styles.previewText}>
                  {size}: {Math.round((priceKopeks / 100) * (1 - pct / 100))} ₽ (−{pct}%)
                </Text>
              ))}
            </View>
          ) : null}

          {/* Уведомления о наличии */}
          <Text style={styles.subLabel}>Уведомления о наличии</Text>
          <Text style={styles.hint}>
            Размер с выключенным уведомлением не показывается, когда его нет в наличии.
          </Text>
          <View style={styles.chips}>
            {value.sizes.map((size) => {
              const disabled = value.disabledNotifySizes.includes(size);
              return (
                <Pressable
                  key={size}
                  onPress={() => toggleNotify(size)}
                  style={[styles.notifyChip, disabled && styles.notifyChipOff]}
                >
                  <Ionicons
                    name={disabled ? "notifications-off" : "notifications"}
                    size={14}
                    color={disabled ? colors.textMuted : colors.success}
                  />
                  <Text
                    style={[
                      styles.notifyText,
                      disabled && styles.notifyTextOff,
                    ]}
                  >
                    {size}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  noSizeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  noSizeText: { color: colors.text, fontSize: 14 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  subLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  hint: { color: colors.textMuted, fontSize: 11, marginBottom: spacing.sm, lineHeight: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: 13 },
  chipTextActive: { color: colors.white, fontWeight: "600" },
  blocks: { marginTop: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  cell: { width: "30%", flexGrow: 1, marginBottom: spacing.sm },
  cellLabel: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginBottom: 4 },
  cellInput: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 14,
    textAlign: "center",
  },
  preview: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  previewText: { color: colors.warning, fontSize: 12 },
  notifyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: "#0f2a1a",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.success,
  },
  notifyChipOff: { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
  notifyText: { color: colors.success, fontSize: 12 },
  notifyTextOff: { color: colors.textMuted, textDecorationLine: "line-through" },
});
