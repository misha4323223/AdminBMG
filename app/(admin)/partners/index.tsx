import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
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
import {
  commissionStatusLabel,
  formatDate,
  formatRub,
  legalStatusLabel,
  partnerStatusLabel,
  payoutStatusLabel,
} from "@/lib/format";
import { colors, radius, spacing } from "@/constants/theme";

type Tab = "partners" | "commissions" | "payouts" | "settings";

const STATUS_FILTERS = [
  { key: "all", label: "Все" },
  { key: "pending", label: "На модерации" },
  { key: "approved", label: "Одобрены" },
  { key: "rejected", label: "Отклонены" },
  { key: "blocked", label: "Заблокированы" },
];

export default function PartnersScreen() {
  const [tab, setTab] = useState<Tab>("partners");
  return (
    <Screen title="Партнёры" scroll={false}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
        <View style={styles.tabs}>
          <TabBtn label="Партнёры" active={tab === "partners"} onPress={() => setTab("partners")} />
          <TabBtn label="Комиссии" active={tab === "commissions"} onPress={() => setTab("commissions")} />
          <TabBtn label="Выплаты" active={tab === "payouts"} onPress={() => setTab("payouts")} />
          <TabBtn label="Настройки" active={tab === "settings"} onPress={() => setTab("settings")} />
        </View>
      </ScrollView>
      {tab === "partners" ? <PartnersList /> : null}
      {tab === "commissions" ? <CommissionsList /> : null}
      {tab === "payouts" ? <PayoutsList /> : null}
      {tab === "settings" ? <SettingsView /> : null}
    </Screen>
  );
}

