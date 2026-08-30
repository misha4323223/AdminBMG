import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Button, Card, EmptyState, Field, InlineError, LoadingView, SectionTitle } from "@/components/ui";
import { ExportButtons } from "@/components/ExportButtons";
import { downloadServerFile } from "@/lib/export";
import { useFetch } from "@/lib/useFetch";
import { getErrorMessage } from "@/lib/api";
import { formatRub } from "@/lib/format";
import { colors, spacing } from "@/constants/theme";
import {
  MetrikaPeriod,
  MetrikaPeriodKey,
  METRIKA_PERIODS,
  getMetrikaPeriod,
  loadMetrikaStatus,
  loadMetrikaSummary,
  loadMetrikaProducts,
  loadMetrikaDaily,
  loadMetrikaProductDates,
  loadMetrikaPages,
  loadMetrikaDevices,
  loadMetrikaGeo,
  loadMetrikaGoals,
  summarizeMetrika,
  MetrikaReport,
  MetrikaRow,
  MetrikaBlock,
  MetrikaGoals as MetrikaGoalsType,
} from "@/lib/metrika";

interface OrderAnalyticsRow {
  month: string;
  retailCount: number;
  wholesaleCount: number;
  retailRevenue: number;
  wholesaleRevenue: number;
}

interface ArtistOrderItem {
  name: string;
  qty: number;
  price: number;
}

interface ArtistOrder {
  orderId: number;
  date: string;
  customerName: string;
  items: ArtistOrderItem[];
  total: number;
}

interface ArtistAnalyticsRow {
  artist: string;
  revenue: number;
  orders: number;
  items: number;
  ordersList?: ArtistOrder[];
}

const MONTHS_RU: Record<string, string> = {
  "01": "Янв", "02": "Фев", "03": "Мар", "04": "Апр",
  "05": "Май", "06": "Июн", "07": "Июл", "08": "Авг",
  "09": "Сен", "10": "Окт", "11": "Ноя", "12": "Дек",
};

const ARTIST_COLORS = ["#38bdf8", "#a855f7", "#f59e0b", "#22c55e", "#ef4444", "#06b6d4", "#f97316", "#8b5cf6"];

function monthLabel(month: string): string {
  const mm = month.slice(5, 7);
  return `${MONTHS_RU[mm] || mm} '${month.slice(2, 4)}`;
}

