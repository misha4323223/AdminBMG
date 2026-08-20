import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Badge, EmptyState, InlineError, LoadingView, SearchBar } from "@/components/ui";
import { useFetch } from "@/lib/useFetch";
import { apiGet, getErrorMessage } from "@/lib/api";
import { formatDate, formatRub, initials } from "@/lib/format";
import type { Client, WholesaleClient } from "@/lib/types";
import { colors, radius, spacing } from "@/constants/theme";

interface ClientDetail {
  user: {
    name?: string;
    email?: string;
    phone?: string;
    createdAt?: string;
    totalSpent?: number;
    loyaltyDiscount?: number;
    emailVerified?: boolean;
  };
  orders: any[];
  cart: any[];
  favorites: any[];
  usedPromoCodes?: any[];
  newsletterSubscribed?: boolean;
}

export default function ClientsScreen() {
  const [tab, setTab] = useState<"retail" | "wholesale">("retail");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const retail = useFetch<{ users: Client[] }>("/admin/users", tab === "retail");
  const wholesale = useFetch<{ users: WholesaleClient[] }>(
    "/admin/wholesale-users",
    tab === "wholesale",
  );

  const active = tab === "retail" ? retail : wholesale;

  const filtered = useMemo(() => {
    const list = (active.data?.users || []) as (Client | WholesaleClient)[];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      const hay = [c.email, c.name, c.phone, c.companyName, c.inn]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [active.data, query]);

  const retailCount = retail.data?.users?.length ?? 0;
  const wholesaleCount = wholesale.data?.users?.length ?? 0;

  return (
    <Screen
      title="Клиенты"
      subtitle={active.error || `${filtered.length} записей`}
      scroll={false}
    >
      <View style={styles.tabs}>
        <TabButton
          label={`Розница (${retailCount})`}
          active={tab === "retail"}
          onPress={() => setTab("retail")}
        />
        <TabButton
          label={`Опт (${wholesaleCount})`}
          active={tab === "wholesale"}
          onPress={() => setTab("wholesale")}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={styles.list}
        onRefresh={active.reload}
        refreshing={active.refreshing}
        ListHeaderComponent={
          <View style={styles.search}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder={
                tab === "retail"
                  ? "Поиск по имени, email или телефону..."
                  : "Поиск по компании, email, ИНН..."
              }
            />
          </View>
        }
        renderItem={({ item }) => {
          if (tab === "retail") {
            const c = item as Client & { orderCount?: number; favoritesCount?: number };
            return (
              <ClientRow
                avatar={initials(c.name)}
                title={c.name || c.email}
                subtitle={c.email}
                onPress={() => setSelectedId(c.id)}
                right={
                  <>
                    <View style={styles.rowStats}>
                      <Text style={styles.rowAmount}>{formatRub(c.totalSpent)}</Text>
                      <Text style={styles.rowMeta}>{c.orderCount ?? 0} заказ.</Text>
                    </View>
                    {c.loyaltyDiscount != null && c.loyaltyDiscount > 0 ? (
                      <Badge tone="accent">−{c.loyaltyDiscount}%</Badge>
                    ) : null}
                    {c.favoritesCount != null && c.favoritesCount > 0 ? (
                      <Text style={styles.fav}>♥ {c.favoritesCount}</Text>
                    ) : null}
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </>
                }
              />
            );
          }
          const w = item as WholesaleClient;
          return (
            <ClientRow
              avatar={initials(w.companyName || w.name)}
              title={w.companyName || w.name || w.email}
              subtitle={`${w.email}${w.inn ? ` · ИНН ${w.inn}` : ""}`}
              right={
                w.wholesaleApproved ? (
                  <Badge tone="success">одобрен</Badge>
                ) : (
                  <Badge tone="warning">на модерации</Badge>
                )
              }
            />
          );
        }}
        ListEmptyComponent={
          active.loading ? <LoadingView /> : <EmptyState text="Клиентов не найдено" />
        }
      />

      <ClientDetailModal
        clientId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </Screen>
  );
}

function ClientDetailModal({
  clientId,
  onClose,
}: {
  clientId: number | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  React.useEffect(() => {
    if (clientId == null) {
      setData(null);
      return;
    }
    (async () => {
      setLoading(true);
      setError("");
      try {
        setData(await apiGet<ClientDetail>(`/admin/users/${clientId}`));
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId]);

  const u = data?.user;

  return (
    <Modal visible={clientId != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderRow}>
              <View style={styles.detailAvatar}>
                <Ionicons name="person" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{u?.name || "Без имени"}</Text>
                <Text style={styles.sheetSubtitle}>{u?.email}</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>

          {loading ? (
            <View style={styles.sheetBody}>
              <LoadingView />
            </View>
          ) : error ? (
            <View style={styles.sheetBody}>
              <InlineError text={error} />
            </View>
          ) : data ? (
            <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetBody}>
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Основные данные</Text>
                <View style={styles.grid}>
                  <GridItem label="Телефон" value={u?.phone || "—"} />
                  <GridItem label="Зарегистрирован" value={formatDate(u?.createdAt)} />
                  <GridItem
                    label="Потрачено"
                    value={formatRub(u?.totalSpent)}
                    valueColor={colors.success}
                    bold
                  />
                  <GridItem
                    label="Скидка лояльности"
                    value={u?.loyaltyDiscount != null && u.loyaltyDiscount > 0 ? `${u.loyaltyDiscount}%` : "нет"}
                  />
                  <GridItem
                    label="Email подтверждён"
                    value={u?.emailVerified ? "Да" : "Нет"}
                    valueColor={u?.emailVerified ? colors.success : colors.warning}
                  />
                  <GridItem
                    label="Рассылка"
                    value={data.newsletterSubscribed ? "Подписан" : "Не подписан"}
                    valueColor={data.newsletterSubscribed ? colors.success : undefined}
                  />
                </View>
              </View>

              <View style={styles.block}>
                <Text style={styles.blockTitle}>🛒 Заказы ({data.orders?.length || 0})</Text>
                {!data.orders?.length ? (
                  <Text style={styles.emptyText}>Заказов нет</Text>
                ) : (
                  data.orders.map((o) => (
                    <View key={o.id} style={styles.orderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.orderId}>#{o.id}</Text>
                        <Text style={styles.orderMeta}>
                          {formatDate(o.createdAt)}
                          {o.isPreorder ? " · Предзаказ" : ""}
                          {o.promoCode ? ` · 🏷 ${o.promoCode}` : ""}
                        </Text>
                      </View>
                      <View style={styles.orderRight}>
                        <Text style={styles.orderAmount}>{formatRub(o.total)}</Text>
                        <Badge tone={statusTone(o.status)}>{statusLabel(o.status)}</Badge>
                      </View>
                    </View>
                  ))
                )}
              </View>

              {data.cart?.length ? (
                <View style={styles.block}>
                  <Text style={styles.blockTitle}>🛒 Сейчас в корзине ({data.cart.length})</Text>
                  {data.cart.map((ci, idx) => (
                    <View key={idx} style={styles.cartRow}>
                      {ci.thumbnailUrl ? (
                        <Image
                          source={{ uri: ci.thumbnailUrl }}
                          style={styles.cartThumb}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[styles.cartThumb, styles.cartThumbEmpty]}>
                          <Ionicons name="image-outline" size={16} color={colors.textMuted} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cartName} numberOfLines={2}>
                          {ci.name}
                        </Text>
                        <Text style={styles.cartMeta}>
                          {[ci.size, ci.color].filter(Boolean).join(" · ") || "—"}
                        </Text>
                      </View>
                      <View style={styles.orderRight}>
                        <Text style={styles.cartQty}>{ci.quantity} шт.</Text>
                        <Text style={styles.cartPrice}>{formatRub(ci.price * ci.quantity)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              {data.favorites?.length ? (
                <View style={styles.block}>
                  <Text style={styles.blockTitle}>♥ Избранное ({data.favorites.length})</Text>
                  <View style={styles.favGrid}>
                    {data.favorites.map((p) => (
                      <View key={p.id} style={styles.favItem}>
                        {p.thumbnailUrl ? (
                          <Image
                            source={{ uri: p.thumbnailUrl }}
                            style={styles.favImage}
                            contentFit="cover"
                          />
                        ) : null}
                        <Text style={styles.favName} numberOfLines={2}>
                          {p.name}
                        </Text>
                        <Text style={styles.favPrice}>{formatRub(p.price)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {data.usedPromoCodes?.length ? (
                <View style={styles.block}>
                  <Text style={styles.blockTitle}>
                    🏷 Использованные промокоды ({data.usedPromoCodes.length})
                  </Text>
                  {data.usedPromoCodes.map((pc, idx) => (
                    <Text key={idx} style={styles.promoLine}>
                      {pc.code || pc}
                    </Text>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function GridItem({
  label,
  value,
  valueColor,
  bold = false,
}: {
  label: string;
  value: string;
  valueColor?: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.gridItem}>
      <Text style={styles.gridLabel}>{label}</Text>
      <Text
        style={[
          styles.gridValue,
          bold && styles.gridValueBold,
          valueColor ? { color: valueColor } : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function statusLabel(status?: string): string {
  switch ((status || "").toLowerCase()) {
    case "pending":
      return "Ожидает";
    case "paid":
      return "Оплачен";
    case "processing":
      return "В обработке";
    case "shipped":
      return "Отправлен";
    case "ready_for_pickup":
      return "К выдаче";
    case "delivered":
      return "Доставлен";
    case "cancelled":
      return "Отменён";
    default:
      return status || "—";
  }
}

function statusTone(status?: string): "success" | "danger" | "warning" | "neutral" | "info" {
  switch ((status || "").toLowerCase()) {
    case "paid":
    case "delivered":
    case "ready_for_pickup":
      return "success";
    case "shipped":
    case "processing":
      return "info";
    case "cancelled":
      return "danger";
    case "pending":
      return "warning";
    default:
      return "neutral";
  }
}

function ClientRow({
  avatar,
  title,
  subtitle,
  right,
  onPress,
}: {
  avatar: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{avatar}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.name}>{title}</Text>
        {subtitle ? (
          <Text style={styles.sub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowRight}>{right}</View>
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
        {body}
      </Pressable>
    );
  }
  return body;
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
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
  tabActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabText: {
    color: colors.textMuted,
    fontWeight: "600",
    fontSize: 13,
  },
  tabTextActive: {
    color: colors.white,
  },
  search: {
    padding: spacing.lg,
  },
  list: {
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.textMuted,
    fontWeight: "700",
  },
  rowBody: {
    flex: 1,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexShrink: 0,
  },
  rowStats: { alignItems: "flex-end" },
  rowAmount: { color: colors.text, fontSize: 13, fontWeight: "600" },
  rowMeta: { color: colors.textMuted, fontSize: 11 },
  fav: { color: colors.textMuted, fontSize: 12 },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  sub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    maxHeight: "92%",
    overflow: "hidden",
  },
  sheetHeader: {
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  detailAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  sheetSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  sheetScroll: { flexGrow: 0 },
  sheetBody: { padding: spacing.lg, gap: spacing.lg },
  block: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  blockTitle: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.sm,
  },
  gridItem: {
    width: "50%",
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  gridLabel: { color: colors.textMuted, fontSize: 11 },
  gridValue: { color: colors.text, fontSize: 14, marginTop: 2 },
  gridValueBold: { fontWeight: "700" },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center", paddingVertical: spacing.md },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.md,
  },
  orderId: { color: colors.text, fontSize: 13, fontWeight: "600" },
  orderMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  orderRight: { alignItems: "flex-end", gap: 4 },
  orderAmount: { color: colors.text, fontSize: 13, fontWeight: "600" },
  cartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  cartThumb: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surface },
  cartThumbEmpty: { alignItems: "center", justifyContent: "center" },
  cartName: { color: colors.text, fontSize: 13, fontWeight: "500" },
  cartMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  cartQty: { color: colors.text, fontSize: 12 },
  cartPrice: { color: colors.textMuted, fontSize: 11 },
  favGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  favItem: {
    width: "31%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.xs,
  },
  favImage: {
    width: "100%",
    height: 72,
    borderRadius: radius.sm - 2,
    backgroundColor: colors.surface,
    marginBottom: spacing.xs,
  },
  favName: { color: colors.text, fontSize: 11 },
  favPrice: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  promoLine: { color: colors.text, fontSize: 13 },
});
