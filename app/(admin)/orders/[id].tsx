import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Screen } from "@/components/Screen";
import { Badge, Button, Card, InlineError, LoadingView, SectionTitle } from "@/components/ui";
import { apiDelete, apiGet, apiPatch, apiPost, getErrorMessage } from "@/lib/api";
import { formatDate, formatDateTime, formatRub, orderStatusLabel } from "@/lib/format";
import { orderItemImage } from "@/lib/images";
import type { Order } from "@/lib/types";
import { colors, radius, spacing } from "@/constants/theme";

const STATUS_FLOW = [
  { key: "new", label: "Новый" },
  { key: "paid", label: "Оплачен" },
  { key: "processing", label: "В обработке" },
  { key: "shipped", label: "Отправлен" },
  { key: "ready_for_pickup", label: "К выдаче" },
  { key: "delivered", label: "Доставлен" },
  { key: "cancelled", label: "Отменён" },
];

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cdek, setCdek] = useState<Record<string, unknown> | null>(null);
  const [cdekLoading, setCdekLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [orders, drafts] = await Promise.all([
          apiGet<Order[]>("/admin/orders"),
          apiGet<Order[]>("/admin/draft-orders"),
        ]);
        const all = [...(orders || []), ...(drafts || [])];
        const found = all.find((o) => String(o.id) === String(id));
        if (found) setOrder(found);
        else setError("Заказ не найден");
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const loadCdek = async () => {
    if (!id) return;
    setCdekLoading(true);
    try {
      setCdek(await apiGet<Record<string, unknown>>(`/admin/orders/${id}/cdek-status`));
    } catch {
      setCdek(null);
    } finally {
      setCdekLoading(false);
    }
  };

  useEffect(() => {
    loadCdek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const retryCdek = async () => {
    setBusy(true);
    setError("");
    try {
      await apiPost(`/admin/orders/${order?.id}/cdek-retry`);
      await loadCdek();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen title="Заказ" scroll={false}>
        <LoadingView />
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen title="Заказ">
        <InlineError text={error || "Заказ не найден"} />
      </Screen>
    );
  }

  const items = Array.isArray(order.items) ? order.items : [];

  const setStatus = async (status: string) => {
    setBusy(true);
    setError("");
    try {
      await apiPatch(`/admin/orders/${order.id}/status`, { status });
      setOrder({ ...order, status });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiDelete(`/admin/orders/${order.id}`);
      router.back();
    } catch (e) {
      setError(getErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Screen
      title={`Заказ #${order.id}`}
      subtitle={order.isWholesale ? "Оптовый" : "Розничный"}
      scroll
    >
      <InlineError text={error} />

      <Card style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.statusLabel}>Статус</Text>
          <Badge tone="accent">{orderStatusLabel(order.status)}</Badge>
        </View>
        <Text style={styles.date}>Создан: {formatDateTime(order.createdAt)}</Text>
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Смена статуса</SectionTitle>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusFlow}
        >
          {STATUS_FLOW.map((s) => {
            const active = String(order.status || "").toLowerCase() === s.key;
            return (
              <Pressable
                key={s.key}
                disabled={busy || active}
                onPress={() => setStatus(s.key)}
                style={[styles.statusChip, active && styles.statusChipActive]}
              >
                <Text
                  style={[styles.statusChipText, active && styles.statusChipTextActive]}
                >
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Покупатель</SectionTitle>
        <InfoRow label="Имя" value={order.customerName} />
        <InfoRow label="Email" value={order.customerEmail} />
        <InfoRow label="Телефон" value={order.customerPhone} />
        <InfoRow label="Доставка" value={order.deliveryMethod || order.address} />
        <InfoRow label="Адрес" value={order.address} />
        <InfoRow label="Оплата" value={order.paymentMethod} />
        <InfoRow label="Комментарий" value={order.comment} />
      </Card>

      <Card style={styles.card}>
        <View style={styles.sectionHeader}>
          <SectionTitle>Состав заказа</SectionTitle>
          <Button
            title="Редактировать"
            variant="secondary"
            icon="create-outline"
            onPress={() => router.push(`/orders/${order.id}/items` as never)}
          />
        </View>
        {items.map((it, i) => (
          <View key={i} style={styles.item}>
            {orderItemImage(it) ? (
              <Image
                source={{ uri: orderItemImage(it) }}
                style={styles.itemImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.itemImage, styles.itemImageEmpty]}>
                <Text style={styles.itemImagePlaceholder}>Нет фото</Text>
              </View>
            )}
            <View style={styles.itemBody}>
              <Text style={styles.itemName} numberOfLines={2}>
                {it.name || `Товар #${it.productId}`}
              </Text>
              <Text style={styles.itemMeta}>
                {[it.size, it.color].filter(Boolean).join(" · ") || "—"}
              </Text>
              <Text style={styles.itemMeta}>
                {it.quantity} × {formatRub(it.price)}
              </Text>
            </View>
            <Text style={styles.itemSum}>
              {formatRub((it.price || 0) * (it.quantity || 1))}
            </Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Итого</Text>
          <Text style={styles.totalValue}>{formatRub(order.total)}</Text>
        </View>
      </Card>

      <Card style={styles.card}>
        <SectionTitle>CDEK</SectionTitle>
        {cdekLoading ? (
          <LoadingView />
        ) : cdek ? (
          <>
            <InfoRow label="Трек-номер" value={String((cdek.cdekData as any)?.cdekNumber || "—")} />
            <InfoRow label="Пункт выдачи" value={String((cdek.cdekData as any)?.pointAddress || "—")} />
            <InfoRow
              label="Стоимость доставки"
              value={formatRub(Number((cdek.cdekData as any)?.deliveryCost || 0))}
            />
            <InfoRow
              label="Последний статус"
              value={String(
                (cdek.cdekData as any)?.lastCdekStatusName ||
                  (cdek.cdekOrderStatus as any)?.entity?.statuses?.[0]?.name ||
                  "—",
              )}
            />
            <InfoRow label="UUID заказа" value={String((cdek.cdekData as any)?.orderUuid || "—")} />
          </>
        ) : (
          <Text style={styles.cdekEmpty}>Нет данных CDEK</Text>
        )}
        <View style={styles.cdekActions}>
          <Button
            title="Обновить накладную"
            onPress={retryCdek}
            loading={busy}
            variant="secondary"
            icon="refresh"
          />
        </View>
      </Card>

      <Button
        title={confirmDelete ? "Точно удалить заказ?" : "Удалить заказ"}
        onPress={remove}
        variant="danger"
        loading={busy && confirmDelete}
        icon="trash-outline"
      />
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{String(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  date: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  statusFlow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  statusChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  statusChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  statusChipText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  statusChipTextActive: {
    color: colors.white,
    fontWeight: "600",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  infoValue: {
    color: colors.text,
    fontSize: 13,
    flexShrink: 1,
    textAlign: "right",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemImage: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  itemImageEmpty: { alignItems: "center", justifyContent: "center" },
  itemImagePlaceholder: { color: colors.textMuted, fontSize: 8, textAlign: "center" },
  itemBody: {
    flex: 1,
  },
  itemName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  itemMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  itemSum: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  cdekEmpty: {
    color: colors.textMuted,
    fontSize: 13,
  },
  cdekActions: {
    marginTop: spacing.md,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
  },
  totalLabel: {
    color: colors.textMuted,
    fontSize: 14,
  },
  totalValue: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: "700",
  },
});
