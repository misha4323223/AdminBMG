import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Badge, Button, EmptyState, LoadingView, SearchBar } from "@/components/ui";
import { apiGet, apiPatch, apiPost, getErrorMessage } from "@/lib/api";
import { asText, formatRub } from "@/lib/format";
import type { Product } from "@/lib/types";
import { colors, radius, spacing } from "@/constants/theme";

export default function ProductsScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  // Selection / bulk
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkMode, setBulkMode] = useState<"badge" | "discount" | null>(null);
  const [bulkValue, setBulkValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const data = await apiGet<{ products: Product[]; total?: number }>(
        "/products?limit=5000&admin=true",
      );
      setProducts(Array.isArray(data.products) ? data.products : []);
      setTotal(data.total ?? data.products?.length ?? 0);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.category) set.add(String(p.category));
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCat = !category || p.category === category;
      if (!matchesCat) return false;
      if (!q) return true;
      return (
        (p.name || "").toLowerCase().includes(q) ||
        (p.slug || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q)
      );
    });
  }, [products, query, category]);

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const exitSelection = () => {
    setSelecting(false);
    setSelected(new Set());
    setBulkMode(null);
    setBulkValue("");
    setConfirmDelete(false);
  };

  const runBulk = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBusy(true);
    setError("");
    try {
      if (bulkMode === "badge") {
        await apiPatch("/admin/products/bulk-badges", { ids, badgeText: bulkValue || null, isNew: false });
      } else if (bulkMode === "discount") {
        await apiPatch("/admin/products/bulk-discount", { ids, discountPercent: Number(bulkValue) || 0 });
      } else if (confirmDelete) {
        await apiPost("/admin/products/bulk-delete", { ids });
      }
      exitSelection();
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen title="Товары" scroll={false}>
        <LoadingView />
      </Screen>
    );
  }

  const headerRight = (
    <View style={styles.headerActions}>
      {selecting ? (
        <Pressable onPress={exitSelection} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>Готово</Text>
        </Pressable>
      ) : (
        <>
          <Pressable onPress={() => setSelecting(true)} style={styles.headerBtn}>
            <Ionicons name="checkmark-done-outline" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable onPress={() => router.push("/products/new" as never)} style={styles.headerBtn}>
            <Ionicons name="add" size={20} color={colors.accent} />
          </Pressable>
        </>
      )}
    </View>
  );

  return (
    <Screen
      title="Товары"
      subtitle={`${filtered.length} из ${total || products.length}${selecting ? ` · выбрано ${selected.size}` : ""}`}
      scroll={false}
      right={headerRight}
    >
      {selecting ? (
        <View style={styles.bulkBar}>
          {bulkMode === null ? (
            <View style={styles.bulkRow}>
              <Button title="Бейдж" onPress={() => setBulkMode("badge")} variant="secondary" icon="pricetag-outline" />
              <Button title="Скидка" onPress={() => setBulkMode("discount")} variant="secondary" icon="pricetags-outline" />
              <Button
                title={confirmDelete ? "Точно удалить?" : "Удалить"}
                onPress={() => (confirmDelete ? runBulk() : setConfirmDelete(true))}
                variant="danger"
                icon="trash-outline"
                loading={busy && confirmDelete}
              />
            </View>
          ) : (
            <View style={styles.bulkRow}>
              <TextInput
                value={bulkValue}
                onChangeText={setBulkValue}
                placeholder={bulkMode === "badge" ? "Текст бейджа (NEW…)" : "Скидка %"}
                placeholderTextColor={colors.textMuted}
                keyboardType={bulkMode === "discount" ? "numeric" : "default"}
                style={styles.bulkInput}
              />
              <Button title="Применить" onPress={runBulk} loading={busy} />
              <Button title="Отмена" onPress={() => setBulkMode(null)} variant="ghost" />
            </View>
          )}
        </View>
      ) : null}

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      <FlatList
        data={filtered}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={styles.listContent}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Поиск по названию, slug или артикулу"
            />
            {categories.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                <Chip label="Все" active={category === null} onPress={() => setCategory(null)} />
                {categories.map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    active={category === c}
                    onPress={() => setCategory(category === c ? null : c)}
                  />
                ))}
              </ScrollView>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <Pressable
              onPress={() =>
                selecting ? toggleSelect(item.id) : router.push(`/products/${item.id}` as never)
              }
              style={({ pressed }) => [
                styles.row,
                pressed && { opacity: 0.7 },
                isSelected && styles.rowSelected,
              ]}
            >
              {selecting ? (
                <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                  {isSelected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                </View>
              ) : null}
              <Image
                source={{ uri: item.imageUrl || item.images?.[0] || item.image }}
                style={styles.thumb}
                contentFit="cover"
                transition={100}
              />
              <View style={styles.rowBody}>
                <Text style={styles.name} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.meta}>
                  {item.category || "—"}
                  {item.subcategory ? ` · ${item.subcategory}` : ""}
                </Text>
                <Text style={styles.price}>{formatRub(item.price)}</Text>
              </View>
              {!selecting ? (
                <View style={styles.badges}>
                  {item.isHidden ? <Badge tone="warning">скрыт</Badge> : null}
                  {asText(item.badgeText) || asText(item.badge) ? (
                    <Badge tone="accent">{asText(item.badgeText) || asText(item.badge)}</Badge>
                  ) : null}
                  {Number(item.stock) <= 0 ? <Badge tone="danger">нет</Badge> : null}
                </View>
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState text={error ? "Ошибка загрузки" : "Ничего не найдено"} />
        }
      />
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: "row", gap: spacing.xs },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnText: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  bulkBar: {
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  bulkRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  bulkInput: {
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
  errorBanner: { color: colors.danger, fontSize: 13, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  listContent: { paddingBottom: spacing.xxl },
  headerBlock: {
    padding: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  rowSelected: { backgroundColor: colors.accentSoft },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  rowBody: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: "600" },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  price: { color: colors.accent, fontSize: 14, fontWeight: "700", marginTop: 2 },
  badges: { alignItems: "flex-end", gap: 4 },
});
