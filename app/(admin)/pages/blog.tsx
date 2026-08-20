import React, { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
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
import { apiGet, apiPost, getErrorMessage, uploadImage } from "@/lib/api";
import { colors, radius, spacing } from "@/constants/theme";

interface BlogPost {
  title?: string;
  date?: string;
  category?: string;
  excerpt?: string;
  image?: string;
}

interface BlogSection {
  title?: string;
  subtitle?: string;
  visible?: boolean;
  items?: BlogPost[];
}

const EMPTY_POST: Record<string, any> = {
  title: "",
  date: "",
  category: "",
  badgeColor: "black",
  author: "BMG Team",
  excerpt: "",
  image: "",
  content: "",
  contentImages: [],
  tags: [],
  quoteText: "",
  quoteAuthor: "",
  quoteVisible: false,
  linkedProducts: [],
  visible: true,
};

export default function BlogPagesScreen() {
  const router = useRouter();
  const [blog, setBlog] = useState<BlogSection | null>(null);
  const [pageSettings, setPageSettings] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [post, setPost] = useState<Record<string, any>>(EMPTY_POST);
  const [blogDraft, setBlogDraft] = useState({ title: "", subtitle: "", visible: true });
  const [pageDraft, setPageDraft] = useState({ title: "", subtitle: "" });
  const [uploadingImage, setUploadingImage] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [home, list] = await Promise.all([
        apiGet<Record<string, any>>("/page-settings/home").catch(() => null),
        apiGet<Record<string, any>>("/page-settings/blog_pages").catch(() => null),
      ]);
      const b = home?.blog || { title: "Культура и стиль", subtitle: "BMG Журнал", visible: true, items: [] };
      const nextBlog = { ...b, items: Array.isArray(b.items) ? b.items : [] };
      const nextPageSettings = list || {};
      setBlog(nextBlog);
      setBlogDraft({ title: nextBlog.title || "", subtitle: nextBlog.subtitle || "", visible: nextBlog.visible !== false });
      setPageSettings(nextPageSettings);
      setPageDraft({ title: String(nextPageSettings.title || ""), subtitle: String(nextPageSettings.subtitle || "") });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveBlogSection = async (next: BlogSection) => {
    await apiPost("/admin/page-settings/home/blog", next);
    setBlog(next);
    setBlogDraft({ title: next.title || "", subtitle: next.subtitle || "", visible: next.visible !== false });
  };

  const saveListSettings = async (next: Record<string, any>) => {
    await apiPost("/admin/page-settings/blog_pages", next);
    setPageSettings(next);
    setPageDraft({ title: String(next.title || ""), subtitle: String(next.subtitle || "") });
  };

  const saveBlogDraft = async () => {
    if (!blog) return;
    setBusy(true);
    setError("");
    try {
      await saveBlogSection({ ...blog, ...blogDraft });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const savePageDraft = async () => {
    setBusy(true);
    setError("");
    try {
      await saveListSettings({ ...(pageSettings || {}), ...pageDraft });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const pickPostImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Нужен доступ к фото");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (result.canceled || !result.assets?.[0]) return;
    setUploadingImage(true);
    setError("");
    try {
      const asset = result.assets[0];
      const url = await uploadImage(asset.uri, asset.fileName || undefined);
      setPost((current) => ({ ...current, image: url }));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setUploadingImage(false);
    }
  };

  const startEdit = async (idx: number) => {
    setError("");
    setBusy(true);
    try {
      const saved = await apiGet<Record<string, any>>(`/page-settings/blog_pages/${idx}`).catch(() => null);
      const item = blog?.items?.[idx] || {};
      setPost({ ...EMPTY_POST, ...(saved || {}), ...item });
      setEditingIdx(idx);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const addPost = async () => {
    if (!blog) return;
    setBusy(true);
    setError("");
    try {
      const items = [...(blog.items || [])];
      const today = new Date();
      const months = [
        "января", "февраля", "марта", "апреля", "мая", "июня",
        "июля", "августа", "сентября", "октября", "ноября", "декабря",
      ];
      const dateStr = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;
      items.push({ title: "Новый пост", date: dateStr, category: "", excerpt: "", image: "" });
      const next = { ...blog, items };
      await saveBlogSection(next);
      setEditingIdx(items.length - 1);
      setPost({ ...EMPTY_POST, title: "Новый пост", date: dateStr });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const savePost = async () => {
    if (editingIdx == null) return;
    setBusy(true);
    setError("");
    try {
      await apiPost(`/admin/page-settings/blog_pages/${editingIdx}`, post);
      if (blog) {
        const items = [...(blog.items || [])];
        items[editingIdx] = {
          ...items[editingIdx],
          title: post.title,
          date: post.date,
          category: post.category,
          excerpt: post.excerpt,
          image: post.image,
        };
        await saveBlogSection({ ...blog, items });
      }
      setEditingIdx(null);
      setPost(EMPTY_POST);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const deletePost = async () => {
    if (editingIdx == null || !blog) return;
    setBusy(true);
    setError("");
    try {
      const items = (blog.items || []).filter((_, i) => i !== editingIdx);
      await saveBlogSection({ ...blog, items });
      setEditingIdx(null);
      setPost(EMPTY_POST);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen title="Блог" scroll={false}>
        <LoadingView />
      </Screen>
    );
  }

  if (editingIdx != null) {
    const set = (k: string, v: any) => setPost((p) => ({ ...p, [k]: v }));
    return (
      <Screen title="Редактор поста" subtitle={`Пост ${editingIdx + 1}`} scroll>
        <InlineError text={error} />
        <Card style={styles.card}>
          <SectionTitle>Основное</SectionTitle>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Видимость поста</Text>
            <Pressable
              onPress={() => set("visible", post.visible !== false)}
              style={[styles.toggle, post.visible !== false && styles.toggleOn]}
            >
              <View style={[styles.dot, post.visible !== false && styles.dotOn]} />
            </Pressable>
          </View>
          <Field label="Заголовок" value={post.title} onChangeText={(v) => set("title", v)} />
          <Field label="Дата (например, 15 января 2026)" value={post.date} onChangeText={(v) => set("date", v)} />
          <Field label="Категория / Бейдж" value={post.category} onChangeText={(v) => set("category", v)} />
          <Field label="Автор" value={post.author} onChangeText={(v) => set("author", v)} />
          <Field label="Цвет бейджа (black/white/red…)" value={post.badgeColor} onChangeText={(v) => set("badgeColor", v)} autoCapitalize="none" />
          <Field label="Картинка (URL)" value={post.image} onChangeText={(v) => set("image", v)} autoCapitalize="none" />
          <Button
            title={uploadingImage ? "Загрузка…" : "Выбрать картинку из галереи"}
            variant="secondary"
            onPress={pickPostImage}
            loading={uploadingImage}
            icon="image-outline"
          />
          {post.image ? (
            <Image source={{ uri: post.image }} style={styles.preview} contentFit="cover" />
          ) : null}
          <Field label="Анонс (excerpt)" value={post.excerpt} onChangeText={(v) => set("excerpt", v)} multiline />
        </Card>

        <Card style={styles.card}>
          <SectionTitle>Содержимое</SectionTitle>
          <Field label="Текст статьи" value={post.content} onChangeText={(v) => set("content", v)} multiline />
          <Field
            label="Теги (через запятую)"
            value={Array.isArray(post.tags) ? post.tags.join(", ") : String(post.tags || "")}
            onChangeText={(v) =>
              set(
                "tags",
                v
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              )
            }
          />
        </Card>

        <Card style={styles.card}>
          <SectionTitle>Цитата</SectionTitle>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Показывать цитату</Text>
            <Pressable
              onPress={() => set("quoteVisible", !post.quoteVisible)}
              style={[styles.toggle, !!post.quoteVisible && styles.toggleOn]}
            >
              <View style={[styles.dot, !!post.quoteVisible && styles.dotOn]} />
            </Pressable>
          </View>
          <Field label="Текст цитаты" value={post.quoteText} onChangeText={(v) => set("quoteText", v)} multiline />
          <Field label="Автор цитаты" value={post.quoteAuthor} onChangeText={(v) => set("quoteAuthor", v)} />
        </Card>

        <Button title="Сохранить пост" onPress={savePost} loading={busy} icon="save-outline" />
        <View style={styles.actionsRow}>
          <Button title="Удалить пост" onPress={deletePost} variant="danger" loading={busy} icon="trash-outline" />
          <Button
            title="Назад"
            variant="ghost"
            onPress={() => {
              setEditingIdx(null);
              setPost(EMPTY_POST);
            }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Блог" subtitle={`${blog?.items?.length ?? 0} постов`} scroll={false}>
      <FlatList
        data={blog?.items || []}
        keyExtractor={(_, i) => String(i)}
        onRefresh={load}
        refreshing={loading}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <InlineError text={error} />
            <Card style={styles.card}>
              <SectionTitle>Блок на главной</SectionTitle>
              <Field
                label="Заголовок блока"
                value={blogDraft.title}
                onChangeText={(v) => setBlogDraft((draft) => ({ ...draft, title: v }))}
              />
              <Field
                label="Подзаголовок"
                value={blogDraft.subtitle}
                onChangeText={(v) => setBlogDraft((draft) => ({ ...draft, subtitle: v }))}
              />
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Виден на главной</Text>
                <Pressable
                  onPress={() => setBlogDraft((draft) => ({ ...draft, visible: !draft.visible }))}
                  style={[styles.toggle, blogDraft.visible && styles.toggleOn]}
                >
                  <View style={[styles.dot, blogDraft.visible && styles.dotOn]} />
                </Pressable>
              </View>
              <Button title="Сохранить блок" onPress={saveBlogDraft} loading={busy} icon="save-outline" />
            </Card>
            <Card style={styles.card}>
              <SectionTitle>Страница блога</SectionTitle>
              <Field
                label="Заголовок страницы"
                value={pageDraft.title}
                onChangeText={(v) => setPageDraft((draft) => ({ ...draft, title: v }))}
              />
              <Field
                label="Подзаголовок страницы"
                value={pageDraft.subtitle}
                onChangeText={(v) => setPageDraft((draft) => ({ ...draft, subtitle: v }))}
              />
              <Button title="Сохранить настройки страницы" onPress={savePageDraft} loading={busy} icon="save-outline" />
            </Card>
            <Button title="Добавить пост" onPress={addPost} loading={busy} icon="add" />
          </View>
        }
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => startEdit(index)}
            style={({ pressed }) => [styles.postRow, pressed && { opacity: 0.7 }]}
          >
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty]}>
                <Ionicons name="image-outline" size={20} color={colors.textMuted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{item.title || "Без названия"}</Text>
              <Text style={styles.sub} numberOfLines={2}>{item.excerpt || "—"}</Text>
              <View style={styles.postMeta}>
                {item.category ? <Badge tone="accent">{item.category}</Badge> : null}
                {item.date ? <Text style={styles.sub}>{item.date}</Text> : null}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState text={error || "Постов нет — добавьте первый"} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl },
  card: { margin: spacing.lg },
  postRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 15, fontWeight: "600" },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  postMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 4 },
  preview: { width: "100%", height: 140, borderRadius: radius.sm, marginTop: spacing.sm },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  toggleLabel: { color: colors.text, fontSize: 14 },
  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: colors.surfaceAlt, padding: 3 },
  toggleOn: { backgroundColor: colors.success },
  dot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.textMuted },
  dotOn: { backgroundColor: colors.white, alignSelf: "flex-end" },
  actionsRow: { marginTop: spacing.sm, gap: spacing.sm },
});
