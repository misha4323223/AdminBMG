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
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
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
import { ExportButtons } from "@/components/ExportButtons";
import { SelectField } from "@/components/SelectField";
import { downloadServerFile } from "@/lib/export";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, getErrorMessage, uploadImage } from "@/lib/api";
import { formatDate, formatRub, preorderStatusLabel } from "@/lib/format";
import { productThumb } from "@/lib/images";
import { colors, spacing } from "@/constants/theme";

type Tab = "products" | "orders" | "customers" | "wholesale" | "campaigns" | "points";

const PREORDER_STATUSES = [
  { key: "production", label: "В производстве" },
  { key: "shipping", label: "Готовится к отправке" },
  { key: "shipped", label: "Отправлен" },
  { key: "cancelled", label: "Отменён" },
];

const PREORDER_PRODUCT_STATUSES = [
  { key: "collecting", label: "Сбор" },
  { key: "production", label: "В производстве" },
  { key: "shipping", label: "Отправка" },
  { key: "shipped", label: "Отправлено" },
  { key: "cancelled", label: "Отменено" },
];

export default function PreordersScreen() {
  const [tab, setTab] = useState<Tab>("orders");
  return (
    <Screen title="Предзаказы" scroll={false}>
      <View style={styles.tabsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabs}
        >
          <TabBtn label="Товары" active={tab === "products"} onPress={() => setTab("products")} />
          <TabBtn label="Заказы" active={tab === "orders"} onPress={() => setTab("orders")} />
          <TabBtn label="Клиенты" active={tab === "customers"} onPress={() => setTab("customers")} />
          <TabBtn label="Опт" active={tab === "wholesale"} onPress={() => setTab("wholesale")} />
          <TabBtn label="Кампании" active={tab === "campaigns"} onPress={() => setTab("campaigns")} />
          <TabBtn label="Точки" active={tab === "points"} onPress={() => setTab("points")} />
        </ScrollView>
      </View>
      {tab === "products" ? <ProductsTab /> : null}
      {tab === "orders" ? <OrdersTab /> : null}
      {tab === "customers" ? <CustomersTab /> : null}
      {tab === "wholesale" ? <WholesaleTab /> : null}
      {tab === "campaigns" ? <CampaignsTab /> : null}
      {tab === "points" ? <PointsTab /> : null}
    </Screen>
  );
}

function ProductsTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [armId, setArmId] = useState<number | null>(null);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      setProducts(await apiGet<any[]>("/preorder/products"));
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

  const setStatus = async (productId: number, status: string) => {
    setBusyId(productId);
    setError("");
    try {
      await apiPost(`/admin/preorder/${productId}/status`, { status });
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const disablePreorder = async (productId: number) => {
    if (armId !== productId) {
      setArmId(productId);
      return;
    }
    setBusyId(productId);
    setError("");
    try {
      await apiPatch(`/admin/products/${productId}`, { preorderEnabled: false });
      setArmId(null);
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.flex}>
        <LoadingView />
      </View>
    );
  }

  const statusOptions = PREORDER_PRODUCT_STATUSES.map((s) => ({ value: s.key, label: s.label }));

  return (
    <FlatList
      data={products}
      keyExtractor={(p) => String(p.id)}
      onRefresh={() => load(true)}
      refreshing={refreshing}
      style={styles.flex}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View>
          <InlineError text={error} />
          <View style={styles.productsHeader}>
            <Text style={styles.productsCount}>
              Товаров с предзаказом: {products.length}
            </Text>
            <Button
              title="Скачать Excel"
              variant="secondary"
              icon="download-outline"
              onPress={async () => {
                try {
                  const date = new Date().toISOString().slice(0, 10);
                  await downloadServerFile("/admin/preorder/orders/xlsx", `preorders-${date}.xlsx`);
                } catch (e) {
                  setError(getErrorMessage(e));
                }
              }}
            />
          </View>
        </View>
      }
      renderItem={({ item }) => {
        const current = item.preorderStatus || "collecting";
        return (
          <View style={styles.rowCard}>
            <View style={styles.rowTop}>
              {productThumb(item) ? (
                <Image source={{ uri: productThumb(item) }} style={styles.thumb} contentFit="cover" />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.price}>{formatRub(item.price)}</Text>
                {item.preorderDeadline ? (
                  <Text style={styles.sub}>📅 Сбор до {formatDate(item.preorderDeadline)}</Text>
                ) : null}
                {item.preorderProductionDate ? (
                  <Text style={styles.sub}>🏭 В производстве до {formatDate(item.preorderProductionDate)}</Text>
                ) : null}
                {item.preorderShippingDate ? (
                  <Text style={styles.sub}>🚚 Отправка {formatDate(item.preorderShippingDate)}</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.productActions}>
              <View style={{ flex: 1 }}>
                <SelectField
                  label="Статус"
                  value={current}
                  options={statusOptions}
                  onChange={(v) => setStatus(item.id, v)}
                />
              </View>
              <Button
                title={armId === item.id ? "Точно отключить?" : "Отключить предзаказ"}
                variant={armId === item.id ? "danger" : "secondary"}
                onPress={() => disablePreorder(item.id)}
                loading={busyId === item.id}
                icon={armId === item.id ? "checkmark" : "trash-outline"}
              />
            </View>
          </View>
        );
      }}
      ListEmptyComponent={
        <EmptyState text={error || "Нет товаров с предзаказом — включите предзаказ в настройках товара"} />
      }
    />
  );
}

function CustomersTab() {
  const [data, setData] = useState<{ users?: any[]; totalOrders?: number; totalUsers?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

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

  if (loading) {
    return (
      <View style={styles.flex}>
        <LoadingView />
      </View>
    );
  }

  const users = data?.users || [];
  return (
    <FlatList
      data={users}
      keyExtractor={(u) => u.userEmail || u.userName || String(u.orderId)}
      onRefresh={() => load(true)}
      refreshing={refreshing}
      style={styles.flex}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View>
          <InlineError text={error} />
          <View style={styles.summaryRow}>
            <SummaryStat label="Клиентов" value={String(data?.totalUsers ?? 0)} />
            <SummaryStat label="Заявок" value={String(data?.totalOrders ?? 0)} />
          </View>
        </View>
      }
      renderItem={({ item }) => {
        const isOpen = expanded === (item.userEmail || item.userName);
        return (
          <View style={styles.rowCard}>
            <Pressable onPress={() => setExpanded(isOpen ? null : item.userEmail || item.userName)}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{item.userName || item.userEmail || "—"}</Text>
                  <Text style={styles.sub}>
                    {item.userEmail}
                    {item.userPhone ? ` · ${item.userPhone}` : ""}
                  </Text>
                </View>
                <Badge tone="accent">{item.orders?.length ?? 0} заявок</Badge>
              </View>
            </Pressable>
            {isOpen ? (
              <View style={styles.statusPanel}>
                {(item.orders || []).map((o: any) => (
                  <View key={o.orderId} style={styles.custOrderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sub}>
                        Заказ #{o.orderId} · {o.product?.name || "—"}
                        {o.size ? ` · ${o.size}` : ""}
                      </Text>
                      <Text style={styles.sub}>{formatDate(o.createdAt)}</Text>
                    </View>
                    <Text style={styles.price}>{formatRub(o.total)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      }}
      ListEmptyComponent={<EmptyState text={error || "Клиентов нет"} />}
    />
  );
}

function WholesaleTab() {
  const [data, setData] = useState<{ orders?: any[]; total?: number } | null>(null);
  const [slides, setSlides] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [orders, slidesRes] = await Promise.all([
        apiGet<{ orders?: any[]; total?: number }>("/admin/wholesale-preorder/orders"),
        apiGet<{ slides?: string[] }>("/wholesale-preorder/slides").catch(() => null),
      ]);
      setData(orders);
      setSlides(slidesRes?.slides || []);
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

  const orders = data?.orders || [];
  const exportRows = orders.map((item: any) => ({
    id: item.id ?? item.orderId,
    date: formatDate(item.createdAt),
    customer: item.companyName || item.customerName || item.customerEmail || "Без имени",
    email: item.customerEmail || item.userEmail || "",
    items: item.items?.length ?? 1,
    status: item.status || item.orderPreorderStatus || "—",
    total: formatRub(item.total),
  }));
  return (
    <FlatList
      data={orders}
      keyExtractor={(o, index) => String(o.id ?? o.orderId ?? `wholesale-${index}`)}
      onRefresh={() => load(true)}
      refreshing={refreshing}
      style={styles.flex}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View>
          <InlineError text={error} />
          {slides.length > 0 ? (
            <Card style={styles.formCard}>
              <SectionTitle>Слайды оптового предзаказа</SectionTitle>
              {slides.map((s, i) => (
                <View key={i} style={styles.slideRow}>
                  <Image source={{ uri: s }} style={styles.slideImage} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.slideText} numberOfLines={2}>{s}</Text>
                    <Text style={styles.slideText}>Слайд {i + 1}</Text>
                  </View>
                </View>
              ))}
            </Card>
          ) : null}
          {orders.length > 0 ? (
            <View style={styles.summaryRow}>
              <SummaryStat label="Заявок" value={String(data?.total ?? orders.length)} />
            </View>
          ) : null}
          <ExportButtons
            title="Оптовые предзаказы"
            columns={[
              { key: "id", label: "№ заявки" },
              { key: "date", label: "Дата" },
              { key: "customer", label: "Клиент" },
              { key: "email", label: "Email" },
              { key: "items", label: "Позиций" },
              { key: "status", label: "Статус" },
              { key: "total", label: "Сумма" },
            ]}
            rows={exportRows}
          />
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.rowCard}>
          <View style={styles.rowTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {item.companyName || item.customerName || `Заказ #${item.id ?? item.orderId}`}
              </Text>
              <Text style={styles.sub}>
                {formatDate(item.createdAt)} · {item.items?.length ?? 0} поз.
                {item.status ? ` · ${preorderStatusLabel(item.status)}` : ""}
              </Text>
            </View>
            <Text style={styles.price}>{formatRub(item.total)}</Text>
          </View>
        </View>
      )}
      ListEmptyComponent={<EmptyState text={error || "Оптовых предзаказов нет"} />}
    />
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
  const exportRows = orders.map((item: any) => ({
    id: item.orderId,
    date: formatDate(item.createdAt),
    customer: item.customerName || item.customerEmail || "Без имени",
    email: item.customerEmail || "",
    product: item.product?.name || "—",
    size: item.size || "",
    status: preorderLabel(item.orderPreorderStatus) || item.status || "—",
    total: formatRub(item.total),
  }));

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
      style={styles.flex}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View>
          <InlineError text={error} />
          <View style={styles.summaryRow}>
            <SummaryStat label="Заказов" value={String(data?.totalOrders ?? 0)} />
            <SummaryStat label="Депозиты" value={formatRub(data?.totalDeposits ?? 0)} />
            <SummaryStat label="Доплаты" value={formatRub(data?.totalRemaining ?? 0)} />
          </View>
          <ExportButtons
            title="Предзаказы"
            columns={[
              { key: "id", label: "№ заказа" },
              { key: "date", label: "Дата" },
              { key: "customer", label: "Клиент" },
              { key: "email", label: "Email" },
              { key: "product", label: "Товар" },
              { key: "size", label: "Размер" },
              { key: "status", label: "Статус" },
              { key: "total", label: "Сумма" },
            ]}
            rows={exportRows}
          />
        </View>
      }
      renderItem={({ item }) => {
        const isOpen = expanded === item.orderId;
        return (
          <View style={styles.rowCard}>
            <Pressable onPress={() => setExpanded(isOpen ? null : item.orderId)}>
              <View style={styles.rowTop}>
                {productThumb(item.product) ? (
                  <Image
                    source={{ uri: productThumb(item.product) }}
                    style={styles.thumb}
                    contentFit="cover"
                  />
                ) : null}
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
  const [editing, setEditing] = useState<any | null>(null);
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

  const startEdit = (c: any) => {
    setEditing(c);
    const hero = c.hero || {};
    setForm({
      slug: c.slug || "",
      title: hero.title || c.title || "",
      subtitle: hero.subtitle || c.subtitle || "",
      description: hero.description || c.description || "",
      coverImage: hero.coverImage || c.coverImage || "",
      badgeImage: hero.badgeImage || c.badgeImage || "",
      logoUrl: hero.logoUrl || c.logoUrl || "",
      heroImage: hero.heroImage || c.heroImage || "",
      heroImageMobile: hero.heroImageMobile || c.heroImageMobile || "",
      seoTitle: hero.seoTitle || c.seoTitle || "",
      seoDescription: hero.seoDescription || c.seoDescription || "",
      cardStyle: hero.cardStyle || c.cardStyle || "vinyl",
      visible: hero.visible !== false && c.visible !== false,
    });
  };

  const cancelEdit = () => {
    setEditing(null);
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
  };

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
      cancelEdit();
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
      style={styles.flex}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <Card style={styles.formCard}>
          <SectionTitle>{editing ? `Изменить: ${editing.slug}` : "Новая кампания"}</SectionTitle>
          <InlineError text={error} />
          <Field label="Slug (латиница, дефисы)" value={form.slug} onChangeText={(v) => set("slug", v)} autoCapitalize="none" editable={!editing} />
          <Field label="Название" value={form.title} onChangeText={(v) => set("title", v)} />
          <Field label="Подзаголовок" value={form.subtitle} onChangeText={(v) => set("subtitle", v)} />
          <Field label="Описание" value={form.description} onChangeText={(v) => set("description", v)} multiline />
          <CampaignImageField label="Обложка" value={form.coverImage} onChange={(v) => set("coverImage", v)} />
          <CampaignImageField label="Бейдж" value={form.badgeImage} onChange={(v) => set("badgeImage", v)} />
          <CampaignImageField label="Логотип" value={form.logoUrl} onChange={(v) => set("logoUrl", v)} />
          <CampaignImageField label="Главный баннер" value={form.heroImage} onChange={(v) => set("heroImage", v)} />
          <CampaignImageField label="Главный баннер (мобильный)" value={form.heroImageMobile} onChange={(v) => set("heroImageMobile", v)} />
          <Field label="SEO-заголовок" value={form.seoTitle} onChangeText={(v) => set("seoTitle", v)} />
          <Field label="SEO-описание" value={form.seoDescription} onChangeText={(v) => set("seoDescription", v)} multiline />
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
          <Button title={editing ? "Сохранить изменения" : "Сохранить кампанию"} onPress={save} loading={busy} icon={editing ? "save-outline" : "add"} />
          {editing ? (
            <View style={styles.cancelWrap}>
              <Button title="Отмена" variant="ghost" onPress={cancelEdit} />
            </View>
          ) : null}
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
            <View style={{ alignItems: "flex-end", gap: spacing.sm }}>
              <Badge tone={item.visible === false ? "neutral" : "success"}>
                {item.visible === false ? "скрыта" : "видна"}
              </Badge>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <Pressable onPress={() => startEdit(item)} hitSlop={8}>
                  <Text style={styles.edit}>Изменить</Text>
                </Pressable>
                <Pressable onPress={() => remove(item.slug)} hitSlop={8}>
                  <Text style={styles.delete}>Удалить</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      )}
      ListEmptyComponent={<EmptyState text="Кампаний нет" />}
    />
  );
}

function CampaignImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setUploadError("Нужен доступ к фото");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (result.canceled || !result.assets?.[0]) return;
    setUploading(true);
    setUploadError("");
    try {
      const asset = result.assets[0];
      onChange(await uploadImage(asset.uri, asset.fileName || undefined));
    } catch (e) {
      setUploadError(getErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.imageField}>
      <Field label={`${label} (URL)`} value={value} onChangeText={onChange} autoCapitalize="none" />
      <Button
        title={uploading ? "Загрузка…" : `Выбрать ${label.toLowerCase()}`}
        variant="secondary"
        onPress={pick}
        loading={uploading}
        icon="image-outline"
      />
      {value ? <Image source={{ uri: value }} style={styles.campaignPreview} contentFit="cover" /> : null}
      {uploadError ? <Text style={styles.errorText}>{uploadError}</Text> : null}
    </View>
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
      style={styles.flex}
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
      <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabsWrap: { flexShrink: 0, backgroundColor: colors.bg },
  tabsScroll: { flexGrow: 0, flexShrink: 0, height: 52 },
  tabs: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  tab: {
    paddingHorizontal: spacing.lg,
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
  productsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    padding: spacing.lg,
    flexWrap: "wrap",
  },
  productsCount: { color: colors.text, fontSize: 14, fontWeight: "700" },
  productActions: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md,
    marginTop: spacing.md,
    flexWrap: "wrap",
  },
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
  thumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.surfaceAlt },
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
  custOrderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  slideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  slideImage: { width: 64, height: 44, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  slideText: { color: colors.textMuted, fontSize: 12 },
  formCard: { margin: spacing.lg },
  cancelWrap: { marginTop: spacing.sm },
  imageField: { marginBottom: spacing.sm },
  campaignPreview: { width: "100%", height: 120, borderRadius: 8, marginTop: spacing.sm, backgroundColor: colors.surfaceAlt },
  errorText: { color: colors.danger, fontSize: 12, marginTop: spacing.xs },
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
