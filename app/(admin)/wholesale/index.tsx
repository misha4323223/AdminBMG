import React, { useEffect, useMemo, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  InlineError,
  LoadingView,
  SearchBar,
  SectionTitle,
} from "@/components/ui";
import { apiDelete, apiGet, apiPatch, apiPost, getErrorMessage } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { formatDate, formatRub } from "@/lib/format";
import { productThumb } from "@/lib/images";
import { colors, radius, spacing } from "@/constants/theme";

const DEFAULT_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

type Tab = "users" | "products" | "orders" | "slides";

export default function WholesaleScreen() {
  const [tab, setTab] = useState<Tab>("users");

  return (
    <Screen title="Оптовики" scroll={false}>
      <View style={styles.tabsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabs}
        >
          <TabBtn label="Клиенты" active={tab === "users"} onPress={() => setTab("users")} />
          <TabBtn label="Товары" active={tab === "products"} onPress={() => setTab("products")} />
          <TabBtn label="Предзаказы" active={tab === "orders"} onPress={() => setTab("orders")} />
          <TabBtn label="Слайды" active={tab === "slides"} onPress={() => setTab("slides")} />
        </ScrollView>
      </View>
      {tab === "users" ? (
        <>
          <InvoiceVatSettings />
          <UsersList />
        </>
      ) : null}
      {tab === "products" ? <ProductsList /> : null}
      {tab === "orders" ? <OrdersList /> : null}
      {tab === "slides" ? <SlidesList /> : null}
    </Screen>
  );
}

/** Настройки НДС в счетах — как на сайте (GET/POST /bonus-settings). */
function InvoiceVatSettings() {
  const [rate, setRate] = useState("5");
  const [mode, setMode] = useState<"included" | "on_top">("included");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<Record<string, string>>("/bonus-settings");
        if (data) {
          if (data.invoice_vat_rate) setRate(data.invoice_vat_rate);
          if (data.invoice_vat_mode === "included" || data.invoice_vat_mode === "on_top") {
            setMode(data.invoice_vat_mode);
          }
        }
      } catch {
        // настройки останутся по умолчанию
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const save = async () => {
    const num = parseFloat(rate.replace(",", "."));
    if (Number.isNaN(num) || num < 0 || num > 100) {
      setError("Значение НДС должно быть от 0 до 100");
      return;
    }
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await apiPost("/bonus-settings", { key: "invoice_vat_rate", value: String(num) });
      await apiPost("/bonus-settings", { key: "invoice_vat_mode", value: mode });
      setSaved(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.vatCard}>
      <View style={styles.vatHeader}>
        <Ionicons name="settings-outline" size={16} color={colors.textMuted} />
        <Text style={styles.vatTitle}>Настройки НДС в счетах</Text>
      </View>
      <View style={styles.vatRow}>
        <View style={styles.vatField}>
          <Text style={styles.vatLabel}>Ставка:</Text>
          <TextInput
            value={rate}
            onChangeText={setRate}
            keyboardType="numeric"
            style={styles.vatInput}
          />
          <Text style={styles.vatLabel}>%</Text>
        </View>
        <View style={styles.vatField}>
          <Text style={styles.vatLabel}>Режим:</Text>
          <View style={styles.vatSegmented}>
            <Pressable
              onPress={() => setMode("included")}
              style={[styles.vatSegment, mode === "included" && styles.vatSegmentOn]}
            >
              <Text
                style={[styles.vatSegmentText, mode === "included" && styles.vatSegmentTextOn]}
              >
                В том числе
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode("on_top")}
              style={[styles.vatSegment, mode === "on_top" && styles.vatSegmentOn]}
            >
              <Text
                style={[styles.vatSegmentText, mode === "on_top" && styles.vatSegmentTextOn]}
              >
                Сверху
              </Text>
            </Pressable>
          </View>
        </View>
        <Button title="Сохранить" onPress={save} loading={busy} icon="save-outline" />
      </View>
      <InlineError text={error} />
      {saved ? <Text style={styles.vatSaved}>✅ Настройки НДС обновлены</Text> : null}
      <Text style={styles.vatHint}>
        {mode === "included"
          ? "НДС включён в сумму — итоговая сумма не меняется, НДС выделяется из неё"
          : "НДС сверху суммы — к итогу добавляется сумма НДС, покупатель платит больше"}
      </Text>
    </Card>
  );
}

