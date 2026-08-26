import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Badge, Button, Card, EmptyState, InlineError, LoadingView, SearchBar } from "@/components/ui";
import { ListSkeleton } from "@/components/Skeletons";
import { SelectField } from "@/components/SelectField";
import { apiDelete, apiGet, apiPatch, apiPost, getErrorMessage, uploadImage } from "@/lib/api";
import {
  mergeCategoriesWithProducts,
  subcategoriesFor,
  subSubsFor,
  useCategories,
} from "@/lib/categories";
import { asText, formatRub } from "@/lib/format";
import { productImage, productThumb } from "@/lib/images";
import { FEATURE_BADGE_ICON_OPTIONS, featureBadgeIcon } from "@/lib/featureBadgeIcons";
import type { Product } from "@/lib/types";
import { colors, radius, spacing } from "@/constants/theme";

// Нормализация имён подкатегорий/под-подкатегорий — как в веб-админке.
const norm = (s?: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");

const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function makeProductSlug(name: string, id: number): string {
  const transliterated = name
    .toLowerCase()
    .split("")
    .map((char) => CYRILLIC[char] ?? char)
    .join("");
  const slug = transliterated
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return slug || `product-${id}`;
}

function productImageList(product: Product): string[] {
  const raw = Array.isArray(product.images) ? product.images : [];
  const main = product.imageUrl || product.image;
  return Array.from(new Set([...(main ? [main] : []), ...raw].filter((url): url is string => typeof url === "string" && url.trim().length > 0)));
}

interface FilterChip {
  value: string;
  label: string;
  count: number;
}

const addlOf = (p: Product): Array<{ category?: string; subcategory?: string; subSubcategory?: string }> =>
  Array.isArray((p as any).additionalCategories) ? (p as any).additionalCategories : [];

export default function ProductsScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [subSubcategory, setSubSubcategory] = useState<string | null>(null);

  // Selection / bulk
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkMode, setBulkMode] = useState<"badge" | "discount" | null>(null);
  const [bulkValue, setBulkValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolBusy, setToolBusy] = useState<"slugs" | "storage" | "webp" | "smart" | "rollback" | "deleteJpg" | "deleteAll" | null>(null);
  const [toolMessage, setToolMessage] = useState("");
  const [storageReport, setStorageReport] = useState<{
    total: number;
    images: number;
    xml: number;
    hasMore: boolean;
    imageFiles: string[];
  } | null>(null);

  // Шаблоны характеристик товара (как в веб-админке — блок над списком товаров)
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState<Array<{ id: string; icon: string; title: string; description: string }>>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateDraftId, setTemplateDraftId] = useState<string | null>(null);
  const [templateDraftIcon, setTemplateDraftIcon] = useState("Sparkles");
  const [templateDraftTitle, setTemplateDraftTitle] = useState("");
  const [templateDraftDesc, setTemplateDraftDesc] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);

  // Быстрые действия в строке товара (бейдж / скрыть / удалить)
  const [quickId, setQuickId] = useState<number | null>(null);
  const [deleteArmId, setDeleteArmId] = useState<number | null>(null);

  // Bulk: перемещение в категорию / доп. категория
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [moveCat, setMoveCat] = useState("");
  const [moveSub, setMoveSub] = useState("");
  const [moveSubSub, setMoveSubSub] = useState("");
  const [bulkAddlOpen, setBulkAddlOpen] = useState(false);
  const [addlCat, setAddlCat] = useState("");
  const [addlSub, setAddlSub] = useState("");
  const [addlSubSub, setAddlSubSub] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const data = await apiGet<{
        products: Product[];
        total?: number;
        pagination?: { total?: number };
      }>("/products?limit=5000&admin=true");
      setProducts(Array.isArray(data.products) ? data.products : []);
      setTotal(data.pagination?.total ?? data.total ?? data.products?.length ?? 0);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setError("");
    try {
      const data = await apiGet<Record<string, { icon?: string; title?: string; description?: string }>>(
        "/page-settings/product_feature_templates",
      );
      setTemplates(
        Object.entries(data || {}).map(([id, t]) => ({
          id,
          icon: t?.icon || "Sparkles",
          title: t?.title || id,
          description: t?.description || "",
        })),
      );
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadTemplates();
  }, [load, loadTemplates]);

  const resetTemplateDraft = () => {
    setTemplateDraftId(null);
    setTemplateDraftIcon("Sparkles");
    setTemplateDraftTitle("");
    setTemplateDraftDesc("");
  };

  const saveTemplate = async () => {
    if (!templateDraftTitle.trim()) {
      setError("Укажите заголовок шаблона");
      return;
    }
    setTemplateSaving(true);
    setError("");
    try {
      const id = templateDraftId || `badge_${Date.now()}`;
      await apiPost(`/admin/page-settings/product_feature_templates/${id}`, {
        icon: templateDraftIcon,
        title: templateDraftTitle.trim(),
        description: templateDraftDesc.trim(),
      });
      resetTemplateDraft();
      await loadTemplates();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setTemplateSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    setError("");
    try {
      await apiDelete(`/admin/page-settings/product_feature_templates/${id}`);
      await loadTemplates();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  // Быстрые действия в строке
  const toggleQuickBadge = async (p: Product) => {
    setQuickId(p.id);
    setError("");
    setDeleteArmId(null);
    try {
      const isNew = !!p.isNew;
      await apiPatch(`/admin/products/${p.id}`, { isNew: !isNew, badgeText: isNew ? "" : "NEW" });
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setQuickId(null);
    }
  };

  const toggleQuickHidden = async (p: Product) => {
    setQuickId(p.id);
    setError("");
    setDeleteArmId(null);
    try {
      await apiPost(`/products/${p.id}/hide`, { hidden: !p.isHidden });
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setQuickId(null);
    }
  };

  const quickDelete = async (p: Product) => {
    if (deleteArmId !== p.id) {
      setDeleteArmId(p.id);
      return;
    }
    setQuickId(p.id);
    setError("");
    try {
      await apiDelete(`/admin/products/${p.id}`);
      setDeleteArmId(null);
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setQuickId(null);
    }
  };

  const { categories } = useCategories();

  // Слияние конфига с реальными категориями/подкатегориями из товаров —
  // используется и в фильтре, и в перемещении, и в доп. категориях (как на сайте).
  const mergedCategories = useMemo(
    () => mergeCategoriesWithProducts(categories, products),
    [categories, products],
  );

  // Категории фильтра: из конфига (русские имена) + найденные в товарах (в т.ч. доп.категории).
  const categoryChips = useMemo<FilterChip[]>(() => {
    const counts = new Map<string, number>();
    const seen = new Map<string, string>();
    for (const [slug, cat] of Object.entries(categories)) {
      seen.set(slug, cat.name);
    }
    const bump = (v?: string) => {
      if (!v) return;
      if (!seen.has(v)) seen.set(v, v);
      counts.set(v, (counts.get(v) || 0) + 1);
    };
    for (const p of products) {
      bump(String(p.category || ""));
      for (const ac of addlOf(p)) bump(ac.category);
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[1].localeCompare(b[1], "ru"))
      .map(([value, label]) => ({ value, label, count: counts.get(value) || 0 }));
  }, [categories, products]);

  // Подкатегории выбранной категории: конфиг + найденные в товарах.
  const subcategoryChips = useMemo<FilterChip[]>(() => {
    if (!category) return [];
    const counts = new Map<string, number>();
    const names = new Set<string>();
    for (const s of categories[category]?.subcategories || []) names.add(s.name);
    const bump = (c?: string, s?: string) => {
      if (!c || !s || c !== category) return;
      names.add(s);
      counts.set(s, (counts.get(s) || 0) + 1);
    };
    for (const p of products) {
      bump(String(p.category || ""), String(p.subcategory || ""));
      for (const ac of addlOf(p)) bump(ac.category, ac.subcategory);
    }
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b, "ru"))
      .map((name) => ({ value: name, label: name, count: counts.get(name) || 0 }));
  }, [categories, category, products]);

  // Под-подкатегории выбранной подкатегории: конфиг + найденные в товарах.
  const subSubChips = useMemo<FilterChip[]>(() => {
    if (!category || !subcategory) return [];
    const counts = new Map<string, number>();
    const names = new Set<string>();
    const configSub = (categories[category]?.subcategories || []).find((s) => s.name === subcategory);
    for (const ss of configSub?.subSubcategories || []) names.add(ss.name);
    const bump = (c?: string, s?: string, ss?: string) => {
      if (!c || !s || !ss || c !== category || s !== subcategory) return;
      names.add(ss);
      counts.set(ss, (counts.get(ss) || 0) + 1);
    };
    for (const p of products) {
      bump(
        String(p.category || ""),
        String(p.subcategory || ""),
        String((p as any).subSubcategory || ""),
      );
      for (const ac of addlOf(p)) bump(ac.category, ac.subcategory, ac.subSubcategory);
    }
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b, "ru"))
      .map((name) => ({ value: name, label: name, count: counts.get(name) || 0 }));
  }, [categories, category, subcategory, products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const mainCat = String(p.category || "");
      const addl = addlOf(p);
      const inCat = !category || mainCat === category || addl.some((ac) => ac.category === category);
      if (!inCat) return false;
      if (subcategory) {
        const mainSubOk = mainCat === category && norm(p.subcategory) === norm(subcategory);
        const addlSubOk = addl.some(
          (ac) => ac.category === category && norm(ac.subcategory) === norm(subcategory),
        );
        if (!mainSubOk && !addlSubOk) return false;
      }
      if (subcategory && subSubcategory) {
        const mainSsOk =
          mainCat === category &&
          norm(p.subcategory) === norm(subcategory) &&
          norm((p as any).subSubcategory) === norm(subSubcategory);
        const addlSsOk = addl.some(
          (ac) =>
            ac.category === category &&
            norm(ac.subcategory) === norm(subcategory) &&
            norm(ac.subSubcategory) === norm(subSubcategory),
        );
        if (!mainSsOk && !addlSsOk) return false;
      }
      if (!q) return true;
      return (
        (p.name || "").toLowerCase().includes(q) ||
        (p.slug || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q)
      );
    });
  }, [products, query, category, subcategory, subSubcategory]);

  const catLabel = (slug?: string) =>
    slug ? mergedCategories[slug]?.name || categories[slug]?.name || slug : "—";

  const selectCategory = (value: string | null) => {
    setCategory(value);
    setSubcategory(null);
    setSubSubcategory(null);
  };

  const selectSubcategory = (value: string | null) => {
    setSubcategory(value);
    setSubSubcategory(null);
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const exitSelection = () => {
    setSelecting(false);
    setSelected(new Set());
    setBulkMode(null);
    setBulkValue("");
    setConfirmDelete(false);
    setBulkMoveOpen(false);
    setMoveCat("");
    setMoveSub("");
    setMoveSubSub("");
    setBulkAddlOpen(false);
    setAddlCat("");
    setAddlSub("");
    setAddlSubSub("");
  };

  const runBulk = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBusy(true);
    setError("");
    try {
      if (bulkMode === "badge") {
        await apiPatch("/admin/products/bulk-badges", { ids, badgeText: bulkValue || null, isNew: false });
      } else if (bulkMode === "discount") {
        await apiPatch("/admin/products/bulk-discount", { ids, discountPercent: Number(bulkValue) || 0 });
      } else if (confirmDelete) {
        await apiPost("/admin/products/bulk-delete", { ids });
      }
      exitSelection();
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Массовое перемещение в категорию (как на сайте: категория → подкатегория → под-под).
  const applyMove = async () => {
    const ids = Array.from(selected);
    if (!ids.length || !moveCat) return;
    setBusy(true);
    setError("");
    try {
      await apiPatch("/admin/products/category", {
        productIds: ids,
        category: moveCat,
        subcategory: moveSub || undefined,
        subSubcategory: moveSubSub || undefined,
      });
      exitSelection();
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Массовое добавление/удаление доп. категории.
  const applyAddl = async (action: "add" | "remove") => {
    const ids = Array.from(selected);
    if (!ids.length || !addlCat) return;
    setBusy(true);
    setError("");
    try {
      await apiPatch("/admin/products/additional-category", {
        productIds: ids,
        category: addlCat,
        subcategory: addlSub || undefined,
        subSubcategory: addlSubSub || undefined,
        action,
      });
      exitSelection();
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const runSlugFix = async () => {
    setToolBusy("slugs");
    setToolMessage("");
    setError("");
    try {
      const result = await apiPost<{ updated?: number; skipped?: number }>("/backfill-slugs");
      const updated = result.updated ?? 0;
      const skipped = result.skipped ?? 0;
      setToolMessage(`Slug: добавлено ${updated}, уже корректных ${skipped}.`);
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setToolBusy(null);
    }
  };

  const runStorageCheck = async () => {
    setToolBusy("storage");
    setToolMessage("");
    setStorageReport(null);
    setError("");
    try {
      const result = await apiGet<{
        total?: number;
        images?: number;
        xml?: number;
        hasMore?: boolean;
        imageFiles?: string[];
      }>("/storage-files");
      setStorageReport({
        total: result.total ?? 0,
        images: result.images ?? 0,
        xml: result.xml ?? 0,
        hasMore: result.hasMore === true,
        imageFiles: Array.isArray(result.imageFiles) ? result.imageFiles : [],
      });
      setToolMessage("Проверка Object Storage завершена.");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setToolBusy(null);
    }
  };

  const runWebpConversion = async () => {
    setToolBusy("webp");
    setToolMessage("");
    setError("");
    try {
      // Эти маршруты выполняют конвертацию в Object Storage и обновляют URL
      // только после проверки существования WebP-файлов. Это безопаснее, чем
      // повторно загружать удалённые URL из клиента.
      const converted = await apiPost<{
        details?: { converted?: number; failed?: number; remaining?: number; hint?: string };
        message?: string;
      }>("/convert-images-to-webp", undefined, { params: { limit: 40 } });
      const convertedCount = converted.details?.converted ?? 0;
      // Обновляем URL всегда: WebP мог быть создан в предыдущем запуске,
      // а URL товара ещё оставался старым. Серверная операция идемпотентна и
      // переводит только те товары, для которых файл реально существует.
      const updated = await apiPost<{
        message?: string;
        details?: { updated?: number; skipped?: number; alreadyWebp?: number };
      }>("/update-images-to-webp");
      const updatedCount = updated.details?.updated ?? 0;
      setToolMessage(
        `${converted.message || `WebP: сконвертировано ${convertedCount}.`} ${
          updated.message || `URL обновлено: ${updatedCount}.`
        }`,
      );
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setToolBusy(null);
    }
  };

  const runSmartUpdateWebp = async () => {
    setToolBusy("smart");
    setToolMessage("");
    setError("");
    try {
      const res = await apiPost<{ message?: string; details?: { updated?: number; skipped?: number; alreadyWebp?: number } }>("/update-images-to-webp");
      setToolMessage(res.message || `Обновлено: ${res.details?.updated ?? 0} товаров`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setToolBusy(null);
    }
  };

  const runRollbackToJpg = async () => {
    setToolBusy("rollback");
    setToolMessage("");
    setError("");
    try {
      const res = await apiPost<{ details?: { updated?: number } }>("/rollback-images-to-jpg");
      setToolMessage(`Откачено на JPG: ${res.details?.updated ?? 0} товаров`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setToolBusy(null);
    }
  };

  const runDeleteJpg = async () => {
    setToolBusy("deleteJpg");
    setToolMessage("");
    setError("");
    try {
      const res = await apiPost<{ details?: { deleted?: number } }>("/delete-jpg-with-webp", { limit: 100 });
      setToolMessage(`Удалено JPG: ${res.details?.deleted ?? 0} из 100`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setToolBusy(null);
    }
  };

  const runDeleteAllProducts = async () => {
    const ok = window.confirm("⚠️ ВНИМАНИЕ\n\nВсе товары будут УДАЛЕНЫ безвозвратно!\nВы уверены?");
    if (!ok) return;
    setToolBusy("deleteAll");
    setToolMessage("");
    setError("");
    try {
      const res = await apiDelete<{ count?: number }>("/products/all");
      setToolMessage(`Удалено ${res.count ?? 0} товаров`);
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setToolBusy(null);
    }
  };

  const categoryOptions = useMemo(
    () =>
      Object.entries(mergedCategories).map(([slug, c]) => ({ value: slug, label: c.name })),
    [mergedCategories],
  );
  const moveSubs = moveCat ? subcategoriesFor(mergedCategories, moveCat) : [];
  const moveSubSubs = moveSub ? subSubsFor(mergedCategories, moveCat, moveSub) : [];
  const addlSubs = addlCat ? subcategoriesFor(mergedCategories, addlCat) : [];
  const addlSubSubs = addlSub ? subSubsFor(mergedCategories, addlCat, addlSub) : [];

  if (loading) {
    return (
      <Screen title="Товары" scroll={false}>
        <ListSkeleton rows={7} />
      </Screen>
    );
  }

  const headerRight = (
    <View style={styles.headerActions}>
      {selecting ? (
        <Pressable onPress={exitSelection} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>Готово</Text>
        </Pressable>
      ) : (
        <>
          <Pressable
            onPress={() => setSelecting(true)}
            style={styles.headerBtn}
            accessibilityLabel="Выбрать товары"
          >
            <Ionicons name="checkmark-done-outline" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable onPress={() => setToolsOpen((open) => !open)} style={styles.headerBtn} accessibilityLabel="Инструменты товаров">
            <Ionicons name="construct-outline" size={18} color={toolsOpen ? colors.accent : colors.textMuted} />
          </Pressable>
          <Pressable onPress={() => router.push("/products/new" as never)} style={styles.headerBtn}>
            <Ionicons name="add" size={20} color={colors.accent} />
          </Pressable>
        </>
      )}
    </View>
  );

  return (
    <Screen
      title="Товары"
      subtitle={`${filtered.length} из ${total || products.length}${selecting ? ` · выбрано ${selected.size}` : ""}`}
      scroll={false}
      right={headerRight}
    >
      {selecting ? (
        <View style={styles.bulkBar}>
          {bulkMode === null ? (
            bulkMoveOpen || bulkAddlOpen ? (
              <View style={styles.bulkPanel}>
                <SelectField
                  label="Категория"
                  value={bulkMoveOpen ? moveCat : addlCat}
                  options={categoryOptions}
                  placeholder="Выберите категорию"
                  onChange={(v) => {
                    if (bulkMoveOpen) {
                      setMoveCat(v);
                      setMoveSub("");
                      setMoveSubSub("");
                    } else {
                      setAddlCat(v);
                      setAddlSub("");
                      setAddlSubSub("");
                    }
                  }}
                />
                {(bulkMoveOpen ? moveSubs : addlSubs).length > 0 ? (
                  <SelectField
                    label="Подкатегория"
                    value={bulkMoveOpen ? moveSub : addlSub}
                    options={(bulkMoveOpen ? moveSubs : addlSubs).map((s) => ({
                      value: s.name,
                      label: s.name,
                    }))}
                    placeholder="Без подкатегории"
                    emptyLabel="Без подкатегории"
                    onChange={(v) => {
                      if (bulkMoveOpen) {
                        setMoveSub(v);
                        setMoveSubSub("");
                      } else {
                        setAddlSub(v);
                        setAddlSubSub("");
                      }
                    }}
                  />
                ) : null}
                {(bulkMoveOpen ? moveSubSubs : addlSubSubs).length > 0 &&
                (bulkMoveOpen ? moveSub : addlSub) ? (
                  <SelectField
                    label="Под-подкатегория"
                    value={bulkMoveOpen ? moveSubSub : addlSubSub}
                    options={(bulkMoveOpen ? moveSubSubs : addlSubSubs).map((s) => ({
                      value: s.name,
                      label: s.name,
                    }))}
                    placeholder="Без под-подкатегории"
                    emptyLabel="Без под-подкатегории"
                    onChange={(v) =>
                      bulkMoveOpen ? setMoveSubSub(v) : setAddlSubSub(v)
                    }
                  />
                ) : null}
                <View style={styles.bulkRow}>
                  {bulkMoveOpen ? (
                    <Button
                      title={`Переместить (${selected.size})`}
                      onPress={applyMove}
                      loading={busy}
                      disabled={!moveCat}
                      icon="folder-open-outline"
                    />
                  ) : (
                    <>
                      <Button
                        title="Добавить"
                        onPress={() => applyAddl("add")}
                        loading={busy}
                        disabled={!addlCat}
                        icon="add"
                      />
                      <Button
                        title="Убрать"
                        onPress={() => applyAddl("remove")}
                        loading={busy}
                        disabled={!addlCat}
                        variant="danger"
                        icon="remove"
                      />
                    </>
                  )}
                  <Button
                    title="Отмена"
                    onPress={() => {
                      setBulkMoveOpen(false);
                      setBulkAddlOpen(false);
                    }}
                    variant="ghost"
                  />
                </View>
              </View>
            ) : (
              <View style={styles.bulkRow}>
                <Button title="Переместить" onPress={() => setBulkMoveOpen(true)} variant="secondary" icon="folder-open-outline" />
                <Button title="Доп. кат." onPress={() => setBulkAddlOpen(true)} variant="secondary" icon="albums-outline" />
                <Button title="Бейдж" onPress={() => setBulkMode("badge")} variant="secondary" icon="pricetag-outline" />
                <Button title="Скидка" onPress={() => setBulkMode("discount")} variant="secondary" icon="pricetags-outline" />
                <Button
                  title={confirmDelete ? "Точно удалить?" : "Удалить"}
                  onPress={() => (confirmDelete ? runBulk() : setConfirmDelete(true))}
                  variant="danger"
                  icon="trash-outline"
                  loading={busy && confirmDelete}
                />
              </View>
            )
          ) : (
            <View style={styles.bulkRow}>
              <TextInput
                value={bulkValue}
                onChangeText={setBulkValue}
                placeholder={bulkMode === "badge" ? "Текст бейджа (NEW…)" : "Скидка %"}
                placeholderTextColor={colors.textMuted}
                keyboardType={bulkMode === "discount" ? "numeric" : "default"}
                style={styles.bulkInput}
              />
              <Button title="Применить" onPress={runBulk} loading={busy} />
              <Button title="Отмена" onPress={() => setBulkMode(null)} variant="ghost" />
            </View>
          )}
        </View>
      ) : null}

      {toolsOpen ? (
        <Card style={styles.toolsCard}>
          <View style={styles.toolsHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toolsTitle}>Инструменты товаров</Text>
              <Text style={styles.toolsHint}>
                Slug, WebP и проверка хранилища используют реальные серверные инструменты сайта и работают со всем каталогом. Конвертация идёт партиями и не меняет URL, пока WebP-файл не проверен.
              </Text>
            </View>
            <Badge tone="neutral">весь каталог</Badge>
          </View>
          <View style={styles.toolsActions}>
            <Button title="Заполнить slug" onPress={runSlugFix} loading={toolBusy === "slugs"} disabled={toolBusy !== null} icon="link-outline" />
            <Button title="Проверить хранилище" variant="secondary" onPress={runStorageCheck} loading={toolBusy === "storage"} disabled={toolBusy !== null} icon="server-outline" />
            <Button title="Конвертировать в WebP" variant="secondary" onPress={runWebpConversion} loading={toolBusy === "webp"} disabled={toolBusy !== null} icon="images-outline" />
            <Button title="Умное обновление WebP" variant="secondary" onPress={runSmartUpdateWebp} loading={toolBusy === "smart"} disabled={toolBusy !== null} icon="sync-outline" />
            <Button title="Откатить на JPG" variant="secondary" onPress={runRollbackToJpg} loading={toolBusy === "rollback"} disabled={toolBusy !== null} icon="refresh-outline" />
            <Button title="Удалить JPG (умно)" variant="danger" onPress={runDeleteJpg} loading={toolBusy === "deleteJpg"} disabled={toolBusy !== null} icon="trash-outline" />
            <Button title="Удалить ВСЕ товары" variant="danger" onPress={runDeleteAllProducts} loading={toolBusy === "deleteAll"} disabled={toolBusy !== null} icon="trash-outline" />
          </View>
          {storageReport ? (
            <Text style={styles.toolReport}>
              Object Storage: {storageReport.total} файлов · изображений {storageReport.images} · XML {storageReport.xml}
              {storageReport.hasMore ? " · показаны первые 100 изображений" : ""}
            </Text>
          ) : null}
          {toolMessage ? <Text style={styles.toolSuccess}>{toolMessage}</Text> : null}
          <InlineError text={error} />
        </Card>
      ) : null}

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      <FlatList
        data={filtered}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={styles.listContent}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Card style={styles.templatesCard}>
              <Pressable onPress={() => setTemplatesOpen((o) => !o)} style={styles.templatesHeader}>
                <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
                <Text style={styles.templatesTitle}>Шаблоны характеристик товара ({templates.length})</Text>
                <Ionicons name={templatesOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
              </Pressable>
              {templatesOpen ? (
                <View style={styles.templatesBody}>
                  <Text style={styles.templatesHint}>
                    Шаблон — это иконка + заголовок + подпись (например «100% хлопок» / «Приятная к телу»). Создайте один раз, дальше просто отмечайте нужные шаблоны у каждого товара.
                  </Text>
                  {!templatesLoading && templates.length === 0 ? (
                    <Text style={styles.templatesEmpty}>Пока нет ни одного шаблона.</Text>
                  ) : null}
                  {templates.map((t) => (
                    <View key={t.id} style={styles.templateRow}>
                      <View style={styles.templateIcon}>
                        <Ionicons name={featureBadgeIcon(t.icon)} size={16} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.templateTitle} numberOfLines={1}>{t.title}</Text>
                        {t.description ? (
                          <Text style={styles.templateSub} numberOfLines={1}>{t.description}</Text>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => {
                          setTemplateDraftId(t.id);
                          setTemplateDraftIcon(t.icon);
                          setTemplateDraftTitle(t.title);
                          setTemplateDraftDesc(t.description);
                        }}
                        hitSlop={8}
                        style={styles.templateBtn}
                        accessibilityLabel="Изменить шаблон"
                      >
                        <Ionicons name="create-outline" size={16} color={colors.textMuted} />
                      </Pressable>
                      <Pressable onPress={() => deleteTemplate(t.id)} hitSlop={8} style={styles.templateBtn} accessibilityLabel="Удалить шаблон">
                        <Ionicons name="trash-outline" size={16} color={colors.danger} />
                      </Pressable>
                    </View>
                  ))}
                  <View style={styles.templateForm}>
                    <Text style={styles.templateFormTitle}>
                      {templateDraftId ? "Редактировать шаблон" : "Новый шаблон"}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateIcons}>
                      {FEATURE_BADGE_ICON_OPTIONS.map((o) => (
                        <Pressable
                          key={o.name}
                          onPress={() => setTemplateDraftIcon(o.name)}
                          style={[styles.templateIconBtn, templateDraftIcon === o.name && styles.templateIconBtnActive]}
                          accessibilityLabel={o.label}
                        >
                          <Ionicons name={o.icon} size={18} color={templateDraftIcon === o.name ? colors.white : colors.textMuted} />
                        </Pressable>
                      ))}
                    </ScrollView>
                    <TextInput
                      value={templateDraftTitle}
                      onChangeText={setTemplateDraftTitle}
                      placeholder="Заголовок, например: 100% хлопок"
                      placeholderTextColor={colors.textMuted}
                      style={styles.templateFormInput}
                    />
                    <TextInput
                      value={templateDraftDesc}
                      onChangeText={setTemplateDraftDesc}
                      placeholder="Подпись, например: Приятная к телу"
                      placeholderTextColor={colors.textMuted}
                      style={styles.templateFormInput}
                    />
                    <View style={styles.templateFormActions}>
                      <Button
                        title={templateDraftId ? "Сохранить изменения" : "Добавить шаблон"}
                        onPress={saveTemplate}
                        loading={templateSaving}
                        icon="save-outline"
                      />
                      {templateDraftId ? (
                        <Button title="Отмена" variant="ghost" onPress={resetTemplateDraft} />
                      ) : null}
                    </View>
                  </View>
                </View>
              ) : null}
            </Card>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Поиск по названию, slug или артикулу"
            />
            {categoryChips.length > 0 ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chips}
                >
                  <Chip label="Все" active={category === null} onPress={() => selectCategory(null)} />
                  {categoryChips.map((c) => (
                    <Chip
                      key={c.value}
                      label={c.count > 0 ? `${c.label} · ${c.count}` : c.label}
                      active={category === c.value}
                      onPress={() => selectCategory(category === c.value ? null : c.value)}
                    />
                  ))}
                </ScrollView>
                {subcategoryChips.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsSub}
                  >
                    {subcategoryChips.map((s) => (
                      <Chip
                        key={s.value}
                        label={s.count > 0 ? `${s.label} · ${s.count}` : s.label}
                        active={subcategory === s.value}
                        onPress={() => selectSubcategory(subcategory === s.value ? null : s.value)}
                      />
                    ))}
                  </ScrollView>
                ) : null}
                {subSubChips.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsSub}
                  >
                    {subSubChips.map((s) => (
                      <Chip
                        key={s.value}
                        label={s.count > 0 ? `${s.label} · ${s.count}` : s.label}
                        active={subSubcategory === s.value}
                        onPress={() => setSubSubcategory(subSubcategory === s.value ? null : s.value)}
                      />
                    ))}
                  </ScrollView>
                ) : null}
              </>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <Pressable
              onPress={() =>
                selecting ? toggleSelect(item.id) : router.push(`/products/${item.id}` as never)
              }
              style={({ pressed }) => [
                styles.row,
                pressed && { opacity: 0.7 },
                isSelected && styles.rowSelected,
              ]}
            >
              {selecting ? (
                <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                  {isSelected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                </View>
              ) : null}
              {productThumb(item) ? (
                <Image
                  source={{ uri: productThumb(item) }}
                  style={styles.thumb}
                  contentFit="cover"
                  transition={100}
                />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.rowBody}>
                <Text style={styles.name} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.meta}>
                  #{item.id}
                  {item.slug ? ` · ${item.slug}` : ""}
                </Text>
                <Text style={styles.meta}>
                  {catLabel(item.category)}
                  {item.subcategory ? ` · ${item.subcategory}` : ""}
                  {(item as any).subSubcategory ? ` · ${(item as any).subSubcategory}` : ""}
                </Text>
                <Text style={styles.price}>{formatRub(item.price)}</Text>
              </View>
              {!selecting ? (
                <View style={styles.badges}>
                  {item.isHidden ? <Badge tone="warning">скрыт</Badge> : null}
                  {asText(item.badgeText) || asText(item.badge) ? (
                    <Badge tone="accent">{asText(item.badgeText) || asText(item.badge)}</Badge>
                  ) : null}
                  {Number(item.stock) <= 0 ? <Badge tone="danger">нет</Badge> : null}
                </View>
              ) : null}
              {!selecting ? (
                <View style={styles.quickActions}>
                  <Pressable
                    onPress={() => toggleQuickBadge(item)}
                    disabled={quickId === item.id}
                    style={styles.quickBtn}
                    hitSlop={4}
                    accessibilityLabel={item.isNew ? "Убрать бейдж" : "Добавить бейдж"}
                  >
                    <Ionicons name="pricetag" size={15} color={item.isNew ? colors.accent : colors.textMuted} />
                  </Pressable>
                  <Pressable
                    onPress={() => toggleQuickHidden(item)}
                    disabled={quickId === item.id}
                    style={styles.quickBtn}
                    hitSlop={4}
                    accessibilityLabel={item.isHidden ? "Показать товар" : "Скрыть товар"}
                  >
                    <Ionicons name={item.isHidden ? "eye-outline" : "eye-off-outline"} size={15} color={item.isHidden ? colors.warning : colors.textMuted} />
                  </Pressable>
                  <Pressable
                    onPress={() => quickDelete(item)}
                    disabled={quickId === item.id}
                    style={[styles.quickBtn, deleteArmId === item.id && styles.quickBtnDanger]}
                    hitSlop={4}
                    accessibilityLabel={deleteArmId === item.id ? "Точно удалить?" : "Удалить товар"}
                  >
                    <Ionicons
                      name={deleteArmId === item.id ? "checkmark" : "trash-outline"}
                      size={15}
                      color={deleteArmId === item.id ? colors.danger : colors.textMuted}
                    />
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState text={error ? "Ошибка загрузки" : "Ничего не найдено"} />
        }
      />
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: "row", gap: spacing.xs },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnText: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  bulkBar: {
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  bulkRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" },
  bulkPanel: { gap: spacing.sm },
  bulkInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 14,
  },
  errorBanner: { color: colors.danger, fontSize: 13, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  listContent: { paddingBottom: spacing.xxl },
  headerBlock: {
    padding: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  chipsSub: { gap: spacing.sm, paddingRight: spacing.lg, paddingLeft: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: 13 },
  chipTextActive: { color: colors.white, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  rowSelected: { backgroundColor: colors.accentSoft },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: "600" },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  price: { color: colors.accent, fontSize: 14, fontWeight: "700", marginTop: 2 },
  badges: { alignItems: "flex-end", gap: 4 },
  toolsCard: { marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm },
  toolsHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.md },
  toolsTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  toolsHint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: spacing.xs },
  toolsActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  toolReport: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: spacing.md },
  toolSuccess: { color: colors.success, fontSize: 13, marginTop: spacing.sm },
  templatesCard: { marginBottom: spacing.md },
  templatesHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  templatesTitle: { color: colors.text, fontSize: 14, fontWeight: "700", flex: 1 },
  templatesBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  templatesHint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  templatesEmpty: { color: colors.textMuted, fontSize: 12, fontStyle: "italic" },
  templateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  templateIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  templateTitle: { color: colors.text, fontSize: 13, fontWeight: "600" },
  templateSub: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  templateBtn: { padding: 4 },
  templateForm: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  templateFormTitle: { color: colors.text, fontSize: 13, fontWeight: "700" },
  templateIcons: { gap: spacing.sm, paddingRight: spacing.lg },
  templateIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  templateIconBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  templateFormInput: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 14,
  },
  templateFormActions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  quickActions: { alignItems: "center", gap: spacing.xs },
  quickBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  quickBtnDanger: { backgroundColor: "#2a1114" },
});
