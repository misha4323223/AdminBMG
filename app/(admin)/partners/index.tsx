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
import { apiDelete, apiGet, apiPatch, apiPost, getErrorMessage } from "@/lib/api";
import { formatDate, formatRub } from "@/lib/format";
import { colors, spacing } from "@/constants/theme";

type Tab = "partners" | "payouts" | "commissions" | "artists" | "settings";

export default function PartnersScreen() {
  const [tab, setTab] = useState<Tab>("partners");
  return (
    <Screen title="Партнёры" scroll={false}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
        <View style={styles.tabs}>
          <TabBtn label="Партнёры" active={tab === "partners"} onPress={() => setTab("partners")} />
          <TabBtn label="Выплаты" active={tab === "payouts"} onPress={() => setTab("payouts")} />
          <TabBtn label="Комиссии" active={tab === "commissions"} onPress={() => setTab("commissions")} />
          <TabBtn label="Артисты" active={tab === "artists"} onPress={() => setTab("artists")} />
          <TabBtn label="Настройки" active={tab === "settings"} onPress={() => setTab("settings")} />
        </View>
      </ScrollView>
      {tab === "partners" ? <PartnersList /> : null}
      {tab === "payouts" ? <PayoutsList /> : null}
      {tab === "commissions" ? <CommissionsList /> : null}
      {tab === "artists" ? <ArtistsList /> : null}
      {tab === "settings" ? <SettingsView /> : null}
    </Screen>
  );
}

