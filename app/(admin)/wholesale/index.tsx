import React, { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Badge, EmptyState, LoadingView } from "@/components/ui";
import { useFetch } from "@/lib/useFetch";
import { formatDate, formatRub } from "@/lib/format";
import { colors, spacing } from "@/constants/theme";

type Tab = "users" | "orders" | "slides";

export default function WholesaleScreen() {
  const [tab, setTab] = useState<Tab>("users");

  return (
    <Screen title="Оптовики" scroll={false}>
      <View style={styles.tabs}>
        <TabBtn label="Клиенты" active={tab === "users"} onPress={() => setTab("users")} />
        <TabBtn label="Предзаказы" active={tab === "orders"} onPress={() => setTab("orders")} />
        <TabBtn label="Слайды" active={tab === "slides"} onPress={() => setTab("slides")} />
      </View>
      {tab === "users" ? <UsersList /> : tab === "orders" ? <OrdersList /> : <SlidesList />}
    </Screen>
  );
}

function UsersList() {
  const { data, loading, refreshing, error, reload } = useFetch<{ users: any[] }>(
    "/admin/wholesale-users",
  );
  const users = data?.users || [];
  return (
    <FlatList
      data={users}
      keyExtractor={(u) => String(u.id)}
      onRefresh={reload}
      refreshing={refreshing}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.companyName || item.name || item.email}</Text>
            <Text style={styles.sub}>
              {item.email}
              {item.inn ? ` · ИНН ${item.inn}` : ""}
            </Text>
            <Text style={styles.sub}>
              Скидка {item.wholesaleDiscount ?? 30}% · {item.orderCount ?? 0} зак. ·{" "}
              {formatRub(item.totalSpent)}
            </Text>
          </View>
          <Badge tone={item.wholesaleApproved ? "success" : "warning"}>
            {item.wholesaleApproved ? "одобрен" : "модерация"}
          </Badge>
        </View>
      )}
      ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text={error || "Нет оптовиков"} />}
    />
  );
}

function OrdersList() {
  const { data, loading, refreshing, error, reload } = useFetch<any[]>("/admin/wholesale-preorder/orders");
  return (
    <FlatList
      data={data || []}
      keyExtractor={(o, i) => String(o.id ?? i)}
      onRefresh={reload}
      refreshing={refreshing}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {item.companyName || item.customerName || `Заказ #${item.id}`}
            </Text>
            <Text style={styles.sub}>
              {formatDate(item.createdAt)} · {item.items?.length ?? 0} поз.
            </Text>
          </View>
          <Text style={styles.price}>{formatRub(item.total)}</Text>
        </View>
      )}
      ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text={error || "Нет предзаказов"} />}
    />
  );
}

function SlidesList() {
  // Чтение слайдов — публичный GET (админские только POST/DELETE/reorder).
  const { data, loading, refreshing, error, reload } = useFetch<any[]>(
    "/wholesale-preorder/slides",
  );
  return (
    <FlatList
      data={data || []}
      keyExtractor={(s, i) => String(i)}
      onRefresh={reload}
      refreshing={refreshing}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.title || item.name || "Слайд"}</Text>
            {item.subtitle ? <Text style={styles.sub}>{item.subtitle}</Text> : null}
          </View>
        </View>
      )}
      ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text={error || "Слайдов нет"} />}
    />
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.textMuted, fontWeight: "600", fontSize: 13 },
  tabTextActive: { color: colors.white },
  list: { paddingBottom: spacing.xxl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: 15, fontWeight: "600" },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  price: { color: colors.accent, fontSize: 14, fontWeight: "700" },
});
