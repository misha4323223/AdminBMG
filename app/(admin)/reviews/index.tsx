import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
  StatCard,
} from "@/components/ui";
import { apiDelete, apiGet, apiPatch, apiPost, getErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Product, Review } from "@/lib/types";
import { colors, spacing } from "@/constants/theme";

interface ProductsResponse {
  products?: Product[];
  pagination?: { total?: number };
  total?: number;
}

interface ReviewCandidate {
  orderId?: number;
  customerName?: string;
  customerEmail?: string;
  createdAt?: string;
  status?: string;
  items?: Array<{ name?: string; productId?: number }>;
}

interface ReviewRequestsResponse {
  candidates?: ReviewCandidate[];
  count?: number;
}

const CANDIDATE_STATUS_LABELS: Record<string, string> = {
  delivered: "Доставлен",
  ready_for_pickup: "Готов к выдаче",
};

// Те же дефолты, что на сервере сайта (server/review-request-email.ts)
const DEFAULT_SUBJECT = "Понравилась покупка? Оставьте отзыв ⭐";
const DEFAULT_BODY =
  "Привет, {name}! Надеемся, ваш заказ уже радует. Поделитесь впечатлением — это займёт минуту и поможет другим покупателям.";

export default function ReviewsScreen() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [candidates, setCandidates] = useState<ReviewCandidate[]>([]);
  const [candidatesCount, setCandidatesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  // Запрос отзыва
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [previewEmail, setPreviewEmail] = useState("");
  const [busyPreview, setBusyPreview] = useState(false);
  const [busySend, setBusySend] = useState(false);
  const [notice, setNotice] = useState("");
  // Редактируемые тема и текст письма (как на сайте)
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [generating, setGenerating] = useState(false);
  // Список кандидатов свёрнут по умолчанию — раскрывается по кнопке
  const [showCandidates, setShowCandidates] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    setNotice("");
    try {
      const [rev, prod, req] = await Promise.all([
        apiGet<Review[]>("/admin/reviews"),
        apiGet<ProductsResponse>("/products?limit=5000&admin=true"),
        apiGet<ReviewRequestsResponse>("/admin/review-requests/candidates"),
      ]);
      setReviews(Array.isArray(rev) ? rev : []);
      setProducts(Array.isArray(prod.products) ? prod.products : []);
      const list = Array.isArray(req.candidates) ? req.candidates : Array.isArray(req) ? (req as unknown as ReviewCandidate[]) : [];
      setCandidates(list);
      setCandidatesCount(req.count ?? list.length);
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

  const productById = useMemo(() => {
    const map = new Map<number, Product>();
    for (const p of products) if (p.id != null) map.set(Number(p.id), p);
    return map;
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter((r) =>
      [r.authorName, r.comment, String(r.productId)].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [reviews, query]);

  const pendingCount = reviews.filter((r) => !r.isApproved).length;
  const approvedCount = reviews.filter((r) => r.isApproved).length;
  const selectedCount = candidates.filter((c) => c.orderId != null && selected.has(c.orderId)).length;
  const allSelected = candidates.length > 0 && selectedCount === candidates.length;

  const toggleReview = async (review: Review) => {
    setBusyId(review.id);
    try {
      const isApproved = review.isApproved === undefined ? true : !review.isApproved;
      await apiPatch(`/admin/reviews/${review.id}`, { isApproved });
      setReviews((list) => list.map((r) => (r.id === review.id ? { ...r, isApproved } : r)));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const removeReview = async (id: number) => {
    setBusyId(id);
    try {
      await apiDelete(`/admin/reviews/${id}`);
      setReviews((list) => list.filter((r) => r.id !== id));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const toggleCandidate = (orderId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(
      allSelected ? new Set() : new Set(candidates.map((c) => c.orderId).filter((id): id is number => id != null)),
    );
  };

  const generateDraft = async () => {
    setGenerating(true);
    setError("");
    setNotice("");
    try {
      const res = await apiPost<{ text?: string }>("/admin/review-requests/generate", {});
      if (res.text) {
        setBody(res.text);
        setNotice("✨ Текст письма сгенерирован ИИ — проверь перед отправкой");
      } else {
        setError("ИИ не вернул текст, попробуй ещё раз");
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setGenerating(false);
    }
  };

  const resetMessage = () => {
    setSubject(DEFAULT_SUBJECT);
    setBody(DEFAULT_BODY);
  };

  const sendPreview = async () => {
    const email = previewEmail.trim();
    if (!email) {
      setError("Введите email для превью");
      return;
    }
    setBusyPreview(true);
    setError("");
    setNotice("");
    try {
      const res = await apiPost<{ sentTo?: string; success?: boolean }>("/admin/review-requests/preview", {
        email,
        subject: subject.trim(),
        body: body.trim(),
      });
      setNotice(
        res.sentTo
          ? `📨 Превью отправлено на ${res.sentTo}${res.success === false ? " (не удалось)" : ""}`
          : "Превью отправлено",
      );
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyPreview(false);
    }
  };

  const sendToSelected = async () => {
    const orderIds = candidates.filter((c) => c.orderId != null && selected.has(c.orderId)).map((c) => c.orderId as number);
    if (orderIds.length === 0) return;
    const subj = subject.trim();
    const bodyText = body.trim();
    if (!subj || !bodyText) {
      setError("Заполни тему и текст письма");
      return;
    }
    setBusySend(true);
    setError("");
    setNotice("");
    try {
      const res = await apiPost<{ sent?: number; total?: number; failed?: number }>(
        "/admin/review-requests/send",
        { orderIds, subject: subj, body: bodyText },
      );
      setNotice(
        `✅ Письма отправлены: ${res.sent ?? 0} из ${res.total ?? orderIds.length}${res.failed ? ` · Ошибок: ${res.failed}` : ""}`,
      );
      setSelected(new Set());
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusySend(false);
    }
  };

  return (
    <Screen title="Отзывы" subtitle={error || `${reviews.length} отзывов`} scroll={false}>
      <FlatList
        data={filtered}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={styles.list}
        onRefresh={load}
        refreshing={refreshing}
        ListHeaderComponent={
          <View>
            {loading ? <LoadingView /> : null}
            <InlineError text={error} />
            {notice ? (
              <View style={styles.notice}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}

            {/* Запрос отзыва у покупателей */}
            <Card style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <Ionicons name="star" size={16} color={colors.warning} />
                <Text style={styles.requestTitle}>Запрос отзыва у покупателей</Text>
              </View>
              <Text style={styles.requestHint}>
                Ручная рассылка «Оставьте отзыв» клиентам, чей заказ доставлен или готов к выдаче. Отметьте
                галочками нужных покупателей. Каждому письмо уходит один раз.
              </Text>

              <View style={styles.requestMetaRow}>
                <View style={styles.metaChip}>
                  <Text style={styles.metaLabel}>Кандидатов:</Text>
                  <Text style={styles.metaValue}>{candidatesCount}</Text>
                </View>
                {candidates.length > 0 ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaLabel}>Выбрано:</Text>
                    <Text style={styles.metaValue}>{selectedCount}</Text>
                  </View>
                ) : null}
                <Button
                  title="Обновить"
                  variant="secondary"
                  onPress={() => load(true)}
                  loading={refreshing}
                  icon="refresh"
                />
              </View>

              {candidates.length === 0 && !loading ? (
                <Text style={styles.requestEmpty}>
                  Нет покупателей, которым нужно отправить запрос (все доставленные заказы уже обработаны или
                  доставленных заказов нет).
                </Text>
              ) : null}

              {candidates.length > 0 ? (
                <Pressable onPress={() => setShowCandidates((v) => !v)} style={styles.expandBtn}>
                  <Ionicons name={showCandidates ? "chevron-up" : "people-outline"} size={16} color={colors.accent} />
                  <Text style={styles.expandText}>
                    {showCandidates
                      ? "Скрыть список покупателей"
                      : `Показать список покупателей (${candidates.length})`}
                  </Text>
                  <Ionicons name={showCandidates ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
                </Pressable>
              ) : null}

              {candidates.length > 0 && showCandidates ? (
                <View>
                  <Pressable onPress={toggleSelectAll} style={styles.selectAll}>
                    <Ionicons
                      name={allSelected ? "checkbox" : "square-outline"}
                      size={18}
                      color={allSelected ? colors.accent : colors.textMuted}
                    />
                    <Text style={styles.selectAllText}>{allSelected ? "Снять выбор со всех" : "Выбрать всех"}</Text>
                  </Pressable>
                  <View style={styles.candidateList}>
                    {candidates.map((c) => {
                      const orderId = c.orderId;
                      const checked = orderId != null && selected.has(orderId);
                      return (
                        <Pressable
                          key={orderId ?? `${c.customerEmail}-${c.createdAt}`}
                          onPress={() => orderId != null && toggleCandidate(orderId)}
                          style={[styles.candidate, checked && styles.candidateChecked]}
                        >
                          <Ionicons
                            name={checked ? "checkbox" : "square-outline"}
                            size={18}
                            color={checked ? colors.accent : colors.textMuted}
                          />
                          <View style={styles.candidateBody}>
                            <View style={styles.candidateTop}>
                              <Text style={styles.candidateName} numberOfLines={1}>
                                {c.customerName || "Без имени"}
                                <Text style={styles.candidateOrder}> · заказ #{orderId ?? "—"}</Text>
                              </Text>
                              <Badge tone={c.status === "ready_for_pickup" ? "info" : "neutral"}>
                                {CANDIDATE_STATUS_LABELS[c.status || ""] || c.status || "—"}
                              </Badge>
                            </View>
                            {c.customerEmail ? (
                              <Text style={styles.candidateEmail} numberOfLines={1}>
                                {c.customerEmail}
                              </Text>
                            ) : null}
                            {c.createdAt ? (
                              <Text style={styles.candidateDate}>Дата заказа: {formatDate(c.createdAt)}</Text>
                            ) : null}
                            {c.items && c.items.length > 0 ? (
                              <View style={styles.candidateItems}>
                                {c.items.map((item, idx) => (
                                  <Text key={item.productId ?? idx} style={styles.candidateItem} numberOfLines={1}>
                                    • {item.name || `Товар #${item.productId ?? ""}`}
                                  </Text>
                                ))}
                              </View>
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {/* Редактор письма (как на сайте) */}
              <View style={styles.editorBlock}>
                <Field
                  label="Тема письма"
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="Тема письма"
                  maxLength={200}
                />
                <View style={styles.editorHeader}>
                  <Text style={styles.editorLabel}>Текст письма</Text>
                  <View style={styles.editorActions}>
                    <Pressable onPress={generateDraft} disabled={generating} style={styles.editorBtn}>
                      <Ionicons name="sparkles-outline" size={14} color={colors.accent} />
                      <Text style={[styles.editorBtnText, { color: colors.accent }]}>
                        {generating ? "Генерирую…" : "Сгенерировать ИИ"}
                      </Text>
                    </Pressable>
                    <Pressable onPress={resetMessage} style={styles.editorBtn}>
                      <Ionicons name="refresh" size={14} color={colors.textMuted} />
                      <Text style={styles.editorBtnText}>Сбросить</Text>
                    </Pressable>
                  </View>
                </View>
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  placeholder="Введите текст письма…"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={5000}
                  style={styles.bodyInput}
                />
                <Text style={styles.editorHint}>
                  Плейсхолдер {"{name}"} заменится именем покупателя. Ссылки на товары добавляются автоматически. Изменения
                  применяются только к этой отправке — стандартный шаблон на сайте не меняется.
                </Text>
              </View>

              <View style={styles.previewRow}>
                <View style={styles.previewField}>
                  <Field
                    label="Email для превью"
                    value={previewEmail}
                    onChangeText={setPreviewEmail}
                    placeholder="you@example.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
                <Button
                  title="Превью на email"
                  variant="secondary"
                  onPress={sendPreview}
                  loading={busyPreview}
                  icon="mail-outline"
                />
                <Button
                  title={`Отправить выбранным (${selectedCount})`}
                  onPress={sendToSelected}
                  disabled={selectedCount === 0}
                  loading={busySend}
                  icon="paper-plane-outline"
                />
              </View>
              <Text style={styles.requestNote}>
                Письма уходят пачками с паузой, прогресс сохраняется. Отправка только по кнопке — автоматики нет.
              </Text>
            </Card>

            {/* Статистика отзывов */}
            <View style={styles.statsRow}>
              <StatCard label="Всего отзывов" value={reviews.length} icon="chatbubbles" tone="accent" />
              <StatCard label="Ожидают модерации" value={pendingCount} icon="time" tone="warning" />
              <StatCard label="Одобрено" value={approvedCount} icon="checkmark-circle" tone="success" />
            </View>

            <View style={styles.search}>
              <SearchBar value={query} onChangeText={setQuery} placeholder="Поиск по тексту или автору" />
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const product = item.productId != null ? productById.get(Number(item.productId)) : undefined;
          return (
            <View style={styles.row}>
              <View style={styles.rowTop}>
                <View style={styles.author}>
                  <Text style={styles.name}>{item.authorName || "Аноним"}</Text>
                  <Text style={styles.meta}>
                    {formatDate(item.createdAt)}
                    {product ? ` · ${product.name}` : item.productId ? ` · товар #${item.productId}` : ""}
                  </Text>
                </View>
                <Badge tone={item.isApproved ? "success" : "warning"}>
                  {item.isApproved ? "Одобрен" : "На модерации"}
                </Badge>
              </View>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Ionicons
                    key={n}
                    name={n <= (item.rating || 0) ? "star" : "star-outline"}
                    size={13}
                    color={colors.warning}
                  />
                ))}
              </View>
              {item.comment ? <Text style={styles.text}>{item.comment}</Text> : null}
              <View style={styles.actions}>
                <Pressable onPress={() => toggleReview(item)} disabled={busyId === item.id} style={styles.action}>
                  <Ionicons
                    name={item.isApproved ? "eye-off-outline" : "checkmark-circle-outline"}
                    size={16}
                    color={colors.info}
                  />
                  <Text style={styles.actionText}>{item.isApproved ? "Скрыть" : "Одобрить"}</Text>
                </Pressable>
                <Pressable onPress={() => removeReview(item.id)} disabled={busyId === item.id} style={styles.action}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={[styles.actionText, { color: colors.danger }]}>Удалить</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text="Отзывов нет" />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: spacing.xxl,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#0f2a1a",
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  noticeText: {
    color: colors.success,
    fontSize: 13,
    flex: 1,
  },
  requestCard: {
    marginBottom: spacing.lg,
  },
  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  requestTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  requestHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: spacing.md,
  },
  requestMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  metaLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  metaValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  requestEmpty: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  expandBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  expandText: {
    flex: 1,
    color: colors.accent,
    fontSize: 14,
    fontWeight: "600",
  },
  selectAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  selectAllText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  candidateList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  candidate: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
  },
  candidateChecked: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  candidateBody: {
    flex: 1,
    minWidth: 0,
  },
  candidateTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  candidateName: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  candidateOrder: {
    color: colors.textMuted,
    fontWeight: "400",
  },
  candidateEmail: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  candidateDate: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  candidateItems: {
    marginTop: spacing.sm,
    gap: 2,
  },
  candidateItem: {
    color: colors.textMuted,
    fontSize: 12,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  previewField: {
    flex: 1,
    minWidth: 200,
  },
  requestNote: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.md,
  },
  editorBlock: {
    marginBottom: spacing.md,
  },
  editorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    marginBottom: 4,
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  editorLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  editorActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  editorBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  editorBtnText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  bodyInput: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 14,
    minHeight: 110,
    textAlignVertical: "top",
  },
  editorHint: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  search: {
    paddingBottom: spacing.md,
  },
  row: {
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  author: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  stars: {
    flexDirection: "row",
    gap: 2,
    marginTop: spacing.sm,
  },
  text: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionText: {
    color: colors.info,
    fontSize: 13,
  },
});