function PartnersList() {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [commissionDrafts, setCommissionDrafts] = useState<Record<number, string>>({});

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<{ partners: any[] }>("/admin/partners");
      setPartners(data.partners || []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (p: any, status: string) => {
    setError("");
    try {
      await apiPatch(`/admin/partners/${p.id}/status`, { status });
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const saveCommission = async (p: any) => {
    setError("");
    try {
      const raw = commissionDrafts[p.id];
      await apiPatch(`/admin/partners/${p.id}/commission`, {
        percent: raw === "" ? null : Number(raw),
      });
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const toggleArtist = async (p: any) => {
    setError("");
    try {
      await apiPatch(`/admin/partners/${p.id}/artist`, { isArtist: !p.isArtist });
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const toggleHomepage = async (p: any) => {
    setError("");
    try {
      await apiPatch(`/admin/partners/${p.id}/homepage`, { showOnHomepage: !p.showOnHomepage });
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <FlatList
      data={partners}
      keyExtractor={(p) => String(p.id)}
      onRefresh={load}
      refreshing={loading}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<InlineError text={error} />}
      renderItem={({ item }) => {
        const expanded = expandedId === item.id;
        return (
          <View style={styles.partnerCard}>
            <Pressable onPress={() => setExpandedId(expanded ? null : item.id)}>
              <View style={styles.partnerHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>
                    {item.storeName || item.contactName || item.partnerSlug}
                  </Text>
                  <Text style={styles.sub}>
                    {item.contactEmail}
                    {item.contactPhone ? ` · ${item.contactPhone}` : ""}
                  </Text>
                </View>
                <Badge tone={statusTone(item.status)}>{item.status || "—"}</Badge>
                <Ionicons
                  name={expanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.textMuted}
                />
              </View>

              <View style={styles.statsRow}>
                <Stat label="Комиссия" value={`${item.commissionOverride ?? "глоб."}%`} />
                <Stat label="Заработано" value={formatRub(item.totalEarned)} />
                <Stat label="Клики" value={String(item.clicksCount ?? 0)} />
              </View>

              {item.status === "pending" ? (
                <View style={styles.actions}>
                  <Button title="Одобрить" onPress={() => setStatus(item, "approved")} icon="checkmark" />
                  <Button title="Отклонить" variant="danger" onPress={() => setStatus(item, "rejected")} icon="close" />
                </View>
              ) : null}

              {expanded ? (
                <View style={styles.detail}>
                  <DetailRow label="Slug" value={item.partnerSlug} />
                  <DetailRow label="Контакт" value={item.contactName} />
                  <DetailRow label="Статус" value={item.status} />
                  <DetailRow label="Юр. статус" value={item.legalStatus} />
                  <DetailRow label="Компания" value={item.companyName} />
                  <DetailRow label="ИНН" value={item.inn} />
                  <DetailRow label="Способ выплаты" value={item.payoutMethod} />
                  <DetailRow label="Реквизиты" value={item.payoutDetails} />
                  <DetailRow label="Получатель" value={item.payoutFullName} />
                  <DetailRow label="Создан" value={formatDate(item.createdAt)} />

                  <View style={styles.inlineForm}>
                    <Text style={styles.formLabel}>Персональная комиссия, %</Text>
                    <View style={styles.inlineRow}>
                      <TextInput
                        value={commissionDrafts[item.id] ?? (item.commissionOverride != null ? String(item.commissionOverride) : "")}
                        onChangeText={(v) =>
                          setCommissionDrafts((d) => ({ ...d, [item.id]: v }))
                        }
                        placeholder="глобальная"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        style={styles.input}
                      />
                      <Button title="Сохранить" variant="secondary" onPress={() => saveCommission(item)} />
                    </View>
                  </View>

                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Артист</Text>
                    <Pressable onPress={() => toggleArtist(item)} style={[styles.toggle, item.isArtist && styles.toggleOn]}>
                      <View style={[styles.dot, item.isArtist && styles.dotOn]} />
                    </Pressable>
                  </View>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>На главной</Text>
                    <Pressable onPress={() => toggleHomepage(item)} style={[styles.toggle, item.showOnHomepage && styles.toggleOn]}>
                      <View style={[styles.dot, item.showOnHomepage && styles.dotOn]} />
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </Pressable>
          </View>
        );
      }}
      ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text={error || "Партнёров нет"} />}
    />
  );
}

function PayoutsList() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [paidRef, setPaidRef] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<{ payouts: any[] }>("/admin/partner-payouts");
      setPayouts(data.payouts || []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (p: any, action: "mark-paid" | "complete" | "reject") => {
    setError("");
    try {
      if (action === "mark-paid") {
        await apiPost(`/admin/partner-payouts/${p.id}/mark-paid`, { paidReference: paidRef || undefined });
      } else if (action === "complete") {
        await apiPost(`/admin/partner-payouts/${p.id}/complete`);
      } else {
        if (rejectReason.trim().length < 3) {
          setError("Укажите причину (не менее 3 символов)");
          return;
        }
        await apiPost(`/admin/partner-payouts/${p.id}/reject`, { reason: rejectReason });
        setRejectReason("");
      }
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <FlatList
      data={payouts}
      keyExtractor={(p) => String(p.id)}
      onRefresh={load}
      refreshing={loading}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<InlineError text={error} />}
      renderItem={({ item }) => {
        const expanded = expandedId === item.id;
        return (
          <View style={styles.partnerCard}>
            <Pressable onPress={() => setExpandedId(expanded ? null : item.id)}>
              <View style={styles.partnerHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{item.recipientName || `Выплата #${item.id}`}</Text>
                  <Text style={styles.sub}>
                    {item.method || "—"} · {formatDate(item.createdAt)}
                  </Text>
                </View>
                <Text style={styles.amount}>{formatRub(item.amount)}</Text>
                <Badge tone={statusTone(item.status)}>{item.status || "—"}</Badge>
              </View>
            </Pressable>
            {expanded ? (
              <View style={styles.detail}>
                <DetailRow label="Реквизиты" value={item.recipientDetails} />
                <DetailRow label="Ссылка на платёжку" value={item.paidReference} />
                {item.receiptUrl ? <DetailRow label="Чек" value={item.receiptUrl} /> : null}
                {item.actUrl ? <DetailRow label="Акт" value={item.actUrl} /> : null}
                {item.rejectedReason ? <DetailRow label="Причина отказа" value={item.rejectedReason} /> : null}

                {item.status === "invoice_uploaded" ? (
                  <>
                    <Field label="Ссылка на платёжку (paidReference)" value={paidRef} onChangeText={setPaidRef} autoCapitalize="none" />
                    <Button title="Отметить оплаченной" onPress={() => act(item, "mark-paid")} icon="card-outline" />
                  </>
                ) : null}
                {item.status === "paid_pending_receipt" || item.status === "paid_pending_act" ? (
                  <Button title="Завершить выплату" onPress={() => act(item, "complete")} icon="checkmark-circle-outline" />
                ) : null}
                {item.status !== "completed" && item.status !== "rejected" ? (
                  <>
                    <Field label="Причина отклонения" value={rejectReason} onChangeText={setRejectReason} multiline />
                    <Button title="Отклонить" variant="danger" onPress={() => act(item, "reject")} icon="close-circle-outline" />
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      }}
      ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text={error || "Выплат нет"} />}
    />
  );
}

function CommissionsList() {
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  // Payout creation form
  const [payoutForm, setPayoutForm] = useState({
    method: "",
    recipientName: "",
    recipientDetails: "",
    note: "",
  });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<{ commissions: any[] }>("/admin/partner-commissions");
      setCommissions(data.commissions || []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedIds = Array.from(selected);

  const bulk = async (action: "confirm" | "mark-paid" | "cancel") => {
    if (selectedIds.length === 0) return;
    setBusy(true);
    setError("");
    try {
      if (action === "confirm") {
        await apiPost("/admin/partner-commissions/confirm", { ids: selectedIds });
      } else if (action === "mark-paid") {
        await apiPost("/admin/partner-commissions/mark-paid", { ids: selectedIds });
      } else {
        await Promise.all(selectedIds.map((id) => apiPost(`/admin/partner-commissions/${id}/cancel`)));
      }
      setSelected(new Set());
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const createPayout = async () => {
    if (selectedIds.length === 0) {
      setError("Выберите комиссии");
      return;
    }
    if (!payoutForm.method.trim() || !payoutForm.recipientName.trim() || !payoutForm.recipientDetails.trim()) {
      setError("Заполните способ, ФИО и реквизиты");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const first = commissions.find((c) => selectedIds.includes(c.id));
      await apiPost("/admin/partner-commissions/payout", {
        partnerId: first?.partnerId,
        commissionIds: selectedIds,
        method: payoutForm.method.trim(),
        recipientName: payoutForm.recipientName.trim(),
        recipientDetails: payoutForm.recipientDetails.trim(),
        note: payoutForm.note.trim() || undefined,
      });
      setSelected(new Set());
      setPayoutForm({ method: "", recipientName: "", recipientDetails: "", note: "" });
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FlatList
      data={commissions}
      keyExtractor={(c) => String(c.id)}
      onRefresh={load}
      refreshing={loading}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View>
          <InlineError text={error} />
          {selectedIds.length > 0 ? (
            <Card style={styles.bulkCard}>
              <SectionTitle>Выбрано: {selectedIds.length}</SectionTitle>
              <View style={styles.bulkActions}>
                <Button title="Подтвердить" onPress={() => bulk("confirm")} loading={busy} icon="checkmark" />
                <Button title="Выплачено" onPress={() => bulk("mark-paid")} loading={busy} variant="secondary" icon="card-outline" />
                <Button title="Отменить" onPress={() => bulk("cancel")} loading={busy} variant="danger" icon="close" />
              </View>
              <Text style={styles.formLabel}>Создать выплату</Text>
              <Field label="Способ" value={payoutForm.method} onChangeText={(v) => setPayoutForm((f) => ({ ...f, method: v }))} />
              <Field label="ФИО получателя" value={payoutForm.recipientName} onChangeText={(v) => setPayoutForm((f) => ({ ...f, recipientName: v }))} />
              <Field label="Реквизиты" value={payoutForm.recipientDetails} onChangeText={(v) => setPayoutForm((f) => ({ ...f, recipientDetails: v }))} multiline />
              <Field label="Заметка" value={payoutForm.note} onChangeText={(v) => setPayoutForm((f) => ({ ...f, note: v }))} />
              <Button title="Создать выплату" onPress={createPayout} loading={busy} icon="paper-plane" />
            </Card>
          ) : null}
        </View>
      }
      renderItem={({ item }) => {
        const isSel = selected.has(item.id);
        return (
          <Pressable onPress={() => toggle(item.id)} style={styles.partnerCard}>
            <View style={styles.partnerHeader}>
              <View style={[styles.check, isSel && styles.checkOn]}>
                {isSel ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>
                  Комиссия #{item.id} · заказ #{item.orderId}
                </Text>
                <Text style={styles.sub}>
                  {item.commissionPercent}% · {formatDate(item.createdAt)}
                </Text>
              </View>
              <Text style={styles.amount}>{formatRub(item.commissionAmount)}</Text>
              <Badge tone={statusTone(item.status)}>{item.status || "—"}</Badge>
            </View>
          </Pressable>
        );
      }}
      ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text={error || "Комиссий нет"} />}
    />
  );
}

function ArtistsList() {
  const [artists, setArtists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", slug: "", artistRate: "", commissionOverride: "" });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<{ artists: any[] }>("/admin/partners/artists");
      setArtists(data.artists || []);
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
    if (!form.name.trim() || !form.email.trim() || form.password.length < 6 || !form.slug.trim()) {
      setError("Заполните имя, email, пароль (≥6) и slug");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiPost("/admin/partners/create-artist", {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        slug: form.slug.trim().toLowerCase(),
        artistRate: form.artistRate === "" ? 0 : Number(form.artistRate),
        commissionOverride: form.commissionOverride === "" ? null : Number(form.commissionOverride),
      });
      setForm({ name: "", email: "", password: "", slug: "", artistRate: "", commissionOverride: "" });
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    setError("");
    try {
      await apiDelete(`/admin/partners/${id}`);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <FlatList
      data={artists}
      keyExtractor={(a) => String(a.id)}
      onRefresh={load}
      refreshing={loading}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <Card style={styles.formCard}>
          <SectionTitle>Новый артист</SectionTitle>
          <InlineError text={error} />
          <Field label="Имя" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Field label="Email" value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} autoCapitalize="none" keyboardType="email-address" />
          <Field label="Пароль" value={form.password} onChangeText={(v) => setForm((f) => ({ ...f, password: v }))} secureTextEntry />
          <Field label="Slug" value={form.slug} onChangeText={(v) => setForm((f) => ({ ...f, slug: v }))} autoCapitalize="none" />
          <Field label="% артиста" value={form.artistRate} onChangeText={(v) => setForm((f) => ({ ...f, artistRate: v }))} keyboardType="numeric" />
          <Field label="% комиссии" value={form.commissionOverride} onChangeText={(v) => setForm((f) => ({ ...f, commissionOverride: v }))} keyboardType="numeric" />
          <Button title="Создать артиста" onPress={create} loading={busy} icon="add" />
        </Card>
      }
      renderItem={({ item }) => (
        <View style={styles.partnerCard}>
          <View style={styles.partnerHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.storeName || item.contactName || item.partnerSlug}</Text>
              <Text style={styles.sub}>{item.contactEmail}</Text>
              <Text style={styles.sub}>Ставка: {item.artistRate ?? 0}%</Text>
            </View>
            <Pressable onPress={() => remove(item.id)} hitSlop={8}>
              <Text style={styles.delete}>Удалить</Text>
            </Pressable>
          </View>
        </View>
      )}
      ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text={error || "Артистов нет"} />}
    />
  );
}

function SettingsView() {
  const [settings, setSettings] = useState<{ globalPercent?: number; holdDays?: number } | null>(null);
  const [percent, setPercent] = useState("");
  const [holdDays, setHoldDays] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const d = await apiGet<{ globalPercent?: number; holdDays?: number }>("/admin/partner-settings");
      setSettings(d);
      setPercent(d.globalPercent != null ? String(d.globalPercent) : "");
      setHoldDays(d.holdDays != null ? String(d.holdDays) : "");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await apiPatch("/admin/partner-settings", {
        globalPercent: percent === "" ? undefined : Number(percent),
        holdDays: holdDays === "" ? undefined : Number(holdDays),
      });
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.flex}>
        <LoadingView />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <InlineError text={error} />
      <Card>
        <SectionTitle>Настройки партнёрской программы</SectionTitle>
        <Field label="Глобальная комиссия, %" value={percent} onChangeText={setPercent} keyboardType="numeric" />
        <Field label="Холд до выплаты, дней" value={holdDays} onChangeText={setHoldDays} keyboardType="numeric" />
        <Button title="Сохранить" onPress={save} loading={busy} icon="save-outline" />
      </Card>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{String(value)}</Text>
    </View>
  );
}

function statusTone(s?: string): "success" | "danger" | "warning" | "neutral" {
  if (s === "approved" || s === "paid" || s === "completed") return "success";
  if (s === "rejected" || s === "cancelled") return "danger";
  if (s === "pending" || s === "awaiting_invoice" || s === "invoice_uploaded") return "warning";
  return "neutral";
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
  partnerCard: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  partnerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  stat: {},
  statValue: { color: colors.text, fontSize: 14, fontWeight: "700" },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  detail: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingVertical: 4,
  },
  detailLabel: { color: colors.textMuted, fontSize: 12 },
  detailValue: { color: colors.text, fontSize: 12, flexShrink: 1, textAlign: "right" },
  title: { color: colors.text, fontSize: 15, fontWeight: "600" },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  amount: { color: colors.accent, fontSize: 14, fontWeight: "700" },
  inlineForm: { marginTop: spacing.md },
  formLabel: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md, marginBottom: spacing.xs },
  inlineRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
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
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  toggleLabel: { color: colors.text, fontSize: 14 },
  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: colors.surfaceAlt, padding: 3 },
  toggleOn: { backgroundColor: colors.success },
  dot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.textMuted },
  dotOn: { backgroundColor: colors.white, alignSelf: "flex-end" },
  bulkCard: { margin: spacing.lg },
  bulkActions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", marginBottom: spacing.md },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  delete: { color: colors.danger, fontSize: 13 },
  formCard: { margin: spacing.lg },
  pad: { padding: spacing.lg },
});
