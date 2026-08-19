import React, { useEffect, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import {
  Button,
  Card,
  EmptyState,
  Field,
  InlineError,
  LoadingView,
  SectionTitle,
} from "@/components/ui";
import { apiGet, apiPost, getErrorMessage } from "@/lib/api";
import { colors, spacing } from "@/constants/theme";

interface SeoPage {
  type: string;
  key: string;
  label: string;
  fields?: {
    title?: { default?: string; value?: string };
    description?: { default?: string; value?: string };
  };
  hero?: Record<string, unknown>;
}

export default function SeoScreen() {
  const [pages, setPages] = useState<SeoPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<SeoPage | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<{ pages: SeoPage[] }>("/admin/seo/pages");
      setPages(data.pages || []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (selected) {
    return (
      <PageEditor
        page={selected}
        onBack={() => {
          setSelected(null);
          load();
        }}
      />
    );
  }

  return (
    <Screen title="SEO" scroll={false}>
      <FlatList
        data={pages}
        keyExtractor={(p) => p.key}
        onRefresh={load}
        refreshing={loading}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<InlineError text={error} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelected(item)} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.label}</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {item.fields?.title?.value || "—"}
              </Text>
              <Text style={styles.sub} numberOfLines={2}>
                {item.fields?.description?.value || "—"}
              </Text>
            </View>
            <Text style={styles.type}>{item.type}</Text>
          </Pressable>
        )}
        ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text={error || "Страниц нет"} />}
      />
    </Screen>
  );
}

function PageEditor({ page, onBack }: { page: SeoPage; onBack: () => void }) {
  const [title, setTitle] = useState(page.fields?.title?.value || "");
  const [description, setDescription] = useState(page.fields?.description?.value || "");
  const [heroImage, setHeroImage] = useState(String(page.hero?.heroImage || ""));
  const [heroImageMobile, setHeroImageMobile] = useState(String(page.hero?.heroImageMobile || ""));
  const [heroImageAlt, setHeroImageAlt] = useState(String(page.hero?.heroImageAlt || ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const seoKey = pageKeyToSeoKey(page);

  const save = async () => {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      if (page.type === "artist") {
        await apiPost(`/admin/page-settings/artist_pages/${page.key}`, {
          seoTitle: title,
          seoDescription: description,
        });
      } else if (seoKey) {
        await apiPost(`/admin/page-settings/seo/${seoKey}`, { title, description });
      }
      if (page.type === "home") {
        await apiPost("/admin/seo/home-hero", {
          heroImage,
          heroImageMobile,
          heroImageAlt,
        });
      }
      setSaved(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={page.label} subtitle={`SEO · ${page.type}`}>
      <ScrollView contentContainerStyle={styles.pad}>
        <InlineError text={error} />
        {saved ? <Text style={styles.saved}>Сохранено ✓</Text> : null}

        <Card style={styles.card}>
          <SectionTitle>Мета-теги</SectionTitle>
          <Field label="Title" value={title} onChangeText={setTitle} multiline />
          <Field label="Description" value={description} onChangeText={setDescription} multiline />
        </Card>

        {page.type === "home" ? (
          <Card style={styles.card}>
            <SectionTitle>Hero (главный слайд)</SectionTitle>
            <Field label="Hero image (URL)" value={heroImage} onChangeText={setHeroImage} autoCapitalize="none" />
            <Field label="Hero mobile (URL)" value={heroImageMobile} onChangeText={setHeroImageMobile} autoCapitalize="none" />
            <Field label="Alt" value={heroImageAlt} onChangeText={setHeroImageAlt} />
          </Card>
        ) : null}

        <Button title="Сохранить" onPress={save} loading={busy} icon="save-outline" />
        <View style={styles.backWrap}>
          <Button title="Назад" variant="ghost" onPress={onBack} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function pageKeyToSeoKey(page: SeoPage): string | null {
  switch (page.type) {
    case "home":
    case "concept":
    case "merch_order":
    case "partner_register":
      return page.key;
    case "category":
      return `category:${page.key}`;
    case "subcategory":
      return `subcategory:${page.key}`;
    case "subsubcategory":
      return `subsubcategory:${page.key}`;
    case "static":
      return `static:${page.key}`;
    default:
      return null;
  }
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
  title: { color: colors.text, fontSize: 15, fontWeight: "600" },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  type: { color: colors.textMuted, fontSize: 11, textTransform: "uppercase" },
  pad: { padding: spacing.lg },
  card: { marginBottom: spacing.lg },
  saved: { color: colors.success, fontSize: 13, marginBottom: spacing.sm },
  backWrap: { marginTop: spacing.sm },
});
