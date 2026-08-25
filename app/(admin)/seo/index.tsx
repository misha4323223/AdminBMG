import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
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
  SeoCounter,
} from "@/components/ui";
import { apiGet, apiPatch, apiPost, getErrorMessage, uploadImage } from "@/lib/api";
import { seoPageTypeLabel } from "@/lib/format";
import { colors, radius, spacing } from "@/constants/theme";

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

interface AuditProduct {
  id: number;
  slug: string;
  name: string;
  category: string;
}

interface AuditData {
  products: {
    total: number;
    visible: number;
    hidden: number;
    withSeoTitle: number;
    withSeoDesc: number;
    withSeoBody: number;
    withImage: number;
    pctTitle: number;
    pctDesc: number;
    pctBody: number;
    missingTitle: AuditProduct[];
    missingDesc: AuditProduct[];
    missingBody: AuditProduct[];
  };
}

const SCHEMA_COVERAGE: Array<{ page: string; schemas: string[]; botSsr: boolean }> = [
  { page: "Главная (/)", schemas: ["Organization", "WebSite", "SearchAction", "WebPage", "SpeakableSpecification"], botSsr: true },
  { page: "Каталог (/products)", schemas: ["BreadcrumbList", "WebPage", "CollectionPage + ItemList"], botSsr: true },
  { page: "Категория (/products/:cat)", schemas: ["BreadcrumbList", "WebPage", "ItemList с Product"], botSsr: true },
  { page: "Товар (/:slug)", schemas: ["Product", "ImageObject[]", "BreadcrumbList", "WebPage", "SpeakableSpecification", "AggregateRating", "Review", "MerchantReturnPolicy", "OfferShippingDetails"], botSsr: true },
  { page: "Артист (/@:slug)", schemas: ["BreadcrumbList", "WebPage", "Person"], botSsr: false },
  { page: "Статья блога (/blog/:slug)", schemas: ["BlogPosting", "BreadcrumbList", "Person (author)"], botSsr: false },
  { page: "Блог (/blog)", schemas: ["Blog", "BreadcrumbList"], botSsr: false },
  { page: "Мерч на заказ (/merch-na-zakaz)", schemas: ["LocalBusiness", "Service", "HowTo", "FAQPage", "BreadcrumbList"], botSsr: true },
  { page: "Статические страницы", schemas: ["WebPage", "BreadcrumbList"], botSsr: false },
];

const TECH_FIXES: Array<{ title: string; status: "fixed" | "ok"; desc: string }> = [
  { title: "Дублирование JSON-LD", status: "fixed", desc: "Исправлено: атрибут data-rh=\"true\" — Helmet удаляет серверные теги при маунте." },
  { title: "max-snippet / max-image-preview", status: "fixed", desc: "Добавлены директивы в robots meta для расширенных сниппетов в Google." },
  { title: "Bot SSR для поисковиков", status: "fixed", desc: "Яндекс и Google получают полный HTML вместо пустого <div id='root'>." },
  { title: "ImageObject (полная разметка)", status: "ok", desc: "Каждый товар передаёт изображения как ImageObject." },
  { title: "SpeakableSpecification", status: "ok", desc: "Главная и страницы товаров разметили xpath для голосовых ассистентов." },
  { title: "MerchantReturnPolicy + ShippingDetails", status: "ok", desc: "hasMerchantReturnPolicy (30-дневный возврат) и shippingDetails (СДЭК по России)." },
];

type SubTab = "settings" | "audit";

const SECTION_ORDER: string[] = [
  "home", "category", "subcategory", "subsubcategory", "artist",
  "concept", "merch_order", "partner_register", "static",
];