function PartnersList() {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyKind, setBusyKind] = useState<string | null>(null);
  const [commissionDrafts, setCommissionDrafts] = useState<Record<number, string>>({});
  const [artistRateDrafts, setArtistRateDrafts] = useState<Record<number, string>>({});
  const [showCreateArtist, setShowCreateArtist] = useState(false);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const url =
        statusFilter === "all" ? "/admin/partners" : `/admin/partners?status=${statusFilter}`;
      const data = await apiGet<{ partners: any[] }>(url);
      setPartners(data.partners || []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter((p) =>
      [p.contactEmail, p.partnerSlug, p.storeName, p.contactName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [partners, search]);

  const run = async (id: number, kind: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    setBusyKind(kind);
    setError("");
    try {
      await action();
      await load(true);
      setDeleteId(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
      setBusyKind(null);
    }
  };

  const setStatus = (p: any, status: string) =>
    run(p.id, `status:${status}`, () => apiPatch(`/admin/partners/${p.id}/status`, { status }));

  const saveCommission = (p: any) => {
    const raw = commissionDrafts[p.id];
    return run(p.id, "commission", () =>
      apiPatch(`/admin/partners/${p.id}/commission`, {
        percent: raw === "" || raw == null ? null : Number(raw),
      }),
    );
  };

  const saveArtistRate = (p: any) => {
    const raw = artistRateDrafts[p.id];
    return run(p.id, "artist-rate", () =>
      apiPatch(`/admin/partners/${p.id}/artist-rate`, {
        rate: raw === "" || raw == null ? null : Number(raw),
      }),
    );
  };

  const remove = (p: any) => {
    if (deleteId !== p.id) {
      setDeleteId(p.id);
      return;
    }
    return run(p.id, "delete", () => apiDelete(`/admin/partners/${p.id}`));
  };

  return (
    <>
      <FlatList
        data={filtered}
        keyExtractor={(p) => String(p.id)}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
        <View style={styles.headerBlock}>
          <InlineError text={error} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterRow}>
              {STATUS_FILTERS.map((f) => (
                <Pressable
                  key={f.key}
                  onPress={() => setStatusFilter(f.key)}
                  style={[styles.filterChip, statusFilter === f.key && styles.filterChipOn]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      statusFilter === f.key && styles.filterChipTextOn,
                    ]}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <View style={styles.toolbar}>
            <Button
              title="Создать артиста"
              variant="secondary"
              icon="person-add-outline"
              onPress={() => setShowCreateArtist(true)}
            />
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Поиск..."
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
              />
            </View>
          </View>
        </View>
      }
      renderItem={({ item }) => {
        const expanded = expandedId === item.id;
        const stats = item.stats || {};
        return (
          <View style={styles.partnerCard}>
            <Pressable onPress={() => setExpandedId(expanded ? null : item.id)}>
              <View style={styles.partnerHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.partnerTitleRow}>
                    <Text style={styles.title}>{item.storeName || item.contactName}</Text>
                    {item.legalStatus ? (
                      <Badge tone="neutral">{legalStatusLabel(item.legalStatus)}</Badge>
                    ) : null}
                    {item.payoutRequested ? <Badge tone="info">Запрос выплаты</Badge> : null}
                  </View>
                  <Text style={styles.sub}>{item.contactName || "—"}</Text>
                  <Text style={styles.code}>{item.partnerSlug}</Text>
                </View>
                <View style={styles.statusCol}>
                  <Badge tone={statusTone(item.status)}>{partnerStatusLabel(item.status)}</Badge>
                  <Ionicons
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.textMuted}
                  />
                </View>
              </View>

              <Text style={styles.emailLine}>
                {item.contactEmail}{" "}
                {item.emailVerified === false ? (
                  <Text style={styles.emailWarn}>⚠ не подтверждён</Text>
                ) : item.emailVerified === true ? (
                  <Text style={styles.emailOk}>✓ подтверждён</Text>
                ) : null}
              </Text>

              <View style={styles.statsRow}>
                <Stat label="Клики" value={String(stats.clicks ?? 0)} />
                <Stat label="Заказы" value={String(stats.ordersCount ?? 0)} />
                <Stat label="К выплате" value={formatRub(stats.confirmedAmount ?? 0)} />
              </View>
            </Pressable>

            <View style={styles.inlineForm}>
              <InlineNumberField
                label="% комиссии"
                value={
                  commissionDrafts[item.id] ??
                  (item.commissionOverride != null ? String(item.commissionOverride) : "")
                }
                placeholder="глоб."
                onChange={(v) => setCommissionDrafts((d) => ({ ...d, [item.id]: v }))}
                onSave={() => saveCommission(item)}
                saving={busyId === item.id && busyKind === "commission"}
              />
              {item.isArtist ? (
                <InlineNumberField
                  label="% артиста"
                  value={
                    artistRateDrafts[item.id] ??
                    (item.artistRate != null ? String(item.artistRate) : "")
                  }
                  placeholder="—"
                  onChange={(v) => setArtistRateDrafts((d) => ({ ...d, [item.id]: v }))}
                  onSave={() => saveArtistRate(item)}
                  saving={busyId === item.id && busyKind === "artist-rate"}
                />
              ) : (
                <Text style={styles.artistEmpty}>% артиста: —</Text>
              )}
            </View>

            <View style={styles.actions}>
              {item.status !== "approved" ? (
                <Button
                  title="Одобрить"
                  variant="secondary"
                  onPress={() => setStatus(item, "approved")}
                  loading={busyId === item.id && busyKind === "status:approved"}
                  icon="checkmark"
                />
              ) : null}
              {item.status === "pending" ? (
                <Button
                  title="Отклонить"
                  variant="secondary"
                  onPress={() => setStatus(item, "rejected")}
                  loading={busyId === item.id && busyKind === "status:rejected"}
                  icon="close"
                />
              ) : null}
              {item.status !== "blocked" && item.status !== "pending" && item.status !== "rejected" ? (
                <Button
                  title="Заблокировать"
                  variant="secondary"
                  onPress={() => setStatus(item, "blocked")}
                  loading={busyId === item.id && busyKind === "status:blocked"}
                  icon="ban-outline"
                />
              ) : null}
              {(item.status === "blocked" || item.status === "rejected") ? (
                <Button
                  title="Сбросить"
                  variant="secondary"
                  onPress={() => setStatus(item, "pending")}
                  loading={busyId === item.id && busyKind === "status:pending"}
                  icon="refresh"
                />
              ) : null}
              <Button
                title={deleteId === item.id ? "Точно удалить?" : "Удалить"}
                variant="danger"
                onPress={() => remove(item)}
                loading={busyId === item.id && busyKind === "delete"}
                icon="trash-outline"
              />
            </View>

            {expanded ? (
              <View style={styles.detail}>
                <DetailRow label="Slug" value={item.partnerSlug} />
                <DetailRow label="Контакт" value={item.contactName} />
                <DetailRow label="Телефон" value={item.contactPhone} />
                <DetailRow label="Статус" value={partnerStatusLabel(item.status)} />
                <DetailRow label="Юр. статус" value={legalStatusLabel(item.legalStatus)} />
                <DetailRow label="Компания" value={item.companyName} />
                <DetailRow label="ИНН" value={item.inn} />
                <DetailRow label="КПП" value={item.kpp} />
                <DetailRow label="ОГРН/ОГРНИП" value={item.ogrn} />
                <DetailRow label="Способ выплаты" value={item.payoutMethod} />
                <DetailRow label="Реквизиты" value={item.payoutDetails} />
                <DetailRow label="Получатель" value={item.payoutFullName} />
                <DetailRow label="Создан" value={formatDate(item.createdAt)} />
              </View>
            ) : null}
          </View>
        );
      }}        ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text={error || "Партнёров нет"} />}
      />
      <CreateArtistModal
        visible={showCreateArtist}
        onClose={() => setShowCreateArtist(false)}
        onCreated={() => load(true)}
      />
    </>
  );
}