function UsersList() {
  const { data, loading, refreshing, error, reload } = useFetch<{ users: any[] }>(
    "/admin/wholesale-users",
  );
  const users = data?.users || [];
  const [passwordId, setPasswordId] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyKind, setBusyKind] = useState<string | null>(null);
  const [discountDraft, setDiscountDraft] = useState<Record<number, string>>({});
  const [actionError, setActionError] = useState("");

  const run = async (id: number, kind: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    setBusyKind(kind);
    setActionError("");
    try {
      await action();
      await reload();
      setDeleteId(null);
    } catch (e) {
      setActionError(getErrorMessage(e));
    } finally {
      setBusyId(null);
      setBusyKind(null);
    }
  };

  const approve = (user: any) =>
    run(user.id, "approve", () =>
      apiPost(`/auth/admin/wholesale/${user.id}/approve`, {
        discount: Number(discountDraft[user.id] ?? user.wholesaleDiscount ?? 30),
      }),
    );

  const reject = (user: any) =>
    run(user.id, "reject", () => apiPost(`/auth/admin/wholesale/${user.id}/reject`));

  const saveDiscount = (user: any, raw: string) => {
    const discount = parseInt(raw, 10);
    if (Number.isNaN(discount) || discount === user.wholesaleDiscount) return;
    if (discount < 0 || discount > 100) return;
    return run(user.id, "discount", () =>
      apiPatch(`/auth/admin/wholesale/${user.id}/discount`, { discount }),
    );
  };

  const savePassword = (user: any) => {
    if (password.length < 6) return;
    return run(user.id, "password", () =>
      apiPost(`/admin/wholesale-users/${user.id}/set-password`, { password }),
    ).then(() => {
      setPasswordId(null);
      setPassword("");
    });
  };

  const remove = (user: any) => {
    if (deleteId !== user.id) {
      setDeleteId(user.id);
      return;
    }
    return run(user.id, "delete", () => apiDelete(`/auth/admin/wholesale/${user.id}`));
  };

  return (
    <FlatList
      data={users}
      keyExtractor={(u) => String(u.id)}
      onRefresh={reload}
      refreshing={refreshing}
      style={styles.flex}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <InlineError text={actionError} />
          <Text style={styles.hint}>
            Заявки на оптовое сотрудничество. Одобренным покупателям доступны оптовые цены и
            скидка; пароль выдаётся вручную.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const approved = !!item.wholesaleApproved;
        const discount =
          discountDraft[item.id] ?? String(item.wholesaleDiscount ?? 30);
        return (
          <View
            style={[
              styles.wholesaleCard,
              !approved && styles.wholesaleCardPending,
            ]}
          >
            <View style={styles.userHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.name || item.companyName || item.email}</Text>
                <Text style={styles.sub}>{item.email}</Text>
                <View style={styles.badgeRow}>
                  {item.emailVerified ? (
                    <Badge tone="neutral">Email подтверждён</Badge>
                  ) : (
                    <Badge tone="warning">Email не подтверждён</Badge>
                  )}
                  {approved ? (
                    <Badge tone="success">Подтверждён</Badge>
                  ) : (
                    <Badge tone="danger">Ожидает</Badge>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.infoGrid}>
              {item.companyName ? (
                <Text style={styles.detailText}>
                  <Text style={styles.detailKey}>Компания:</Text> {item.companyName}
                </Text>
              ) : null}
              {item.inn ? (
                <Text style={styles.detailText}>
                  <Text style={styles.detailKey}>ИНН:</Text> {item.inn}
                </Text>
              ) : null}
              {item.kpp ? (
                <Text style={styles.detailText}>
                  <Text style={styles.detailKey}>КПП:</Text> {item.kpp}
                </Text>
              ) : null}
              {item.contactPerson ? (
                <Text style={styles.detailText}>
                  <Text style={styles.detailKey}>Контакт:</Text> {item.contactPerson}
                </Text>
              ) : null}
              {item.contactPhone ? (
                <Text style={styles.detailText}>
                  <Text style={styles.detailKey}>Телефон:</Text> {item.contactPhone}
                </Text>
              ) : null}
              {item.legalAddress ? (
                <Text style={styles.detailText}>
                  <Text style={styles.detailKey}>Адрес:</Text> {item.legalAddress}
                </Text>
              ) : null}
              {item.createdAt ? (
                <Text style={styles.detailText}>
                  <Text style={styles.detailKey}>Зарегистрирован:</Text>{" "}
                  {formatDate(item.createdAt)}
                </Text>
              ) : null}
            </View>

            {approved ? (
              <View style={styles.approvedActions}>
                <View style={styles.discountInputRow}>
                  <TextInput
                    value={discount}
                    onChangeText={(v) =>
                      setDiscountDraft((prev) => ({ ...prev, [item.id]: v }))
                    }
                    onBlur={() => {
                      const next = discountDraft[item.id];
                      if (next != null && next !== String(item.wholesaleDiscount ?? 30)) {
                        saveDiscount(item, next);
                      }
                    }}
                    keyboardType="numeric"
                    style={styles.discountInput}
                  />
                  <Text style={styles.discountSuffix}>%</Text>
                </View>
                <Button
                  title="Пароль"
                  variant="secondary"
                  onPress={() => {
                    setPasswordId(item.id);
                    setPassword("");
                  }}
                  icon="lock-closed-outline"
                />
                <Button
                  title="Отозвать"
                  variant="secondary"
                  onPress={() => reject(item)}
                  loading={busyId === item.id && busyKind === "reject"}
                  icon="close"
                />
                <Button
                  title={deleteId === item.id ? "Точно удалить?" : "Удалить"}
                  variant="danger"
                  onPress={() => remove(item)}
                  loading={busyId === item.id && busyKind === "delete"}
                  icon="trash-outline"
                />
              </View>
            ) : (
              <View style={styles.approvedActions}>
                <Button
                  title="Подтвердить"
                  onPress={() => approve(item)}
                  loading={busyId === item.id && busyKind === "approve"}
                  icon="checkmark"
                />
                <Button
                  title="Отклонить"
                  variant="secondary"
                  onPress={() => reject(item)}
                  loading={busyId === item.id && busyKind === "reject"}
                  icon="close"
                />
              </View>
            )}

            {passwordId === item.id ? (
              <View style={styles.passwordBox}>
                <Field
                  label="Новый пароль (минимум 6 символов)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <View style={styles.actionRow}>
                  <Button
                    title="Сохранить пароль"
                    onPress={() => savePassword(item)}
                    disabled={password.length < 6}
                    loading={busyId === item.id && busyKind === "password"}
                    icon="lock-closed-outline"
                  />
                  <Button
                    title="Отмена"
                    variant="ghost"
                    onPress={() => {
                      setPasswordId(null);
                      setPassword("");
                    }}
                  />
                </View>
              </View>
            ) : null}
          </View>
        );
      }}
      ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text={error || "Нет оптовиков"} />}
    />
  );
}

