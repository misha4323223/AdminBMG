// Панель «Дубли товаров» — мобильный аналог веб-панели ProductDuplicatesPanel.
// Источник данных: GET /admin/products/duplicates (группы похожих товаров:
// одинаковое нормализованное имя или слаг с суффиксом -2/-3).
// Действия: скрыть/показать (PATCH /admin/products/:id), удалить
// (POST /admin/products/bulk-delete + авто-301 редирект слага на канон).
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  InlineError,
  LoadingView,
} from "@/components/ui";
import { apiGet, apiPatch, apiPost, getErrorMessage } from "@/lib/api";
import { formatRub } from "@/lib/format";
import { colors, radius, spacing } from "@/constants/theme";

interface DuplicateItem {
  id: number;
  name: string;
  slug: string;
  price: number;
  stock: number;
  imageCount: number;
  isHidden: boolean;
  autoHideOverride: boolean;
  inStock: boolean;
  updatedAt: string | null;
  externalId: string | null;
  danger?: boolean;
}

interface DuplicateGroup {
  key: string;
  reason: "name" | "slug";
  nameDiffers?: boolean;
  canonicalId: number | null;
  items: DuplicateItem[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function DuplicatesPanel() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const res = await apiGet<{ groups: DuplicateGroup[]; total: number }>(
        "/admin/products/duplicates",
      );
      setGroups(Array.isArray(res.groups) ? res.groups : []);
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

  const totalDups = groups.reduce(
    (acc, g) => acc + g.items.filter((it) => it.id !== g.canonicalId).length,
    0,
  );

  const toggleVisibility = async (item: DuplicateItem) => {
    setBusyId(item.id);
    setError("");
    try {
      const hidden = !item.isHidden;
      await apiPatch(`/admin/products/${item.id}`, {
        isHidden: hidden,
        autoHideOverride: true,
        inStock: !hidden,
      });
      // Обновляем элемент локально во всех группах
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          items: g.items.map((it) =>
            it.id === item.id ? { ...it, isHidden: hidden, inStock: !hidden } : it,
          ),
        })),
      );
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  /** 301-редирект со слага удалённого дубля на канон (как на сайте). */
  const addSlugRedirect = async (from: string, to: string) => {
    if (!from || !to || from === to) return;
    try {
      const settings = await apiGet<Record<string, unknown>>("/bonus-settings");
      let map: { from: string; to: string }[] = [];
      try {
        const parsed = JSON.parse(String(settings.slug_redirects || "[]"));
        if (Array.isArray(parsed)) map = parsed;
      } catch {
        /* оставляем пустую карту */
      }
      if (map.some((r) => r.from === from)) return;
      map.push({ from, to });
      await apiPost("/bonus-settings", {
        key: "slug_redirects",
        value: JSON.stringify(map),
      });
    } catch {
      // Редирект не критичен: товар уже удалён, не валим операцию
    }
  };

  const deleteItem = async (item: DuplicateItem, group: DuplicateGroup) => {
    setDeleting(true);
    setError("");
    try {
      await apiPost("/admin/products/bulk-delete", { ids: [item.id] });
      const canonical = group.items.find((g) => g.id === group.canonicalId);
      if (canonical) await addSlugRedirect(item.slug, canonical.slug);
      setConfirmId(null);
      load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  const renderItem = ({ item: group }: { item: DuplicateGroup }) => {
    const canonical = group.items.find((g) => g.id === group.canonicalId);
    const title = canonical?.name || group.items[0]?.name || group.key;
    const dupCount = group.items.filter((it) => it.id !== group.canonicalId).length;
    return (
      <Card style={styles.group}>
        <View style={styles.groupHeader}>
          <View style={styles.groupTitleWrap}>
            <Text style={styles.groupTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.groupMeta}>
              {dupCount} дубль(я) · найдено по{" "}
              {group.reason === "name" ? "названию" : "слагу"}
              {group.nameDiffers ? " · ⚠️ имена различаются" : ""}
            </Text>
          </View>
          <Badge tone="neutral">{group.items.length} зап.</Badge>
        </View>

        <View style={styles.itemsWrap}>
          {group.items.map((item) => {
            const isCanonical = item.id === group.canonicalId;
            return (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <View style={styles.itemTitleRow}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {isCanonical ? <Badge tone="success">канон</Badge> : null}
                    {item.isHidden ? (
                      <Badge tone="danger">скрыт</Badge>
                    ) : (
                      <Badge tone="info">виден</Badge>
                    )}
                  </View>
                  <Text style={styles.itemSlug} numberOfLines={1}>
                    /{item.slug}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {formatRub(item.price)} · склад: {item.stock} · фото:{" "}
                    {item.imageCount} · обновлён: {fmtDate(item.updatedAt)}
                  </Text>
                  {item.danger ? (
                    <View style={styles.dangerRow}>
                      <Ionicons
                        name="warning-outline"
                        size={13}
                        color={colors.warning}
                      />
                      <Text style={styles.dangerText}>
                        цена отличается от канона — удаление может изменить цену
                        канона (1С переподцепит номенклатуру)
                      </Text>
                    </View>
                  ) : null}

                  {confirmId === item.id ? (
                    <View style={styles.confirmRow}>
                      <Button
                        title="Удалить"
                        variant="danger"
                        loading={deleting}
                        onPress={() => deleteItem(item, group)}
                      />
                      <Button
                        title="Отмена"
                        variant="ghost"
                        onPress={() => setConfirmId(null)}
                      />
                    </View>
                  ) : (
                    <View style={styles.actionsRow}>
                      <Button
                        title={item.isHidden ? "Показать" : "Скрыть"}
                        variant="secondary"
                        onPress={() => toggleVisibility(item)}
                        loading={busyId === item.id}
                        icon={item.isHidden ? "eye-outline" : "eye-off-outline"}
                      />
                      {!isCanonical ? (
                        <Button
                          title="Удалить"
                          variant="danger"
                          onPress={() => setConfirmId(item.id)}
                          icon="trash-outline"
                        />
                      ) : null}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </Card>
    );
  };

  return (
    <FlatList
      data={groups}
      keyExtractor={(g) => g.key}
      contentContainerStyle={styles.list}
      onRefresh={() => load(true)}
      refreshing={refreshing}
      ListHeaderComponent={
        <View style={styles.header}>
          <InlineError text={error} />
          <Card style={styles.summary}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{loading ? "…" : groups.length}</Text>
                <Text style={styles.summaryLabel}>групп-дублей</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{loading ? "…" : totalDups}</Text>
                <Text style={styles.summaryLabel}>дублей</Text>
              </View>
              <View style={styles.summaryActions}>
                <Button
                  title="Обновить"
                  variant="secondary"
                  onPress={() => load(true)}
                  loading={refreshing}
                  icon="refresh"
                />
              </View>
            </View>
            <Text style={styles.hint}>
              Группы товаров, похожих на один и тот же товар (одинаковое название
              или слаг с суффиксом -2/-3). Канон — видимый товар, остальные —
              дубли. Удаление дубля не ломает старые ссылки: URL продолжит
              отдавать 301 на канон.
            </Text>
          </Card>
        </View>
      }
      renderItem={renderItem}
      ListEmptyComponent={
        loading ? (
          <LoadingView />
        ) : (
          <EmptyState text={error || "Дублей не найдено — всё чисто ✅"} />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl },
  header: { marginBottom: spacing.md },
  summary: { gap: spacing.md },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  summaryItem: { alignItems: "center" },
  summaryValue: { color: colors.text, fontSize: 22, fontWeight: "800" },
  summaryLabel: { color: colors.textMuted, fontSize: 11 },
  summaryActions: { marginLeft: "auto" },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  group: { marginBottom: spacing.md, gap: spacing.md },
  groupHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  groupTitleWrap: { flex: 1, minWidth: 0 },
  groupTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  groupMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  itemsWrap: { gap: spacing.md },
  itemRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  itemInfo: { gap: spacing.xs },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  itemName: { color: colors.text, fontSize: 13, fontWeight: "600", flexShrink: 1 },
  itemSlug: { color: colors.textMuted, fontSize: 11 },
  itemMeta: { color: colors.textMuted, fontSize: 11 },
  dangerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: 2,
  },
  dangerText: {
    color: colors.warning,
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  confirmRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
});
