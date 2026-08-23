import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Screen } from "@/components/Screen";
import { AgentChat } from "@/components/AgentChat";
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
import { apiGet, apiPost, apiPut, getErrorMessage } from "@/lib/api";
import { colors, radius, spacing } from "@/constants/theme";

type Tab = "chat" | "queue" | "log" | "settings" | "knowledge";

const QUEUE_TYPE_LABELS: Record<string, string> = {
  discount: "💸 Скидка",
  description: "📝 Описание товара",
  hide_product: "👁 Скрытие товара",
  seo: "🔍 SEO",
  blog_draft: "✍️ Черновик блога",
  review_reply: "💬 Ответ на отзыв",
  promo_code: "🎟 Промокод",
  cart_promo: "🛒 Промокод на корзину",
  favorites_promo: "❤️ Промокод на избранное",
  price_drop_analysis: "🔔 Анализ снижения цен",
  knowledge_gap: "🧠 Пробел в знаниях",
  retention_offer: "🎁 Предложение по удержанию",
  chat_conversion_insight: "📈 Конверсия чата",
};

const TOOL_LABELS: Record<string, string> = {
  update_product: "Обновление товара",
  hide_product: "Скрытие товара",
  update_ai_knowledge_draft: "Обновление базы знаний",
  send_email: "Отправка письма",
  create_promo: "Создание промокода",
  reply_review: "Ответ на отзыв",
  create_blog_draft: "Черновик статьи",
};

const LOG_TYPE_LABELS: Record<string, string> = {
  discount: "💸 Скидка",
  description: "📝 Описание",
  hide_product: "👁 Скрыть товар",
  seo: "🔍 SEO",
  blog_draft: "✍️ Блог",
  review_reply: "💬 Отзыв",
  promo_code: "🎟 Промокод",
  seo_batch: "🔍 SEO батч",
  digest: "📊 Дайджест",
  knowledge_gap: "🧠 Пробел в знаниях",
  cart_analysis: "🛒 Анализ корзин",
  chat_conversion_insight: "📈 Конверсия чата",
  favorites_promo: "❤️ Избранное без покупки",
  price_drop_analysis: "🔔 Подписки на снижение цены",
};

const SETTINGS_TOGGLES: { key: string; label: string; desc: string }[] = [
  { key: "enabled", label: "Автономный агент", desc: "Главный выключатель — отключает все задачи" },
  { key: "seoEnabled", label: "SEO-генерация", desc: "Автоматически заполнять SEO для новых товаров" },
  { key: "alertsEnabled", label: "Алерты", desc: "Уведомления о низком остатке и товарах без фото" },
  { key: "digestEnabled", label: "Еженедельный дайджест", desc: "Сводка каждый понедельник в 09:00" },
];

const RUN_JOBS: { job: string; label: string }[] = [
  { job: "all", label: "Полный запуск" },
  { job: "seo", label: "SEO-генерация" },
  { job: "descriptions", label: "Описания" },
  { job: "alerts", label: "Алерты" },
  { job: "digest", label: "Дайджест" },
  { job: "cart_analysis", label: "Анализ корзин" },
  { job: "favorites_analysis", label: "❤️ Избранное" },
  { job: "price_drop_analysis", label: "🔔 Снижение цен" },
];

const SCHEDULE_LINES = [
  "• SEO-батч — каждую ночь в 03:00 МСК (до 50 товаров)",
  "• Алерты — каждые 6 часов",
  "• Дайджест — каждый понедельник в 09:00",
  "• Анализ корзин — каждое воскресенье в 11:00",
  "• ❤️ Анализ избранного — каждый вторник в 10:00 МСК",
  "• 🔔 Снижение цен — каждую пятницу в 11:00 МСК",
  "• Лимит Groq: ~200 запросов/сутки для агента",
];

