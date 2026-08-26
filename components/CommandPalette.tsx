import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ADMIN_SECTIONS } from "@/lib/sections";
import { registerHotkey } from "@/lib/hotkeys";
import { getRecent, type RecentItem } from "@/lib/recent";
import { colors, font, radius, spacing } from "@/constants/theme";

/**
 * Палитра быстрого перехода: Ctrl+K → поиск раздела или «недавнего».
 * Работает только на web/ПК (на нативе не регистрируется).
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const off = registerHotkey(
      "command-palette",
      { key: "k", ctrl: true },
      () => {
        setQuery("");
        setOpen(true);
      },
      100,
    );
    const offEsc = registerHotkey(
      "command-palette-close",
      { key: "escape" },
      () => setOpen(false),
      100,
    );
    return () => {
      off();
      offEsc();
    };
  }, []);

  // Фокус на поле поиска сразу после открытия (web).
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  const [recent, setRecent] = useState<RecentItem[]>([]);
  useEffect(() => {
    if (open) void getRecent().then(setRecent);
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sections = q
      ? ADMIN_SECTIONS.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            s.key.toLowerCase().includes(q),
        )
      : ADMIN_SECTIONS;
    const recents = q
      ? recent.filter((r) => r.label.toLowerCase().includes(q))
      : recent;
    return { sections, recents };
  }, [query, recent]);

  const go = (route: string) => {
    setOpen(false);
    router.push(route as never);
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => setOpen(false)}
    >
      <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder="Раздел или «недавний»…"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoCapitalize="none"
            />
            <Text style={styles.escHint}>Esc</Text>
          </View>

          <FlatList
            data={[
              ...results.recents.map((r) => ({
                key: `recent-${r.type}-${r.id}`,
                icon: (r.type === "order" ? "receipt-outline" : "shirt-outline") as keyof typeof Ionicons.glyphMap,
                label: r.label,
                hint: r.type === "order" ? "Заказ" : "Товар",
                route: r.type === "order" ? `/orders/${r.id}` : `/products/${r.id}`,
              })),
              ...results.sections.map((s) => ({
                key: `section-${s.key}`,
                icon: s.icon,
                label: s.title,
                hint: s.description,
                route: s.route,
              })),
            ]}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => go(item.route)}
                style={({ pressed }) => [styles.item, pressed && { opacity: 0.75 }]}
              >
                <View style={styles.itemIcon}>
                  <Ionicons name={item.icon} size={16} color={colors.accent} />
                </View>
                <Text style={styles.itemLabel} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.itemHint} numberOfLines={1}>
                  {item.hint}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>Ничего не найдено</Text>
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(8, 8, 12, 0.72)",
    justifyContent: "flex-start",
    paddingTop: 120,
    paddingHorizontal: spacing.xl,
  },
  sheet: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 560,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontFamily: font.regular,
    paddingVertical: 4,
  },
  escHint: {
    color: colors.textMuted,
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  list: {
    maxHeight: 420,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(201, 206, 216, 0.08)",
  },
  itemIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  itemLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
  itemHint: {
    color: colors.textMuted,
    fontSize: 12,
    flex: 1,
    textAlign: "right",
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    padding: spacing.xl,
  },
});
