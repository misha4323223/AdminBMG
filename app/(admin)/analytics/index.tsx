import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Card, EmptyState, InlineError, LoadingView, SectionTitle } from "@/components/ui";
import { useFetch } from "@/lib/useFetch";
import { formatRub } from "@/lib/format";
import { colors, spacing } from "@/constants/theme";

interface OrderAnalyticsRow {
  month: string;
  retailCount: number;
  wholesaleCount: number;
  retailRevenue: number;
  wholesaleRevenue: number;
}

interface ArtistAnalyticsRow {
  artist: string;
  revenue: number;
  orders: number;
  items: number;
}

export default function AnalyticsScreen() {
  const orders = useFetch<OrderAnalyticsRow[]>("/admin/analytics/orders");
  const artists = useFetch<ArtistAnalyticsRow[]>("/admin/analytics/artists");

  return (
    <Screen title="Аналитика">
      <InlineError text={orders.error || artists.error} />

      <Card style={styles.card}>
        <SectionTitle>Заказы по месяцам</SectionTitle>
        {orders.loading ? (
          <LoadingView />
        ) : !orders.data?.length ? (
          <EmptyState text="Данных нет" />
        ) : (
          orders.data.map((row, i) => (
            <View key={`${row.month}-${i}`} style={styles.monthBlock}>
              <Text style={styles.monthTitle}>{row.month}</Text>
              <View style={styles.metricRow}>
                <Text style={styles.metricKey}>Розница</Text>
                <Text style={styles.metricValue}>
                  {row.retailCount} зак. · {formatRub(row.retailRevenue)}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricKey}>Опт</Text>
                <Text style={styles.metricValue}>
                  {row.wholesaleCount} зак. · {formatRub(row.wholesaleRevenue)}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Артисты</SectionTitle>
        {artists.loading ? (
          <LoadingView />
        ) : !artists.data?.length ? (
          <EmptyState text="Данных нет" />
        ) : (
          artists.data.map((row, i) => (
            <View key={`${row.artist}-${i}`} style={styles.monthBlock}>
              <Text style={styles.monthTitle}>{row.artist || "Без имени"}</Text>
              <View style={styles.metricRow}>
                <Text style={styles.metricKey}>Выручка</Text>
                <Text style={styles.metricValue}>{formatRub(row.revenue)}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricKey}>Заказы / товары</Text>
                <Text style={styles.metricValue}>
                  {row.orders} / {row.items}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  monthBlock: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  monthTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingVertical: 3,
  },
  metricKey: { color: colors.textMuted, fontSize: 13 },
  metricValue: { color: colors.text, fontSize: 13, fontWeight: "600" },
});