export default function AnalyticsScreen() {
  const orders = useFetch<OrderAnalyticsRow[]>("/admin/analytics/orders");
  const artists = useFetch<ArtistAnalyticsRow[]>("/admin/analytics/artists");
  const [expanded, setExpanded] = useState<string | null>(null);

  // --- Яндекс.Метрика: аналитика трафика + e-commerce (общий период).
  const [metrikaPeriodKey, setMetrikaPeriodKey] = useState<MetrikaPeriodKey>("7d");
  const [metrikaRefreshing, setMetrikaRefreshing] = useState(false);
  const [metrikaStatus, setMetrikaStatus] = useState<MetrikaBlock<import("@/lib/metrika").MetrikaStatus> | null>(null);
  const [metrikaSummary, setMetrikaSummary] = useState<MetrikaBlock<MetrikaReport> | null>(null);
  const [metrikaProducts, setMetrikaProducts] = useState<MetrikaBlock<MetrikaReport> | null>(null);
  const [metrikaDaily, setMetrikaDaily] = useState<MetrikaBlock<MetrikaReport> | null>(null);
  const [metrikaProductDates, setMetrikaProductDates] = useState<MetrikaBlock<MetrikaReport> | null>(null);
  const [metrikaPages, setMetrikaPages] = useState<MetrikaBlock<MetrikaReport> | null>(null);
  const [metrikaDevices, setMetrikaDevices] = useState<MetrikaBlock<MetrikaReport> | null>(null);
  const [metrikaGeo, setMetrikaGeo] = useState<MetrikaBlock<MetrikaReport> | null>(null);
  const [metrikaGoals, setMetrikaGoals] = useState<MetrikaBlock<MetrikaGoalsType> | null>(null);

  const refreshMetrika = async (periodKey: MetrikaPeriodKey = metrikaPeriodKey) => {
    setMetrikaRefreshing(true);
    try {
      const period = getMetrikaPeriod(periodKey);
      // Загружаем отчёты строго по одному (не параллельно): Яндекс.Метрика
      // жёстко ограничивает число параллельных запросов на токен, и ожидание
      // всех 9 отчётов разом упиралось в квоту («Превышена квота на количество
      // параллельных запросов»). Последовательно грузим каждый блок и сразу
      // показываем, как только он готов.
      const steps: Array<() => void> = [
        () => void loadMetrikaStatus().then(setMetrikaStatus),
        () => void loadMetrikaSummary(period).then(setMetrikaSummary),
        () => void loadMetrikaProducts(period).then(setMetrikaProducts),
        () => void loadMetrikaDaily(period).then(setMetrikaDaily),
        () => void loadMetrikaProductDates(period).then(setMetrikaProductDates),
        () => void loadMetrikaPages(period).then(setMetrikaPages),
        () => void loadMetrikaDevices(period).then(setMetrikaDevices),
        () => void loadMetrikaGeo(period).then(setMetrikaGeo),
        () => void loadMetrikaGoals(period).then(setMetrikaGoals),
      ];
      for (const step of steps) {
        await step();
      }
    } finally {
      setMetrikaRefreshing(false);
    }
  };

  React.useEffect(() => {
    refreshMetrika(metrikaPeriodKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrikaPeriodKey]);

  const rows = orders.data || [];
  const totalRetail = rows.reduce((s, r) => s + r.retailCount, 0);
  const totalWholesale = rows.reduce((s, r) => s + r.wholesaleCount, 0);
  const totalRetailRev = rows.reduce((s, r) => s + r.retailRevenue, 0);
  const totalWsRev = rows.reduce((s, r) => s + r.wholesaleRevenue, 0);
  const monthExportRows = rows.map((row) => ({
    month: row.month,
    retailOrders: row.retailCount,
    retailRevenue: formatRub(row.retailRevenue),
    wholesaleOrders: row.wholesaleCount,
    wholesaleRevenue: formatRub(row.wholesaleRevenue),
  }));
  const artistExportRows = (artists.data || []).map((row) => ({
    artist: row.artist || "Без имени",
    revenue: formatRub(row.revenue),
    orders: row.orders,
    items: row.items,
  }));
  const artistMax = Math.max(1, ...(artists.data || []).map((r) => r.revenue || 0));

  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportBusy, setReportBusy] = useState<"retail" | "wholesale" | "all" | null>(null);
  const [reportError, setReportError] = useState("");

  const downloadReport = async (type: "retail" | "wholesale" | "all") => {
    setReportBusy(type);
    setReportError("");
    try {
      const params = new URLSearchParams();
      if (reportFrom.trim()) params.set("from", reportFrom.trim());
      if (reportTo.trim()) params.set("to", reportTo.trim());
      params.set("type", type);
      const today = new Date().toISOString().slice(0, 10);
      const period = reportFrom && reportTo ? `${reportFrom}_${reportTo}` : reportFrom ? `from_${reportFrom}` : reportTo ? `to_${reportTo}` : today;
      const typeSuffix = type === "retail" ? "-roznica" : type === "wholesale" ? "-opt" : "";
      await downloadServerFile(`/admin/reports/monthly-sales?${params.toString()}`, `sales-report-${period}${typeSuffix}.xlsx`);
    } catch (e) {
      setReportError(getErrorMessage(e));
    } finally {
      setReportBusy(null);
    }
  };

  return (
    <Screen title="Аналитика" scroll>
      <InlineError text={orders.error || artists.error || reportError} />

      <Card style={styles.card}>
        <SectionTitle>Выгрузка подробного отчёта по продажам (XLS)</SectionTitle>
        <Text style={styles.hint}>Файл формирует сервер: все заказы с товарами, размерами и клиентами за выбранный период. Без дат — все месяцы.</Text>
        <View style={styles.reportRow}>
          <View style={styles.reportField}>
            <Field label="С месяца" value={reportFrom} onChangeText={setReportFrom} placeholder="2025-01" autoCapitalize="none" />
          </View>
          <View style={styles.reportField}>
            <Field label="По месяц" value={reportTo} onChangeText={setReportTo} placeholder="2025-12" autoCapitalize="none" />
          </View>
        </View>
        <View style={styles.reportBtns}>
          <Button title="Розница XLS" onPress={() => downloadReport("retail")} loading={reportBusy === "retail"} icon="download-outline" />
          <Button title="Опт XLS" variant="secondary" onPress={() => downloadReport("wholesale")} loading={reportBusy === "wholesale"} icon="download-outline" />
          <Button title="Все вместе" variant="ghost" onPress={() => downloadReport("all")} loading={reportBusy === "all"} icon="download-outline" />
        </View>
      </Card>

      {!orders.loading && rows.length > 0 ? (
        <View style={styles.statsRow}>
          <StatCard label="Вся база заказов" value={String(totalRetail + totalWholesale)} />
          <StatCard label="Розница" value={String(totalRetail)} />
          <StatCard label="Опт" value={String(totalWholesale)} />
          <StatCard label="Вся выручка" value={formatRub(totalRetailRev + totalWsRev)} />
          <StatCard label="Выручка розницы" value={formatRub(totalRetailRev)} />
          <StatCard label="Выручка опт" value={formatRub(totalWsRev)} />
        </View>
      ) : null}

      <Card style={styles.card}>
        <SectionTitle>Заказы по месяцам</SectionTitle>
        {!orders.loading && rows.length > 0 ? (
          <ExportButtons
            title="Аналитика — заказы по месяцам"
            columns={[
              { key: "month", label: "Месяц" },
              { key: "retailOrders", label: "Розничные заказы" },
              { key: "retailRevenue", label: "Розничная выручка" },
              { key: "wholesaleOrders", label: "Оптовые заказы" },
              { key: "wholesaleRevenue", label: "Оптовая выручка" },
            ]}
            rows={monthExportRows}
          />
        ) : null}
        {orders.loading ? (
          <LoadingView />
        ) : !rows.length ? (
          <EmptyState text="Данных нет" />
        ) : (
          <>
            <MonthBarChart rows={rows} mode="count" />
            <View style={styles.chartSpacer} />
            <MonthBarChart rows={rows} mode="revenue" />
            {rows.map((row, i) => (
            <View key={`${row.month}-${i}`} style={styles.monthBlock}>
              <Text style={styles.monthTitle}>{row.month}</Text>
              <View style={styles.metricRow}>
                <Text style={styles.metricKey}>Розница</Text>
                <Text style={styles.metricValue}>
                  {row.retailCount} зак. · {formatRub(row.retailRevenue)}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricKey}>Опт</Text>
                <Text style={styles.metricValue}>
                  {row.wholesaleCount} зак. · {formatRub(row.wholesaleRevenue)}
                </Text>
              </View>
            </View>
            ))}
          </>
        )}
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Продажи по артистам</SectionTitle>
        {!artists.loading && artistExportRows.length > 0 ? (
          <ExportButtons
            title="Аналитика — продажи по артистам"
            columns={[
              { key: "artist", label: "Артист" },
              { key: "revenue", label: "Выручка" },
              { key: "orders", label: "Заказы" },
              { key: "items", label: "Товары" },
            ]}
            rows={artistExportRows}
          />
        ) : null}
        {artists.loading ? (
          <LoadingView />
        ) : !artists.data?.length ? (
          <EmptyState text="Данных нет" />
        ) : (
          ((artists.data as ArtistAnalyticsRow[])).map((row, i) => {
            const isOpen = expanded === row.artist;
            const list = row.ordersList || [];
            return (
              <View key={`${row.artist}-${i}`} style={styles.artistBlock}>
                <Pressable
                  onPress={() => setExpanded(isOpen ? null : row.artist)}
                  style={styles.artistHeader}
                >
                  <View style={styles.artistNameWrap}>
                    <Ionicons
                      name={isOpen ? "chevron-down" : "chevron-forward"}
                      size={16}
                      color={colors.textMuted}
                    />
                    <Text style={styles.monthTitle}>{row.artist || "Без имени"}</Text>
                  </View>
                  <View style={styles.artistMeta}>
                    <Text style={styles.artistRevenue}>{formatRub(row.revenue)}</Text>
                    <Text style={styles.metricKey}>
                      {row.orders} зак. · {row.items} шт.
                    </Text>
                  </View>
                </Pressable>
                {artistMax > 0 ? (
                  <View style={styles.artistBarTrack}>
                    <View
                      style={[
                        styles.artistBarFill,
                        {
                          width: `${Math.max(3, Math.min(100, (row.revenue / artistMax) * 100))}%`,
                          backgroundColor: ARTIST_COLORS[i % ARTIST_COLORS.length],
                        },
                      ]}
                    />
                  </View>
                ) : null}
                {isOpen ? (
                  list.length === 0 ? (
                    <Text style={styles.emptyOrders}>Нет заказов</Text>
                  ) : (
                    list.map((o, oi) => (
                      <View key={`${o.orderId}-${oi}`} style={styles.orderBlock}>
                        <View style={styles.orderHeader}>
                          <Text style={styles.orderId}>#{String(o.orderId).slice(-6)}</Text>
                          <Text style={styles.customer} numberOfLines={1}>
                            {o.customerName}
                          </Text>
                          <Text style={styles.orderTotal}>{formatRub(o.total)}</Text>
                        </View>
                        <Text style={styles.orderDate}>{o.date}</Text>
                        {(o.items || []).map((it, ii) => (
                          <View key={ii} style={styles.itemRow}>
                            <Text style={styles.itemName} numberOfLines={1}>
                              {it.qty > 1 ? `${it.qty}× ` : ""}
                              {it.name}
                            </Text>
                            <Text style={styles.itemPrice}>{formatRub(it.price)}</Text>
                          </View>
                        ))}
                      </View>
                    ))
                  )
                ) : null}
              </View>
            );
          })
        )}
      </Card>

      <MetrikaCard
        refreshing={metrikaRefreshing}
        periodKey={metrikaPeriodKey}
        onPeriodChange={setMetrikaPeriodKey}
        configured={metrikaStatus?.data?.configured}
        counterId={metrikaStatus?.data?.counterId}
        statusError={metrikaStatus?.detail}
        summary={metrikaSummary}
        products={metrikaProducts}
        daily={metrikaDaily}
        productDates={metrikaProductDates}
        pages={metrikaPages}
        devices={metrikaDevices}
        geo={metrikaGeo}
        goals={metrikaGoals}
        onRefresh={() => refreshMetrika(metrikaPeriodKey)}
      />
    </Screen>
  );
}

