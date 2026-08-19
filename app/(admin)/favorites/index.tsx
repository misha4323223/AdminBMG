import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Badge, Card, EmptyState, LoadingView, SectionTitle } from "@/components/ui";
import { useFetch } from "@/lib/useFetch";
import { colors, spacing } from "@/constants/theme";

interface FavoritesData {
  users?: Array<{ userId: number; userName: string; userEmail: string; count: number }>;
  popularProducts?: Array<{ productId: number; count: number }>;
  totalFavorites?: number;
  totalUsers?: number;
}

export default function FavoritesScreen() {
  const { data, loading, refreshing, error, reload } = useFetch<FavoritesData>("/admin/favorites");

  return (
    <Screen title="Избранное клиентов" subtitle={error || `${data?.totalFavorites ?? 0} избранных`}>
      {loading ? <LoadingView /> : null}
      <View style={styles.stats}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{data?.totalFavorites ?? 0}</Text>
          <Text style={styles.statLabel}>Всего в избранном</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{data?.totalUsers ?? 0}</Text>
          <Text style={styles.statLabel}>Клиентов</Text>
        </Card>
      </View>

      <Card style={styles.card}>
        <SectionTitle>По клиентам</SectionTitle>
        {data?.users?.length ? (
          data.users.map((u) => (
            <View key={u.userId} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{u.userName}</Text>
                <Text style={styles.sub}>{u.userEmail}</Text>
              </View>
              <Badge tone="accent">{u.count}</Badge>
            </View>
          ))
        ) : (
          <EmptyState text="Нет данных" />
        )}
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Популярные товары</SectionTitle>
        {data?.popularProducts?.length ? (
          data.popularProducts.map((p) => (
            <View key={p.productId} style={styles.row}>
              <Text style={styles.name}>Товар #{p.productId}</Text>
              <Badge tone="accent">{p.count}</Badge>
            </View>
          ))
        ) : (
          <EmptyState text="Нет данных" />
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: { flex: 1 },
  statValue: { color: colors.text, fontSize: 22, fontWeight: "700" },
  statLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  card: { marginBottom: spacing.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: { color: colors.text, fontSize: 14, fontWeight: "600" },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