const TRIGGER_LABELS: Record<string, string> = {
  home_newuser: "🏠 Главная — новый пользователь (20 сек)",
  product_time: "📦 Карточка товара — долгий просмотр (35 сек)",
  product_outofstock: "📦 Карточка товара — нет в наличии (5 сек)",
  cart_time: "🛒 Корзина — без оформления (60 сек)",
  checkout_time: "💳 Чекаут — завис (90 сек)",
  catalog_browse: "🔍 Каталог — долгий просмотр (2 мин)",
  exit_intent: "🚪 Exit Intent — попытка уйти",
};

const BLOCK_META: Record<string, { label: string; desc: string }> = {
  ai_prompt_base: { label: "Базовый промт", desc: "Личность, тон, правила поведения и информация о бренде. Используется в каждом запросе." },
  ai_block_assortment: { label: "Ассортимент магазина", desc: "Полный список категорий и подкатегорий. Не даёт ИИ выдумывать несуществующие товары." },
  ai_block_delivery: { label: "Доставка", desc: "СДЭК, сроки, стоимость, отслеживание." },
  ai_block_payment: { label: "Оплата", desc: "ЮKassa, Т-Банк, Ozon Pay, рассрочка." },
  ai_block_returns: { label: "Возврат и обмен", desc: "Условия возврата, сроки, порядок оформления." },
  ai_block_sizing: { label: "Размеры", desc: "Размерная сетка, рекомендации, особенности." },
  ai_block_merch_order: { label: "Мерч на заказ", desc: "Корпоративный мерч, тиражи, сроки, клиенты." },
  ai_block_partner: { label: "Партнёрская программа", desc: "Реферальная программа, комиссии, инструменты партнёра." },
  ai_block_artist: { label: "Платформа для артистов", desc: "Персональные страницы /@slug, витрина мерча, аналитика." },
  ai_block_wholesale: { label: "Оптовые закупки", desc: "B2B условия, регистрация, XML-фид." },
  ai_block_giftcards: { label: "Подарочные сертификаты", desc: "Покупка, использование, особенности сертификатов." },
  ai_block_predrop: { label: "Pre-drop (Предзаказ)", desc: "Концепция, цена, сроки, отмена, доставка." },
  ai_block_loyalty: { label: "Программа лояльности", desc: "Уровни 1–5, автоматические скидки 5–20%." },
  ai_block_promo: { label: "Промокоды", desc: "Как ввести, совмещение с лояльностью и сертификатами." },
  ai_block_account: { label: "Личный кабинет", desc: "История заказов, отслеживание, профиль, избранное." },
  ai_block_vacancies: { label: "Вакансии", desc: "Работа в BOOOMERANGS, открытые позиции." },
  ai_block_brand: { label: "О бренде", desc: "История, философия, производство, мерч, коллаборации." },
};

const ORDERED_KEYS = Object.keys(BLOCK_META);

function formatAgentDate(value: unknown): string {
  if (value == null) return "—";
  const s = String(value);
  if (!s || s === "никогда") return "никогда";
  const t = Date.parse(s);
  if (Number.isNaN(t)) return s;
  return new Date(t).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLogDate(value: unknown): string {
  if (value == null || value === "") return "—";
  const d = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AiScreen() {
  const [tab, setTab] = useState<Tab>("chat");
  const [queueBadge, setQueueBadge] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await apiGet<{ pendingCount?: number }>("/admin/autonomous-agent/status");
        setQueueBadge(typeof d.pendingCount === "number" ? d.pendingCount : null);
      } catch {
        // бейдж появится после открытия вкладки «Очередь»
      }
    })();
  }, []);

  return (
    <Screen title="AI-чат" scroll={false}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
        <View style={styles.tabs}>
          <TabBtn label="💬 Чат" active={tab === "chat"} onPress={() => setTab("chat")} />
          <TabBtn
            label="🛒 Очередь"
            badge={queueBadge ?? undefined}
            active={tab === "queue"}
            onPress={() => setTab("queue")}
          />
          <TabBtn label="📋 Лог" active={tab === "log"} onPress={() => setTab("log")} />
          <TabBtn label="⚙️ Настройки" active={tab === "settings"} onPress={() => setTab("settings")} />
          <TabBtn label="📚 Знания" active={tab === "knowledge"} onPress={() => setTab("knowledge")} />
        </View>
      </ScrollView>
      {tab === "chat" ? <ChatTab /> : null}
      {tab === "queue" ? <QueueTab /> : null}
      {tab === "log" ? <LogTab /> : null}
      {tab === "settings" ? <SettingsTab /> : null}
      {tab === "knowledge" ? <KnowledgeTab /> : null}
    </Screen>
  );
}

