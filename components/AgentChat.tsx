import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button, EmptyState, InlineError } from "@/components/ui";
import { Ionicons } from "@expo/vector-icons";
import { apiPost, getErrorMessage } from "@/lib/api";
import { tryLocalAssistant, tryLocalFallback } from "@/lib/agentAnalytics";
import { getStoredJson, setStoredJson } from "@/lib/storage";
import { colors, spacing } from "@/constants/theme";

interface AgentWritePayload {
  tool: string;
  params: Record<string, unknown>;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  pendingWrite?: AgentWritePayload | null;
}

/* Безопасное превращение ответа сервера в текст:
 * если пришёл объект (а не строка) — показываем читаемый JSON, а не «[object Object]». */
function asDisplayText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

/* ── Общая история чата ─────────────────────────────────────────────────
 * Модульный кэш: все экземпляры AgentChat (главная, вкладка AI, полный экран)
 * видят одну переписку в рамках сессии. Плюс персистентность в хранилище —
 * история переживает перезапуск приложения (последние ~30 сообщений).
 */
const HISTORY_KEY = "agent_chat_history";
let cachedMessages: ChatMessage[] | null = null;

function persistMessages(messages: ChatMessage[]): void {
  cachedMessages = messages;
  // pendingWrite не сохраняем: подтверждение операции живёт только в текущей сессии
  let payload = messages.slice(-30).map((m) => ({ role: m.role, content: m.content }));
  // Ужимаем под лимит SecureStore (~2 КБ на значение)
  while (JSON.stringify(payload).length > 1800 && payload.length > 2) payload = payload.slice(1);
  void setStoredJson(HISTORY_KEY, payload);
}

interface AgentChatProps {
  /**
   * Фиксированная высота — нужен, когда чат встраивается в прокручиваемый
   * экран (например, главная админки). Без высоты растягивается на всё место.
   */
  height?: number;
  /**
   * Команда, которую нужно отправить автоматически (быстрые действия на главной).
   * Меняется значение — отправляется новая команда.
   */
  autoCommand?: string | null;
  /** Вызывается после постановки autoCommand в чат, чтобы родитель мог сбросить проп. */
  onAutoCommandSent?: () => void;
  placeholder?: string;
  emptyHint?: string;
}

