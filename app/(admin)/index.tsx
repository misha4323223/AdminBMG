import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { StatCard } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { apiGet } from "@/lib/api";
import { ADMIN_SECTIONS } from "@/lib/sections";
import { colors, radius, spacing } from "@/constants/theme";

export default function Dashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [productsCount, setProductsCount] = useState<number | null>(null);
  const [ordersCount, setOrdersCount] = useState<number | null>(null);
  const [clientsCount, setClientsCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const products = await apiGet<{ products: unknown[]; total?: number }>(
          "/products?limit=1&admin=true",
        );
        setProductsCount(products.total ?? products.products?.length ?? 0);
      } catch {}
      try {
        const orders = await apiGet<unknown[]>("/admin/orders");
        setOrdersCount(orders.length);
      } catch {}
      try {
        const clients = await apiGet<{ users: unknown[] }>("/admin/users");
        setClientsCount(clients.users?.length ?? 0);
      } catch {}
    })();
  }, []);

  return (
    <Screen
      title="Админ-панель"
      subtitle={user ? `Вы вошли как ${user.name || user.email}` : undefined}
      right={
        <Pressable onPress={logout} style={styles.logout} hitSlop={8}>
          <Ionicons name="log-out-outline" size={20} color={colors.textMuted} />
        </Pressable>
      }
    >
      <View style={styles.stats}>
        <StatCard label="Товаров" value={productsCount ?? "—"} icon="shirt-outline" tone="accent" />
        <StatCard label="Заказов" value={ordersCount ?? "—"} icon="receipt-outline" tone="info" />
        <StatCard label="Клиентов" value={clientsCount ?? "—"} icon="people-outline" tone="success" />
      </View>

      <Text style={styles.gridTitle}>Разделы админки</Text>
      <View style={styles.grid}>
        {ADMIN_SECTIONS.map((section) => (
          <Pressable
            key={section.key}
            onPress={() => router.push(section.route as never)}
            style={({ pressed }) => [styles.sectionCard, pressed && { opacity: 0.8 }]}
          >
            <View style={styles.sectionIcon}>
              <Ionicons name={section.icon} size={20} color={colors.accent} />
            </View>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionDesc} numberOfLines={2}>
              {section.description}
            </Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logout: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
  },
  stats: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  gridTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  sectionCard: {
    width: "48%",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    flexGrow: 1,
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  sectionDesc: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
});
