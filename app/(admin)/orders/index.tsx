import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Badge, EmptyState, LoadingView, SearchBar } from "@/components/ui";
import { apiGet, getErrorMessage } from "@/lib/api";
import { formatDate, formatRub, orderStatusLabel } from "@/lib/format";
import type { Order } from "@/lib/types";
import { colors, spacing } from "@/constants/theme";

const STATUSES = [
  { key: "all", label: "Все" },
  { key: "new", label: "Новые" },
  { key: "paid", label: "Оплачен" },
  { key: "processing", label: "В обработке" },
  { key: "shipped", label: "Отправлен" },
  { key: "delivered", label: "Доставлен" },
  { key: "ready_for_pickup", label: "К выдаче" },
  { key: "cancelled", label: "Отменён" },
];

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [drafts, setDrafts] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [showDrafts, setShowDrafts] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [data, draftData] = await Promise.all([
        apiGet<Order[]>("/admin/orders"),
        apiGet<Order[]>("/admin/draft-orders"),
      ]);
      setOrders(Array.isArray(data) ? data : []);
      setDrafts(Array.isArray(draftData) ? draftData : []);
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

  const filtered = useMemo(() => {
    const source = showDrafts ? drafts : orders;
    const q = query.trim().toLowerCase();
    return source.filter((o) => {
      if (status !== "all" && String(o.status || "").toLowerCase() !== status) {
        return false;
      }
      if (!q) return true;
      return [o.customerName, o.customerEmail, o.customerPhone, String(o.id)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [orders, drafts, showDrafts, query, status]);

  if (loading) {
    return (
      <Screen title="Заказы" scroll={false}>
        <LoadingView />
      </Screen>
    );
  }

  return (
    <Screen
      title="Заказы"
      subtitle={`${filtered.length} из ${showDrafts ? drafts.length : orders.length}`}
      scroll={false}
    >
      <FlatList
        data={filtered}
        keyExtractor={(o) => String(o.id)}
        contentContainerStyle={styles.listContent}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Поиск по имени, email, телефону, № заказа"
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              <Chip
                label={showDrafts ? "Заказы" : "Черновики"}
                active={false}
                onPress={() => setShowDrafts(!showDrafts)}
              />
              {STATUSES.map((s) => (
                <Chip
                  key={s.key}
                  label={s.label}
                  active={status === s.key}
                  onPress={() => setStatus(s.key)}
                />
              ))}
            </ScrollView>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/orders/${item.id}` as never)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.rowTop}>
              <Text style={styles.orderId}>Заказ #{item.id}</Text>
              <Badge tone={statusTone(item.status)}>
                {orderStatusLabel(item.status)}
              </Badge>
            </View>
            <Text style={styles.customer}>
              {item.customerName || item.customerEmail || "Без имени"}
              {item.customerPhone ? ` · ${item.customerPhone}` : ""}
            </Text>
            <Text style={styles.meta}>
              {formatDate(item.createdAt)} · {item.items?.length ?? 0} поз. ·{" "}
              {formatRub(item.total)}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState text={error ? "Ошибка загрузки" : "Заказов нет"} />
        }
      />
    </Screen>
  );
}

function statusTone(status?: string): "neutral" | "accent" | "success" | "danger" | "warning" | "info" {
  switch ((status || "").toLowerCase()) {
    case "paid":
    case "delivered":
    case "ready_for_pickup":
      return "success";
    case "processing":
    case "shipped":
      return "info";
    case "cancelled":
      return "danger";
    case "new":
      return "accent";
    default:
      return "neutral";
  }
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacing.xxl,
  },
  headerBlock: {
    padding: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chips: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  chipTextActive: {
    color: colors.white,
    fontWeight: "600",
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  row: {
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  orderId: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  customer: {
    color: colors.text,
    fontSize: 13,
    marginTop: 2,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