function ProductsList() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, any>>({});

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const data = await apiGet<{ products: any[] }>("/products?limit=5000&admin=true");
      setProducts(Array.isArray(data.products) ? data.products : []);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        String(p.id).includes(q),
    );
  }, [products, query]);

  const draftFor = (p: any) => {
    const d = drafts[p.id];
    if (d) return d;
    return {
      enabled: !!p.wholesalePreorderEnabled,
      deadline: p.preorderDeadline || "",
      production: p.preorderProductionDate || "",
      shipping: p.preorderShippingDate || "",
      rrp: p.wholesalePreorderRrp != null ? String(Math.round(p.wholesalePreorderRrp / 100)) : p.price != null ? String(Math.round(p.price / 100)) : "",
      wholesale: p.wholesalePrice != null ? String(Math.round(p.wholesalePrice / 100)) : "",
      preorder: p.wholesalePreorderPrice != null ? String(Math.round(p.wholesalePreorderPrice / 100)) : "",
      sizes:
        Array.isArray(p.wholesalePreorderSizes) && p.wholesalePreorderSizes.length > 0
          ? [...p.wholesalePreorderSizes]
          : Array.isArray(p.sizes) && p.sizes.length > 0
            ? [...p.sizes]
            : [...DEFAULT_SIZES],
    };
  };

  const setDraft = (id: number, patch: Record<string, unknown>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...draftFor(products.find((p) => p.id === id)), ...patch } }));

  const save = async (p: any) => {
    const d = draftFor(p);
    setBusyId(p.id);
    setError("");
    try {
      await apiPost(`/admin/wholesale-preorder/products/${p.id}/toggle`, {
        enabled: d.enabled,
        preorderDeadline: d.deadline || undefined,
        preorderProductionDate: d.production || undefined,
        preorderShippingDate: d.shipping || undefined,
        wholesalePreorderSizes: d.sizes,
        wholesalePreorderRrp: d.rrp ? Math.round(Number(d.rrp) * 100) : undefined,
        wholesalePrice: d.wholesale ? Math.round(Number(d.wholesale) * 100) : undefined,
        wholesalePreorderPrice: d.preorder ? Math.round(Number(d.preorder) * 100) : undefined,
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[p.id];
        return next;
      });
      load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <FlatList
      data={filtered}
      keyExtractor={(p) => String(p.id)}
      onRefresh={() => load(true)}
      refreshing={refreshing}
      style={styles.flex}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          <InlineError text={error} />
          <SearchBar value={query} onChangeText={setQuery} placeholder="Поиск по названию, артикулу или ID" />
          <Text style={styles.hint}>
            Включите товары для страницы оптового предзаказа. Цены указываются в рублях.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const d = draftFor(item);
        const allSizes = Array.from(new Set([...DEFAULT_SIZES, ...d.sizes]));
        const dirty = !!drafts[item.id];
        return (
          <View style={styles.productCard}>
            <View style={styles.productTop}>
              {productThumb(item) ? (
                <Image
                  source={{ uri: productThumb(item) }}
                  style={styles.thumb}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.sub}>
                  #{item.id}
                  {item.sku ? ` · ${item.sku}` : ""} · {formatRub(item.price)}
                </Text>
              </View>
              <Pressable
                onPress={() => setDraft(item.id, { enabled: !d.enabled })}
                style={[styles.toggle, d.enabled && styles.toggleOn]}
              >
                <View style={[styles.dot, d.enabled && styles.dotOn]} />
              </Pressable>
            </View>

            {d.enabled ? (
              <View style={styles.productBody}>
                <Text style={styles.panelTitle}>Оптовый предзаказ включён</Text>
                <View style={styles.fieldRow}>
                  <View style={styles.flex1}>
                    <Field label="Сбор до" value={d.deadline} onChangeText={(v) => setDraft(item.id, { deadline: v })} placeholder="YYYY-MM-DD" />
                  </View>
                  <View style={styles.flex1}>
                    <Field label="Производство" value={d.production} onChangeText={(v) => setDraft(item.id, { production: v })} placeholder="YYYY-MM-DD" />
                  </View>
                </View>
                <Field label="Отправка" value={d.shipping} onChangeText={(v) => setDraft(item.id, { shipping: v })} placeholder="YYYY-MM-DD" />
                <View style={styles.fieldRow}>
                  <View style={styles.flex1}>
                    <Field label="РРЦ, ₽" value={d.rrp} onChangeText={(v) => setDraft(item.id, { rrp: v })} keyboardType="numeric" />
                  </View>
                  <View style={styles.flex1}>
                    <Field label="Опт, ₽" value={d.wholesale} onChangeText={(v) => setDraft(item.id, { wholesale: v })} keyboardType="numeric" />
                  </View>
                </View>
                <Field label="Предзаказ, ₽" value={d.preorder} onChangeText={(v) => setDraft(item.id, { preorder: v })} keyboardType="numeric" />

                <Text style={styles.panelTitle}>Размеры в предзаказе</Text>
                <View style={styles.chips}>
                  {allSizes.map((s) => {
                    const on = d.sizes.includes(s);
                    return (
                      <Pressable
                        key={s}
                        onPress={() =>
                          setDraft(item.id, {
                            sizes: on ? d.sizes.filter((x: string) => x !== s) : [...d.sizes, s],
                          })
                        }
                        style={[styles.chip, on && styles.chipOn]}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{s}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.productActions}>
                  <Button
                    title={dirty ? "Сохранить изменения" : "Сохранить"}
                    onPress={() => save(item)}
                    loading={busyId === item.id}
                    icon="save-outline"
                  />
                </View>
              </View>
            ) : null}
          </View>
        );
      }}
      ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text={error || "Товаров нет"} />}
    />
  );
}

function OrdersList() {
  const { data, loading, refreshing, error, reload } = useFetch<any>("/admin/wholesale-preorder/orders");
  const orders = Array.isArray(data) ? data : (data as any)?.orders || [];
  return (
    <FlatList
      data={orders}
      keyExtractor={(o, i) => String(o.id ?? o.orderId ?? i)}
      onRefresh={reload}
      refreshing={refreshing}
      style={styles.flex}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {item.companyName || item.customerName || `Заказ #${item.id ?? item.orderId}`}
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
  const [slides, setSlides] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiGet<{ slides?: string[] }>("/wholesale-preorder/slides");
      setSlides(res.slides || []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addSlide = async () => {
    setBusy(true);
    setError("");
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError("Нет доступа к галерее");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        base64: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        setError("Не удалось прочитать изображение");
        return;
      }
      const mime = asset.mimeType || "image/jpeg";
      const fileData = `data:${mime};base64,${asset.base64}`;
      const res = await apiPost<{ slides?: string[] }>("/admin/wholesale-preorder/slides", { fileData });
      setSlides(res.slides || slides);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const removeSlide = async (idx: number) => {
    setBusy(true);
    setError("");
    try {
      const res = await apiDelete<{ slides?: string[] }>(`/admin/wholesale-preorder/slides/${idx}`);
      if (res?.slides) setSlides(res.slides);
      else setSlides((prev) => prev.filter((_, i) => i !== idx));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FlatList
      data={slides}
      keyExtractor={(_, i) => String(i)}
      onRefresh={load}
      refreshing={loading}
      style={styles.flex}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          <InlineError text={error} />
          <Button title="Добавить слайд из галереи" onPress={addSlide} loading={busy} icon="images-outline" />
        </View>
      }
      renderItem={({ item, index }) => (
        <View style={styles.slideRow}>
          <Image source={{ uri: item }} style={styles.slideImage} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={styles.sub} numberOfLines={2}>{item}</Text>
            <Text style={styles.sub}>Слайд {index + 1}</Text>
          </View>
          <Pressable onPress={() => removeSlide(index)} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </Pressable>
        </View>
      )}
      ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text={error || "Слайдов нет"} />}
    />
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabsWrap: { flexShrink: 0, backgroundColor: colors.bg },
  tabsScroll: { flexGrow: 0, flexShrink: 0, height: 52 },
  tabs: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: "center" },
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
  listHeader: { padding: spacing.lg, paddingBottom: spacing.xs, gap: spacing.sm },
  headerBlock: { padding: spacing.lg, gap: spacing.md },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  vatCard: { marginHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.sm },
  vatHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  vatTitle: { color: colors.text, fontSize: 14, fontWeight: "600" },
  vatRow: { flexDirection: "row", alignItems: "flex-end", flexWrap: "wrap", gap: spacing.md },
  vatField: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  vatLabel: { color: colors.textMuted, fontSize: 13 },
  vatInput: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
    width: 64,
    textAlign: "center",
  },
  vatSegmented: { flexDirection: "row", gap: 4 },
  vatSegment: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  vatSegmentOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  vatSegmentText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  vatSegmentTextOn: { color: colors.white },
  vatSaved: { color: colors.success, fontSize: 12 },
  vatHint: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  wholesaleCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  wholesaleCardPending: { borderColor: colors.warning, borderWidth: 1 },
  userHead: { flexDirection: "row" },
  badgeRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.sm, flexWrap: "wrap" },
  infoGrid: { gap: 2 },
  detailText: { color: colors.text, fontSize: 12, lineHeight: 18 },
  detailKey: { color: colors.textMuted },
  approvedActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  discountInputRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  discountInput: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 14,
    width: 56,
    textAlign: "center",
  },
  discountSuffix: { color: colors.textMuted, fontSize: 13, marginRight: spacing.xs },
  passwordBox: { paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: spacing.sm },
  actionRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  title: { color: colors.text, fontSize: 15, fontWeight: "600" },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  price: { color: colors.accent, fontSize: 14, fontWeight: "700" },
  productCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  productTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: colors.surfaceAlt, padding: 3 },
  toggleOn: { backgroundColor: colors.success },
  dot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.textMuted },
  dotOn: { backgroundColor: colors.white, alignSelf: "flex-end" },
  productBody: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  panelTitle: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.xs },
  fieldRow: { flexDirection: "row", gap: spacing.sm },
  flex1: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 13 },
  chipTextOn: { color: colors.accent, fontWeight: "600" },
  productActions: { marginTop: spacing.md },
  slideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  slideImage: { width: 72, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
});
