import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { DuplicatesPanel } from "@/components/DuplicatesPanel";
import { Badge, Button, Card, EmptyState, InlineError, LoadingView, SectionTitle } from "@/components/ui";
import { apiGet, apiPost, getErrorMessage } from "@/lib/api";
import { formatRub } from "@/lib/format";
import { productThumb } from "@/lib/images";
import { useCategories } from "@/lib/categories";
import { colors, radius, spacing } from "@/constants/theme";

type Filter = "all" | "hidden" | "noimage" | "zeroprice";
type SubTab = "items" | "duplicates";

interface ProblemsResponse {
  products?: Array<Record<string, any>>;
  total?: number;
}

interface ThumbDetails {
  generated?: number;
  failed?: number;
  remaining?: number;
  nextOffset?: number;
}

interface ThumbProgress {
  generated: number;
  failed: number;
  remaining: number;
  nextOffset: number;
}

type ProductRow = Record<string, any>;

export default function ProblemsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { categories } = useCategories();

  const [hidden, setHidden] = useState<ProductRow[]>([]);
  const [noImage, setNoImage] = useState<ProductRow[]>([]);
  const [zeroPrice, setZeroPrice] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [filter, setFilter] = useState<Filter>("all");
  const [subTab, setSubTab] = useState<SubTab>("items");
  // activeSub: без сужения типа внутри JSX (тернарник ниже сужает subTab до "items")
  const activeSub: SubTab = subTab;
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyAutoHide, setBusyAutoHide] = useState<"noimage" | "zeroprice" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [thumbForce, setThumbForce] = useState(false);
  const [thumbProgress, setThumbProgress] = useState<ThumbProgress | null>(null);
  const [thumbRunning, setThumbRunning] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [h, n, z] = await Promise.all([
        apiGet<ProblemsResponse>("/products/hidden"),
        apiGet<ProblemsResponse>("/products/no-image"),
        apiGet<ProblemsResponse>("/products/zero-price"),
      ]);
      setHidden(Array.isArray(h.products) ? h.products : []);
      setNoImage(Array.isArray(n.products) ? n.products : []);
      setZeroPrice(Array.isArray(z.products) ? z.products : []);
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

  const hiddenCount = hidden.length;
  const noImageCount = noImage.length;
  const zeroPriceCount = zeroPrice.length;
  const allCount = useMemo(
    () => new Set([...hidden, ...noImage, ...zeroPrice].map((p) => p.id)).size,
    [hidden, noImage, zeroPrice],
  );

  const catLabel = (slug?: string) => (slug ? categories[slug]?.name || slug : "");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (p: ProductRow) => !q || String(p.name || "").toLowerCase().includes(q);
    const lists: Array<{ group: Filter; items: ProductRow[] }> = [];
    if (filter === "all" || filter === "hidden") lists.push({ group: "hidden", items: hidden });
    if (filter === "all" || filter === "noimage") lists.push({ group: "noimage", items: noImage });
    if (filter === "all" || filter === "zeroprice") lists.push({ group: "zeroprice", items: zeroPrice });
    const seen = new Set<number>();
    const result: ProductRow[] = [];
    for (const { items } of lists) {
      for (const p of items) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        if (matches(p)) result.push(p);
      }
    }
    return result;
  }, [filter, search, hidden, noImage, zeroPrice]);

  const allSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(visible.map((p) => p.id)));
  };

  const toggleHide = async (p: ProductRow) => {
    setBusyId(p.id);
    setError("");
    try {
      const hiddenValue = !p.isHidden;
      await apiPost(`/products/${p.id}/hide`, { hidden: hiddenValue });
      const patch = (list: ProductRow[]) => list.map((item) => (item.id === p.id ? { ...item, isHidden: hiddenValue } : item));
      setHidden(patch(hidden));
      setNoImage(patch(noImage));
      setZeroPrice(patch(zeroPrice));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const autoHide = async (which: "noimage" | "zeroprice") => {
    setBusyAutoHide(which);
    setError("");
    try {
      await apiPost("/products/auto-hide-problematic", { filter: which });
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyAutoHide(null);
    }
  };

  const bulkDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      await apiPost("/admin/products/bulk-delete", { ids: [...selected] });
      setSelected(new Set());
      setConfirmDelete(false);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  const runThumbnails = async () => {
    setThumbRunning(true);
    setError("");
    try {
      const offset = thumbProgress && thumbProgress.remaining > 0 ? thumbProgress.nextOffset : 0;
      if (offset === 0) setThumbProgress(null);
      const res = await apiPost<{ details?: ThumbDetails }>(
        `/update-thumbnail-urls?limit=50&offset=${offset}${thumbForce ? "&force=true" : ""}`,
      );
      const d = res.details || {};
      const generated = d.generated ?? 0;
      const failed = d.failed ?? 0;
      const remaining = d.remaining ?? 0;
      const nextOffset = d.nextOffset ?? 0;
      setThumbProgress((prev) => ({
        generated: (prev?.generated || 0) + generated,
        failed: (prev?.failed || 0) + failed,
        remaining,
        nextOffset,
      }));
      if (remaining === 0) load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setThumbRunning(false);
    }
  };

  const numColumns = width >= 1200 ? 4 : width >= 800 ? 3 : 2;
  const sectionTitle =
    filter === "hidden" ? `Скрытые товары (${hiddenCount})` :
    filter === "noimage" ? `Без изображений (${noImageCount})` :
    filter === "zeroprice" ? `Без цены (${zeroPriceCount})` :
    `Проблемные товары (${allCount})`;

  const noImageVisibleCount = noImage.filter((p) => !p.isHidden).length;
  const zeroPriceVisibleCount = zeroPrice.filter((p) => !p.isHidden).length;

  return (
    <Screen title="Проблемные товары" subtitle={error || `${allCount} проблемных`} scroll={false}>
      {subTab === "duplicates" ? (
        <DuplicatesPanel />
      ) : (
      <FlatList
        data={visible}
        keyExtractor={(p) => String(p.id)}
        key={`cols-${numColumns}`}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.gridRow : undefined}
        onRefresh={load}
        refreshing={refreshing}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <InlineError text={error} />

            {/* Под-вкладки: Товары / Дубли (как на сайте) */}
            <View style={styles.subTabs}>
              <Pressable
                onPress={() => setSubTab("items")}
                style={[styles.subTab, activeSub === "items" && styles.subTabActive]}
              >
                <Ionicons name="cube-outline" size={14} color={activeSub === "items" ? colors.white : colors.textMuted} />
                <Text style={[styles.subTabText, activeSub === "items" && styles.subTabTextActive]}>
                  Товары
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSubTab("duplicates")}
                style={[styles.subTab, activeSub === "duplicates" && styles.subTabActive]}
              >
                <Ionicons name="copy-outline" size={14} color={activeSub === "duplicates" ? colors.white : colors.textMuted} />
                <Text style={[styles.subTabText, activeSub === "duplicates" && styles.subTabTextActive]}>
                  Дубли
                </Text>
              </Pressable>
            </View>

            {/* Фильтры */}
            <View style={styles.filters}>
              <FilterChip label="Все" count={allCount} active={filter === "all"} onPress={() => setFilter("all")} />
              <FilterChip label="Скрытые" count={hiddenCount} active={filter === "hidden"} onPress={() => setFilter("hidden")} />
              <FilterChip label="Без фото" count={noImageCount} active={filter === "noimage"} onPress={() => setFilter("noimage")} />
              <FilterChip label="Без цены" count={zeroPriceCount} active={filter === "zeroprice"} onPress={() => setFilter("zeroprice")} />
            </View>

            <View style={styles.toolbar}>
              <View style={styles.searchWrap}>
                <Ionicons name="search" size={15} color={colors.textMuted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Поиск по названию..."
                  placeholderTextColor={colors.textMuted}
                  style={styles.searchInput}
                />
                {search ? (
                  <Pressable onPress={() => setSearch("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
              <Button title="" variant="ghost" onPress={() => load(true)} loading={refreshing} icon="refresh" />
            </View>

            {/* Массовые действия */}
            <View style={styles.bulkRow}>
              <Button
                title={allSelected ? "Снять выбор" : `Выбрать все (${visible.length})`}
                variant="secondary"
                onPress={toggleSelectAll}
                icon="checkbox-outline"
              />
              {noImageVisibleCount > 0 && (filter === "all" || filter === "noimage") ? (
                <Button
                  title={`Скрыть без фото (${noImageVisibleCount})`}
                  variant="secondary"
                  onPress={() => autoHide("noimage")}
                  loading={busyAutoHide === "noimage"}
                  icon="eye-off-outline"
                />
              ) : null}
              {zeroPriceVisibleCount > 0 && (filter === "all" || filter === "zeroprice") ? (
                <Button
                  title={`Скрыть без цены (${zeroPriceVisibleCount})`}
                  variant="secondary"
                  onPress={() => autoHide("zeroprice")}
                  loading={busyAutoHide === "zeroprice"}
                  icon="eye-off-outline"
                />
              ) : null}
              {selected.size > 0 ? (
                <>
                  <Text style={styles.selectedText}>Выбрано: {selected.size}</Text>
                  {confirmDelete ? (
                    <View style={styles.confirmRow}>
                      <Button title="Удалить" variant="danger" onPress={bulkDelete} loading={deleting} />
                      <Button title="Отмена" variant="ghost" onPress={() => setConfirmDelete(false)} />
                    </View>
                  ) : (
                    <Button
                      title={`Удалить выбранные (${selected.size})`}
                      variant="danger"
                      onPress={() => setConfirmDelete(true)}
                      icon="trash-outline"
                    />
                  )}
                </>
              ) : null}
            </View>

            {/* Миниатюры каталога */}
            <Card style={styles.thumbCard}>
              <View style={styles.thumbHeader}>
                <View style={styles.thumbTextWrap}>
                  <Text style={styles.thumbTitle}>
                    <Ionicons name="images-outline" size={14} color={colors.text} /> Миниатюры каталога
                  </Text>
                  <Text style={styles.thumbHint}>
                    Создаёт оптимизированные миниатюры (800px, WebP quality 100) для карточек товаров. Улучшает скорость загрузки.
                  </Text>
                  {thumbProgress ? (
                    <Text style={styles.thumbProgress}>
                      Создано: {thumbProgress.generated}
                      {thumbProgress.failed > 0 ? ` · Ошибок: ${thumbProgress.failed}` : ""}
                      {thumbProgress.remaining > 0 ? ` · Осталось: ~${thumbProgress.remaining}` : ""}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.thumbControls}>
                  <Pressable onPress={() => setThumbForce((v) => !v)} style={styles.forceRow}>
                    <Ionicons
                      name={thumbForce ? "checkbox" : "square-outline"}
                      size={18}
                      color={thumbForce ? colors.accent : colors.textMuted}
                    />
                    <Text style={styles.forceLabel}>Перезаписать</Text>
                  </Pressable>
                  <Button
                    title={
                      thumbRunning
                        ? "Обработка..."
                        : thumbProgress && thumbProgress.remaining > 0
                          ? `Продолжить (ещё ~${thumbProgress.remaining})`
                          : "Создать миниатюры"
                    }
                    variant="secondary"
                    onPress={runThumbnails}
                    loading={thumbRunning}
                    icon="refresh"
                  />
                </View>
              </View>
            </Card>

            <Text style={styles.sectionTitle}>{sectionTitle}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.card} onPress={() => toggleSelect(item.id)}>
            <View style={styles.cardImageWrap}>
              {productThumb(item) ? (
                <Image source={{ uri: productThumb(item) }} style={styles.cardImage} contentFit="cover" />
              ) : (
                <View style={[styles.cardImage, styles.cardImageEmpty]}>
                  <Ionicons name="cube-outline" size={28} color={colors.textMuted} />
                </View>
              )}
              <View style={[styles.checkbox, selected.has(item.id) && styles.checkboxOn]}>
                {selected.has(item.id) ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
              </View>
              {item.isHidden ? (
                <View style={styles.hiddenBadge}>
                  <Text style={styles.hiddenBadgeText}>Скрыт</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
              <View style={styles.reasons}>
                {item.isHidden ? <Badge tone="danger">Скрыт</Badge> : null}
                {!item.imageUrl ? <Badge tone="warning">Нет фото</Badge> : null}
                {!item.price || item.price <= 0 ? <Badge tone="warning">Нет цены</Badge> : null}
                {(item.stock ?? 0) <= 0 ? <Badge tone="info">Нет в наличии</Badge> : null}
              </View>
              <View style={styles.cardMeta}>
                <Text style={styles.cardCat} numberOfLines={1}>{catLabel(item.category) || item.sku || ""}</Text>
                {filter === "zeroprice" ? (
                  <Text style={styles.cardPrice}>Остаток: {item.stock ?? 0}</Text>
                ) : (
                  <Text style={styles.cardPrice}>{formatRub(item.price)}</Text>
                )}
              </View>
              <View style={styles.cardActions}>
                <Button
                  title="Изменить"
                  variant="secondary"
                  onPress={() => router.push(`/products/${item.id}` as never)}
                  icon="pencil-outline"
                />
                <Button
                  title={item.isHidden ? "Показать" : "Скрыть"}
                  variant={item.isHidden ? "primary" : "danger"}
                  onPress={() => toggleHide(item)}
                  loading={busyId === item.id}
                  icon={item.isHidden ? "eye-outline" : "eye-off-outline"}
                />
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text={error || "Проблем нет"} />}
      />
      )}
    </Screen>
  );
}

function FilterChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label} {count}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl },
  subTabs: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  subTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subTabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  subTabText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  subTabTextActive: { color: colors.white },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.white },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  bulkRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  selectedText: { color: colors.textMuted, fontSize: 13 },
  confirmRow: { flexDirection: "row", gap: spacing.sm },
  thumbCard: { marginBottom: spacing.lg },
  thumbHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  thumbTextWrap: { flex: 1, minWidth: 220, gap: spacing.xs },
  thumbTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  thumbHint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  thumbProgress: { color: colors.textMuted, fontSize: 12 },
  thumbControls: { gap: spacing.sm },
  forceRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  forceLabel: { color: colors.textMuted, fontSize: 13 },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  gridRow: { gap: spacing.md, marginBottom: spacing.md },
  card: { flex: 1, padding: 0, overflow: "hidden" },
  cardImageWrap: { position: "relative", aspectRatio: 1, backgroundColor: colors.surfaceAlt },
  cardImage: { width: "100%", height: "100%" },
  cardImageEmpty: { alignItems: "center", justifyContent: "center" },
  checkbox: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "rgba(120,120,130,0.6)",
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  hiddenBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: colors.danger,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  hiddenBadgeText: { color: colors.white, fontSize: 10, fontWeight: "700" },
  cardBody: { padding: spacing.md, gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 13, fontWeight: "600" },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  cardCat: { color: colors.textMuted, fontSize: 11, flex: 1 },
  cardPrice: { color: colors.text, fontSize: 12, fontWeight: "600" },
  cardActions: { flexDirection: "row", gap: spacing.sm },
});