export function AgentChat({
  height,
  autoCommand = null,
  onAutoCommandSent,
  placeholder = "Команда для BOOOM AI…",
  emptyHint = "Напишите команду агенту, например: «Покажи последние 10 заказов»",
}: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(cachedMessages ?? []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const historyLoaded = useRef(cachedMessages != null);

  useEffect(() => {
    if (historyLoaded.current) return;
    let cancelled = false;
    (async () => {
      const saved = await getStoredJson(HISTORY_KEY);
      if (cancelled) return;
      if (Array.isArray(saved) && saved.length) {
        cachedMessages = saved as ChatMessage[];
        setMessages(cachedMessages);
      }
      historyLoaded.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!historyLoaded.current) return;
    persistMessages(messages);
  }, [messages]);

  const send = async (raw?: string) => {
    const command = (raw ?? input).trim();
    if (!command || busy) return;
    setInput("");
    setError("");
    setMessages((m) => [...m, { role: "user", content: command }]);
    setBusy(true);
    try {
      // Локальный роутер: уверенно распознанные простые вопросы (аналитика,
      // клиенты, заказы, товары, резюме, проблемы) считаем сами — экономия токенов.
      // Всё, что не распознано (return null), уходит серверному ИИ-агенту.
      const local = await tryLocalAssistant(command);
      if (local !== null) {
        setMessages((m) => [...m, { role: "assistant", content: local }]);
        return;
      }
      const history = messages
        .filter((m) => !m.pendingWrite)
        .slice(-15) // сервер принимает до 15 сообщений истории
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await apiPost<any>("/admin/agent/chat", { command, history });
      const answer = asDisplayText(res?.text ?? res?.description);
      // Сервер вернул заглушку («Не удалось распознать команду» / пустоту) —
      // значит LLM ответила пустотой. Пробуем посчитать локально вместо тупика.
      if (!answer.trim() || /не удалось распознать/i.test(answer)) {
        try {
          const fb = await tryLocalFallback(command);
          if (fb !== null) {
            setMessages((m) => [
              ...m,
              { role: "assistant", content: `${fb}\n\n_(локальный расчёт: ИИ не смог обработать запрос)_` },
            ]);
            return;
          }
        } catch {
          // ignore
        }
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "ИИ не смог обработать этот запрос. Попробуй переформулировать — например: «сколько продалось <название товара>», «покажи брошенные корзины», «создай промокод …».",
          },
        ]);
        return;
      }
      if (res.type === "write") {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: asDisplayText(res.description) || "Подтвердить операцию?",
            pendingWrite: { tool: res.tool, params: res.params || {} },
          },
        ]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: asDisplayText(res.text) || "Готово" }]);
      }
    } catch (e) {
      // Сервер недоступен — пробуем посчитать локально, чтобы чат не молчал
      try {
        const fb = await tryLocalFallback(command);
        if (fb !== null) {
          setMessages((m) => [
            ...m,
            { role: "assistant", content: `${fb}\n\n_(локальный расчёт: сервер недоступен)_` },
          ]);
          return;
        }
      } catch {
        // ignore
      }
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const execute = async (msg: ChatMessage) => {
    if (!msg.pendingWrite) return;
    setBusy(true);
    setError("");
    try {
      const res = await apiPost<{ result: string }>("/admin/agent/execute", {
        tool: msg.pendingWrite.tool,
        params: msg.pendingWrite.params,
      });
      setMessages((m) =>
        m.map((x) =>
          x === msg
            ? { role: "assistant", content: asDisplayText(res.result) || "Выполнено", pendingWrite: null }
            : x,
        ),
      );
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!autoCommand) return;
    send(autoCommand);
    onAutoCommandSent?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCommand]);

  /* Рендер ответа: части в ```…``` — моноширинным (CSV, таблицы),
   * в обычном тексте убираем markdown-заголовки и выделяем **жирный**. */
  const renderContent = (content: string) => {
    const parts = content.split("```");
    if (parts.length === 1) return renderMarkdown(content, 0);
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <Text key={i} style={styles.codeText} selectable>
          {part.replace(/^\n/, "").replace(/\n$/, "")}
        </Text>
      ) : part ? (
        <React.Fragment key={i}>{renderMarkdown(part, i)}</React.Fragment>
      ) : null,
    );
  };

  const renderMarkdown = (text: string, keyBase: number) => {
    // «## Заголовок» → просто текст без решёток
    const cleaned = text.replace(/^#{1,6}\s+/gm, "");
    const segments = cleaned.split(/(\*\*[^*\n]+\*\*)/g);
    return (
      <Text style={styles.bubbleText} selectable>
        {segments.map((seg, i) =>
          seg.startsWith("**") && seg.endsWith("**") && seg.length > 4 ? (
            <Text key={`${keyBase}-${i}`} style={styles.bubbleTextBold}>
              {seg.slice(2, -2)}
            </Text>
          ) : (
            seg
          ),
        )}
      </Text>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, height != null ? { height } : null]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.chatContent}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        <InlineError text={error} />
        {messages.length === 0 ? (
          <EmptyState text={emptyHint} />
        ) : (
          messages.map((m, i) => (
            <View
              key={i}
              style={[styles.bubbleWrap, m.role === "user" ? styles.bubbleUser : styles.bubbleAi]}
            >
              <View style={[styles.bubble, m.role === "user" ? styles.bubbleUserBg : styles.bubbleAiBg]}>
                {renderContent(m.content)}
                {m.pendingWrite ? (
                  <View style={styles.confirmRow}>
                    <Button title="Выполнить" onPress={() => execute(m)} loading={busy} />
                    <Button
                      title="Отмена"
                      variant="ghost"
                      onPress={() =>
                        setMessages((all) =>
                          all.map((x) =>
                            x === m ? { role: "assistant", content: "Отменено", pendingWrite: null } : x,
                          ),
                        )
                      }
                    />
                  </View>
                ) : null}
              </View>
            </View>
          ))
        )}
        {busy ? <TypingBubble /> : null}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          style={styles.composerInput}
          multiline
          onSubmitEditing={() => send()}
          /* Web: Enter (или Ctrl+Enter) — отправить, Shift+Enter — новая строка */
          onKeyPress={(e) => {
            if (Platform.OS !== "web") return;
            const meta = e.nativeEvent as unknown as { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean };
            const isEnter = e.nativeEvent.key === "Enter";
            const isPlainEnter = isEnter && !meta.shiftKey && !meta.ctrlKey && !meta.metaKey;
            const isCtrlEnter = isEnter && (meta.ctrlKey || meta.metaKey);
            if (isPlainEnter || isCtrlEnter) {
              e.preventDefault();
              send();
            }
          }}
        />
        {/* Кнопка отправки — компактная, фиксированного размера, не растягивается на всю ширину. */}
        <View style={styles.composerButton}>
          <Pressable
            style={[styles.composerButtonInner, busy && styles.composerButtonBusy]}
            onPress={() => send()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Отправить сообщение"
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/* Пульсирующая подсказка, пока агент думает */
function TypingBubble() {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 550, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <View style={styles.bubbleWrap}>
      <View style={[styles.bubble, styles.bubbleAiBg]}>
        <Animated.Text style={[styles.bubbleText, { opacity, fontStyle: "italic" }]}>
          Агент печатает…
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chatContent: { padding: spacing.lg, gap: spacing.md },
  bubbleWrap: { flexDirection: "row" },
  bubbleUser: { justifyContent: "flex-end" },
  bubbleAi: { justifyContent: "flex-start" },
  bubble: { maxWidth: "85%", padding: spacing.md, borderRadius: 14 },
  bubbleUserBg: { backgroundColor: colors.accent },
  bubbleAiBg: { backgroundColor: colors.surface },
  bubbleText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  bubbleTextBold: { fontWeight: "700" },
  codeText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
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
  composerButton: {
    width: 48,
    height: 48,
    flexShrink: 0,
    alignSelf: "flex-end",
  },
  composerButtonInner: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  composerButtonBusy: {
    opacity: 0.7,
  },
});
