import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Badge, EmptyState, LoadingView, SearchBar } from "@/components/ui";
import { apiDelete, apiPatch, getErrorMessage } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { formatDate } from "@/lib/format";
import type { Review } from "@/lib/types";
import { colors, spacing } from "@/constants/theme";

export default function ReviewsScreen() {
  const { data, loading, refreshing, error, reload, setData } = useFetch<Review[]>("/admin/reviews");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const list = data || [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [r.authorName, r.comment, String(r.productId)].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [data, query]);

  const toggle = async (review: Review) => {
    setBusyId(review.id);
    try {
      const isApproved = review.isApproved === undefined ? true : !review.isApproved;
      await apiPatch(`/admin/reviews/${review.id}`, { isApproved });
      setData(
        (data || []).map((r) => (r.id === review.id ? { ...r, isApproved } : r)),
      );
    } catch (e) {
      // показать ошибку можно через subtitle, но держим простым
      console.warn(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: number) => {
    setBusyId(id);
    try {
      await apiDelete(`/admin/reviews/${id}`);
      setData((data || []).filter((r) => r.id !== id));
    } catch (e) {
      console.warn(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen title="Отзывы" subtitle={error || `${filtered.length} отзывов`} scroll={false}>
      <FlatList
        data={filtered}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={styles.list}
        onRefresh={reload}
        refreshing={refreshing}
        ListHeaderComponent={
          <View style={styles.search}>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Поиск по тексту или автору" />
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowTop}>
              <View style={styles.author}>
                <Text style={styles.name}>{item.authorName || "Аноним"}</Text>
                <Text style={styles.meta}>
                  {formatDate(item.createdAt)}
                  {item.productId ? ` · товар #${item.productId}` : ""}
                </Text>
              </View>
              <Badge tone={item.isApproved ? "success" : "warning"}>
                {item.isApproved ? "опубликован" : "на модерации"}
              </Badge>
            </View>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Ionicons
                  key={n}
                  name={n <= (item.rating || 0) ? "star" : "star-outline"}
                  size={13}
                  color={colors.warning}
                />
              ))}
            </View>
            {item.comment ? <Text style={styles.text}>{item.comment}</Text> : null}
            <View style={styles.actions}>
              <Pressable onPress={() => toggle(item)} disabled={busyId === item.id} style={styles.action}>
                <Ionicons
                  name={item.isApproved ? "eye-off-outline" : "checkmark-circle-outline"}
                  size={16}
                  color={colors.info}
                />
                <Text style={styles.actionText}>
                  {item.isApproved ? "Скрыть" : "Опубликовать"}
                </Text>
              </Pressable>
              <Pressable onPress={() => remove(item.id)} disabled={busyId === item.id} style={styles.action}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={[styles.actionText, { color: colors.danger }]}>Удалить</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text="Отзывов нет" />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    padding: spacing.lg,
  },
  list: {
    paddingBottom: spacing.xxl,
  },
  row: {
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  author: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  stars: {
    flexDirection: "row",
    gap: 2,
    marginTop: spacing.sm,
  },
  text: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionText: {
    color: colors.info,
    fontSize: 13,
  },
});