function ChatTab() {
  // Чат вынесен в общий компонент — тот же экземпляр логики встроен на главную.
  return <AgentChat />;
}

function QueueTab() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await apiGet<any>("/admin/agent-queue?status=pending", { timeout: 60000 });
      const list = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.queue)
          ? data.queue
          : Array.isArray(data?.pending)
            ? data.pending
            : [];
      setItems(list);
      setTotal(typeof data?.total === "number" ? data.total : list.length);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  const act = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    setError("");
    try {
      await apiPost(`/admin/agent-queue/${id}/${action}`);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => String(i.id)}
      onRefresh={load}
      refreshing={loading}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View>
          <InlineError text={error} />
          <View style={styles.queueCountRow}>
            <Text style={styles.queueCount}>
              {total != null ? `Ожидают подтверждения: ${total}` : "Очередь агента"}
            </Text>
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.queueCard}>
          <View style={styles.queueHeader}>
            <Text style={styles.title}>{item.title}</Text>
            <Badge tone={item.type === "seo" ? "info" : "warning"}>
              {QUEUE_TYPE_LABELS[item.type] || item.type}
            </Badge>
          </View>
          <Text style={styles.sub}>{item.description}</Text>
          {item.tool ? (
            <Text style={styles.sub}>Инструмент: {TOOL_LABELS[item.tool] || item.tool}</Text>
          ) : null}
          <View style={styles.queueActions}>
            <Button
              title="Подтвердить"
              onPress={() => act(item.id, "approve")}
              loading={busyId === item.id}
              icon="checkmark"
            />
            <Button
              title="Отклонить"
              variant="danger"
              onPress={() => act(item.id, "reject")}
              disabled={busyId === item.id}
              icon="close"
            />
          </View>
        </View>
      )}
      ListEmptyComponent={
        loading ? <LoadingView /> : <EmptyState text={error || "Очередь пуста — агент ещё ничего не предложил"} />
      }
    />
  );
}

function LogTab() {
  const [log, setLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const data = await apiGet<{ log: any[] }>("/admin/autonomous-agent/log");
      setLog(Array.isArray(data.log) ? data.log : []);
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

  return (
    <FlatList
      data={log}
      keyExtractor={(e) => String(e.id)}
      onRefresh={() => load(true)}
      refreshing={refreshing}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.logHeader}>
          <InlineError text={error} />
          <View style={styles.logTitleRow}>
            <Text style={styles.logTitle}>История действий автономного агента</Text>
            <Button title="Обновить" variant="secondary" onPress={() => load(true)} icon="refresh" />
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.logRow}>
          <View style={[styles.logDot, item.isAuto ? styles.logDotAuto : styles.logDotManual]} />
          <View style={{ flex: 1 }}>
            <View style={styles.queueHeader}>
              <Text style={styles.logAction}>{item.action}</Text>
              <Badge tone="neutral">{LOG_TYPE_LABELS[item.type] || item.type}</Badge>
            </View>
            {item.summary ? <Text style={styles.sub}>{item.summary}</Text> : null}
            <Text style={styles.logDate}>{formatLogDate(item.createdAt)}</Text>
          </View>
        </View>
      )}
      ListEmptyComponent={
        loading ? <LoadingView /> : <EmptyState text={error || "Лог пуст. Здесь будут отображаться все автоматические действия агента."} />
      }
    />
  );
}

