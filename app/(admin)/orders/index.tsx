import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  InlineError,
  LoadingView,
  SectionTitle,
} from "@/components/ui";
import { SelectField } from "@/components/SelectField";
import { exportExcel } from "@/lib/export";
import { apiDelete, apiGet, apiPatch, apiPost, getErrorMessage } from "@/lib/api";
import { formatDateTime, formatRub, orderStatusLabel } from "@/lib/format";
import type { Order } from "@/lib/types";
import { colors, radius, spacing } from "@/constants/theme";

/** Статусы и подписи — как в выпадающем списке на сайте. */
const STATUS_OPTIONS = [
  { value: "pending", label: "Ожидает оплаты" },
  { value: "paid", label: "Оплачен" },
  { value: "shipped", label: "Отправлен" },
  { value: "delivered", label: "Доставлен" },
  { value: "ready_for_pickup", label: "Готов к выдаче" },
  { value: "cancelled", label: "Отменён" },
];

type Tab = "retail" | "wholesale" | "drafts" | "pickup";

export default function OrdersScreen() {
  return <OrdersTabs />;
}

function OrdersTabs() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("retail");
  const [orders, setOrders] = useState<Order[]>([]);
  const [drafts, setDrafts] = useState<Order[]>([]);
  const [points, setPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [ordersData, draftData, pointsData] = await Promise.all([
        apiGet<Order[]>("/admin/orders"),
        apiGet<Order[]>("/admin/draft-orders"),
        apiGet<any[]>("/admin/retail/pickup-points"),
      ]);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setDrafts(Array.isArray(draftData) ? draftData : []);
      setPoints(Array.isArray(pointsData) ? pointsData : []);
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

  const retail = useMemo(() => orders.filter((o) => !o.isWholesale), [orders]);
  const wholesale = useMemo(() => orders.filter((o) => o.isWholesale), [orders]);

  const refreshHeader = (
    <Pressable onPress={() => load(true)} style={styles.refreshBtn} hitSlop={8}>
      <Ionicons name="refresh" size={15} color={colors.text} />
      <Text style={styles.refreshText}>Обновить</Text>
    </Pressable>
  );

  return (
    <Screen title="Управление заказами" scroll={false} right={refreshHeader}>
      <View style={styles.tabs}>
        <TabBtn
          label={`🛍️ Розничные (${retail.length})`}
          active={tab === "retail"}
          onPress={() => setTab("retail")}
        />
        <TabBtn
          label={`🏢 Оптовые (${wholesale.length})`}
          active={tab === "wholesale"}
          onPress={() => setTab("wholesale")}
        />
        <TabBtn
          label={`⏳ Неоплаченные (${drafts.length})`}
          active={tab === "drafts"}
          onPress={() => setTab("drafts")}
        />
        <TabBtn
          label={`📦 Самовывоз (${points.length})`}
          active={tab === "pickup"}
          onPress={() => setTab("pickup")}
        />
      </View>
      {tab === "pickup" ? (
        <PickupPointsTab
          points={points}
          loading={loading}
          refreshing={refreshing}
          error={error}
          reload={() => load(true)}
        />
      ) : (
        <OrdersList
          orders={tab === "drafts" ? drafts : tab === "wholesale" ? wholesale : retail}
          loading={loading}
          refreshing={refreshing}
          error={error}
          reload={() => load(true)}
          onOpenDetail={(id) => router.push(`/orders/${id}` as never)}
        />
      )}
    </Screen>
  );
}

function OrdersList({
  orders,
  loading,
  refreshing,
  error,
  reload,
  onOpenDetail,
}: {
  orders: Order[];
  loading: boolean;
  refreshing: boolean;
  error: string;
  reload: () => void;
  onOpenDetail: (id: number) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      [o.customerName, o.customerEmail, o.customerPhone, String(o.id)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [orders, query]);

  if (loading && orders.length === 0) {
    return (
      <View style={styles.flex}>
        <LoadingView />
      </View>
    );
  }

  return (
    <FlatList
      data={filtered}
      keyExtractor={(o) => String(o.id)}
      contentContainerStyle={styles.listContent}
      onRefresh={reload}
      refreshing={refreshing}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          <InlineError text={error} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Поиск по имени, email, телефону, № заказа"
            placeholderTextColor={colors.textMuted}
            style={styles.search}
          />
          <Text style={styles.hint}>
            Нажмите на карточку, чтобы открыть полный заказ. Кнопки «Товары», «СДЭК» и «Excel»
            работают прямо из списка.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <OrderCard order={item} onOpenDetail={onOpenDetail} onReload={reload} />
      )}
      ListEmptyComponent={
        <EmptyState text={error ? "Ошибка загрузки" : "Заказов нет"} />
      }
    />
  );
}

