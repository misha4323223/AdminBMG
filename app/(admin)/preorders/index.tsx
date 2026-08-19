import React, { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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
import { apiDelete, apiGet, apiPost, apiPut, getErrorMessage } from "@/lib/api";
import { formatDate, formatRub } from "@/lib/format";
import { colors, spacing } from "@/constants/theme";

type Tab = "orders" | "campaigns" | "points";

const PREORDER_STATUSES = [
  { key: "production", label: "В производстве" },
  { key: "shipping", label: "Готовится к отправке" },
  { key: "shipped", label: "Отправлен" },
  { key: "cancelled", label: "Отменён" },
];

export default function PreordersScreen() {
  const [tab, setTab] = useState<Tab>("orders");
  return (
    <Screen title="Предзаказы" scroll={false}>
      <View style={styles.tabs}>
        <TabBtn label="Заказы" active={tab === "orders"} onPress={() => setTab("orders")} />
        <TabBtn label="Кампании" active={tab === "campaigns"} onPress={() => setTab("campaigns")} />
        <TabBtn label="Точки" active={tab === "points"} onPress={() => setTab("points")} />
      </View>
      {tab === "orders" ? <OrdersTab /> : null}
      {tab === "campaigns" ? <CampaignsTab /> : null}
      {tab === "points" ? <PointsTab /> : null}
    </Screen>
  );
}

function OrdersTab() {
  const [data, setData] = useState<{
    orders?: any[];
    totalOrders?: number;
    totalDeposits?: number;
    totalRemaining?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      setData(await apiGet<any>("/admin/preorder/orders"));
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

  const setStatus = async (orderId: number, status: string) => {
    try {
      await apiPost(`/admin/preorder/order/${orderId}/status`, { status });
      load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const orders = data?.orders || [];

  if (loading) {
    return (
      <View style={styles.flex}>
        <LoadingView />
      </View>
    );
  }

  return (
    <FlatList
      data={orders}
      keyExtractor={(o) => String(o.orderId)}
      onRefresh={() => load(true)}
      refreshing={refreshing}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View>
          <InlineError text={error} />
          <View style={styles.summaryRow}>
            <SummaryStat label="Заказов" value={String(data?.totalOrders ?? 0)} />
            <SummaryStat label="Депозиты" value={formatRub(data?.totalDeposits ?? 0)} />
            <SummaryStat label="Доплаты" value={formatRub(data?.totalRemaining ?? 0)} />
          </View>
        </View>
      }
      renderItem={({ item }) => {
        const isOpen = expanded === item.orderId;
        return (
          <View style={styles.rowCard}>
            <Pressable onPress={() => setExpanded(isOpen ? null : item.orderId)}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>
                    {item.customerName || item.customerEmail || "Без имени"}
                  </Text>
                  <Text style={styles.sub}>
                    Заказ #{item.orderId} · {item.product?.name || "—"}
                  </Text>
                  <Text style={styles.sub}>
                    {item.size ? `Размер ${item.size}` : ""}
                    {item.color ? ` · ${item.color}` : ""} · {formatDate(item.createdAt)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.price}>{formatRub(item.total)}</Text>
                  <Badge tone={statusTone(item.orderPreorderStatus || item.status)}>
                    {preorderLabel(item.orderPreorderStatus) || item.status || "—"}
                  </Badge>
                </View>
              </View>
            </Pressable>
            {isOpen ? (
              <View style={styles.statusPanel}>
                <Text style={styles.panelTitle}>Сменить статус предзаказа</Text>
                <View style={styles.statusBtns}>
                  {PREORDER_STATUSES.map((s) => (
                    <Button
                      key={s.key}
                      title={s.label}
                      variant={
                        item.orderPreorderStatus === s.key ? "primary" : "secondary"
                      }
                      onPress={() => setStatus(item.orderId, s.key)}
                    />
                  ))}
                </View>
                {item.cdekTrackNumber ? (
                  <Text style={styles.sub}>Трек: {item.cdekTrackNumber}</Text>
                ) : null}
                {item.cdekPointAddress ? (
                  <Text style={styles.sub}>ПВЗ: {item.cdekPointAddress}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      }}
      ListEmptyComponent={<EmptyState text={error || "Предзаказов нет"} />}
    />
  );
}

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    slug: "",
    title: "",
    subtitle: "",
    description: "",
    coverImage: "",
    badgeImage: "",
    logoUrl: "",
    heroImage: "",
    heroImageMobile: "",
    seoTitle: "",
    seoDescription: "",
    cardStyle: "vinyl",
    visible: true,
  });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setCampaigns(await apiGet<any[]>("/admin/preorder/campaigns"));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.slug.trim()) {
      setError("Slug обязателен");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiPost("/admin/preorder/campaigns", {
        ...form,
        slug: form.slug.trim().toLowerCase(),
        visible: form.visible,
        cardStyle: form.cardStyle === "poster" ? "poster" : "vinyl",
      });
      setForm({
        slug: "",
        title: "",
        subtitle: "",
        description: "",
        coverImage: "",
        badgeImage: "",
        logoUrl: "",
        heroImage: "",
        heroImageMobile: "",
        seoTitle: "",
        seoDescription: "",
        cardStyle: "vinyl",
        visible: true,
      });
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (slug: string) => {
    setError("");
    try {
      await apiDelete(`/admin/preorder/campaigns/${slug}`);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <FlatList
      data={campaigns}
      keyExtractor={(c) => c.slug}
      onRefresh={load}
      refreshing={loading}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <Card style={styles.formCard}>
          <SectionTitle>Новая кампания</SectionTitle>
          <InlineError text={error} />
          <Field label="Slug (латиница, дефисы)" value={form.slug} onChangeText={(v) => set("slug", v)} autoCapitalize="none" />
          <Field label="Название" value={form.title} onChangeText={(v) => set("title", v)} />
          <Field label="Подзаголовок" value={form.subtitle} onChangeText={(v) => set("subtitle", v)} />
          <Field label="Описание" value={form.description} onChangeText={(v) => set("description", v)} multiline />
          <Field label="Обложка (URL)" value={form.coverImage} onChangeText={(v) => set("coverImage", v)} autoCapitalize="none" />
          <Field label="Бейдж (URL)" value={form.badgeImage} onChangeText={(v) => set("badgeImage", v)} autoCapitalize="none" />
          <Field label="Логотип (URL)" value={form.logoUrl} onChangeText={(v) => set("logoUrl", v)} autoCapitalize="none" />
          <Field label="Hero (URL)" value={form.heroImage} onChangeText={(v) => set("heroImage", v)} autoCapitalize="none" />
          <Field label="Hero mobile (URL)" value={form.heroImageMobile} onChangeText={(v) => set("heroImageMobile", v)} autoCapitalize="none" />
          <Field label="SEO title" value={form.seoTitle} onChangeText={(v) => set("seoTitle", v)} />
          <Field label="SEO description" value={form.seoDescription} onChangeText={(v) => set("seoDescription", v)} multiline />
          <ToggleRow
            label="Видимость"
            value={form.visible}
            onToggle={(v) => set("visible", v)}
          />
          <ToggleRow
            label="Стиль карточки: poster"
            value={form.cardStyle === "poster"}
            onToggle={(v) => set("cardStyle", v ? "poster" : "vinyl")}
          />
          <Button title="Сохранить кампанию" onPress={save} loading={busy} icon="add" />
        </Card>
      }
      renderItem={({ item }) => (
        <View style={styles.rowCard}>
          <View style={styles.rowTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title || item.slug}</Text>
              <Text style={styles.sub}>
                {item.productCount ?? 0} товаров · {item.activeProductCount ?? 0} активных
              </Text>
              {item.subtitle ? <Text style={styles.sub}>{item.subtitle}</Text> : null}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Badge tone={item.visible === false ? "neutral" : "success"}>
                {item.visible === false ? "скрыта" : "видна"}
              </Badge>
              <Pressable onPress={() => remove(item.slug)} hitSlop={8}>
                <Text style={styles.delete}>Удалить</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
      ListEmptyComponent={<EmptyState text="Кампаний нет" />}
    />
  );
}

function PointsTab() {
  const [points, setPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", city: "", address: "", date: "", isActive: true });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setPoints(await apiGet<any[]>("/admin/preorder/pickup-points"));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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
      setError("name, city, address обязательны");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (editing) {
        await apiPut(`/admin/preorder/pickup-points/${editing.id}`, form);
      } else {
        await apiPost("/admin/preorder/pickup-points", form);
      }
      setEditing(null);
      setForm({ name: "", city: "", address: "", date: "", isActive: true });
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setError("");
    try {
      await apiDelete(`/admin/preorder/pickup-points/${id}`);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <FlatList
      data={points}
      keyExtractor={(p) => String(p.id)}
      onRefresh={load}
      refreshing={loading}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <Card style={styles.formCard}>
          <SectionTitle>{editing ? "Изменить точку" : "Новая точка выдачи"}</SectionTitle>
          <InlineError text={error} />
          <Field label="Название" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Field label="Город" value={form.city} onChangeText={(v) => setForm((f) => ({ ...f, city: v }))} />
          <Field label="Адрес" value={form.address} onChangeText={(v) => setForm((f) => ({ ...f, address: v }))} />
          <Field label="Дата" value={form.date} onChangeText={(v) => setForm((f) => ({ ...f, date: v }))} />
          <ToggleRow
            label="Активна"
            value={form.isActive}
            onToggle={(v) => setForm((f) => ({ ...f, isActive: v }))}
          />
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
        <View style={styles.rowCard}>
          <View style={styles.rowTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.name}</Text>
              <Text style={styles.sub}>{item.city} · {item.address}</Text>
              {item.date ? <Text style={styles.sub}>{item.date}</Text> : null}
            </View>
            <View style={{ alignItems: "flex-end", gap: spacing.sm }}>
              <Badge tone={item.isActive === false ? "neutral" : "success"}>
                {item.isActive === false ? "неактивна" : "активна"}
              </Badge>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <Pressable onPress={() => startEdit(item)} hitSlop={8}>
                  <Text style={styles.edit}>Изменить</Text>
                </Pressable>
                <Pressable onPress={() => remove(item.id)} hitSlop={8}>
                  <Text style={styles.delete}>Удалить</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      )}
      ListEmptyComponent={<EmptyState text="Точек выдачи нет" />}
    />
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Pressable
        onPress={() => onToggle(!value)}
        style={[styles.toggle, value && styles.toggleOn]}
      >
        <View style={[styles.dot, value && styles.dotOn]} />
      </Pressable>
    </View>
  );
}

function preorderLabel(s?: string | null): string {
  switch (s) {
    case "production":
      return "В производстве";
    case "shipping":
      return "Готовится к отправке";
    case "shipped":
      return "Отправлен";
    case "cancelled":
      return "Отменён";
    default:
      return "";
  }
}

function statusTone(s?: string): "success" | "danger" | "warning" | "neutral" | "info" {
  switch (s) {
    case "shipped":
    case "paid":
      return "success";
    case "cancelled":
      return "danger";
    case "production":
    case "shipping":
      return "info";
    default:
      return "neutral";
  }
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  summaryRow: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  summaryStat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
  },
  summaryValue: { color: colors.accent, fontSize: 16, fontWeight: "700" },
  summaryLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  rowCard: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  title: { color: colors.text, fontSize: 15, fontWeight: "600" },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  price: { color: colors.accent, fontSize: 14, fontWeight: "700" },
  statusPanel: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  panelTitle: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  statusBtns: { gap: spacing.sm },
  delete: { color: colors.danger, fontSize: 13 },
  edit: { color: colors.accent, fontSize: 13 },
  formCard: { margin: spacing.lg },
  cancelWrap: { marginTop: spacing.sm },
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
});
