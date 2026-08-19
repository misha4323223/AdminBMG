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
import { apiDelete, apiGet, apiPatch, apiPost, getErrorMessage } from "@/lib/api";
import { formatDate, formatRub } from "@/lib/format";
import { colors, spacing } from "@/constants/theme";

type Tab = "promo" | "giftcards" | "loyalty" | "mailings";

export default function BonusesScreen() {
  const [tab, setTab] = useState<Tab>("promo");
  return (
    <Screen title="Бонусы" scroll={false}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
        <View style={styles.tabs}>
          <TabBtn label="Промо" active={tab === "promo"} onPress={() => setTab("promo")} />
          <TabBtn label="Сертификаты" active={tab === "giftcards"} onPress={() => setTab("giftcards")} />
          <TabBtn label="Лояльность" active={tab === "loyalty"} onPress={() => setTab("loyalty")} />
          <TabBtn label="Рассылки" active={tab === "mailings"} onPress={() => setTab("mailings")} />
        </View>
      </ScrollView>
      {tab === "promo" ? <PromoTab /> : null}
      {tab === "giftcards" ? <GiftCardsTab /> : null}
      {tab === "loyalty" ? <LoyaltyTab /> : null}
      {tab === "mailings" ? <MailingsTab /> : null}
    </Screen>
  );
}

function PromoTab() {
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    code: "",
    discountPercent: "10",
    discountAmount: "",
    minOrderAmount: "",
    maxUses: "",
    startsAt: "",
    expiresAt: "",
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

  const create = async () => {
    if (!form.code.trim()) return;
    setBusy(true);
    setError("");
    try {
      await apiPost("/promo-codes", {
        code: form.code.trim().toUpperCase(),
        discountPercent: form.discountPercent ? Number(form.discountPercent) : null,
        discountAmount: form.discountAmount ? Math.round(Number(form.discountAmount) * 100) : null,
        minOrderAmount: form.minOrderAmount ? Math.round(Number(form.minOrderAmount) * 100) : null,
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        startsAt: form.startsAt || undefined,
        expiresAt: form.expiresAt || undefined,
        isActive: true,
      });
      setForm({
        code: "",
        discountPercent: "10",
        discountAmount: "",
        minOrderAmount: "",
        maxUses: "",
        startsAt: "",
        expiresAt: "",
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

  return (
    <FlatList
      data={promoCodes}
      keyExtractor={(p) => String(p.id)}
      onRefresh={load}
      refreshing={loading}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <Card style={styles.formCard}>
          <SectionTitle>Новый промокод</SectionTitle>
          <InlineError text={error} />
          <View style={styles.createRow}>
            <TextInput
              value={form.code}
              onChangeText={(v) => setForm((f) => ({ ...f, code: v }))}
              placeholder="КОД"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              style={styles.input}
            />
            <TextInput
              value={form.discountPercent}
              onChangeText={(v) => setForm((f) => ({ ...f, discountPercent: v }))}
              placeholder="%"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={[styles.input, styles.inputSmall]}
            />
          </View>
          <Field label="Фиксированная скидка, ₽" value={form.discountAmount} onChangeText={(v) => setForm((f) => ({ ...f, discountAmount: v }))} keyboardType="numeric" />
          <Field label="Мин. сумма заказа, ₽" value={form.minOrderAmount} onChangeText={(v) => setForm((f) => ({ ...f, minOrderAmount: v }))} keyboardType="numeric" />
          <Field label="Макс. использований" value={form.maxUses} onChangeText={(v) => setForm((f) => ({ ...f, maxUses: v }))} keyboardType="numeric" />
          <Field label="Начало (YYYY-MM-DD)" value={form.startsAt} onChangeText={(v) => setForm((f) => ({ ...f, startsAt: v }))} />
          <Field label="Конец (YYYY-MM-DD)" value={form.expiresAt} onChangeText={(v) => setForm((f) => ({ ...f, expiresAt: v }))} />
          <Button title="Создать" onPress={create} loading={busy} icon="add" />
        </Card>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.code}>{item.code}</Text>
            <Text style={styles.sub}>
              {discountLabel(item)}
              {item.minOrderAmount ? ` · от ${formatRub(item.minOrderAmount)}` : ""}
              {item.maxUses ? ` · ${item.usedCount ?? 0}/${item.maxUses} исп.` : ""}
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
      )}
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
              {item.status || "—"}
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

function LoyaltyTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<{ users?: any[] }>("/admin/loyalty-users");
      setUsers(data.users || []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <FlatList
      data={users}
      keyExtractor={(u) => String(u.id)}
      onRefresh={load}
      refreshing={loading}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<InlineError text={error} />}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.code}>{item.email || item.name}</Text>
            <Text style={styles.sub}>Потрачено: {formatRub(item.totalSpent)}</Text>
          </View>
          <Badge tone="accent">-{item.loyaltyDiscount ?? 0}%</Badge>
        </View>
      )}
      ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text={error || "Нет участников"} />}
    />
  );
}

