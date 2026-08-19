import React, { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Badge, Button, EmptyState, LoadingView } from "@/components/ui";
import { apiPost } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { colors, spacing } from "@/constants/theme";

export default function AiQuestionsScreen() {
  const { data, loading, refreshing, error, reload } = useFetch<{ questions?: any[]; faq?: any[] }>(
    "/admin/ai-questions",
  );
  const questions = data?.questions || [];
  const [busy, setBusy] = useState<string | "prune" | null>(null);

  const regenerate = async (question: string) => {
    setBusy(question);
    try {
      await apiPost(`/admin/ai-questions/${encodeURIComponent(question)}/regenerate`);
      reload();
    } catch {
    } finally {
      setBusy(null);
    }
  };

  const prune = async () => {
    setBusy("prune");
    try {
      await apiPost("/admin/ai-questions/prune");
      reload();
    } catch {
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen
      title="AI-вопросы"
      subtitle={error || `${questions.length} вопросов`}
      scroll={false}
      right={
        <Button title="Очистить" onPress={prune} variant="secondary" loading={busy === "prune"} />
      }
    >
      <FlatList
        data={questions}
        keyExtractor={(q, i) => String(q.question ?? q.id ?? i)}
        onRefresh={reload}
        refreshing={refreshing}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const question = item.question || item.text || String(item.id);
          return (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{question}</Text>
                {item.answer ? (
                  <Text style={styles.sub} numberOfLines={3}>
                    {item.answer}
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={() => regenerate(question)} disabled={busy === question}>
                <Badge tone="info">{busy === question ? "…" : "Регенерировать"}</Badge>
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text="Вопросов нет" />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: 14, fontWeight: "600" },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 17 },
});
