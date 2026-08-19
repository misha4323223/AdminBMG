import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/Screen";
import { Button, Card, EmptyState, Field, InlineError, LoadingView } from "@/components/ui";
import { apiGet, apiPost, getErrorMessage } from "@/lib/api";
import { colors, spacing } from "@/constants/theme";

export default function PageSectionsScreen() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await apiGet<Record<string, unknown>>(`/page-settings/${page}`);
        setData(res || {});
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [page]);

  const sections = useMemo(() => (data ? Object.keys(data) : []), [data]);

  const openSection = (key: string) => {
    setSelected(key);
    setDraft(JSON.stringify(data?.[key], null, 2));
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(draft);
      } catch {
        setError("Некорректный JSON");
        setSaving(false);
        return;
      }
      await apiPost(`/admin/page-settings/${page}/${selected}`, parsed);
      setData((prev) => ({ ...(prev || {}), [selected]: parsed }));
      setSelected(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen title={page} scroll={false}>
        <LoadingView />
      </Screen>
    );
  }

  return (
    <Screen title={page} subtitle={`${sections.length} секций`} scroll>
      <InlineError text={error} />

      {selected ? (
        <Card style={styles.editorCard}>
          <Text style={styles.editorTitle}>Секция: {selected}</Text>
          <Field label="JSON" value={draft} onChangeText={setDraft} multiline />
          <View style={styles.editorActions}>
            <Button title="Отмена" onPress={() => setSelected(null)} variant="secondary" />
            <Button title="Сохранить" onPress={save} loading={saving} />
          </View>
        </Card>
      ) : null}

      <FlatList
        data={sections}
        keyExtractor={(k) => k}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openSection(item)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.sectionName}>{item}</Text>
            <Text style={styles.sectionPreview}>
              {String(data?.[item] ?? "").slice(0, 60)}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState text={error || "Секций нет"} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  editorCard: { marginBottom: spacing.lg },
  editorTitle: { color: colors.text, fontSize: 15, fontWeight: "700", marginBottom: spacing.md },
  editorActions: { flexDirection: "row", gap: spacing.sm },
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sectionName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  sectionPreview: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