const SECTION_META: Record<string, { label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> = {
  home: { label: "Главная", icon: "home-outline" },
  category: { label: "Категории", icon: "folder-outline" },
  subcategory: { label: "Подкатегории", icon: "grid-outline" },
  subsubcategory: { label: "Под-подкатегории", icon: "layers-outline" },
  artist: { label: "Артисты", icon: "musical-notes-outline" },
  concept: { label: "Pre-drop", icon: "cube-outline" },
  merch_order: { label: "Мерч на заказ", icon: "bag-outline" },
  partner_register: { label: "Партнёрская программа", icon: "people-outline" },
  static: { label: "Информационные страницы", icon: "document-text-outline" },
};

export default function SeoScreen() {
  const [subTab, setSubTab] = useState<SubTab>("settings");

  return (
    <Screen title="SEO" scroll={false}>
      <View style={styles.tabs}>
        <TabBtn label="Настройки" active={subTab === "settings"} onPress={() => setSubTab("settings")} />
        <TabBtn label="Аудит" active={subTab === "audit"} onPress={() => setSubTab("audit")} />
      </View>
      {subTab === "audit" ? <AuditTab /> : <PagesList />}
    </Screen>
  );
}

function PagesList() {
  const [pages, setPages] = useState<SeoPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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

  const grouped = useMemo(() => {
    const groups: Record<string, SeoPage[]> = {};
    for (const type of SECTION_ORDER) groups[type] = [];
    const q = query.trim().toLowerCase();
    for (const p of pages) {
      if (!groups[p.type]) groups[p.type] = [];
      if (q && !p.label.toLowerCase().includes(q) && !p.key.toLowerCase().includes(q)) continue;
      groups[p.type].push(p);
    }
    return groups;
  }, [pages, query]);

  const selectedPage = pages.find((p) => `${p.type}:${p.key}` === selectedKey) || null;

  if (selectedPage) {
    return (
      <PageEditor
        page={selectedPage}
        onBack={() => {
          setSelectedKey(null);
          load();
        }}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.treeList} keyboardShouldPersistTaps="handled">
      <InlineError text={error} />
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск по названию или slug..."
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
      </View>
      {loading ? (
        <LoadingView />
      ) : (
        SECTION_ORDER.map((type) => {
          const items = grouped[type] || [];
          if (items.length === 0) return null;
          const meta = SECTION_META[type];
          return (
            <View key={type} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name={meta?.icon || "folder-outline"} size={14} color={colors.textMuted} />
                <Text style={styles.sectionLabel}>{meta?.label || type}</Text>
                <Badge tone="neutral">{items.length}</Badge>
              </View>
              {items.map((p) => {
                const sel = `${p.type}:${p.key}` === selectedKey;
                const hasTitle = !!p.fields?.title?.value;
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => setSelectedKey(`${p.type}:${p.key}`)}
                    style={[styles.pageRow, sel && styles.pageRowSelected]}
                  >
                    <View style={[styles.dot, hasTitle ? styles.dotOn : styles.dotOff]} />
                    <Text style={[styles.pageLabel, sel && styles.pageLabelSelected]} numberOfLines={1}>
                      {p.label}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          );
        })
      )}
    </ScrollView>
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

  const pickHero = async (target: "desktop" | "mobile") => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Нет доступа к галерее");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setBusy(true);
    setError("");
    try {
      const url = await uploadImage(asset.uri, asset.fileName || undefined);
      if (target === "desktop") setHeroImage(url);
      else setHeroImageMobile(url);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <InlineError text={error} />
      {saved ? <Text style={styles.saved}>Сохранено ✓</Text> : null}

      <View style={styles.editorHeader}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.editorTitle}>{page.label}</Text>
          <Text style={styles.editorSubtitle}>SEO · {seoPageTypeLabel(page.type)}</Text>
        </View>
      </View>

      <Card style={styles.card}>
        <SectionTitle>Мета-теги</SectionTitle>
        <Text style={styles.hint}>Meta-теги этой страницы (title, description).</Text>
        <Field
          label={`Title (заголовок вкладки/страницы)`}
          value={title}
          onChangeText={setTitle}
        />
        <SeoCounter text={title} min={50} max={70} />
        <Field
          label="Description (meta-описание)"
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <SeoCounter text={description} min={120} max={165} />
      </Card>

      {page.type === "home" ? (
        <Card style={styles.card}>
          <SectionTitle>Hero-баннер (картинка + alt-текст)</SectionTitle>
          <Text style={styles.hint}>
            Слайдер из 4 слайдов — здесь редактируется только 1-й (главный) слайд. Остальные слайды и их картинки — в разделе «Страницы → Главная».
          </Text>

          <View style={styles.heroSection}>
            <Text style={styles.heroLabel}>Изображение (десктоп)</Text>
            {heroImage ? (
              <View style={styles.heroPreviewRow}>
                <Image source={{ uri: heroImage }} style={styles.heroPreview} contentFit="cover" />
                <View style={styles.heroActions}>
                  <Button title="Заменить" variant="secondary" onPress={() => pickHero("desktop")} icon="image-outline" />
                  <Button title="Убрать" variant="ghost" onPress={() => setHeroImage("")} icon="trash-outline" />
                </View>
              </View>
            ) : (
              <View>
                <TextInput
                  value={heroImage}
                  onChangeText={setHeroImage}
                  placeholder="URL изображения"
                  placeholderTextColor={colors.textMuted}
                  style={styles.heroInput}
                  autoCapitalize="none"
                />
                <Button title="Загрузить из галереи" variant="secondary" onPress={() => pickHero("desktop")} icon="images-outline" />
              </View>
            )}
          </View>

          <View style={styles.heroSection}>
            <Text style={styles.heroLabel}>Изображение (мобильная версия, опционально)</Text>
            {heroImageMobile ? (
              <View style={styles.heroPreviewRow}>
                <Image source={{ uri: heroImageMobile }} style={styles.heroPreview} contentFit="cover" />
                <View style={styles.heroActions}>
                  <Button title="Заменить" variant="secondary" onPress={() => pickHero("mobile")} icon="image-outline" />
                  <Button title="Убрать" variant="ghost" onPress={() => setHeroImageMobile("")} icon="trash-outline" />
                </View>
              </View>
            ) : (
              <View>
                <TextInput
                  value={heroImageMobile}
                  onChangeText={setHeroImageMobile}
                  placeholder="URL изображения"
                  placeholderTextColor={colors.textMuted}
                  style={styles.heroInput}
                  autoCapitalize="none"
                />
                <Button title="Загрузить из галереи" variant="secondary" onPress={() => pickHero("mobile")} icon="images-outline" />
              </View>
            )}
          </View>

          <Field label="Alt-текст изображения" value={heroImageAlt} onChangeText={setHeroImageAlt} />
          <Text style={styles.hint}>Помогает SEO и доступности — описывает, что изображено на баннере.</Text>
        </Card>
      ) : null}

      <Button title="Сохранить" onPress={save} loading={busy} icon="save-outline" />
      <View style={styles.backWrap}>
        <Button title="Назад" variant="ghost" onPress={onBack} />
      </View>
    </ScrollView>
  );
}

interface FullProduct {
  id: number;
  name: string;
  slug?: string;
  category?: string | null;
  isHidden?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

interface SeoDraft {
  product: FullProduct;
  title: string;
  description: string;
}

/** Черновик SEO из названия/категории — админ правит перед сохранением. */
function draftSeo(p: FullProduct): SeoDraft {
  const name = p.name.trim();
  const cat = (p.category || "").trim().toLowerCase();
  return {
    product: p,
    title: `${name} — купить ${cat || "в магазине BMGBRAND"} | BOOOMERANGS`,
    description:
      `${name} в официальном магазине BMGBRAND${cat ? `. ${cat}: оригинал, авторский дизайн` : ""}. ` +
      "Доставка по всей России, оплата онлайн. Заказывайте на booomerangs.ru.",
  };
}

function AuditTab() {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [field, setField] = useState<"title" | "desc" | "body">("title");
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<FullProduct[]>([]);
  const [wizard, setWizard] = useState<SeoDraft | null>(null);
  const [wizardBusy, setWizardBusy] = useState(false);
  const [wizardMsg, setWizardMsg] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [audit, prod] = await Promise.all([
        apiGet<AuditData>("/admin/seo-audit"),
        apiGet<{ products?: FullProduct[] }>("/products?limit=5000&admin=true"),
      ]);
      setData(audit);
      setProducts(Array.isArray(prod.products) ? prod.products : []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const p = data?.products;
  const list =
    field === "title"
      ? p?.missingTitle
      : field === "desc"
        ? p?.missingDesc
        : p?.missingBody;

  const filtered =
    list && query.trim()
      ? list.filter(
          (it) =>
            it.name.toLowerCase().includes(query.toLowerCase()) ||
            it.slug.toLowerCase().includes(query.toLowerCase()),
        )
      : list;

  /* --- Мастер дозаполнения --- */
  const missingSeo = useMemo(
    () =>
      products.filter(
        (pr) => !pr.isHidden && (!(pr.seoTitle || "").trim() || !(pr.seoDescription || "").trim()),
      ),
    [products],
  );

  const startWizard = () => {
    setWizardMsg("");
    if (missingSeo.length) setWizard(draftSeo(missingSeo[0]));
  };

  const skipProduct = () => {
    setWizardMsg("");
    const rest = missingSeo.filter((x) => x.id !== wizard?.product.id);
    setWizard(rest.length ? draftSeo(rest[0]) : null);
  };

  const saveWizard = async () => {
    if (!wizard) return;
    setWizardBusy(true);
    setWizardMsg("");
    try {
      await apiPatch(`/admin/products/${wizard.product.id}`, {
        seoTitle: wizard.title.trim(),
        seoDescription: wizard.description.trim(),
      });
      // локально помечаем товар заполненным и переходим к следующему
      setProducts((prev) =>
        prev.map((x) =>
          x.id === wizard.product.id
            ? { ...x, seoTitle: wizard.title.trim(), seoDescription: wizard.description.trim() }
            : x,
        ),
      );
      load(); // тихо обновляем проценты аудита
      const next = missingSeo.filter((x) => x.id !== wizard.product.id);
      setWizardMsg(`Сохранено ✓ Осталось: ${next.length}`);
      setWizard(next.length ? draftSeo(next[0]) : null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setWizardBusy(false);
    }
  };

  /* --- Дубли мета-тегов --- */
  const duplicates = useMemo(() => {
    interface DupGroup {
      value: string;
      kind: "title" | "desc";
      names: string[];
    }
    const build = (kind: "title" | "desc", get: (p: FullProduct) => string): DupGroup[] => {
      const map = new Map<string, string[]>();
      for (const pr of products) {
        if (pr.isHidden) continue;
        const v = get(pr).trim().toLowerCase();
        if (!v) continue;
        const arr = map.get(v) || [];
        arr.push(pr.name);
        map.set(v, arr);
      }
      return [...map.entries()]
        .filter(([, names]) => names.length > 1)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 5)
        .map(([value, names]) => ({ value, kind, names }));
    };
    return [...build("title", (p) => String(p.seoTitle || "")), ...build("desc", (p) => String(p.seoDescription || ""))];
  }, [products]);

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <InlineError text={error} />
      <View style={styles.auditHeader}>
        <Text style={styles.auditTitle}>SEO-аудит</Text>
        <Button title="Обновить" variant="ghost" icon="refresh" onPress={load} loading={loading} />
      </View>

      {/* --- Мастер дозаполнения SEO --- */}
      {wizard ? (
        <Card style={styles.card}>
          <SectionTitle>✍️ Заполнение SEO — конвейер</SectionTitle>
          <Text style={styles.hint}>
            Товар {missingSeo.length ? `1 из ${missingSeo.length}` : "— последний"}. Черновик сгенерирован из названия и категории — поправь и сохрани.
          </Text>
          <Text style={styles.wizardProduct}>
            [ID: {wizard.product.id}] {wizard.product.name}
            {wizard.product.category ? ` · ${wizard.product.category}` : ""}
          </Text>
          <Field label="SEO-заголовок" value={wizard.title} onChangeText={(v) => setWizard({ ...wizard, title: v })} multiline />
          <SeoCounter text={wizard.title} min={50} max={65} />
          <Field label="SEO-описание" value={wizard.description} onChangeText={(v) => setWizard({ ...wizard, description: v })} multiline />
          <SeoCounter text={wizard.description} min={120} max={165} />
          {wizardMsg ? <Text style={styles.saved}>{wizardMsg}</Text> : null}
          <View style={styles.wizardBtnRow}>
            <View style={{ flex: 1 }}>
              <Button title="Сохранить и след." onPress={saveWizard} loading={wizardBusy} icon="save-outline" />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Пропустить" variant="secondary" onPress={skipProduct} disabled={wizardBusy} icon="play-skip-forward-outline" />
            </View>
          </View>
          <Button title="Закрыть конвейер" variant="ghost" onPress={() => setWizard(null)} />
        </Card>
      ) : missingSeo.length && !loading ? (
        <Card style={[styles.card, styles.wizardInvite]}>
          <SectionTitle>Мастер дозаполнения</SectionTitle>
          <Text style={styles.hint}>
            Видимых товаров без SEO: {missingSeo.length}. Заполняй по одному с готовым черновиком — конвейером закроешь всё за минуты.
          </Text>
          <Button title={`Заполнить следующий (${missingSeo.length})`} onPress={startWizard} icon="arrow-forward-outline" />
        </Card>
      ) : null}

      {/* --- Дубли мета-тегов --- */}
      {!loading && duplicates.length > 0 ? (
        <Card style={styles.card}>
          <SectionTitle>🔁 Дубли мета-тегов</SectionTitle>
          <Text style={styles.hint}>
            Одинаковые тексты у нескольких товаров хуже, чем их отсутствие — поисковики показывают только один. Исправь через мастер или чат («заполни SEO товарам без SEO» не поможет — тексты нужно сделать уникальными).
          </Text>
          {duplicates.map((d) => (
            <View key={`${d.kind}:${d.value}`} style={styles.dupBlock}>
              <Text style={styles.dupValue} numberOfLines={1}>
                {d.kind === "title" ? "Title" : "Description"}: {d.value}
              </Text>
              <Text style={styles.hint}>×{d.names.length}: {d.names.slice(0, 4).join(", ")}{d.names.length > 4 ? `, …и ещё ${d.names.length - 4}` : ""}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Card style={styles.card}>
        <SectionTitle>Schema.org покрытие по типам страниц</SectionTitle>
        {SCHEMA_COVERAGE.map((s) => (
          <View key={s.page} style={styles.schemaRow}>
            <Text style={styles.schemaLabel}>{s.page}</Text>
            <Text style={styles.schemaValue}>{s.schemas.join(", ")}</Text>
          </View>
        ))}
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Технические исправления</SectionTitle>
        {TECH_FIXES.map((fix) => (
          <View key={fix.title} style={styles.fixRow}>
            <Ionicons
              name={fix.status === "fixed" ? "checkmark-circle" : "checkmark-circle-outline"}
              size={16}
              color={colors.success}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.fixTitle}>{fix.title}</Text>
              <Text style={styles.hint}>{fix.desc}</Text>
            </View>
          </View>
        ))}
      </Card>

      {p ? (
        <Card style={styles.card}>
          <View style={styles.auditStatsRow}>
            <StatBig label="Всего товаров" value={String(p.total)} />
            <StatBig label="Видимых" value={String(p.visible)} />
            <StatBig label="Скрытых / арт." value={String(p.hidden)} />
            <StatBig label="С изображением" value={String(p.withImage)} />
          </View>

          <Text style={styles.auditBarLabel}>
            seoTitle — {p.withSeoTitle} из {p.visible} видимых товаров
          </Text>
          <View style={styles.auditBar}>
            <View style={[styles.auditBarFill, { width: `${p.pctTitle}%` }, p.pctTitle >= 80 ? styles.auditBarOk : p.pctTitle >= 40 ? styles.auditBarMid : styles.auditBarBad]} />
          </View>
          <Text style={styles.auditBarPct}>{p.pctTitle}%</Text>

          <Text style={styles.auditBarLabel}>
            seoDescription — {p.withSeoDesc} из {p.visible}
          </Text>
          <View style={styles.auditBar}>
            <View style={[styles.auditBarFill, { width: `${p.pctDesc}%` }, p.pctDesc >= 80 ? styles.auditBarOk : p.pctDesc >= 40 ? styles.auditBarMid : styles.auditBarBad]} />
          </View>
          <Text style={styles.auditBarPct}>{p.pctDesc}%</Text>

          <Text style={styles.auditBarLabel}>
            seoBody (SEO-текст) — {p.withSeoBody} из {p.visible}
          </Text>
          <View style={styles.auditBar}>
            <View style={[styles.auditBarFill, { width: `${p.pctBody}%` }, p.pctBody >= 80 ? styles.auditBarOk : p.pctBody >= 40 ? styles.auditBarMid : styles.auditBarBad]} />
          </View>
          <Text style={styles.auditBarPct}>{p.pctBody}%</Text>

          <View style={styles.auditChips}>
            <AuditChip label={`Без seoTitle (${p.missingTitle.length})`} active={field === "title"} onPress={() => setField("title")} />
            <AuditChip label={`Без seoDesc (${p.missingDesc.length})`} active={field === "desc"} onPress={() => setField("desc")} />
            <AuditChip label={`Без seoBody (${p.missingBody.length})`} active={field === "body"} onPress={() => setField("body")} />
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Поиск по названию или slug..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />

          <View style={styles.auditTableHeader}>
            <Text style={styles.auditTh}>Товар</Text>
            <Text style={styles.auditThRight}>Категория</Text>
          </View>
          {filtered?.map((it) => (
            <View key={it.id} style={styles.auditRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{it.name}</Text>
                <Text style={styles.sub} numberOfLines={1}>/{it.slug}</Text>
              </View>
              <Text style={styles.auditCategory}>{it.category}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

function AuditChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.auditChip, active && styles.auditChipActive]}>
      <Text style={[styles.auditChipText, active && styles.auditChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function StatBig({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBig}>
      <Text style={styles.statBigValue}>{value}</Text>
      <Text style={styles.statBigLabel}>{label}</Text>
    </View>
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
    case "artist":
      return null; // saved separately
    default:
      return null;
  }
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: spacing.sm, padding: spacing.lg },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.textMuted, fontWeight: "600", fontSize: 13 },
  tabTextActive: { color: colors.white },
  treeList: { paddingBottom: spacing.xxl, paddingHorizontal: spacing.lg },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: spacing.sm },
  section: { marginBottom: spacing.md },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sectionLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "700", flex: 1 },
  pageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pageRowSelected: { backgroundColor: colors.accentSoft, borderRadius: radius.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOn: { backgroundColor: colors.success },
  dotOff: { backgroundColor: colors.textMuted + "44" },
  pageLabel: { color: colors.text, fontSize: 14, flex: 1 },
  pageLabelSelected: { color: colors.accent, fontWeight: "600" },
  pad: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  editorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  editorTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  editorSubtitle: { color: colors.textMuted, fontSize: 12 },
  card: { gap: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  saved: { color: colors.success, fontSize: 13 },
  charCount: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  heroSection: { marginTop: spacing.sm },
  heroLabel: { color: colors.text, fontSize: 13, fontWeight: "600", marginBottom: spacing.xs },
  heroInput: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  heroPreviewRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  heroPreview: {
    width: 120,
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  heroActions: { gap: spacing.xs },
  backWrap: { marginTop: spacing.sm },
  auditHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  auditTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  schemaRow: { paddingVertical: spacing.xs },
  schemaLabel: { color: colors.text, fontSize: 13 },
  schemaValue: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  fixRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", paddingVertical: spacing.xs },
  fixTitle: { color: colors.text, fontSize: 13, fontWeight: "500" },
  auditStatsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  statBig: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm, alignItems: "center" },
  statBigValue: { color: colors.text, fontSize: 18, fontWeight: "700" },
  statBigLabel: { color: colors.textMuted, fontSize: 10, marginTop: 2, textAlign: "center" },
  auditBarLabel: { color: colors.text, fontSize: 12, marginTop: spacing.sm },
  auditBar: { height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4, overflow: "hidden", marginTop: 4 },
  auditBarFill: { height: "100%", borderRadius: 4 },
  auditBarOk: { backgroundColor: colors.success },
  auditBarMid: { backgroundColor: colors.warning },
  auditBarBad: { backgroundColor: colors.danger },
  auditBarPct: { color: colors.textMuted, fontSize: 11, textAlign: "right" },
  auditChips: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  auditChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  auditChipActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  auditChipText: { color: colors.textMuted, fontSize: 12 },
  auditChipTextActive: { color: colors.white },
  auditTableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  auditTh: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  auditThRight: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  auditRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  auditCategory: { color: colors.textMuted, fontSize: 12 },
  title: { color: colors.text, fontSize: 14, fontWeight: "600" },
  sub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  wizardProduct: { color: colors.text, fontSize: 13, fontWeight: "600", marginTop: spacing.xs },
  wizardBtnRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  wizardInvite: { borderLeftWidth: 3, borderLeftColor: colors.accent, gap: spacing.sm },
  dupBlock: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 2,
  },
  dupValue: { color: colors.warning, fontSize: 12, fontWeight: "600" },
});
