import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Screen } from "@/components/Screen";
import { AgentChat } from "@/components/AgentChat";
import { StatCard } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { apiGet } from "@/lib/api";
import { ADMIN_SECTIONS } from "@/lib/sections";
import { colors, radius, spacing } from "@/constants/theme";

/** Быстрые действия для BOOOM AI на главной — только те операции,
 * которые агент реально умеет (см. инструменты в server/admin-tools.ts).
 * После внедрения ТЗ docs/tz-site-agent.md сервер поддерживает:
 * analyze_orders, get_clients, get_product_detail, get_order_detail,
 * search_clients_by_orders, get_abandoned_carts, get_revenue_by_period,
 * export_orders_csv, bulk_update_products. */
const QUICK_ACTIONS: { icon: keyof typeof Ionicons.glyphMap; label: string; command: string }[] = [
  {
    icon: "ticket-outline",
    label: "Создать промокод",
    command: "Создай промокод SUMMER10 со скидкой 10%, активный, без ограничений по количеству",
  },
  {
    icon: "receipt-outline",
    label: "Последние заказы",
    command: "Покажи последние 10 заказов",
  },
  {
    icon: "trending-up-outline",
    label: "Выручка за месяц",
    command: "Какая выручка за последний месяц? Покажи по дням",
  },
  {
    icon: "people-outline",
    label: "Топ клиентов",
    command: "Покажи топ-10 лучших клиентов магазина",
  },
  {
    icon: "cart-outline",
    label: "Брошенные корзины",
    command: "Покажи брошенные корзины",
  },
  {
    icon: "search-outline",
    label: "Найти товар",
    command: "Найди товары по запросу «худи»",
  },
  {
    icon: "today-outline",
    label: "Утреннее резюме",
    command: "Доброе утро, дай сводку по магазину",
  },
  {
    icon: "warning-outline",
    label: "Проблемы",
    command: "Какие проблемы у магазина?",
  },
];

interface AgentStatus {
  enabled?: boolean;
  pendingCount?: number;
}

export default function Dashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { height: winHeight } = useWindowDimensions();
  // Адаптивная высота чата: ~42% экрана, зажата в разумные границы
  const chatHeight = Math.min(520, Math.max(320, Math.round(winHeight * 0.42)));
  const [productsCount, setProductsCount] = useState<number | null>(null);
  const [ordersCount, setOrdersCount] = useState<number | null>(null);
  const [clientsCount, setClientsCount] = useState<number | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [autoCommand, setAutoCommand] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const products = await apiGet<{
          products: unknown[];
          total?: number;
          pagination?: { total?: number };
        }>("/products?limit=1&admin=true");
        setProductsCount(products.pagination?.total ?? products.total ?? products.products?.length ?? 0);
      } catch {}
      try {
        const orders = await apiGet<unknown[]>("/admin/orders");
        setOrdersCount(orders.length);
      } catch {}
      try {
        const clients = await apiGet<{ users: unknown[] }>("/admin/users");
        setClientsCount(clients.users?.length ?? 0);
      } catch {}
      try {
        const status = await apiGet<AgentStatus>("/admin/autonomous-agent/status");
        setAgentStatus(status);
      } catch {}
    })();
  }, []);

  return (
    <Screen
      title="Админ-панель"
      subtitle={user ? `Вы вошли как ${user.name || user.email}` : undefined}
      hideBack
      right={
        <Pressable onPress={logout} style={styles.logout} hitSlop={8}>
          <Ionicons name="log-out-outline" size={20} color={colors.textMuted} />
        </Pressable>
      }
    >
      {/* ── Hero: BOOOM AI ─────────────────────────────────────────── */}
      <LinearGradient
        colors={[...colors.gradCosmic]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTop}>
          <Image
            source={require("@/assets/logo-light.png")}
            style={styles.heroLogo}
            resizeMode="contain"
          />
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>BOOOM AI</Text>
            <View style={styles.heroStatusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: agentStatus?.enabled === false ? colors.textMuted : colors.success },
                ]}
              />
              <Text style={styles.heroSubtitle}>
                {agentStatus?.enabled === false ? "Агент выключен" : "Агент активен"}
                {typeof agentStatus?.pendingCount === "number" && agentStatus.pendingCount > 0
                  ? ` · в очереди: ${agentStatus.pendingCount}`
                  : ""}
                {" · может всё: промокоды, SEO, товары"}
              </Text>
            </View>
          </View>
          <Pressable onPress={() => router.push("/ai" as never)} style={styles.heroSettings} hitSlop={8}>
            <Ionicons name="settings-outline" size={18} color={colors.accent} />
          </Pressable>
        </View>

        <View style={styles.chipsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            <View style={styles.chips}>
              {QUICK_ACTIONS.map((action) => (
                <Pressable
                  key={action.label}
                  onPress={() => setAutoCommand(action.command)}
                  style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                >
                  <Ionicons name={action.icon} size={13} color={colors.white} />
                  <Text style={styles.chipText}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          {/* Затухание правого края — намёк, что чипсы прокручиваются */}
          <View pointerEvents="none" style={styles.chipFadeOuter} />
          <View pointerEvents="none" style={styles.chipFadeInner} />
        </View>
      </LinearGradient>

      {/* ── Чат с агентом прямо на главной ─────────────────────────── */}
      <View style={styles.chatCard}>
        <View style={styles.chatHeader}>
          <Ionicons name="chatbubbles" size={16} color={colors.accent} />
          <Text style={styles.chatTitle}>Чат с ассистентом</Text>
          <Pressable
            onPress={() => router.push("/chat" as never)}
            style={styles.chatExpand}
            hitSlop={8}
          >
            <Ionicons name="expand-outline" size={16} color={colors.accent} />
          </Pressable>
        </View>
        <View style={[styles.chatBody, { height: chatHeight + 20 }]}>
          <AgentChat height={chatHeight} autoCommand={autoCommand} onAutoCommandSent={() => setAutoCommand(null)} />
        </View>
      </View>

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
  hero: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(215, 223, 238, 0.45)",
    padding: spacing.lg,
    marginBottom: spacing.lg,
    overflow: "hidden",
    shadowColor: colors.glowViolet,
    shadowOpacity: 0.8,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  heroLogo: {
    width: 108,
    height: 45,
  },
  heroTextWrap: {
    flex: 1,
    gap: 3,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  heroStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  heroSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    flexShrink: 1,
  },
  heroSettings: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  chipsScroll: {
    flexGrow: 0,
    marginTop: spacing.md,
  },
  chipsWrap: {
    position: "relative",
  },
  chipFadeOuter: {
    position: "absolute",
    right: 0,
    top: spacing.md,
    bottom: 0,
    width: 18,
    backgroundColor: "rgba(38, 40, 47, 0.55)",
  },
  chipFadeInner: {
    position: "absolute",
    right: 18,
    top: spacing.md,
    bottom: 0,
    width: 8,
    backgroundColor: "rgba(38, 40, 47, 0.25)",
  },
  chips: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: "rgba(236, 238, 243, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(201, 206, 216, 0.35)",
  },
  chipPressed: { opacity: 0.75 },
  chipText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "600",
  },
  chatCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: spacing.xl,
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  chatTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  chatHint: {
    color: colors.textMuted,
    fontSize: 11,
    marginLeft: "auto",
  },
  chatExpand: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  chatBody: {
    minHeight: 340,
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
