import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { apiGet } from "@/lib/api";
import { formatRub } from "@/lib/format";
import { productThumb } from "@/lib/images";
import { DragList } from "./DragList";
import { SectionTitle } from "./ui";
import { colors, radius, spacing } from "@/constants/theme";

interface ProductLike {
  id: number;
  name?: string;
  sku?: string;
  isHidden?: boolean;
  price?: number;
  [key: string]: unknown;
}

/**
 * Управление товарами секции главной («Хиты продаж» / «Популярное») — как в
 * веб-админке: режим «Авто» (последние N товаров) или «Вручную» (закреплённые
 * товары с поиском, drag-and-drop порядком и удалением).
 */
export function PinnedProductsEditor({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const [products, setProducts] = useState<ProductLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const mode: "manual" | "auto" = value.mode === "manual" ? "manual" : "auto";
  const pinned = useMemo(
    () =>
      (Array.isArray(value.pinnedProductIds) ? (value.pinnedProductIds as unknown[]) : [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    [value.pinnedProductIds],
  );
  const count = Number(value.count) > 0 ? Math.floor(Number(value.count)) : 8;

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<{ products?: ProductLike[] }>("/products?limit=5000&admin=true");
        setProducts(Array.isArray(data.products) ? data.products : []);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const byId = useMemo(() => {
    const map = new Map<number, ProductLike>();
    for (const p of products) map.set(Number(p.id), p);
    return map;
  }, [products]);

  const patch = (next: Partial<{ mode: "manual" | "auto"; pinnedProductIds: number[] }>) =>
    onChange({ ...value, ...next });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => {
        if (p.isHidden) return false;
        if (pinned.includes(Number(p.id))) return false;
        if (!q) return false;
        const name = (p.name || "").toLowerCase();
        const sku = (p.sku || "").toLowerCase();
        return name.includes(q) || sku.includes(q);
      })
      .slice(0, 8);
  }, [products, pinned, query]);

  const addProduct = (id: number) => {
    if (pinned.includes(id)) return;
    patch({ pinnedProductIds: [...pinned, id] });
    setQuery("");
  };

  const removeProduct = (id: number) =>
    patch({ pinnedProductIds: pinned.filter((p) => p !== id) });

  const autoPreview = useMemo(
    () =>
      products
        .filter((p) => !p.isHidden)
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
        .slice(0, count),
    [products, count],
  );

  return (
    <View style={styles.wrap}>
      <SectionTitle>Выбор товаров</SectionTitle>

      {/* Переключатель режима */}
      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeBtn, mode !== "manual" && styles.modeBtnActive]}
          onPress={() => patch({ mode: "auto" })}
        >
          <Text style={[styles.modeText, mode !== "manual" && styles.modeTextActive]}>Авто</Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, mode === "manual" && styles.modeBtnActive]}
          onPress={() => patch({ mode: "manual" })}
        >
          <Text style={[styles.modeText, mode === "manual" && styles.modeTextActive]}>Вручную</Text>
        </Pressable>
      </View>

      {mode !== "manual" ? (
        <View style={styles.autoBlock}>
          <Text style={styles.hint}>
            Автоматически — последние {count} добавленных товаров. Сейчас в секции:
          </Text>
          {loading ? (
            <Text style={styles.hint}>Загрузка товаров…</Text>
          ) : autoPreview.length === 0 ? (
            <Text style={styles.hint}>Товаров пока нет.</Text>
          ) : (
            autoPreview.map((p, idx) => (
              <View key={p.id} style={styles.productRow}>
                <Text style={styles.index}>{idx + 1}</Text>
                {productThumb(p) ? (
                  <Image source={{ uri: productThumb(p) }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]} />
                )}
                <View style={styles.meta}>
                  <Text style={styles.name} numberOfLines={1}>{p.name || `Товар #${p.id}`}</Text>
                  <Text style={styles.sku}>{p.sku || `ID: ${p.id}`}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      ) : (
        <View>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Найти товар по названию или артикулу…"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {query.trim().length > 0 ? (
            <View style={styles.results}>
              {results.length === 0 ? (
                <Text style={styles.resultsEmpty}>Ничего не найдено</Text>
              ) : (
                results.map((p) => (
                  <Pressable key={p.id} style={styles.resultRow} onPress={() => addProduct(Number(p.id))}>
                    {productThumb(p) ? (
                      <Image source={{ uri: productThumb(p) }} style={styles.resultThumb} contentFit="cover" />
                    ) : (
                      <View style={[styles.resultThumb, styles.thumbEmpty]} />
                    )}
                    <View style={styles.meta}>
                      <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                      <Text style={styles.sku}>{p.sku || `ID: ${p.id}`}</Text>
                    </View>
                    <Ionicons name="add" size={18} color={colors.textMuted} />
                  </Pressable>
                ))
              )}
            </View>
          ) : null}

          <Text style={styles.dragHint}>
            Захватите и перетащите товар, чтобы изменить порядок. Порядок сохранится при нажатии «Сохранить секцию».
          </Text>

          {pinned.length === 0 ? (
            <Text style={styles.empty}>Добавьте товары через поиск выше</Text>
          ) : (
            <DragList
              items={pinned}
              keyExtractor={(id) => String(id)}
              onReorder={(ids) => patch({ pinnedProductIds: ids })}
              itemHeight={60}
              gap={8}
              renderItem={(id, idx) => {
                const p = byId.get(id);
                return (
                  <View style={styles.productRow}>
                    <Ionicons name="reorder-three-outline" size={18} color={colors.textMuted} />
                    <Text style={styles.index}>{idx + 1}</Text>
                    {productThumb(p) ? (
                      <Image source={{ uri: productThumb(p) }} style={styles.thumb} contentFit="cover" />
                    ) : (
                      <View style={[styles.thumb, styles.thumbEmpty]} />
                    )}
                    <View style={styles.meta}>
                      <Text style={styles.name} numberOfLines={1}>
                        {p?.name || `Товар #${id}`}
                      </Text>
                      <Text style={styles.sku}>{p?.sku || `ID: ${id}`}</Text>
                    </View>
                    <Pressable onPress={() => removeProduct(id)} hitSlop={8} style={styles.removeBtn}>
                      <Ionicons name="close" size={18} color={colors.danger} />
                    </Pressable>
                  </View>
                );
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  modeRow: {
    flexDirection: "row",
    borderRadius: radius.sm,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  modeBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: "center", backgroundColor: colors.surface },
  modeBtnActive: { backgroundColor: colors.accent },
  modeText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  modeTextActive: { color: colors.white },
  autoBlock: { gap: 0 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: spacing.sm },
  dragHint: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: spacing.sm, marginBottom: spacing.sm },
  empty: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, color: colors.text, paddingVertical: spacing.md, fontSize: 14 },
  results: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  resultsEmpty: { color: colors.textMuted, fontSize: 12, padding: spacing.md },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  resultThumb: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.surface },
  thumb: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surface },
  thumbEmpty: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  productRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  index: { color: colors.textMuted, fontSize: 12, fontWeight: "700", width: 18, textAlign: "center" },
  meta: { flex: 1, minWidth: 0 },
  name: { color: colors.text, fontSize: 13, fontWeight: "600" },
  sku: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: "#2a1114",
    alignItems: "center",
    justifyContent: "center",
  },
});
