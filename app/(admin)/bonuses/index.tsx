import React, { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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
  SectionTitle,
} from "@/components/ui";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, getErrorMessage, uploadEmailImage } from "@/lib/api";
import { subcategoriesFor, useCategories } from "@/lib/categories";
import { formatDate, formatDateTime, formatRub, giftCardStatusLabel } from "@/lib/format";
import { productThumb } from "@/lib/images";
import { colors, radius, spacing } from "@/constants/theme";

type Tab = "promo" | "giftcards" | "loyalty" | "newsletter" | "stock" | "price" | "preorder-subs" | "mailings" | "settings";

export default function BonusesScreen() {
  const [tab, setTab] = useState<Tab>("promo");
  // Счётчики для бейджей вкладок (как на сайте).
  const [newsletterCount, setNewsletterCount] = useState<number | null>(null);
  const [stockCount, setStockCount] = useState<number | null>(null);
  const [preorderCount, setPreorderCount] = useState<number | null>(null);
  const [mailingsCount, setMailingsCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [s, st, pr, nq, pq] = await Promise.all([
        apiGet<{ count?: number }>("/admin/newsletter-stats").catch(() => null),
        apiGet<Array<{ notified?: boolean }>>("/admin/stock-notifications").catch(() => null),
        apiGet<{ count?: number; subscribers?: unknown[] }>("/admin/preorder-subscribers").catch(() => null),
        apiGet<{ count?: number }>("/admin/newsletter-queue-status").catch(() => null),
        apiGet<{ count?: number }>("/admin/preorder-queue-status").catch(() => null),
      ]);
      setNewsletterCount(s?.count ?? null);
      setStockCount(Array.isArray(st) ? st.filter((n) => !n.notified).length : null);
      setPreorderCount(pr?.count ?? (Array.isArray(pr?.subscribers) ? pr.subscribers.length : null));
      setMailingsCount((nq?.count ?? 0) + (pq?.count ?? 0));
    })();
  }, []);

  return (
    <Screen title="Бонусы" scroll={false}>
      <View style={styles.tabsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabs}
        >
          <TabBtn label="Промокоды" active={tab === "promo"} onPress={() => setTab("promo")} />
          <TabBtn label="Сертификаты" active={tab === "giftcards"} onPress={() => setTab("giftcards")} />
          <TabBtn label="Лояльность" active={tab === "loyalty"} onPress={() => setTab("loyalty")} />
          <TabBtn label="Рассылка" count={newsletterCount} active={tab === "newsletter"} onPress={() => setTab("newsletter")} />
          <TabBtn label="Подписки на товар" count={stockCount} active={tab === "stock"} onPress={() => setTab("stock")} />
          <TabBtn label="Снижение цены" active={tab === "price"} onPress={() => setTab("price")} />
          <TabBtn label="Предзаказ" count={preorderCount} active={tab === "preorder-subs"} onPress={() => setTab("preorder-subs")} />
          <TabBtn label="Рассылки новинок" count={mailingsCount} active={tab === "mailings"} onPress={() => setTab("mailings")} />
          <TabBtn label="Настройки" active={tab === "settings"} onPress={() => setTab("settings")} />
        </ScrollView>
      </View>
      {tab === "promo" ? <PromoTab /> : null}
      {tab === "giftcards" ? <GiftCardsTab /> : null}
      {tab === "loyalty" ? <LoyaltyTab /> : null}
      {tab === "newsletter" ? <NewsletterTab /> : null}
      {tab === "stock" ? <StockNotifyTab /> : null}
      {tab === "price" ? <PriceDropTab /> : null}
      {tab === "preorder-subs" ? <PreorderSubscribersTab /> : null}
      {tab === "mailings" ? <MailingsTab /> : null}
      {tab === "settings" ? <SettingsTab /> : null}
    </Screen>
  );
}

function SubscriptionsList({ url, wrapKey }: { url: string; wrapKey?: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiGet<any>(url);
      const list = Array.isArray(res) ? res : wrapKey ? res?.[wrapKey] : [];
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const waiting = items.filter((n) => !n.notified).length;

  return (
    <FlatList
      data={items}
      keyExtractor={(n) => String(n.id ?? n.email ?? Math.random())}
      onRefresh={load}
      refreshing={loading}
      style={styles.flex}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{items.length}</Text>
            <Text style={styles.statLabel}>всего</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: colors.warning }]}>{waiting}</Text>
            <Text style={styles.statLabel}>ожидают</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: colors.success }]}>{items.length - waiting}</Text>
            <Text style={styles.statLabel}>уведомлены</Text>
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.code}>{item.email || "—"}</Text>
            <Text style={styles.sub}>
              {item.productName || `Товар #${item.productId || "—"}`}
              {item.size ? ` · Размер ${item.size}` : ""}
            </Text>
            {item.priceAtSubscription ? (
              <Text style={styles.sub}>Цена при подписке: {formatRub(item.priceAtSubscription)}</Text>
            ) : null}
            {item.createdAt || item.subscribedAt ? (
              <Text style={styles.sub}>{formatDate(item.createdAt || item.subscribedAt)}</Text>
            ) : null}
          </View>
          <Badge tone={item.notified ? "success" : "warning"}>
            {item.notified ? "уведомлён" : "ожидает"}
          </Badge>
        </View>
      )}
      ListEmptyComponent={
        loading ? <LoadingView /> : <EmptyState text={error || "Подписок нет"} />
      }
    />
  );
}

function StockNotifyTab() {
  return <SubscriptionsList url="/admin/stock-notifications" />;
}