function OrderCard({
  order,
  onOpenDetail,
  onReload,
}: {
  order: Order;
  onOpenDetail: (id: number) => void;
  onReload: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(false);

  const items = useMemo(
    () => (Array.isArray(order.items) ? order.items : []),
    [order.items],
  );
  const visibleItems = items.filter((i) => !(i as any)._discountDetails);
  const displayItems = itemsExpanded ? visibleItems : visibleItems.slice(0, 3);
  const hiddenCount = visibleItems.length - 3;

  const setStatus = async (status: string) => {
    if (status === order.status) return;
    setBusy(true);
    setError("");
    try {
      await apiPatch(`/admin/orders/${order.id}/status`, { status });
      onReload();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const retryCdek = async () => {
    setBusyAction("cdek");
    setError("");
    try {
      await apiPost(`/admin/orders/${order.id}/cdek-retry`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyAction(null);
    }
  };

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusyAction("delete");
    setError("");
    try {
      await apiDelete(`/admin/orders/${order.id}`);
      onReload();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyAction(null);
    }
  };

  const downloadExcel = async () => {
    setBusyAction("excel");
    setError("");
    try {
      await exportExcel(
        `Заказ-${order.id}`,
        [
          { key: "id", label: "№ заказа" },
          { key: "date", label: "Дата" },
          { key: "status", label: "Статус" },
          { key: "customer", label: "Клиент" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Телефон" },
          { key: "address", label: "Адрес" },
          { key: "delivery", label: "Доставка" },
          { key: "point", label: "ПВЗ" },
          { key: "tracking", label: "Трек-номер" },
          { key: "payment", label: "Оплата" },
          { key: "total", label: "Сумма" },
          { key: "items", label: "Товары" },
        ],
        [buildOrderExcelRow(order)],
      );
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyAction(null);
    }
  };

  const cdek = parseCdekData(order);
  const canRetryCdek =
    order.transportCompany === "cdek" ||
    Boolean(order.cdekData && order.transportCompany !== "yandex");

  return (
    <Card style={styles.orderCard}>
      <Pressable onPress={() => onOpenDetail(order.id)}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.orderId}>#{order.id}</Text>
            <StatusBadge status={order.status} />
          </View>
          <Text style={styles.price}>{formatRub(order.total)}</Text>
        </View>

        <View style={styles.details}>
          <DetailLine label="Клиент" value={order.customerName} />
          <DetailLine label="Email" value={order.customerEmail} />
          <DetailLine label="Телефон" value={order.customerPhone} />
          <DetailLine label="Адрес" value={order.address} />
          {cdek ? (
            <>
              {cdek.service ? (
                <DetailLine
                  label="Доставка"
                  value={`${cdek.service}${cdek.type ? ` — ${cdek.type}` : ""}`}
                />
              ) : null}
              {cdek.point ? <DetailLine label="ПВЗ" value={cdek.point} /> : null}
              {cdek.door ? <DetailLine label="Адрес курьера" value={cdek.door} /> : null}
              {cdek.tracking ? (
                <DetailLine label="Трек-номер" value={cdek.tracking} />
              ) : null}
              {cdek.ozonOrderId ? (
                <DetailLine label="Ozon заказ №" value={cdek.ozonOrderId} />
              ) : null}
            </>
          ) : null}
          {order.isWholesale && order.transportCompany ? (
            <View style={styles.tkRow}>
              <Text style={styles.detailLabel}>ТК:</Text>
              <TransportBadge company={String(order.transportCompany)} />
            </View>
          ) : null}
        </View>

        {visibleItems.length > 0 ? (
          <View style={styles.itemsBlock}>
            <Text style={styles.detailLabel}>Товары:</Text>
            {displayItems.map((item, idx) => (
              <Text key={idx} style={styles.itemLine}>
                {"• "}
                {String(item.name || item.productName || `Товар #${item.productId}`)}
                {item.size || item.color ? (
                  <Text style={styles.itemMeta}>
                    {" "}
                    ({[item.size, item.color].filter(Boolean).join(", ")})
                  </Text>
                ) : null}{" "}
                x{item.quantity}
              </Text>
            ))}
            {!itemsExpanded && hiddenCount > 0 ? (
              <Pressable onPress={() => setItemsExpanded(true)} hitSlop={8}>
                <Text style={styles.expand}>… и ещё {hiddenCount}</Text>
              </Pressable>
            ) : null}
            {itemsExpanded && hiddenCount > 0 ? (
              <Pressable onPress={() => setItemsExpanded(false)} hitSlop={8}>
                <Text style={styles.expand}>Свернуть</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.created}>
          Создан: {formatDateTime(order.createdAt)}
        </Text>
      </Pressable>

      <View style={styles.cardActions}>
        <View style={styles.statusWrap}>
          <SelectField
            label="Статус"
            value={String(order.status || "")}
            options={STATUS_OPTIONS}
            onChange={setStatus}
            allowEmpty={false}
          />
        </View>
        {isPickupOrder(order) && order.status !== "ready_for_pickup" ? (
          <Button
            title="Привезён на точку — уведомить клиента"
            variant="secondary"
            icon="storefront-outline"
            onPress={() => setStatus("ready_for_pickup")}
            loading={busy}
          />
        ) : null}
        <InlineError text={error} />
        <View style={styles.buttonsRow}>
          <SmallButton
            icon="pricetag-outline"
            label="Товары"
            onPress={() => onOpenDetail(order.id)}
          />
          {canRetryCdek ? (
            <SmallButton
              icon="cube-outline"
              label="СДЭК"
              onPress={retryCdek}
              loading={busyAction === "cdek"}
            />
          ) : null}
          <SmallButton
            icon="download-outline"
            label="Excel"
            onPress={downloadExcel}
            loading={busyAction === "excel"}
          />
          <SmallButton
            icon="trash-outline"
            label={confirmDelete ? "Точно?" : "Удалить"}
            danger
            onPress={remove}
            loading={busyAction === "delete"}
          />
        </View>
      </View>
    </Card>
  );
}

function SmallButton({
  icon,
  label,
  onPress,
  loading = false,
  danger = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  loading?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={[styles.smallBtn, danger && styles.smallBtnDanger]}
    >
      {loading ? (
        <Ionicons name="hourglass-outline" size={14} color={colors.textMuted} />
      ) : (
        <Ionicons name={icon} size={14} color={danger ? colors.danger : colors.text} />
      )}
      <Text style={[styles.smallBtnText, danger && styles.smallBtnTextDanger]}>
        {label}
      </Text>
    </Pressable>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const s = String(status || "").toLowerCase();
  const tone =
    s === "paid"
      ? ("accent" as const)
      : s === "shipped" || s === "processing"
        ? ("info" as const)
        : s === "cancelled"
          ? ("danger" as const)
          : s === "delivered" || s === "ready_for_pickup"
            ? ("success" as const)
            : s === "pending"
              ? ("warning" as const)
              : ("neutral" as const);
  return (
    <Badge tone={tone}>
      {s === "pending" ? "⏳ " : s === "paid" ? "💳 " : s === "shipped" ? "🛠️ " : s === "ready_for_pickup" ? "🏬 " : s === "cancelled" ? "🚫 " : ""}
      {orderStatusLabel(status)}
    </Badge>
  );
}

function DetailLine({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || String(value).trim() === "") return null;
  return (
    <Text style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}: </Text>
      {String(value)}
    </Text>
  );
}

function TransportBadge({ company }: { company: string }) {
  const map: Record<string, { label: string; color: string }> = {
    cdek: { label: "СДЭК", color: "#00A94B" },
    dellin: { label: "Деловые Линии", color: "#ED1C24" },
    pek: { label: "ПЭК", color: "#00599D" },
    pochta: { label: "Почта России", color: "#004D9E" },
  };
  const item = map[company] || { label: company, color: "#666666" };
  return (
    <View style={[styles.tkBadge, { backgroundColor: item.color }]}>
      <Text style={styles.tkBadgeText}>{item.label}</Text>
    </View>
  );
}

/** Достаёт из order.cdekData поля доставки — так же, как сайт. */
function parseCdekData(order: Order): {
  service: string;
  type: string;
  point: string;
  door: string;
  tracking: string;
  ozonOrderId: string;
} | null {
  if (!order.cdekData) return null;
  let d: any = {};
  try {
    d = typeof order.cdekData === "string" ? JSON.parse(order.cdekData) : order.cdekData;
  } catch {
    return null;
  }
  const service =
    d.deliveryService === "yandex"
      ? "🟡 Яндекс Доставка"
      : d.deliveryService === "cdek"
        ? "🟢 СДЭК"
        : d.deliveryService === "ozon"
          ? "🔵 Ozon Доставка"
          : d.deliveryService || "";
  const type =
    d.deliveryType === "door" ? "Курьер до двери" : d.deliveryType === "pickup" ? "ПВЗ" : d.deliveryType || "";
  const point = d.ydPointName || d.pointCode || d.ozonPvzAddress || "";
  const door = d.doorAddress
    ? [d.doorAddress.street, d.doorAddress.house, d.doorAddress.flat && `кв. ${d.doorAddress.flat}`, d.doorAddress.entrance && `подъезд ${d.doorAddress.entrance}`, d.doorAddress.floor && `эт. ${d.doorAddress.floor}`]
        .filter(Boolean)
        .join(", ")
    : "";
  const tracking = d.cdekTrackingNumber || d.trackingNumber || "";
  let ozonOrderId = "";
  try {
    ozonOrderId = (order as any).addonData ? JSON.parse((order as any).addonData)?.ozonOrderId || "" : "";
  } catch {}
  return { service, type, point, door, tracking, ozonOrderId };
}

function isPickupOrder(order: Order): boolean {
  if (String(order.address || "").startsWith("Самовывоз")) return true;
  if (!order.cdekData) return false;
  try {
    const d = typeof order.cdekData === "string" ? JSON.parse(order.cdekData) : order.cdekData;
    return d?.deliveryService === "pickup";
  } catch {
    return false;
  }
}

/** Строка для Excel-выгрузки одного заказа — как скачивает сайт. */
function buildOrderExcelRow(order: Order): Record<string, unknown> {
  const cdek = parseCdekData(order);
  const paymentMap: Record<string, string> = {
    yookassa: "ЮKassa",
    tbank: "Т-Банк",
    ozon: "Ozon Доставка",
    cash: "Наличные",
    transfer: "Перевод",
    invoice: "Счёт",
  };
  const items = (Array.isArray(order.items) ? order.items : [])
    .filter((i) => !(i as any)._discountDetails)
    .map((i) => `${i.name || i.productName || `Товар #${i.productId}`}${i.size || i.color ? ` (${[i.size, i.color].filter(Boolean).join(", ")})` : ""} x${i.quantity}`)
    .join("; ");
  return {
    id: order.id,
    date: formatDateTime(order.createdAt),
    status: orderStatusLabel(order.status),
    customer: order.customerName || "",
    email: order.customerEmail || "",
    phone: order.customerPhone || "",
    address: order.address || "",
    delivery: cdek?.service || "",
    point: cdek?.point || "",
    tracking: cdek?.tracking || "",
    payment: paymentMap[(order as any).paymentMethod] || (order as any).paymentMethod || "",
    total: formatRub(order.total),
    items,
  };
}

function PickupPointsTab({
  points,
  loading,
  refreshing,
  error,
  reload,
}: {
  points: any[];
  loading: boolean;
  refreshing: boolean;
  error: string;
  reload: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", city: "", address: "", date: "", isActive: true });
  const [actionError, setActionError] = useState("");

  const startEdit = (p: any) => {
    setEditing(p);
    setForm({
      name: p.name || "",
      city: p.city || "",
      address: p.address || "",
      date: p.date || "",
      isActive: p.isActive !== false,
    });
  };

  const save = async () => {
    if (!form.name.trim() || !form.city.trim() || !form.address.trim()) {
      setActionError("Название, город и адрес обязательны");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      if (editing) {
        await apiPatch(`/admin/retail/pickup-points/${editing.id}`, form);
      } else {
        await apiPost("/admin/retail/pickup-points", form);
      }
      setEditing(null);
      setForm({ name: "", city: "", address: "", date: "", isActive: true });
      reload();
    } catch (e) {
      setActionError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setActionError("");
    try {
      await apiDelete(`/admin/retail/pickup-points/${id}`);
      reload();
    } catch (e) {
      setActionError(getErrorMessage(e));
    }
  };

  return (
    <FlatList
      data={points}
      keyExtractor={(p) => String(p.id)}
      onRefresh={reload}
      refreshing={refreshing}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <Card style={styles.formCard}>
          <SectionTitle>{editing ? "Изменить точку" : "Новая точка выдачи"}</SectionTitle>
          <InlineError text={actionError} />
          <Field label="Название" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Field label="Город" value={form.city} onChangeText={(v) => setForm((f) => ({ ...f, city: v }))} />
          <Field label="Адрес" value={form.address} onChangeText={(v) => setForm((f) => ({ ...f, address: v }))} />
          <Field label="Дата (необязательно)" value={form.date} onChangeText={(v) => setForm((f) => ({ ...f, date: v }))} />
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Активна</Text>
            <Pressable
              onPress={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
              style={[styles.toggle, form.isActive && styles.toggleOn]}
            >
              <View style={[styles.dot, form.isActive && styles.dotOn]} />
            </Pressable>
          </View>
          <Button
            title={editing ? "Сохранить" : "Добавить"}
            onPress={save}
            loading={busy}
            icon={editing ? "save-outline" : "add"}
          />
          {editing ? (
            <View style={styles.cancelWrap}>
              <Button
                title="Отмена"
                variant="ghost"
                onPress={() => {
                  setEditing(null);
                  setForm({ name: "", city: "", address: "", date: "", isActive: true });
                }}
              />
            </View>
          ) : null}
        </Card>
      }
      renderItem={({ item }) => (
        <View style={styles.pointRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderId}>{item.name}</Text>
            <Text style={styles.meta}>
              {item.city} · {item.address}
              {item.date ? ` · ${item.date}` : ""}
            </Text>
          </View>
          <Badge tone={item.isActive === false ? "neutral" : "success"}>
            {item.isActive === false ? "неактивна" : "активна"}
          </Badge>
          <Pressable onPress={() => startEdit(item)} hitSlop={8}>
            <Text style={styles.edit}>Изменить</Text>
          </Pressable>
          <Pressable onPress={() => remove(item.id)} hitSlop={8}>
            <Text style={styles.delete}>Удалить</Text>
          </Pressable>
        </View>
      )}
      ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text={error || "Точек выдачи нет"} />}
    />
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: {
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.lg,
    paddingBottom: spacing.md,
    flexWrap: "wrap",
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.textMuted, fontWeight: "600", fontSize: 12 },
  tabTextActive: { color: colors.white },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  headerBlock: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  search: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  orderCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 },
  orderId: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  price: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  details: {
    marginTop: spacing.md,
    gap: 2,
  },
  detailLine: { color: colors.text, fontSize: 13, lineHeight: 19 },
  detailLabel: { color: colors.textMuted, fontSize: 12 },
  tkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
  tkBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tkBadgeText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  itemsBlock: {
    marginTop: spacing.md,
    gap: 2,
  },
  itemLine: { color: colors.text, fontSize: 12, lineHeight: 18 },
  itemMeta: { color: colors.textMuted, fontSize: 12 },
  expand: { color: colors.accent, fontSize: 12, marginTop: 2, textDecorationLine: "underline" },
  created: { color: colors.textMuted, fontSize: 11, marginTop: spacing.md },
  cardActions: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  statusWrap: { maxWidth: 240 },
  buttonsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  smallBtnDanger: { backgroundColor: colors.danger, borderColor: colors.danger },
  smallBtnText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  smallBtnTextDanger: { color: colors.white },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  refreshText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  formCard: { margin: spacing.lg },
  pointRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  toggleLabel: { color: colors.text, fontSize: 14 },
  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: colors.surfaceAlt, padding: 3 },
  toggleOn: { backgroundColor: colors.success },
  dot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.textMuted },
  dotOn: { backgroundColor: colors.white, alignSelf: "flex-end" },
  cancelWrap: { marginTop: spacing.sm },
  edit: { color: colors.accent, fontSize: 13 },
  delete: { color: colors.danger, fontSize: 13 },
});