function MetrikaCard({
  refreshing,
  periodKey,
  onPeriodChange,
  configured,
  counterId,
  statusError,
  summary,
  products,
  daily,
  productDates,
  pages,
  devices,
  geo,
  goals,
  onRefresh,
}: {
  refreshing: boolean;
  periodKey: MetrikaPeriodKey;
  onPeriodChange: (k: MetrikaPeriodKey) => void;
  configured?: boolean;
  counterId?: string;
  statusError?: string;
  summary: MetrikaBlock<MetrikaReport> | null;
  products: MetrikaBlock<MetrikaReport> | null;
  daily: MetrikaBlock<MetrikaReport> | null;
  productDates: MetrikaBlock<MetrikaReport> | null;
  pages: MetrikaBlock<MetrikaReport> | null;
  devices: MetrikaBlock<MetrikaReport> | null;
  geo: MetrikaBlock<MetrikaReport> | null;
  goals: MetrikaBlock<MetrikaGoalsType> | null;
  onRefresh: () => void;
}) {
  const ready = configured === true;
  const totals = summarizeMetrika(summary?.data?.data);
  const period = getMetrikaPeriod(periodKey);
  const periodLabel = period.label.toLowerCase();

  return (
    <>
      {/* Разделитель: своя секция карточки «Яндекс.Метрика» внутри Аналитики. */}
      <View style={styles.metrikaDivider}>
        <View style={styles.metrikaDividerLine} />
        <Text style={styles.metrikaDividerLabel}>Внешняя аналитика</Text>
        <View style={styles.metrikaDividerLine} />
      </View>

      <Card style={styles.card}>
        <View style={styles.metrikaHeader}>
          <View style={styles.metrikaTitleWrap}>
            <View style={styles.metrikaIcon}>
              <Ionicons name="bar-chart" size={18} color={colors.accent} />
            </View>
            <SectionTitle>Яндекс.Метрика</SectionTitle>
          </View>
          <View style={styles.metrikaHeaderRight}>
            {refreshing ? <ActivityIndicator size="small" color={colors.accent} /> : null}
            <Button
              title="Обновить"
              variant="ghost"
              icon="refresh-outline"
              onPress={onRefresh}
              loading={refreshing}
            />
          </View>
        </View>

        {/* Период */}
        <View style={styles.metrikaPeriodRow}>
          {METRIKA_PERIODS.map((p) => {
            const active = p.key === periodKey;
            return (
              <Pressable
                key={p.key}
                onPress={() => onPeriodChange(p.key)}
                style={[styles.metrikaPeriodChip, active && styles.metrikaPeriodChipActive]}
              >
                <Text style={[styles.metrikaPeriodChipText, active && styles.metrikaPeriodChipTextActive]}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {statusError ? <InlineError text={statusError} /> : null}

        {!ready ? (
          configured === false ? (
            <EmptyState text="На сервере не задан секрет YANDEX_METRIKA_OAUTH_TOKEN — добавьте его, чтобы включить отчёты." />
          ) : summary === null ? (
            <LoadingView />
          ) : (
            <EmptyState text="Не удалось загрузить данные Яндекс.Метрики." />
          )
        ) : (
          <>
            <Text style={styles.metrikaPeriod}>Данные за {periodLabel} · счётчик {counterId ?? ""}</Text>

            {/* Ключевые показатели */}
            {summary?.state !== "ok" ? (
              <InlineError text={summary?.detail || "Не удалось получить сводку."} />
            ) : (
              <View style={styles.metrikaStats}>
                <View style={styles.statCard}><Text style={styles.statValue}>{fmtNum(totals.visits)}</Text><Text style={styles.statLabel}>Визиты</Text></View>
                <View style={styles.statCard}><Text style={styles.statValue}>{fmtNum(totals.users)}</Text><Text style={styles.statLabel}>Пользователи</Text></View>
                <View style={styles.statCard}><Text style={styles.statValue}>{fmtNum(totals.pageviews)}</Text><Text style={styles.statLabel}>Просмотры</Text></View>
                <View style={styles.statCard}><Text style={styles.statValue}>{totals.revenue ? `${Math.round(totals.revenue).toLocaleString("ru-RU")} ₽` : "—"}</Text><Text style={styles.statLabel}>Выручка</Text></View>
                <View style={styles.statCard}><Text style={styles.statValue}>{fmtNum(totals.purchases)}</Text><Text style={styles.statLabel}>Покупки</Text></View>
              </View>
            )}

            {/* График по дням */}
            {daily?.state !== "ok" ? (
              <InlineError text={daily?.detail || "Не удалось построить график."} />
            ) : (
              <MetrikaDailyChart rows={daily?.data?.data ?? []} />
            )}

            {/* Цели воронки */}
            {goals?.state === "ok" ? <MetrikaGoalsBlock goals={goals.data} /> : null}

            {/* Источники трафика */}
            {summary?.state !== "ok" ? null : (
              <MetrikaRows
                title={`Источники трафика (${periodLabel})`}
                rows={summary?.data?.data ?? []}
                renderMetrics={m => [
                  `${fmtNum(m[0])} виз.`,
                  `${fmtNum(m[2])} просм.`,
                  m[4] ? `${Math.round(m[4]).toLocaleString("ru-RU")} ₽` : null,
                ].filter(Boolean) as string[]}
              />
            )}

            {/* Устройства */}
            {devices?.state !== "ok" ? null : (
              <MetrikaRows
                title="Устройства"
                rows={devices?.data?.data ?? []}
                renderMetrics={m => [`${fmtNum(m[0])} виз.`, m[2] ? `отк. ${Math.round(m[2]*100)/100}%` : null].filter(Boolean) as string[]}
              />
            )}

            {/* Города */}
            {geo?.state !== "ok" ? null : (
              <MetrikaRows
                title={`Города (${periodLabel})`}
                rows={geo?.data?.data ?? []}
                renderMetrics={m => [`${fmtNum(m[0])} виз.`, `${fmtNum(m[1])} польз.`].filter(Boolean) as string[]}
              />
            )}

            {/* Страницы входа */}
            {pages?.state !== "ok" ? null : (
              <MetrikaRows
                title="Популярные страницы входа"
                rows={pages?.data?.data ?? []}
                renderMetrics={m => [`${fmtNum(m[0])} виз.`, `${fmtNum(m[1])} просм.`].filter(Boolean) as string[]}
              />
            )}

            {/* Товары e-commerce */}
            {products?.state !== "ok" ? (
              <InlineError text={products?.detail || "Не удалось получить товары."} />
            ) : (
              <MetrikaRows
                title={`Товары электронной коммерции (${periodLabel})`}
                rows={products?.data?.data ?? []}
                renderMetrics={m => [
                  `${fmtNum(m[0])} пок.`,
                  m[1] ? `${Math.round(m[1]).toLocaleString("ru-RU")} ₽` : null,
                  m[2] ? `${fmtNum(m[2])} шт.` : null,
                ].filter(Boolean) as string[]}
              />
            )}

            {/* Продажи товара по дням */}
            {productDates?.state !== "ok" ? null : (
              <MetrikaProductDatesBlock rows={productDates?.data?.data ?? []} />
            )}
          </>
        )}
      </Card>
    </>
  );
}

function MetrikaDailyChart({ rows }: { rows: MetrikaRow[] }) {
  if (!rows.length) return <Text style={styles.metrikaEmpty}>Нет данных за период.</Text>;
  const visits = rows.map(r => Number(r.metrics?.[0] ?? 0));
  const max = Math.max(1, ...visits);
  return (
    <View style={styles.metrikaList}>
      <Text style={styles.metrikaListTitle}>Динамика визитов по дням</Text>
      <View style={styles.chartBars}>
        {rows.map((row, i) => {
          const v = visits[i];
          const label = row.dimensions?.[0]?.name ?? "";
          const day = label.slice(5).replace("-", ".");
          return (
            <View key={i} style={styles.chartCol}>
              <View style={styles.barTrackMini}>
                <View style={[styles.bar, { backgroundColor: colors.accent, height: `${Math.max(2, (v / max) * 100)}%` }]} />
              </View>
              <Text style={styles.chartLabel} numberOfLines={1}>{day}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MetrikaGoalsBlock({ goals }: { goals?: MetrikaGoalsType }) {
  const list = goals?.goals || [];
  if (!list.length) return null;
  const max = Math.max(1, ...list.map((g) => g.reaches || 0));
  return (
    <View style={styles.metrikaList}>
      <Text style={styles.metrikaListTitle}>Цели воронки (достижений за период)</Text>
      {list.map((g, i) => (
        <View key={g.id} style={styles.metrikaRow}>
          <View style={styles.metrikaGoalLeft}>
            <Text style={styles.metrikaRowName}>{g.name || "Без названия"}</Text>
            <View style={styles.metrikaGoalBarTrack}>
              <View
                style={[
                  styles.metrikaGoalBarFill,
                  {
                    width: `${Math.max(3, Math.min(100, ((g.reaches || 0) / max) * 100))}%`,
                  },
                ]}
              />
            </View>
          </View>
          <View style={styles.metrikaGoalRight}>
            <Text style={styles.goalReaches}>{fmtNum(g.reaches)}</Text>
            <Text style={styles.goalId}>#{g.id}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function MetrikaProductDatesBlock({ rows }: { rows: MetrikaRow[] }) {
  if (!rows.length) return null;
  return (
    <View style={styles.metrikaList}>
      <Text style={styles.metrikaListTitle}>Продажи товаров по дням</Text>
      {(rows || []).slice(0, 20).map((row, index) => {
        const name = row.dimensions?.[0]?.name || "Без названия";
        const date = row.dimensions?.[1]?.name || "";
        const m = row.metrics || [];
        return (
          <View key={index} style={styles.metrikaRow}>
            <Text style={styles.metrikaRowName} numberOfLines={2}>{date} · {name}</Text>
            <Text style={styles.metrikaRowMetrics}>
              {[m[0] ? `${fmtNum(m[0])} пок.` : null, m[1] ? `${Math.round(m[1]).toLocaleString("ru-RU")} ₽` : null].filter(Boolean).join(" · ")}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function MetrikaRows({
  title,
  rows,
  renderMetrics,
}: {
  title: string;
  rows: MetrikaRow[];
  renderMetrics: (m: number[]) => (string | null)[];
}) {
  return (
    <View style={styles.metrikaList}>
      <Text style={styles.metrikaListTitle}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={styles.metrikaEmpty}>Нет данных за период.</Text>
      ) : (
        rows.slice(0, 20).map((row, index) => {
          const name = row.dimensions?.map(d => d.name).filter(Boolean).join(" / ") || "Без названия";
          const metrics = renderMetrics(row.metrics || []).filter(Boolean) as string[];
          return (
            <View key={index} style={styles.metrikaRow}>
              <Text style={styles.metrikaRowName} numberOfLines={2}>{name}</Text>
              <Text style={styles.metrikaRowMetrics}>{metrics.join(" · ")}</Text>
            </View>
          );
        })
      )}
    </View>
  );
}

function fmtNum(v: number | undefined | null): string {
  return Number(v || 0).toLocaleString("ru-RU");
}

function MonthBarChart({
  rows,
  mode,
}: {
  rows: OrderAnalyticsRow[];
  mode: "count" | "revenue";
}) {
  const max = Math.max(
    1,
    ...rows.flatMap((r) => [r.retailCount, r.wholesaleCount, r.retailRevenue, r.wholesaleRevenue]),
  );
  const valueOf = (r: OrderAnalyticsRow) => (mode === "count" ? r.retailCount : r.retailRevenue);
  const valueWs = (r: OrderAnalyticsRow) => (mode === "count" ? r.wholesaleCount : r.wholesaleRevenue);
  const fmt = (v: number) => (mode === "count" ? String(v) : formatRub(v));

  return (
    <View style={styles.chartWrap}>
      <Text style={styles.chartTitle}>
        {mode === "count" ? "Количество оплаченных заказов по месяцам" : "Выручка по месяцам (₽)"}
      </Text>
      <View style={styles.chartBars}>
        {rows.map((row) => (
          <View key={row.month} style={styles.chartCol}>
            <View style={styles.chartPair}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    { backgroundColor: colors.info, height: `${Math.max(2, (valueOf(row) / max) * 100)}%` },
                  ]}
                />
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    { backgroundColor: colors.warning, height: `${Math.max(2, (valueWs(row) / max) * 100)}%` },
                  ]}
                />
              </View>
            </View>
            <Text style={styles.chartLabel} numberOfLines={1}>
              {monthLabel(row.month)}
            </Text>
            <Text style={styles.chartValue} numberOfLines={1}>
              {fmt(mode === "count" ? valueOf(row) + valueWs(row) : valueOf(row) + valueWs(row))}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.info }]} />
          <Text style={styles.legendText}>Розница</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
          <Text style={styles.legendText}>Опт</Text>
        </View>
      </View>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: spacing.md },
  reportRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  reportField: { flex: 1, minWidth: 140 },
  reportBtns: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", marginTop: spacing.sm },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
  },
  statValue: { color: colors.text, fontSize: 18, fontWeight: "700" },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  card: { marginBottom: spacing.lg },
  monthBlock: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  monthTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingVertical: 3,
  },
  metricKey: { color: colors.textMuted, fontSize: 12 },
  metricValue: { color: colors.text, fontSize: 13, fontWeight: "600" },
  chartSpacer: { height: spacing.lg },
  chartWrap: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  chartTitle: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: spacing.md },
  chartBars: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, minHeight: 120 },
  chartCol: { flex: 1, alignItems: "center", gap: 4 },
  chartPair: { flexDirection: "row", alignItems: "flex-end", gap: 3, flex: 1, width: "100%", justifyContent: "center" },
  barTrack: {
    width: 12,
    height: 90,
    justifyContent: "flex-end",
    backgroundColor: colors.surface,
    borderRadius: 4,
    overflow: "hidden",
  },
  bar: { width: "100%", borderRadius: 4 },
  chartLabel: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
  chartValue: { color: colors.textMuted, fontSize: 9 },
  legend: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.textMuted, fontSize: 11 },
  artistBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  artistBarFill: { height: "100%", borderRadius: 3 },
  artistBlock: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  artistHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  artistNameWrap: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  artistMeta: { alignItems: "flex-end" },
  artistRevenue: { color: colors.accent, fontSize: 14, fontWeight: "700" },
  emptyOrders: { color: colors.textMuted, fontSize: 12, paddingLeft: 24, paddingBottom: spacing.sm },
  orderBlock: {
    paddingLeft: 24,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  orderId: { color: colors.textMuted, fontSize: 12 },
  customer: { color: colors.text, fontSize: 13, fontWeight: "600", flex: 1 },
  orderTotal: { color: colors.text, fontSize: 13, fontWeight: "700" },
  orderDate: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: 3,
  },
  itemName: { color: colors.textMuted, fontSize: 12, flex: 1 },
  itemPrice: { color: colors.textMuted, fontSize: 12 },

  // --- Яндекс.Метрика ---
  metrikaDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  metrikaDividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  metrikaDividerLabel: { color: colors.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  metrikaHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  metrikaTitleWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  metrikaIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  metrikaHeaderRight: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metrikaStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metrikaPeriod: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md },
  metrikaPeriodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  metrikaPeriodChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  metrikaPeriodChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  metrikaPeriodChipText: { color: colors.textMuted, fontSize: 12 },
  metrikaPeriodChipTextActive: { color: "#fff", fontWeight: "700" },
  barTrackMini: {
    width: 8,
    height: 80,
    justifyContent: "flex-end",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    overflow: "hidden",
  },
  metrikaList: { marginTop: spacing.lg },
  metrikaListTitle: { color: colors.text, fontSize: 14, fontWeight: "700", marginBottom: spacing.sm },
  metrikaEmpty: { color: colors.textMuted, fontSize: 13 },
  metrikaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  metrikaRowName: { color: colors.text, fontSize: 13, flex: 1, lineHeight: 18 },
  metrikaRowMetrics: { color: colors.textMuted, fontSize: 12, textAlign: "right", lineHeight: 18 },
  goalId: { color: colors.textMuted, fontSize: 11, textAlign: "right", lineHeight: 18, opacity: 0.6 },
  metrikaGoalLeft: { flex: 1, gap: 4 },
  metrikaGoalBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceAlt,
    overflow: "hidden",
  },
  metrikaGoalBarFill: { height: "100%", borderRadius: 2, backgroundColor: colors.accent },
  metrikaGoalRight: { alignItems: "flex-end" },
  goalReaches: { color: colors.text, fontSize: 15, fontWeight: "700" },
});