function InlineNumberField({
  label,
  value,
  placeholder,
  onChange,
  onSave,
  saving,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <View style={styles.inlineField}>
      <Text style={styles.inlineLabel}>{label}</Text>
      <View style={styles.inlineRow}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          style={styles.inlineInput}
        />
        <Button title="OK" variant="secondary" onPress={onSave} loading={saving} />
      </View>
    </View>
  );
}

function CreateArtistModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", password: "", slug: "", artistRate: "", commissionOverride: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
        artistRate: form.artistRate === "" ? undefined : Number(form.artistRate),
        commissionOverride: form.commissionOverride === "" ? undefined : Number(form.commissionOverride),
      });
      setForm({ name: "", email: "", password: "", slug: "", artistRate: "", commissionOverride: "" });
      onClose();
      onCreated();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>Создать артиста вручную</Text>
              <Text style={styles.sheetSubtitle}>Аккаунт партнёра-артиста</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetBody}>
            <InlineError text={error} />
            <Field label="Имя / название" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} />
            <Field label="Email" value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} autoCapitalize="none" keyboardType="email-address" />
            <Field label="Пароль (минимум 6 символов)" value={form.password} onChangeText={(v) => setForm((f) => ({ ...f, password: v }))} secureTextEntry />
            <Field label="Slug" value={form.slug} onChangeText={(v) => setForm((f) => ({ ...f, slug: v }))} autoCapitalize="none" />
            <Field label="% артиста" value={form.artistRate} onChangeText={(v) => setForm((f) => ({ ...f, artistRate: v }))} keyboardType="numeric" />
            <Field label="% комиссии (пусто = глобальная)" value={form.commissionOverride} onChangeText={(v) => setForm((f) => ({ ...f, commissionOverride: v }))} keyboardType="numeric" />
            <Button title="Создать артиста" onPress={create} loading={busy} icon="person-add-outline" />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
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
                <Badge tone={statusTone(item.status)}>{payoutStatusLabel(item.status)}</Badge>
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
              <Badge tone={statusTone(item.status)}>{commissionStatusLabel(item.status)}</Badge>
            </View>
          </Pressable>
        );
      }}
      ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text={error || "Комиссий нет"} />}
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

function statusTone(s?: string): "success" | "danger" | "warning" | "neutral" | "info" {
  if (s === "approved" || s === "paid" || s === "completed") return "success";
  if (s === "rejected" || s === "cancelled") return "danger";
  if (s === "pending" || s === "awaiting_invoice" || s === "invoice_uploaded") return "warning";
  if (s === "blocked") return "neutral";
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
  headerBlock: { padding: spacing.lg, gap: spacing.md },
  filterRow: { flexDirection: "row", gap: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  filterChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterChipText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  filterChipTextOn: { color: colors.white },
  toolbar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  searchWrap: {
    flex: 1,
    minWidth: 160,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, color: colors.text, paddingVertical: spacing.sm, fontSize: 14 },
  partnerCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  partnerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  partnerTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  statusCol: { alignItems: "flex-end", gap: spacing.sm },
  emailLine: { color: colors.text, fontSize: 13 },
  emailOk: { color: colors.success, fontSize: 11 },
  emailWarn: { color: colors.warning, fontSize: 11 },
  code: { color: colors.textMuted, fontSize: 12, fontFamily: "monospace", marginTop: 2 },
  statsRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  stat: {},
  statValue: { color: colors.text, fontSize: 14, fontWeight: "700" },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  inlineForm: { gap: spacing.sm },
  inlineField: {},
  inlineLabel: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs },
  inlineRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  inlineInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 14,
  },
  artistEmpty: { color: colors.textMuted, fontSize: 12 },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
    marginTop: spacing.xs,
  },
  detail: {
    marginTop: spacing.sm,
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
  formLabel: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md, marginBottom: spacing.xs },
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
  pad: { padding: spacing.lg },
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
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  sheetSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  sheetScroll: { flexGrow: 0 },
  sheetBody: { padding: spacing.lg, gap: spacing.sm },
});