function MailingsTab() {
  const [stats, setStats] = useState<{ subscriptions?: any[]; count?: number } | null>(null);
  const [settings, setSettings] = useState<{ newProductsEnabled?: boolean; preorderEnabled?: boolean } | null>(null);
  const [npQueue, setNpQueue] = useState<any>(null);
  const [poQueue, setPoQueue] = useState<any>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Broadcast form
  const [broadcast, setBroadcast] = useState({ subject: "", body: "" });
  const [sending, setSending] = useState(false);

  const load = async () => {
    setError("");
    try {
      const [s, st, np, po] = await Promise.all([
        apiGet<{ subscriptions?: any[]; count?: number }>("/admin/newsletter-stats"),
        apiGet<{ newProductsEnabled?: boolean; preorderEnabled?: boolean }>("/admin/mailings-settings"),
        apiGet<any>("/admin/newsletter-queue-status").catch(() => null),
        apiGet<any>("/admin/preorder-queue-status").catch(() => null),
      ]);
      setStats(s);
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

  const sendBroadcast = async () => {
    const emails = (stats?.subscriptions || []).map((s) => s.email).filter(Boolean);
    if (!broadcast.subject.trim() || !broadcast.body.trim()) {
      setError("Заполните тему и текст");
      return;
    }
    if (emails.length === 0) {
      setError("Нет подписчиков");
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
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.mailingsWrap}>
      <InlineError text={error} />
      {msg ? <Text style={styles.saved}>{msg}</Text> : null}

      <Card style={styles.card}>
        <SectionTitle>Настройки рассылок</SectionTitle>
        <ToggleRow
          label="Рассылка новинок"
          value={!!settings?.newProductsEnabled}
          onToggle={(v) => saveSetting("newProductsEnabled", v)}
          disabled={saving}
        />
        <ToggleRow
          label="Рассылка предзаказов"
          value={!!settings?.preorderEnabled}
          onToggle={(v) => saveSetting("preorderEnabled", v)}
          disabled={saving}
        />
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Очереди</SectionTitle>
        <View style={styles.queueRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.queueTitle}>Очередь новинок</Text>
            <Text style={styles.count}>{npQueue ? JSON.stringify(npQueue) : "—"}</Text>
          </View>
          <Button title="Отправить сейчас" onPress={() => trigger("newsletter")} loading={saving} variant="secondary" />
        </View>
        <View style={styles.queueRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.queueTitle}>Очередь предзаказов</Text>
            <Text style={styles.count}>{poQueue ? JSON.stringify(poQueue) : "—"}</Text>
          </View>
          <Button title="Отправить сейчас" onPress={() => trigger("preorder")} loading={saving} variant="secondary" />
        </View>
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Broadcast-рассылка</SectionTitle>
        <Text style={styles.count}>Подписчиков: {stats?.count ?? 0}</Text>
        <Field label="Тема" value={broadcast.subject} onChangeText={(v) => setBroadcast((f) => ({ ...f, subject: v }))} />
        <Field label="Текст" value={broadcast.body} onChangeText={(v) => setBroadcast((f) => ({ ...f, body: v }))} multiline />
        <Button title="Отправить всем подписчикам" onPress={sendBroadcast} loading={sending} icon="paper-plane" />
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Подписчики рассылки</SectionTitle>
        {(stats?.subscriptions || []).map((s, i) => (
          <View key={String(s.id ?? i)} style={styles.subRow}>
            <Text style={styles.subEmail}>{s.email}</Text>
            <Text style={styles.subDate}>{formatDate(s.subscribedAt)}</Text>
          </View>
        ))}
        {(stats?.subscriptions || []).length === 0 ? <EmptyState text="Подписчиков нет" /> : null}
      </Card>
    </ScrollView>
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
  tabsScroll: { flexGrow: 0 },
  tabs: {
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.lg,
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
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  delete: { color: colors.danger, fontSize: 13 },
  mailingsWrap: { padding: spacing.lg, gap: spacing.lg },
  card: {},
  count: { color: colors.text, fontSize: 14, fontWeight: "600", marginBottom: spacing.sm },
  queueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  queueTitle: { color: colors.text, fontSize: 14, fontWeight: "600" },
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
});
