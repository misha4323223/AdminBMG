import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Accordion } from "@/components/Accordion";
import { Badge, EmptyState, InlineError, LoadingView, SectionTitle, StatCard } from "@/components/ui";
import { apiGet, getErrorMessage } from "@/lib/api";
import { formatRub } from "@/lib/format";
import { productThumb } from "@/lib/images";
import type { Product } from "@/lib/types";
import { colors, spacing } from "@/constants/theme";

interface FavoritesData {
  users?: Array<{ userId: number; userName: string; userEmail: string; productIds: number[]; count: number }>;
  popularProducts?: Array<{ productId: number; count: number }>;
  totalFavorites?: number;
  totalUsers?: number;
}

interface ProductsResponse {
  products?: Product[];
  pagination?: { total?: number };
  total?: number;
}

export default function FavoritesScreen() {
  const [data, setData] = useState<FavoritesData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [fav, prod] = await Promise.all([
        apiGet<FavoritesData>("/admin/favorites"),
        apiGet<ProductsResponse>("/products?limit=5000&admin=true"),
      ]);
      setData(fav);
      setProducts(Array.isArray(prod.products) ? prod.products : []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const productById = useMemo(() => {
    const map = new Map<number, Product>();
    for (const p of products) if (p.id != null) map.set(Number(p.id), p);
    return map;
  }, [products]);

  const popular = data?.popularProducts ?? [];
  const users = data?.users ?? [];
  const totalFavorites = data?.totalFavorites ?? 0;
  const totalUsers = data?.totalUsers ?? 0;
  const average = totalUsers > 0 ? Math.round((totalFavorites / totalUsers) * 10) / 10 : 0;

  return (
    <Screen
      title="Избранное клиентов"
      subtitle={error || `${totalFavorites} добавлений · ${totalUsers} клиентов`}
    >
      {loading ? <LoadingView /> : null}
      <InlineError text={error} />

      <View style={styles.statsRow}>
        <StatCard label="Всего добавлений" value={totalFavorites} icon="heart" tone="danger" />
        <StatCard label="Клиентов с избранным" value={totalUsers} icon="people" tone="info" />
        <StatCard label="Среднее на клиента" value={average} icon="stats-chart" tone="accent" />
        <StatCard label="Уникальных товаров" value={popular.length} icon="cube" tone="success" />
      </View>

      <View style={styles.columns}>
        <View style={styles.column}>
          <SectionTitle>Популярные товары в избранном</SectionTitle>
          {popular.length === 0 ? (
            <EmptyState text="Нет данных" />
          ) : (
            popular.map((item, idx) => {
              const product = productById.get(item.productId);
              return (
                <View key={item.productId} style={styles.rankRow}>
                  <Text style={styles.rank}>{idx + 1}</Text>
                  {productThumb(product) ? (
                    <Image source={{ uri: productThumb(product) }} style={styles.thumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.thumb, styles.thumbFallback]}>
                      <Ionicons name="cube-outline" size={16} color={colors.textMuted} />
                    </View>
                  )}
                  <Text style={styles.productName} numberOfLines={1}>
                    {product?.name || `Товар #${item.productId}`}
                  </Text>
                  <Badge tone="danger">
                    <Ionicons name="heart" size={11} color={colors.danger} /> {item.count}
                  </Badge>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.column}>
          <SectionTitle>Клиенты и их избранное</SectionTitle>
          {users.length === 0 ? (
            <EmptyState text="Нет данных" />
          ) : (
            users.map((user) => (
              <Accordion
                key={user.userId}
                icon="person-outline"
                title={user.userName}
                badge={<Badge tone="danger">{user.count}</Badge>}
              >
                <Text style={styles.email}>{user.userEmail}</Text>
                <View style={styles.itemsList}>
                  {(user.productIds || []).map((productId) => {
                    const product = productById.get(productId);
                    return (
                      <View key={productId} style={styles.itemRow}>
                        {productThumb(product) ? (
                          <Image source={{ uri: productThumb(product) }} style={styles.itemThumb} contentFit="cover" />
                        ) : (
                          <View style={[styles.itemThumb, styles.thumbFallback]}>
                            <Ionicons name="cube-outline" size={12} color={colors.textMuted} />
                          </View>
                        )}
                        <Text style={styles.itemName} numberOfLines={1}>
                          {product?.name || `Товар #${productId}`}
                        </Text>
                        {product?.price ? (
                          <Text style={styles.itemPrice}>{formatRub(product.price)}</Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </Accordion>
            ))
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  columns: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.lg,
  },
  column: {
    flex: 1,
    minWidth: 280,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rank: {
    width: 20,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  thumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.surfaceAlt,
  },
  thumbFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  productName: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  email: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  itemsList: {
    gap: spacing.sm,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  itemThumb: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
  },
  itemName: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },
  itemPrice: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