function SettingsTab() {
  const [status, setStatus] = useState<{ lastRun?: string; lastResult?: string } | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [runningJob, setRunningJob] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const d = await apiGet<{ status?: any; settings?: any; pendingCount?: number }>(
        "/admin/autonomous-agent/status",
      );
      setStatus(d.status || null);
      setPendingCount(typeof d.pendingCount === "number" ? d.pendingCount : null);
      setSettings((d.settings as Record<string, unknown>) || {});
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setFlag = (key: string, value: boolean) =>
    setSettings((s) => ({ ...(s || {}), [key]: value }));

  const saveSettings = async () => {
    setBusy(true);
    setError("");
    try {
      await apiPut("/admin/autonomous-agent/settings", settings);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const runJob = async (job: string) => {
    setRunningJob(job);
    setError("");
    try {
      await apiPost("/admin/autonomous-agent/run", { job });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setRunningJob(null);
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

      <Card style={styles.card}>
        <SectionTitle>⚡ Статус агента</SectionTitle>
        <Text style={styles.statusLine}>
          Последний запуск: <Text style={styles.statusValue}>{formatAgentDate(status?.lastRun)}</Text>
        </Text>
        <Text style={styles.statusLine}>
          Результат: <Text style={styles.statusValue}>{status?.lastResult || "—"}</Text>
        </Text>
        <Text style={styles.statusLine}>
          В очереди:{" "}
          <Text style={styles.statusPending}>
            {pendingCount ?? 0} ожидает подтверждения
          </Text>
        </Text>
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Включить/выключить:</SectionTitle>
        {SETTINGS_TOGGLES.map(({ key, label, desc }) => {
          const on = !!settings?.[key];
          return (
            <View key={key} style={styles.toggleWrap}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextWrap}>
                  <Text style={styles.toggleLabel}>{label}</Text>
                  <Text style={styles.toggleHint}>{desc}</Text>
                </View>
                <Pressable
                  onPress={() => setFlag(key, !on)}
                  style={[styles.toggle, on && styles.toggleOn]}
                >
                  <View style={[styles.dot, on && styles.dotOn]} />
                </Pressable>
              </View>
            </View>
          );
        })}
        <View style={styles.settingsSave}>
          <Button title="Сохранить настройки" onPress={saveSettings} loading={busy} icon="save-outline" />
        </View>
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Запустить вручную:</SectionTitle>
        <View style={styles.runGrid}>
          {RUN_JOBS.map(({ job, label }) => (
            <View key={job} style={styles.runCell}>
              <Button
                title={label}
                variant="secondary"
                onPress={() => runJob(job)}
                loading={runningJob === job}
                disabled={runningJob !== null && runningJob !== job}
                icon="play"
              />
            </View>
          ))}
        </View>
        <Text style={styles.hint}>Задачи выполняются в фоне — результат появится в логе.</Text>
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Расписание:</SectionTitle>
        {SCHEDULE_LINES.map((line, i) => (
          <Text key={i} style={styles.scheduleLine}>
            {line}
          </Text>
        ))}
        <View style={styles.settingsSave}>
          <Button title="Обновить статус" variant="secondary" onPress={load} icon="refresh" />
        </View>
      </Card>
    </ScrollView>
  );
}

function KnowledgeTab() {
  const [blocks, setBlocks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<{ blocks: Record<string, string> }>("/admin/ai-knowledge");
      setBlocks(data.blocks || {});
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
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      await apiPost(`/admin/ai-knowledge/${editing}`, { value: draft });
      setBlocks((b) => ({ ...b, [editing]: draft }));
      setEditing(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (key: string) => {
    setError("");
    try {
      const res = await apiPost<{ value: string }>(`/admin/ai-knowledge/${key}/reset`);
      setBlocks((b) => ({ ...b, [key]: res.value }));
    } catch (e) {
      setError(getErrorMessage(e));
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
    <FlatList
      data={ORDERED_KEYS}
      keyExtractor={(k) => k}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.knowledgeHeader}>
          <InlineError text={error} />
          <Card style={styles.tipCard}>
            <SectionTitle>Как это работает:</SectionTitle>
            <Text style={styles.tipLine}>• Базовый промт — отправляется всегда</Text>
            <Text style={styles.tipLine}>• Ассортимент магазина — отправляется всегда (не даёт ИИ выдумывать несуществующие товары)</Text>
            <Text style={styles.tipLine}>• Тематические блоки — подключаются автоматически по ключевым словам в вопросе пользователя</Text>
            <Text style={styles.tipLine}>• Итоговый промт в Groq: ~600–900 токенов. Кэш обновляется каждые 5 минут.</Text>
          </Card>
          <ProactiveStats />
        </View>
      }
      renderItem={({ item: key }) => {
        const meta = BLOCK_META[key];
        const value = blocks[key] ?? "";
        return editing === key ? (
          <Card style={styles.formCard}>
            <SectionTitle>{meta?.label || key}</SectionTitle>
            {meta?.desc ? <Text style={styles.hint}>{meta.desc}</Text> : null}
            <Field label="Текст блока" value={draft} onChangeText={setDraft} multiline />
            <View style={styles.btnRow}>
              <Button title="Сохранить" onPress={save} loading={busy} icon="save-outline" />
              <Button title="Отмена" variant="ghost" onPress={() => setEditing(null)} />
            </View>
          </Card>
        ) : (
          <Card style={styles.formCard}>
            <View style={styles.blockHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{meta?.label || key}</Text>
                {meta?.desc ? <Text style={styles.hint}>{meta.desc}</Text> : null}
              </View>
            </View>
            <Text style={styles.sub} numberOfLines={3}>
              {value || "—"}
            </Text>
            <View style={styles.btnRow}>
              <Button title="Изменить" variant="secondary" onPress={() => { setEditing(key); setDraft(value); }} icon="create-outline" />
              <Button title="По умолчанию" variant="ghost" onPress={() => reset(key)} icon="refresh" />
            </View>
          </Card>
        );
      }}
      ListEmptyComponent={<EmptyState text={error || "База знаний пуста"} />}
    />
  );
}

function ProactiveStats() {
  const [stats, setStats] = useState<Record<string, { shown: number; clicked: number; dismissed: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError("");
    try {
      const data = await apiGet<{ stats: Record<string, { shown: number; clicked: number; dismissed: number }> }>(
        "/admin/ai-proactive-stats",
      );
      setStats(data.stats || {});
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  const reset = async () => {
    setBusy(true);
    setError("");
    try {
      await apiPost("/admin/ai-proactive-stats/reset");
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const triggerKeys = Object.keys(TRIGGER_LABELS);
  const totalShown = triggerKeys.reduce((s, k) => s + (stats[k]?.shown ?? 0), 0);
  const totalClicked = triggerKeys.reduce((s, k) => s + (stats[k]?.clicked ?? 0), 0);
  const totalDismissed = triggerKeys.reduce((s, k) => s + (stats[k]?.dismissed ?? 0), 0);
  const globalCtr = totalShown > 0 ? `${((totalClicked / totalShown) * 100).toFixed(1)}%` : "—";

  if (loading) return <Card style={styles.formCard}><LoadingView /></Card>;

  return (
    <Card style={styles.formCard}>
      <View style={styles.statsHeader}>
        <View style={{ flex: 1 }}>
          <SectionTitle>Проактивный чат — статистика</SectionTitle>
          <Text style={styles.hint}>Сколько раз пузырь появлялся, сколько кликов и отклонений. Обновляется раз в 30 сек.</Text>
        </View>
      </View>
      <InlineError text={error} />
      <View style={styles.statsRow}>
        <Metric label="Показов" value={String(totalShown)} />
        <Metric label="Кликов" value={String(totalClicked)} color={colors.success} />
        <Metric label="Отклонений" value={String(totalDismissed)} color={colors.warning} />
        <Metric label="CTR" value={globalCtr} />
      </View>

      {triggerKeys.map((key) => {
        const s = stats[key] ?? { shown: 0, clicked: 0, dismissed: 0 };
        const ctr = s.shown > 0 ? `${((s.clicked / s.shown) * 100).toFixed(1)}%` : "—";
        return (
          <View key={key} style={styles.triggerRow}>
            <Text style={styles.triggerLabel} numberOfLines={1}>
              {TRIGGER_LABELS[key] ?? key}
            </Text>
            <Text style={styles.triggerNum}>{s.shown}</Text>
            <Text style={[styles.triggerNum, s.clicked > 0 && { color: colors.success }]}>{s.clicked}</Text>
            <Text style={[styles.triggerNum, s.dismissed > 0 && { color: colors.warning }]}>{s.dismissed}</Text>
            <Text style={styles.triggerNum}>{ctr}</Text>
          </View>
        );
      })}

      <Text style={styles.hint}>CTR (click-through rate) — % пользователей, кликнувших по пузырю. Цель: &gt;10%.</Text>
      <View style={styles.btnRow}>
        <Button title="Обновить" variant="secondary" onPress={load} icon="refresh" />
        <Button title="Сбросить" variant="danger" onPress={reset} loading={busy} icon="trash-outline" />
      </View>
    </Card>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function TabBtn({
  label,
  active,
  onPress,
  badge,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
        {label}
      </Text>
      {badge != null && badge > 0 ? (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabsScroll: { flexGrow: 0, flexShrink: 0 },
  tabs: {
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.lg,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.textMuted, fontWeight: "600", fontSize: 12 },
  tabTextActive: { color: colors.white },
  tabBadge: {
    backgroundColor: colors.danger,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabBadgeText: { color: colors.white, fontSize: 10, fontWeight: "700" },
  list: { paddingBottom: spacing.xxl },
  formCard: { margin: spacing.lg },
  card: { marginHorizontal: spacing.lg, marginTop: spacing.md },
  pad: { paddingBottom: spacing.xxl },
  btnRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  title: { color: colors.text, fontSize: 15, fontWeight: "600" },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  hint: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  blockHeader: { flexDirection: "row", alignItems: "flex-start" },
  chatContent: { padding: spacing.lg, gap: spacing.md },
  bubbleWrap: { flexDirection: "row" },
  bubbleUser: { justifyContent: "flex-end" },
  bubbleAi: { justifyContent: "flex-start" },
  bubble: { maxWidth: "85%", padding: spacing.md, borderRadius: 14 },
  bubbleUserBg: { backgroundColor: colors.accent },
  bubbleAiBg: { backgroundColor: colors.surface },
  bubbleText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  confirmRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  composer: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-end",
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  composerInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    maxHeight: 110,
  },
  queueCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  queueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  queueActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  queueCountRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  queueCount: { color: colors.text, fontSize: 14, fontWeight: "600" },
  logHeader: { padding: spacing.lg, gap: spacing.sm },
  logTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  logTitle: { color: colors.textMuted, fontSize: 13, fontWeight: "600", flex: 1 },
  logRow: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  logDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  logDotAuto: { backgroundColor: colors.info + "33" },
  logDotManual: { backgroundColor: colors.success + "33" },
  logAction: { color: colors.text, fontSize: 13, fontWeight: "500" },
  logDate: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  statusLine: { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm },
  statusValue: { color: colors.text },
  statusPending: { color: colors.warning, fontWeight: "600" },
  toggleWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  toggleTextWrap: { flex: 1 },
  toggleLabel: { color: colors.text, fontSize: 14, fontWeight: "600" },
  toggleHint: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: colors.surfaceAlt, padding: 3 },
  toggleOn: { backgroundColor: colors.accent },
  dot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.textMuted },
  dotOn: { backgroundColor: colors.white, alignSelf: "flex-end" },
  settingsSave: { marginTop: spacing.md },
  runGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  runCell: { width: "48%", flexGrow: 1 },
  scheduleLine: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  knowledgeHeader: { gap: spacing.sm },
  tipCard: { marginHorizontal: spacing.lg, marginTop: spacing.md },
  tipLine: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  statsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  metric: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  metricValue: { color: colors.text, fontSize: 17, fontWeight: "700" },
  metricLabel: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  triggerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  triggerLabel: { color: colors.text, fontSize: 12, flex: 1 },
  triggerNum: { color: colors.textMuted, fontSize: 12, width: 40, textAlign: "right" },
});