function PriceDropTab() {
  return <SubscriptionsList url="/admin/price-drop-notify" />;
}

function PreorderSubscribersTab() {
  return <SubscriptionsList url="/admin/preorder-subscribers" wrapKey="subscribers" />;
}

function PromoTab() {
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { categories } = useCategories();
  const [catsOpen, setCatsOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    discountPercent: "10",
    discountAmount: "",
    minOrderAmount: "",
    maxUses: "",
    startsAt: "",
    expiresAt: "",
    allowForWholesale: false,
    applicableCategories: [] as string[],
  });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<{ promoCodes: any[] }>("/promo-codes");
      setPromoCodes(data.promoCodes || []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleCat = (value: string) => {
    setForm((f) => {
      const has = f.applicableCategories.includes(value);
      return {
        ...f,
        applicableCategories: has
          ? f.applicableCategories.filter((c) => c !== value)
          : [...f.applicableCategories, value],
      };
    });
  };

  const create = async () => {
    if (!form.code.trim()) return;
    setBusy(true);
    setError("");
    try {
      await apiPost("/promo-codes", {
        code: form.code.trim().toUpperCase(),
        discountPercent: Number(form.discountPercent) || 0,
        discountAmount: form.discountAmount ? Math.round(Number(form.discountAmount) * 100) : 0,
        minOrderAmount: form.minOrderAmount ? Math.round(Number(form.minOrderAmount) * 100) : 0,
        maxUses: form.maxUses ? Number(form.maxUses) : 0,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        isActive: true,
        allowForWholesale: form.allowForWholesale,
        applicableCategories:
          form.applicableCategories.length > 0 ? JSON.stringify(form.applicableCategories) : null,
      });
      setForm({
        code: "",
        discountPercent: "10",
        discountAmount: "",
        minOrderAmount: "",
        maxUses: "",
        startsAt: "",
        expiresAt: "",
        allowForWholesale: false,
        applicableCategories: [],
      });
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (p: any) => {
    setError("");
    try {
      await apiPatch(`/promo-codes/${p.id}`, { isActive: !p.isActive });
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const remove = async (id: number) => {
    setError("");
    try {
      await apiDelete(`/promo-codes/${id}`);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const discountLabel = (p: any) =>
    p.discountPercent ? `${p.discountPercent}%` : formatRub(p.discountAmount);

  const categoryRestrictionLabel = (p: any) => {
    const raw = p.applicableCategories;
    if (!raw) return "";
    try {
      const cats = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(cats) ? cats.join(", ") : "";
    } catch {
      return "";
    }
  };

  const catSlugs = Object.keys(categories);

  return (
    <FlatList
      data={promoCodes}
      keyExtractor={(p) => String(p.id)}
      onRefresh={load}
      refreshing={loading}
      style={styles.flex}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <Card style={styles.formCard}>
          <SectionTitle>Создать новый промокод</SectionTitle>
          <InlineError text={error} />
          <View style={styles.createRow}>
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Код</Text>
              <TextInput
                value={form.code}
                onChangeText={(v) => setForm((f) => ({ ...f, code: v }))}
                placeholder="BMG-SUMMER"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                style={styles.input}
              />
            </View>
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Скидка (%)</Text>
              <TextInput
                value={form.discountPercent}
                onChangeText={(v) => setForm((f) => ({ ...f, discountPercent: v }))}
                placeholder="10"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                style={[styles.input, styles.inputSmall]}
              />
            </View>
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Скидка (₽)</Text>
              <TextInput
                value={form.discountAmount}
                onChangeText={(v) => setForm((f) => ({ ...f, discountAmount: v }))}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                style={[styles.input, styles.inputSmall]}
              />
            </View>
          </View>
          <View style={styles.createRow}>
            <Field label="Начало действия (гггг-мм-дд)" value={form.startsAt} onChangeText={(v) => setForm((f) => ({ ...f, startsAt: v }))} />
            <Field label="Конец действия (гггг-мм-дд)" value={form.expiresAt} onChangeText={(v) => setForm((f) => ({ ...f, expiresAt: v }))} />
          </View>
          <View style={styles.createRow}>
            <Field label="Мин. заказ (₽)" value={form.minOrderAmount} onChangeText={(v) => setForm((f) => ({ ...f, minOrderAmount: v }))} keyboardType="numeric" />
            <Field label="Макс. использований (0 = безлимит)" value={form.maxUses} onChangeText={(v) => setForm((f) => ({ ...f, maxUses: v }))} keyboardType="numeric" />
          </View>

          <Pressable onPress={() => setForm((f) => ({ ...f, allowForWholesale: !f.allowForWholesale }))} style={styles.wholesaleRow}>
            <Ionicons
              name={form.allowForWholesale ? "checkbox" : "square-outline"}
              size={20}
              color={form.allowForWholesale ? colors.accent : colors.textMuted}
            />
            <Text style={styles.wholesaleLabel}>Доступен для оптовых покупателей</Text>
          </Pressable>

          <Text style={styles.fieldLabel}>Применять только к категориям (пусто = на весь заказ)</Text>
          <Pressable onPress={() => setCatsOpen((v) => !v)} style={styles.catsTrigger}>
            {form.applicableCategories.length === 0 ? (
              <Text style={styles.catsPlaceholder}>Все категории</Text>
            ) : (
              <View style={styles.chipsRow}>
                {form.applicableCategories.map((cat) => (
                  <View key={cat} style={styles.chip}>
                    <Text style={styles.chipText}>{cat}</Text>
                  </View>
                ))}
              </View>
            )}
            <Ionicons name={catsOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
          </Pressable>
          {catsOpen ? (
            <ScrollView style={styles.catsPanel} nestedScrollEnabled>
              <View style={styles.catsPanelInner}>
                {catSlugs.map((slug) => {
                  const cat = categories[slug];
                  if (!cat) return null;
                  const subs = subcategoriesFor(categories, slug);
                  return (
                    <View key={slug} style={styles.catGroup}>
                      <Pressable onPress={() => toggleCat(slug)} style={styles.catRow}>
                        <Ionicons
                          name={form.applicableCategories.includes(slug) ? "checkbox" : "square-outline"}
                          size={18}
                          color={form.applicableCategories.includes(slug) ? colors.accent : colors.textMuted}
                        />
                        <Text style={styles.catName}>{cat.name} (весь раздел)</Text>
                      </Pressable>
                      {subs.map((sub) => (
                        <Pressable key={sub.name} onPress={() => toggleCat(sub.name)} style={styles.subCatRow}>
                          <Ionicons
                            name={form.applicableCategories.includes(sub.name) ? "checkbox" : "square-outline"}
                            size={18}
                            color={form.applicableCategories.includes(sub.name) ? colors.accent : colors.textMuted}
                          />
                          <Text style={styles.subName}>{sub.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  );
                })}
                {form.applicableCategories.length > 0 ? (
                  <Button title="Сбросить выбор" variant="ghost" onPress={() => setForm((f) => ({ ...f, applicableCategories: [] }))} />
                ) : null}
              </View>
            </ScrollView>
          ) : null}

          <Button title="Создать" onPress={create} loading={busy} icon="add" />
        </Card>
      }
      renderItem={({ item }) => {
        const only = categoryRestrictionLabel(item);
        return (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <View style={styles.codeRow}>
                <Text style={styles.code}>{item.code}</Text>
                {item.allowForWholesale ? <Badge tone="info">Опт</Badge> : null}
              </View>
              <Text style={styles.sub}>
                {discountLabel(item)} скидка
                {item.minOrderAmount > 0 ? ` · от ${formatRub(item.minOrderAmount)}` : ""}
                {item.maxUses > 0 ? ` · использовано: ${item.usedCount ?? 0}/${item.maxUses}` : ""}
                {only ? ` · только: ${only}` : ""}
              </Text>
              {item.expiresAt ? <Text style={styles.sub}>до {formatDate(item.expiresAt)}</Text> : null}
            </View>
            <Pressable onPress={() => toggle(item)}>
              <Badge tone={item.isActive ? "success" : "neutral"}>
                {item.isActive ? "активен" : "выключен"}
              </Badge>
            </Pressable>
            <Pressable onPress={() => remove(item.id)} hitSlop={8}>
              <Text style={styles.delete}>Удалить</Text>
            </Pressable>
          </View>
        );
      }}
      ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text={error || "Промокодов нет"} />}
    />
  );
}

function GiftCardsTab() {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setCards(await apiGet<any[]>("/admin/gift-cards"));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleStatus = async (g: any) => {
    setError("");
    try {
      await apiPatch(`/admin/gift-cards/${g.id}`, { status: g.status === "active" ? "used" : "active" });
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const remove = async (id: number) => {
    setError("");
    try {
      await apiDelete(`/admin/gift-cards/${id}`);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <FlatList
      data={cards}
      keyExtractor={(g) => String(g.id)}
      onRefresh={load}
      refreshing={loading}
      style={styles.flex}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<InlineError text={error} />}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.code}>{item.code}</Text>
            <Text style={styles.sub}>
              Номинал {formatRub(item.amount)} · Баланс {formatRub(item.balance)}
            </Text>
            <Text style={styles.sub}>
              Получатель: {item.recipientEmail || item.purchaserEmail || "—"}
            </Text>
            <Text style={styles.sub}>до {formatDate(item.expiresAt)}</Text>
          </View>
          <Pressable onPress={() => toggleStatus(item)}>
            <Badge tone={item.status === "active" ? "success" : "neutral"}>
              {giftCardStatusLabel(item.status)}
            </Badge>
          </Pressable>
          <Pressable onPress={() => remove(item.id)} hitSlop={8}>
            <Text style={styles.delete}>Удалить</Text>
          </Pressable>
        </View>
      )}
      ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text={error || "Сертификатов нет"} />}
    />
  );
}

interface LoyaltyTier {
  id: number;
  name?: string;
  minSpent?: number;
  discountPercent?: number;
}

function LoyaltyTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ id: 0, name: "", minSpent: "", discountPercent: "" });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [u, t] = await Promise.all([
        apiGet<{ users?: any[] }>("/admin/loyalty-users"),
        apiGet<LoyaltyTier[]>("/loyalty-tiers").catch(() => []),
      ]);
      setUsers(u.users || []);
      setTiers(Array.isArray(t) ? t : []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (tier?: LoyaltyTier) => {
    setError("");
    setForm(
      tier
        ? { id: tier.id, name: tier.name || "", minSpent: String((tier.minSpent || 0) / 100), discountPercent: String(tier.discountPercent ?? "") }
        : { id: 0, name: "", minSpent: "", discountPercent: "" },
    );
    setShowForm(true);
  };

  const saveTier = async () => {
    if (!form.name.trim()) {
      setError("Укажите название уровня");
      return;
    }
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const payload = {
        name: form.name.trim(),
        minSpent: Math.round(Number(form.minSpent || 0) * 100),
        discountPercent: Number(form.discountPercent || 0),
      };
      if (form.id) {
        await apiPatch(`/loyalty-tiers/${form.id}`, payload);
      } else {
        await apiPost("/loyalty-tiers", payload);
      }
      setMsg(form.id ? "Уровень обновлён" : "Уровень создан");
      setShowForm(false);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteTier = async (id: number) => {
    setBusy(true);
    setError("");
    try {
      await apiDelete(`/loyalty-tiers/${id}`);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const sortedTiers = [...tiers].sort((a, b) => (a.minSpent || 0) - (b.minSpent || 0));

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.mailingsWrap}>
      {loading ? <LoadingView /> : null}
      <Card style={styles.card}>
        <SectionTitle>Уровни накопительной скидки</SectionTitle>
        <InlineError text={error} />
        {msg ? <Text style={styles.saved}>{msg}</Text> : null}
        {!showForm ? (
          <Button title="Добавить уровень" variant="secondary" onPress={() => startEdit()} icon="add" />
        ) : (
          <>
            <Field label="Название" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Например: Серебро" />
            <Field label="Сумма покупок от, ₽" value={form.minSpent} onChangeText={(v) => setForm((f) => ({ ...f, minSpent: v }))} keyboardType="numeric" />
            <Field label="Скидка, %" value={form.discountPercent} onChangeText={(v) => setForm((f) => ({ ...f, discountPercent: v }))} keyboardType="numeric" />
            <View style={styles.createRow}>
              <Button title="Сохранить" onPress={saveTier} loading={busy} icon="save-outline" />
              <Button title="Отмена" variant="ghost" onPress={() => setShowForm(false)} />
            </View>
          </>
        )}
        <View style={styles.tierList}>
          {sortedTiers.map((tier) => (
            <View key={tier.id} style={styles.tierRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tierName}>{tier.name || `Уровень ${tier.id}`}</Text>
                <Text style={styles.sub}>от {formatRub(tier.minSpent || 0)}</Text>
              </View>
              <Badge tone="accent">-{tier.discountPercent ?? 0}%</Badge>
              <Pressable onPress={() => startEdit(tier)} hitSlop={8}>
                <Ionicons name="create-outline" size={16} color={colors.textMuted} />
              </Pressable>
              <Pressable onPress={() => deleteTier(tier.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </Pressable>
            </View>
          ))}
          {sortedTiers.length === 0 ? <Text style={styles.hint}>Уровни ещё не настроены. Нажмите «Добавить уровень».</Text> : null}
        </View>
        <View style={styles.tierDivider}>
          <SectionTitle>Клиенты с бонусами</SectionTitle>
        </View>
        {users.map((item, i) => (
          <View key={String(item.id ?? i)} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.code}>{item.email || item.name}</Text>
              <Text style={styles.sub}>Потрачено: {formatRub(item.totalSpent)}</Text>
            </View>
            <Badge tone="accent">-{item.loyaltyDiscount ?? 0}%</Badge>
          </View>
        ))}
        {users.length === 0 ? <EmptyState text="Нет участников" /> : null}
      </Card>
    </ScrollView>
  );
}

interface QueueStatus {
  count: number;
  firstAddedAt?: string | null;
  lastAddedAt?: string | null;
  minutesUntilSend?: number | null;
  productIds: number[];
  products: Array<{
    id: number;
    name: string;
    price: number;
    imageUrl: string;
    slug: string;
  }>;
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `~${Math.max(0, Math.round(mins))} мин`;
  return `~${Math.round(mins / 60)} ч`;
}

function NewsletterTab() {
  const [stats, setStats] = useState<{ subscriptions?: any[]; count?: number } | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  // Broadcast form
  const [broadcast, setBroadcast] = useState({ subject: "", body: "" });
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const load = async () => {
    setError("");
    try {
      const s = await apiGet<{ subscriptions?: any[]; count?: number }>("/admin/newsletter-stats");
      setStats(s);
      setSelectedEmails((current) => {
        const available = new Set((s.subscriptions || []).map((item) => item.email).filter(Boolean));
        if (current.size === 0) return available;
        return new Set([...current].filter((email) => available.has(email)));
      });
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sendBroadcast = async () => {
    const emails = [...selectedEmails].filter(Boolean);
    if (!broadcast.subject.trim() || !broadcast.body.trim()) {
      setError("Заполните тему и текст");
      return;
    }
    if (emails.length === 0) {
      setError("Выберите хотя бы одного получателя");
      return;
    }
    setSending(true);
    setError("");
    setMsg("");
    try {
      const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2>${broadcast.subject}</h2>${broadcast.body
        .split("\n\n")
        .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
        .join("")}</div>`;
      const res = await apiPost<any>("/admin/newsletter-broadcast", {
        subject: broadcast.subject.trim(),
        html,
        emails,
      });
      setMsg(`Отправлено: ${res.sent ?? "ok"}, ошибок: ${res.failed ?? 0}`);
      setBroadcast({ subject: "", body: "" });
      setSelectedEmails(new Set());
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const addEmailImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Нужен доступ к фото");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    setSending(true);
    setError("");
    try {
      const asset = result.assets[0];
      const url = await uploadEmailImage(asset.uri, asset.fileName || undefined);
      setBroadcast((current) => ({
        ...current,
        body: `${current.body}${current.body ? "\n\n" : ""}<img src="${url}" alt="Изображение" style="max-width:100%;height:auto;display:block" />`,
      }));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.mailingsWrap}>
      <InlineError text={error} />
      {msg ? <Text style={styles.saved}>{msg}</Text> : null}

      <Card style={styles.card}>
        <Text style={styles.countLabel}>Всего подписчиков</Text>
        <Text style={styles.countValue}>{stats?.count ?? 0}</Text>
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Broadcast-рассылка</SectionTitle>
        <Text style={styles.count}>Подписчиков: {stats?.count ?? 0}</Text>
        <Field label="Тема" value={broadcast.subject} onChangeText={(v) => setBroadcast((f) => ({ ...f, subject: v }))} />
        <Field label="Текст письма" value={broadcast.body} onChangeText={(v) => setBroadcast((f) => ({ ...f, body: v }))} multiline />
        <View style={styles.broadcastTools}>
          <Button title="Добавить изображение" variant="secondary" onPress={addEmailImage} loading={sending} icon="image-outline" />
          <Text style={styles.queueMeta}>Можно вставить несколько изображений в письмо.</Text>
        </View>
        <View style={styles.recipientsHeader}>
          <Text style={styles.recipientTitle}>Получатели: {selectedEmails.size} из {stats?.subscriptions?.length ?? 0}</Text>
          <Pressable
            onPress={() => {
              const all = (stats?.subscriptions || []).map((item) => item.email).filter(Boolean);
              setSelectedEmails((current) => current.size === all.length ? new Set() : new Set(all));
            }}
            hitSlop={8}
          >
            <Text style={styles.addBtnText}>{selectedEmails.size === (stats?.subscriptions?.length || 0) && selectedEmails.size > 0 ? "Снять все" : "Выбрать всех"}</Text>
          </Pressable>
        </View>
        <View style={styles.recipientsList}>
          {(stats?.subscriptions || []).map((subscriber, index) => {
            const email = subscriber.email;
            const checked = selectedEmails.has(email);
            return (
              <Pressable
                key={String(subscriber.id ?? email ?? index)}
                onPress={() => setSelectedEmails((current) => {
                  const next = new Set(current);
                  if (next.has(email)) next.delete(email); else next.add(email);
                  return next;
                })}
                style={styles.recipientRow}
              >
                <Ionicons name={checked ? "checkbox" : "square-outline"} size={18} color={checked ? colors.accent : colors.textMuted} />
                <Text style={styles.subEmail}>{email}</Text>
                <Text style={styles.subDate}>{formatDate(subscriber.subscribedAt)}</Text>
              </Pressable>
            );
          })}
          {(stats?.subscriptions || []).length === 0 ? <Text style={styles.hint}>Подписчиков пока нет</Text> : null}
        </View>
        <Button title={`Отправить выбранным (${selectedEmails.size})`} onPress={sendBroadcast} loading={sending} disabled={selectedEmails.size === 0} icon="paper-plane" />
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Подписчики рассылки</SectionTitle>
        {(stats?.subscriptions || []).map((s, i) => (
          <View key={String(s.id ?? i)} style={styles.subRow}>
            <Text style={styles.subEmail}>{s.email}</Text>
            <Text style={styles.subDate}>{formatDate(s.subscribedAt)}</Text>
            <Pressable
              onPress={async () => {
                try {
                  await apiDelete(`/admin/newsletter-subscriptions/${s.id}`);
                  await load();
                } catch (e) {
                  setError(getErrorMessage(e));
                }
              }}
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
            </Pressable>
          </View>
        ))}
        {(stats?.subscriptions || []).length === 0 ? <EmptyState text="Подписчиков нет" /> : null}
      </Card>
    </ScrollView>
  );
}

function MailingsTab() {
  const [settings, setSettings] = useState<{ newProductsEnabled?: boolean; preorderEnabled?: boolean } | null>(null);
  const [npQueue, setNpQueue] = useState<QueueStatus | null>(null);
  const [poQueue, setPoQueue] = useState<QueueStatus | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setError("");
    try {
      const [st, np, po] = await Promise.all([
        apiGet<{ newProductsEnabled?: boolean; preorderEnabled?: boolean }>("/admin/mailings-settings"),
        apiGet<QueueStatus>("/admin/newsletter-queue-status").catch(() => null),
        apiGet<QueueStatus>("/admin/preorder-queue-status").catch(() => null),
      ]);
      setSettings(st);
      setNpQueue(np);
      setPoQueue(po);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveSetting = async (key: "newProductsEnabled" | "preorderEnabled", value: boolean) => {
    setSaving(true);
    setError("");
    try {
      await apiPatch("/admin/mailings-settings", { [key]: value });
      setSettings((s) => ({ ...(s || {}), [key]: value }));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const trigger = async (which: "newsletter" | "preorder") => {
    setSaving(true);
    setError("");
    setMsg("");
    try {
      const res = await apiPost<any>(
        which === "newsletter" ? "/admin/newsletter-trigger-now" : "/admin/preorder-trigger-now",
      );
      setMsg(`Отправлено: ${res.sent ?? res.count ?? "ok"}`);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.mailingsWrap}>
      <InlineError text={error} />
      {msg ? <Text style={styles.saved}>{msg}</Text> : null}

      <QueueCard
        title="Новинки"
        icon="sparkles-outline"
        description="Автоматическая рассылка новых товаров подписчикам. Отправка — вручную кнопкой ниже."
        enabled={settings?.newProductsEnabled !== false}
        onToggle={(v) => saveSetting("newProductsEnabled", v)}
        queue={npQueue}
        addUrl="/admin/newsletter-queue-item"
        onSendNow={() => trigger("newsletter")}
        onReload={load}
        busy={saving}
      />

      <QueueCard
        title="Предзаказы"
        icon="notifications-outline"
        description="Уведомление подписчиков при открытии нового предзаказа."
        enabled={settings?.preorderEnabled !== false}
        onToggle={(v) => saveSetting("preorderEnabled", v)}
        queue={poQueue}
        addUrl="/admin/preorder-queue-item"
        onSendNow={() => trigger("preorder")}
        onReload={load}
        busy={saving}
      />
    </ScrollView>
  );
}

interface PopupPromoData {
  popup?: { id: number; code: string; discountPercent?: number; isActive?: boolean } | null;
  homepage?: { id: number; code: string; discountPercent?: number; isActive?: boolean } | null;
  settings?: {
    enabled?: boolean;
    title?: string;
    subtitle?: string;
    description?: string;
    buttonText?: string;
    successTitle?: string;
    successText?: string;
    delay?: number;
    placeholder?: string;
    closeText?: string;
  };
}

/** Вкладка «Настройки» — брошенные корзины и промокоды за подписку (popup + главная). */
function SettingsTab() {
  const [data, setData] = useState<PopupPromoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiGet<PopupPromoData>("/admin/popup-promo");
      setData(res || {});
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const patchSettings = (key: keyof NonNullable<PopupPromoData["settings"]>, value: unknown) => {
    setData((prev) => ({ ...(prev || {}), settings: { ...(prev?.settings || {}), [key]: value } }));
    setMsg("");
  };

  const patchPromo = (which: "popup" | "homepage", key: string, value: unknown) => {
    const cur = data?.[which] || {};
    setData((prev) => ({ ...(prev || {}), [which]: { ...cur, [key]: value } }));
    setMsg("");
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setMsg("");
    try {
      const { popup, homepage, settings } = data || {};
      await apiPut("/admin/popup-promo", {
        popup: popup
          ? {
              id: popup.id,
              code: popup.code,
              discountPercent: Number(popup.discountPercent) || 0,
              isActive: !!popup.isActive,
            }
          : undefined,
        homepage: homepage
          ? {
              id: homepage.id,
              code: homepage.code,
              discountPercent: Number(homepage.discountPercent) || 0,
              isActive: !!homepage.isActive,
            }
          : undefined,
        settings,
      });
      setMsg("Настройки подписки сохранены");
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const triggerAbandoned = async () => {
    setTriggering(true);
    setError("");
    setMsg("");
    try {
      const res = await apiPost<{ sent?: number; error?: string }>("/admin/trigger-abandoned-cart");
      setMsg(`Рассылка о брошенных корзинах отправлена: ${res.sent ?? "ok"}`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setTriggering(false);
    }
  };

  const settings = data?.settings || {};

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.mailingsWrap}>
      <InlineError text={error} />
      {msg ? <Text style={styles.saved}>{msg}</Text> : null}

      <Card style={styles.card}>
        <SectionTitle>Брошенные корзины</SectionTitle>
        <Text style={styles.hint}>
          Ручной запуск рассылки напоминаний покупателям, которые оставили товары в корзине.
        </Text>
        <Button
          title="Запустить рассылку сейчас"
          onPress={triggerAbandoned}
          loading={triggering}
          variant="secondary"
          icon="cart-outline"
        />
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Промокоды за подписку</SectionTitle>
        {loading ? (
          <LoadingView />
        ) : (
          <>
            <PromoCodeBlock
              title="Popup (всплывающее окно)"
              code={data?.popup?.code || ""}
              discountPercent={data?.popup?.discountPercent}
              isActive={!!data?.popup?.isActive}
              onCode={(v) => patchPromo("popup", "code", v.toUpperCase())}
              onDiscount={(v) => patchPromo("popup", "discountPercent", v)}
              onActive={(v) => patchPromo("popup", "isActive", v)}
            />
            <View style={styles.promoTexts}>
              <Field label="Заголовок" value={settings.title || ""} onChangeText={(v) => patchSettings("title", v)} />
              <Field label="Подзаголовок" value={settings.subtitle || ""} onChangeText={(v) => patchSettings("subtitle", v)} />
              <Field label="Описание" value={settings.description || ""} onChangeText={(v) => patchSettings("description", v)} multiline />
              <Field label="Текст кнопки" value={settings.buttonText || ""} onChangeText={(v) => patchSettings("buttonText", v)} />
              <Field label="Плейсхолдер email" value={settings.placeholder || ""} onChangeText={(v) => patchSettings("placeholder", v)} />
              <Field label="Заголовок успеха" value={settings.successTitle || ""} onChangeText={(v) => patchSettings("successTitle", v)} />
              <Field label="Текст успеха" value={settings.successText || ""} onChangeText={(v) => patchSettings("successText", v)} />
              <Field label="Текст закрытия" value={settings.closeText || ""} onChangeText={(v) => patchSettings("closeText", v)} />
              <Field
                label="Задержка показа, мс"
                value={String(settings.delay ?? "")}
                onChangeText={(v) => patchSettings("delay", v ? Number(v) : 0)}
                keyboardType="numeric"
              />
              <ToggleRow label={settings.enabled ? "Показывать popup" : "Скрытый popup"} value={!!settings.enabled} onToggle={(v) => patchSettings("enabled", v)} />
            </View>
            <PromoCodeBlock
              title="Главная страница"
              code={data?.homepage?.code || ""}
              discountPercent={data?.homepage?.discountPercent}
              isActive={!!data?.homepage?.isActive}
              onCode={(v) => patchPromo("homepage", "code", v.toUpperCase())}
              onDiscount={(v) => patchPromo("homepage", "discountPercent", v)}
              onActive={(v) => patchPromo("homepage", "isActive", v)}
            />
            <View style={styles.saveRow}>
              <Button title="Сохранить подписку" onPress={save} loading={saving} icon="save-outline" />
            </View>
          </>
        )}
      </Card>
    </ScrollView>
  );
}

function PromoCodeBlock({
  title,
  code,
  discountPercent,
  isActive,
  onCode,
  onDiscount,
  onActive,
}: {
  title: string;
  code: string;
  discountPercent?: number;
  isActive: boolean;
  onCode: (v: string) => void;
  onDiscount: (v: number) => void;
  onActive: (v: boolean) => void;
}) {
  return (
    <View style={[styles.promoCodeBlock, { marginBottom: spacing.lg }]}>
      <View style={styles.queueHeader}>
        <Text style={styles.promoTitle}>{title}</Text>
        <ToggleRow label={isActive ? "Вкл" : "Выкл"} value={isActive} onToggle={onActive} />
      </View>
      <View style={styles.promoFields}>
        <Field label="Код промокода" value={code} onChangeText={onCode} autoCapitalize="characters" />
        <Field
          label="Скидка, %"
          value={String(discountPercent ?? "")}
          onChangeText={(v) => onDiscount(v ? Number(v) : 0)}
          keyboardType="numeric"
        />
      </View>
    </View>
  );
}

function QueueCard({
  title,
  icon,
  description,
  enabled,
  onToggle,
  queue,
  addUrl,
  onSendNow,
  onReload,
  subscribers,
  busy,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  queue: QueueStatus | null;
  addUrl: string;
  onSendNow: () => void;
  onReload: () => void;
  subscribers?: number;
  busy?: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [itemBusy, setItemBusy] = useState(false);
  const [err, setErr] = useState("");

  const loadProducts = async () => {
    if (products.length > 0) return;
    try {
      const data = await apiGet<{ products?: any[] }>("/products?limit=5000&admin=true");
      setProducts(data.products || []);
    } catch {
      // поиск просто не найдёт ничего
    }
  };

  const toggleAdd = () => {
    const next = !addOpen;
    setAddOpen(next);
    setSearch("");
    if (next) loadProducts();
  };

  const addItem = async (id: number) => {
    setItemBusy(true);
    setErr("");
    try {
      await apiPost(addUrl, { productId: id });
      setAddOpen(false);
      setSearch("");
      onReload();
    } catch (e) {
      setErr(getErrorMessage(e));
    } finally {
      setItemBusy(false);
    }
  };

  const removeItem = async (id: number) => {
    setItemBusy(true);
    setErr("");
    try {
      await apiDelete(addUrl, { data: { productId: id } });
      onReload();
    } catch (e) {
      setErr(getErrorMessage(e));
    } finally {
      setItemBusy(false);
    }
  };

  const q = search.trim().toLowerCase();
  const queueIds = queue?.productIds || [];
  const found = q
    ? products
        .filter(
          (p) =>
            (p.name || "").toLowerCase().includes(q) ||
            String(p.id).includes(q),
        )
        .filter((p) => !queueIds.includes(p.id))
        .slice(0, 8)
    : [];

  return (
    <Card style={styles.card}>
      <View style={styles.queueHeader}>
        <View style={styles.queueHeaderLeft}>
          <Ionicons name={icon} size={18} color={colors.accent} />
          <Text style={styles.queueTitle}>{title}</Text>
        </View>
        <ToggleRow
          label={enabled ? "Вкл" : "Выкл"}
          value={enabled}
          onToggle={onToggle}
          disabled={busy}
        />
      </View>
      <Text style={styles.hint}>{description}</Text>

      {queue === null ? (
        <LoadingView />
      ) : queue.count === 0 ? (
        <View style={styles.queueEmpty}>
          <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
          <Text style={styles.hint}>Очередь пуста — нет товаров для отправки</Text>
        </View>
      ) : (
        <>
          <View style={styles.queueChips}>
            <Badge tone="accent">{queue.count} в очереди</Badge>
            {queue.minutesUntilSend != null ? (
              <Badge tone="warning">до отправки {formatMinutes(queue.minutesUntilSend)}</Badge>
            ) : null}
          </View>
          {queue.firstAddedAt ? (
            <Text style={styles.queueMeta}>
              Первый добавлен: {formatDateTime(queue.firstAddedAt)}
              {queue.lastAddedAt && queue.lastAddedAt !== queue.firstAddedAt
                ? ` · Последний: ${formatDateTime(queue.lastAddedAt)}`
                : ""}
            </Text>
          ) : null}
          <View style={styles.queueProducts}>
            {queue.products.map((p) => (
              <View key={p.id} style={styles.queueProduct}>
                {productThumb(p) ? (
                  <Image
                    source={{ uri: productThumb(p) }}
                    style={styles.queueImg}
                    contentFit="cover"
                    transition={100}
                  />
                ) : (
                  <View style={[styles.queueImg, styles.queueImgEmpty]}>
                    <Ionicons name="image-outline" size={16} color={colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.queueName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.queueMeta}>
                    {formatRub(p.price)} · #{p.id}
                  </Text>
                </View>
                <Pressable
                  onPress={() => removeItem(p.id)}
                  disabled={itemBusy}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={20} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        </>
      )}

      {addOpen ? (
        <View style={styles.addArea}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Поиск по названию или ID…"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoFocus
          />
          {q ? (
            <View style={styles.searchResults}>
              {found.map((p) => (
                <Pressable
                  key={p.id}
                  style={styles.searchRow}
                  onPress={() => addItem(p.id)}
                  disabled={itemBusy}
                >
                  {productThumb(p) ? (
                    <Image
                      source={{ uri: productThumb(p) }}
                      style={styles.searchImg}
                      contentFit="cover"
                      transition={100}
                    />
                  ) : (
                    <View style={[styles.searchImg, styles.queueImgEmpty]} />
                  )}
                  <Text style={styles.searchName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.queueMeta}>{formatRub(p.price)}</Text>
                </Pressable>
              ))}
              {found.length === 0 ? <Text style={styles.hint}>Ничего не найдено</Text> : null}
            </View>
          ) : null}
          <Pressable onPress={() => setAddOpen(false)} hitSlop={8}>
            <Text style={styles.cancel}>Отмена</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={toggleAdd} style={styles.addBtn}>
          <Ionicons name="add" size={16} color={colors.accent} />
          <Text style={styles.addBtnText}>Добавить товар в очередь</Text>
        </Pressable>
      )}

      <View style={styles.sendRow}>
        <Button
          title="Отправить сейчас"
          onPress={onSendNow}
          loading={busy}
          variant="secondary"
          icon="paper-plane-outline"
        />
      </View>
      <Text style={styles.queueMeta}>
        Подписчиков: {subscribers ?? "—"}
      </Text>
      {err ? <Text style={styles.err}>{err}</Text> : null}
    </Card>
  );
}

function ToggleRow({
  label,
  value,
  onToggle,
  disabled,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Pressable
        disabled={disabled}
        onPress={() => onToggle(!value)}
        style={[styles.toggle, value && styles.toggleOn]}
      >
        <View style={[styles.dot, value && styles.dotOn]} />
      </Pressable>
    </View>
  );
}

function TabBtn({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number | null;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
        {label}
        {count != null && count > 0 ? ` (${count})` : ""}
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
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  tab: {
    paddingHorizontal: spacing.lg,
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
  list: { paddingBottom: spacing.xxl },
  formCard: { margin: spacing.lg },
  createRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
  },
  inputSmall: { flex: 0.4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  code: { color: colors.text, fontSize: 15, fontWeight: "700", textTransform: "uppercase" },
  codeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  delete: { color: colors.danger, fontSize: 13 },
  fieldWrap: { flex: 1 },
  fieldLabel: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs },
  wholesaleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  wholesaleLabel: { color: colors.text, fontSize: 14, flex: 1 },
  catsTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  catsPlaceholder: { color: colors.textMuted, fontSize: 14, flex: 1 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 },
  chip: {
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  chipText: { color: colors.accent, fontSize: 11, fontWeight: "600" },
  catsPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceAlt,
    maxHeight: 320,
  },
  catsPanelInner: { padding: spacing.sm },
  catGroup: { marginBottom: spacing.sm },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  catName: { color: colors.text, fontSize: 13, fontWeight: "600", flex: 1 },
  subCatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.lg,
  },
  subName: { color: colors.textMuted, fontSize: 13, flex: 1 },
  mailingsWrap: { padding: spacing.lg, gap: spacing.lg },
  card: {},
  count: { color: colors.text, fontSize: 14, fontWeight: "600", marginBottom: spacing.sm },
  countLabel: { color: colors.textMuted, fontSize: 13, marginBottom: 4 },
  countValue: { color: colors.text, fontSize: 26, fontWeight: "700" },
  queueHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  queueHeaderLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  queueTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: spacing.sm },
  queueChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  queueMeta: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  queueEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  queueProducts: { gap: spacing.sm, marginBottom: spacing.md },
  queueProduct: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  queueImg: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  queueImgEmpty: { alignItems: "center", justifyContent: "center" },
  queueName: { color: colors.text, fontSize: 13, fontWeight: "600" },
  addArea: { gap: spacing.sm, marginBottom: spacing.md },
  searchInput: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 14,
  },
  searchResults: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    maxHeight: 220,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  searchImg: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.surface },
  searchName: { color: colors.text, fontSize: 12, flex: 1 },
  cancel: { color: colors.textMuted, fontSize: 13 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: spacing.md },
  addBtnText: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  sendRow: { marginBottom: spacing.md },
  err: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  subRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  subEmail: { color: colors.text, fontSize: 13, flexShrink: 1 },
  subDate: { color: colors.textMuted, fontSize: 12 },
  broadcastTools: { gap: spacing.xs, marginBottom: spacing.md },
  recipientsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginBottom: spacing.xs },
  recipientTitle: { color: colors.text, fontSize: 13, fontWeight: "600" },
  recipientsList: { maxHeight: 220, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm, marginBottom: spacing.md },
  recipientRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tierList: { marginTop: spacing.sm, gap: spacing.sm },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  tierName: { color: colors.text, fontSize: 14, fontWeight: "600" },
  tierDivider: { marginTop: spacing.lg, marginBottom: spacing.xs },
  promoCodeBlock: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  promoTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  promoFields: { gap: spacing.sm, marginTop: spacing.xs },
  promoTexts: { gap: spacing.sm, marginBottom: spacing.lg },
  saveRow: { marginTop: spacing.xs },
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
  saved: { color: colors.success, fontSize: 13 },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: "center",
  },
  statValue: { color: colors.text, fontSize: 20, fontWeight: "700" },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
