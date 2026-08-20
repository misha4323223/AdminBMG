import React, { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Accordion } from "@/components/Accordion";
import { SchemaEditor, humanizeLabel } from "@/components/SchemaEditor";
import { NamedSettingsEditor } from "@/components/NamedSettingsEditor";
import { Badge, Button, EmptyState, InlineError, LoadingView } from "@/components/ui";
import { apiGet, apiPost, getErrorMessage } from "@/lib/api";
import { colors, spacing } from "@/constants/theme";

const DEFAULT_ARTISTS_HEADER = {
  title: "Наши артисты",
  subtitle: "Коллаборации",
  linkText: "Весь мерч",
  linkUrl: "/products?category=merch",
  visible: true,
};

export default function PageSectionsScreen() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const router = useRouter();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [saved, setSaved] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiGet<Record<string, unknown>>(`/page-settings/${page}`);
      setData(res || {});
      setSaved(res || {});
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const createArtist = async () => {
    if (page !== "artist_pages") return;
    setCreating(true);
    setError("");
    setSavedMsg("");
    try {
      const slug = `artist-${Date.now()}`;
      const home = await apiGet<Record<string, unknown>>("/page-settings/home");
      const artists = (home.artists as Record<string, unknown> | undefined) || {};
      const items = Array.isArray(artists.items) ? [...(artists.items as unknown[])] : [];
      const newItem = { name: "Новый артист", role: "", image: "", collection: "", slug };
      await apiPost("/admin/page-settings/home/artists", {
        ...DEFAULT_ARTISTS_HEADER,
        ...(artists as object),
        items: [newItem, ...items],
      });
      await apiPost(`/admin/page-settings/artist_pages/${slug}`, {
        name: "Новый артист",
        slug,
        heroVisible: true,
        aboutVisible: true,
        galleryVisible: true,
        productsVisible: true,
        quoteVisible: true,
        videoVisible: true,
        socialsVisible: true,
      });
      await load();
      setSavedMsg("Артист создан. Раскройте секцию и заполните страницу.");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const sections = useMemo(() => (data ? Object.keys(data) : []), [data]);

  const save = async (key: string) => {
    setSavingKey(key);
    setError("");
    setSavedMsg("");
    try {
      await apiPost(`/admin/page-settings/${page}/${key}`, data?.[key]);
      setSaved((prev) => ({ ...(prev || {}), [key]: data?.[key] }));
      setSavedMsg(`Секция «${humanizeLabel(key)}» сохранена`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSavingKey(null);
    }
  };

  const reset = (key: string) => {
    setData((prev) => ({ ...(prev || {}), [key]: saved?.[key] }));
  };

  const change = (key: string, next: unknown) => {
    setData((prev) => ({ ...(prev || {}), [key]: next }));
    setSavedMsg("");
  };

  if (loading) {
    return (
      <Screen title={page} scroll={false}>
        <LoadingView />
      </Screen>
    );
  }

  return (
    <Screen title={humanizeLabel(page)} subtitle={`${sections.length} секций`} scroll={false}>
      <FlatList
        data={sections}
        keyExtractor={(k) => k}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <InlineError text={error} />
            {savedMsg ? <Text style={styles.saved}>{savedMsg}</Text> : null}
            <Text style={styles.hint}>
              {page === "artist_pages"
                ? "Каждый артист — отдельная секция. Добавьте нового артиста, затем раскройте его секцию и заполните поля."
                : "Разделы страницы редактируются по одному: раскройте секцию, поменяйте поля и нажмите «Сохранить секцию»."}
            </Text>
            {page === "artist_pages" ? (
              <Button title="Добавить артиста" variant="secondary" icon="add" onPress={createArtist} loading={creating} />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Accordion
            title={humanizeLabel(item)}
            icon="options-outline"
            badge={<Badge tone="neutral">{typeLabel(data?.[item])}</Badge>}
          >
            {page === "navbar" || page === "footer" || page === "site_config" ? (
              <NamedSettingsEditor
                kind={page}
                sectionKey={item}
                value={data?.[item]}
                onChange={(next) => change(item, next)}
              />
            ) : (
              <SchemaEditor value={data?.[item]} onChange={(next) => change(item, next)} />
            )}
            {page === "artist_pages" ? (
              <View style={styles.actions}>
                <Button
                  title="Треки артиста"
                  variant="secondary"
                  icon="musical-notes-outline"
                  onPress={() => router.push(`/pages/artist-tracks?slug=${encodeURIComponent(item)}` as never)}
                />
              </View>
            ) : null}
            <View style={styles.actions}>
              <Button title="Сохранить секцию" onPress={() => save(item)} loading={savingKey === item} icon="save-outline" />
              <Button title="Сбросить" variant="ghost" onPress={() => reset(item)} />
            </View>
          </Accordion>
        )}
        ListEmptyComponent={<EmptyState text={error || "Секций нет"} />}
      />
    </Screen>
  );
}

function typeLabel(v: unknown): string {
  if (Array.isArray(v)) return `массив (${v.length})`;
  if (typeof v === "object" && v !== null)
    return `объект (${Object.keys(v as object).length})`;
  return typeof v;
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl },
  headerBlock: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  saved: { color: colors.success, fontSize: 13 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
});
