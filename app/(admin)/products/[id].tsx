import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { DragList } from "@/components/DragList";
import { DropZone } from "@/components/DropZone";
import { Accordion } from "@/components/Accordion";
import { Button, Card, Field, InlineError, LoadingView, SectionTitle, SeoCounter } from "@/components/ui";
import { SelectField } from "@/components/SelectField";
import { SizesEditor, type SizesValue } from "@/components/SizesEditor";
import { FeatureBadgesEditor } from "@/components/FeatureBadgesEditor";
import {
  AdditionalCategoriesEditor,
  type AdditionalCategory,
} from "@/components/AdditionalCategoriesEditor";
import {
  MeasurementsEditor,
  type MeasurementRow,
  type MeasurementSection,
} from "@/components/MeasurementsEditor";
import { apiDelete, apiGet, apiPatch, getErrorMessage, uploadImage } from "@/lib/api";
import { recordRecent } from "@/lib/recent";
import { registerHotkey } from "@/lib/hotkeys";
import { Platform } from "react-native";
import { asText } from "@/lib/format";
import {
  mergeCategoriesWithProducts,
  subcategoriesFor,
  subSubsFor,
  useCategories,
} from "@/lib/categories";
import type { Product } from "@/lib/types";
import { colors, radius, spacing } from "@/constants/theme";

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string") {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function parseComma(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function numToStr(value: unknown, div = 1): string {
  const n = Number(value);
  return n && !Number.isNaN(n) ? String(n / div) : "";
}

function recordOf(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const n = Number(v);
    if (!Number.isNaN(n)) out[k] = n;
  }
  return out;
}

interface FormState {
  name: string;
  sku: string;
  color: string;
  category: string;
  subcategory: string;
  subSubcategory: string;
  slug: string;
  price: string;
  wholesalePrice: string;
  wholesaleDiscountPercent: string;
  discountPercent: string;
  salePrice: string;
  stock: string;
  isNew: boolean;
  badgeText: string;
  description: string;
  composition: string;
  careInstructions: string;
  note: string;
  delivery: string;
  returnPolicy: string;
  specsHtml: string;
  seoTitle: string;
  seoDescription: string;
  seoBody: string;
  seoJsonLd: string;
  imageAlts: string;
  videoUrl: string;
  preorderEnabled: boolean;
  preorderDeadline: string;
  preorderProductionDate: string;
  preorderShippingDate: string;
  preorderGroup: string;
  artistSlug: string;
  lookProducts: string;
  lookCategory: string;
  lookSubcategory: string;
}

const EMPTY: FormState = {
  name: "",
  sku: "",
  color: "",
  category: "",
  subcategory: "",
  subSubcategory: "",
  slug: "",
  price: "",
  wholesalePrice: "",
  wholesaleDiscountPercent: "",
  discountPercent: "",
  salePrice: "",
  stock: "",
  isNew: false,
  badgeText: "",
  description: "",
  composition: "",
  careInstructions: "",
  note: "",
  delivery: "",
  returnPolicy: "",
  specsHtml: "",
  seoTitle: "",
  seoDescription: "",
  seoBody: "",
  seoJsonLd: "",
  imageAlts: "",
  videoUrl: "",
  preorderEnabled: false,
  preorderDeadline: "",
  preorderProductionDate: "",
  preorderShippingDate: "",
  preorderGroup: "",
  artistSlug: "",
  lookProducts: "",
  lookCategory: "",
  lookSubcategory: "",
};

const EMPTY_SIZES: SizesValue = {
  sizes: [],
  sizeStock: {},
  sizeDiscounts: {},
  disabledNotifySizes: [],
  noSize: false,
};

function productToForm(p: Product): FormState {
  return {
    name: asText(p.name),
    sku: asText(p.sku),
    color: asText(p.color),
    category: asText(p.category),
    subcategory: asText(p.subcategory),
    subSubcategory: asText(p.subSubcategory),
    slug: asText(p.slug),
    price: numToStr(p.price, 100),
    wholesalePrice: numToStr(p.wholesalePrice, 100),
    wholesaleDiscountPercent: numToStr(p.wholesaleDiscountPercent),
    discountPercent: numToStr(p.discountPercent),
    salePrice: numToStr(p.salePrice, 100),
    stock: numToStr(p.stock),
    isNew: !!p.isNew,
    badgeText: asText(p.badgeText) || asText(p.badge),
    description: asText(p.description),
    composition: asText(p.composition),
    careInstructions: asText(p.careInstructions),
    note: asText(p.note),
    delivery: asText(p.delivery),
    returnPolicy: asText(p.returnPolicy),
    specsHtml: asText(p.specsHtml),
    seoTitle: asText(p.seoTitle),
    seoDescription: asText(p.seoDescription),
    seoBody: asText(p.seoBody),
    seoJsonLd: asText(p.seoJsonLd),
    imageAlts: Array.isArray(p.imageAlts) ? (p.imageAlts as string[]).join("\n") : "",
    videoUrl: asText(p.videoUrl),
    preorderEnabled: !!p.preorderEnabled,
    preorderDeadline: asText(p.preorderDeadline),
    preorderProductionDate: asText(p.preorderProductionDate),
    preorderShippingDate: asText(p.preorderShippingDate),
    preorderGroup: asText(p.preorderGroup),
    artistSlug: asText(p.artistSlug),
    lookProducts: Array.isArray(p.lookProducts)
      ? (p.lookProducts as number[]).map(String).join(", ")
      : "",
    lookCategory: asText(p.lookCategory),
    lookSubcategory: asText(p.lookSubcategory),
  };
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { categories } = useCategories();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [sizes, setSizes] = useState<SizesValue>(EMPTY_SIZES);
  const [featureBadgeIds, setFeatureBadgeIds] = useState<string[]>([]);
  const [additionalCategories, setAdditionalCategories] = useState<AdditionalCategory[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementRow[]>([]);
  const [measurementSections, setMeasurementSections] = useState<MeasurementSection[]>([]);
  const [measurementLabels, setMeasurementLabels] = useState<Record<string, string>>({});
  const [campaigns, setCampaigns] = useState<{ value: string; label: string }[]>([]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<Product>(`/admin/products/${id}`);
        setProduct(data);
        void recordRecent("product", Number(id), data.name || `Товар #${id}`);
        setForm(productToForm(data));
        setSizes({
          sizes: toArray(data.sizes),
          sizeStock: recordOf(data.sizeStock),
          sizeDiscounts: recordOf(data.sizeDiscounts),
          disabledNotifySizes: Array.isArray(data.disabledNotifySizes)
            ? (data.disabledNotifySizes as string[])
            : [],
          noSize: !!data.noSize,
        });
        setFeatureBadgeIds(Array.isArray(data.featureBadgeIds) ? (data.featureBadgeIds as string[]) : []);
        setAdditionalCategories(
          Array.isArray(data.additionalCategories) ? (data.additionalCategories as AdditionalCategory[]) : [],
        );
        setMeasurements(Array.isArray(data.measurements) ? (data.measurements as MeasurementRow[]) : []);
        setMeasurementSections(
          Array.isArray(data.measurementSections) ? (data.measurementSections as MeasurementSection[]) : [],
        );
        setMeasurementLabels((data.measurementLabels as Record<string, string>) || {});
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<{ slug: string; title: string }[]>("/admin/preorder/campaigns");
        setCampaigns(
          (data || []).map((c) => ({
            value: c.slug,
            label: c.title && c.title !== c.slug ? `${c.title} (${c.slug})` : c.slug,
          })),
        );
      } catch {
        setCampaigns([]);
      }
    })();
  }, []);

  const images = useMemo(() => {
    const arr = (product?.images as string[] | undefined) || [];
    const main = product?.imageUrl || product?.image;
    if (main && !arr.includes(main)) return [main, ...arr];
    return arr;
  }, [product]);

  // Слияние конфига с данными самого товара — чтобы текущие значения категорий
  // (например «Спортивные (40-45)» у носков, отсутствующие в конфиге) не терялись.
  const mergedCategories = useMemo(
    () => mergeCategoriesWithProducts(categories, product ? [product] : []),
    [categories, product],
  );
  const subcategories = form.category
    ? subcategoriesFor(mergedCategories, form.category)
    : [];
  const subSubs = form.subcategory
    ? subSubsFor(mergedCategories, form.category, form.subcategory)
    : [];

  if (loading) {
    return (
      <Screen title="Товар" scroll={false}>
        <LoadingView />
      </Screen>
    );
  }

  const toInt = (v: string, fallback = 0) => {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? fallback : n;
  };
  const toKopeks = (v: string) => Math.round((parseFloat(v) || 0) * 100);

  const onSizesChange = (next: SizesValue) => {
    setSizes(next);
    // Общий остаток = сумма остатков по размерам (как на сайте).
    if (next.sizes.length > 0) {
      const total = Object.values(next.sizeStock).reduce((a, b) => a + b, 0);
      setForm((f) => ({ ...f, stock: String(total) }));
    }
  };

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        description: form.description,
        price: toKopeks(form.price),
        category: form.category,
        subcategory: form.subcategory || null,
        subSubcategory: form.subSubcategory || null,
        additionalCategories,
        sku: form.sku,
        color: form.color,
        sizes: sizes.sizes,
        composition: form.composition,
        careInstructions: form.careInstructions,
        note: form.note,
        delivery: form.delivery,
        returnPolicy: form.returnPolicy,
        specsHtml: form.specsHtml,
        seoTitle: form.seoTitle,
        seoDescription: form.seoDescription,
        seoBody: form.seoBody,
        seoJsonLd: form.seoJsonLd,
        imageAlts: form.imageAlts.split("\n").map((s) => s.trim()).filter(Boolean),
        videoUrl: form.videoUrl || null,
        slug: form.slug || undefined,
        wholesalePrice: form.wholesalePrice ? toKopeks(form.wholesalePrice) : undefined,
        wholesaleDiscountPercent: toInt(form.wholesaleDiscountPercent),
        discountPercent: toInt(form.discountPercent),
        salePrice: form.salePrice ? toKopeks(form.salePrice) : null,
        stock: form.stock !== "" ? toInt(form.stock) : undefined,
        noSize: sizes.noSize,
        isNew: form.isNew,
        badgeText: form.badgeText || null,
        sizeStock: Object.keys(sizes.sizeStock).length > 0 ? sizes.sizeStock : undefined,
        sizeDiscounts: sizes.sizeDiscounts,
        disabledNotifySizes: sizes.disabledNotifySizes.length > 0 ? sizes.disabledNotifySizes : undefined,
        preorderEnabled: form.preorderEnabled,
        preorderDeadline: form.preorderDeadline || null,
        preorderProductionDate: form.preorderProductionDate || null,
        preorderShippingDate: form.preorderShippingDate || null,
        preorderGroup: form.preorderGroup || null,
        artistSlug: form.artistSlug || null,
        lookProducts: parseComma(form.lookProducts).map(Number).filter((n) => n > 0),
        lookCategory: form.lookCategory || null,
        lookSubcategory: form.lookSubcategory || null,
        featureBadgeIds,
        measurements: measurementSections.length > 0 ? [] : measurements.length > 0 ? measurements : undefined,
        measurementSections,
      };

      const res = await apiPatch<{ success: boolean; product: Product }>(
        `/admin/products/${id}`,
        body,
      );
      const updated = res.product;
      setProduct(updated);
      setForm(productToForm(updated));
      setSizes({
        sizes: toArray(updated.sizes),
        sizeStock: recordOf(updated.sizeStock),
        sizeDiscounts: recordOf(updated.sizeDiscounts),
        disabledNotifySizes: Array.isArray(updated.disabledNotifySizes) ? (updated.disabledNotifySizes as string[]) : [],
        noSize: !!updated.noSize,
      });
      setError("");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  // ПК: Ctrl+S — сохранить товар.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    return registerHotkey("product-save", { key: "s", ctrl: true }, () => void save(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setError("");
    setSaving(true);
    try {
      await apiDelete(`/admin/products/${id}`);
      router.back();
    } catch (e) {
      setError(getErrorMessage(e));
      setSaving(false);
    }
  };

  // ПК: файлы, перетащенные из проводника.
  const addDroppedImages = async (files: { uri: string; name: string }[]) => {
    setUploading(true);
    setError("");
    try {
      const urls: string[] = [];
      for (const file of files.slice(0, 8)) {
        urls.push(await uploadImage(file.uri, file.name || undefined));
      }
      const nextImages = [...images, ...urls];
      await apiPatch(`/admin/products/${id}`, { images: nextImages });
      setProduct((prev) => (prev ? { ...prev, images: nextImages, imageUrl: nextImages[0] } : prev));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Нужен доступ к фото");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsMultipleSelection: true,
    });
    if (result.canceled || !result.assets?.length) return;

    setUploading(true);
    setError("");
    try {
      const urls: string[] = [];
      for (const asset of result.assets.slice(0, 8)) {
        urls.push(await uploadImage(asset.uri, asset.fileName || undefined));
      }
      const nextImages = [...images, ...urls];
      await apiPatch(`/admin/products/${id}`, { images: nextImages });
      setProduct((prev) => (prev ? { ...prev, images: nextImages, imageUrl: nextImages[0] } : prev));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (idx: number) => {
    setError("");
    try {
      const nextImages = images.filter((_, i) => i !== idx);
      await apiPatch(`/admin/products/${id}`, { images: nextImages });
      setProduct((prev) => (prev ? { ...prev, images: nextImages, imageUrl: nextImages[0] } : prev));
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const moveImage = async (idx: number, dir: -1 | 1) => {
    const to = idx + dir;
    if (to < 0 || to >= images.length) return;
    setError("");
    try {
      const nextImages = [...images];
      [nextImages[idx], nextImages[to]] = [nextImages[to], nextImages[idx]];
      await apiPatch(`/admin/products/${id}`, { images: nextImages, imageUrl: nextImages[0] });
      setProduct((prev) => (prev ? { ...prev, images: nextImages, imageUrl: nextImages[0] } : prev));
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const reorderImages = async (nextImages: string[]) => {
    if (nextImages.length === images.length && nextImages.every((uri, i) => uri === images[i])) {
      return;
    }
    setError("");
    try {
      await apiPatch(`/admin/products/${id}`, { images: nextImages, imageUrl: nextImages[0] });
      setProduct((prev) => (prev ? { ...prev, images: nextImages, imageUrl: nextImages[0] } : prev));
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const categoryOptions = Object.entries(mergedCategories).map(([slug, c]) => ({
    value: slug,
    label: c.name,
  }));

  return (
    <Screen title={form.name || "Товар"} subtitle={`ID ${id}`} scroll>
      <InlineError text={error} />

      <DropZone
        onFiles={addDroppedImages}
        hint="Отпустите, чтобы загрузить фото"
        style={styles.photosCard}
      >
      <Card style={styles.photosCardInner}>
        <SectionTitle>Фото</SectionTitle>
        <Text style={styles.hint}>
          Удерживайте фото и перетаскивайте, чтобы изменить порядок. Первое фото — главное.
        </Text>
        <DragList
          items={images}
          keyExtractor={(uri) => uri}
          onReorder={reorderImages}
          itemHeight={76}
          gap={10}
          renderItem={(uri, i) => (
            <View style={styles.imgRow}>
              <Ionicons name="reorder-three-outline" size={20} color={colors.textMuted} />
              <Image source={{ uri }} style={styles.image} contentFit="cover" />
              <View style={styles.imgMeta}>
                <Text style={styles.imgName} numberOfLines={1}>
                  Фото {i + 1}
                </Text>
                {i === 0 ? <Text style={styles.imgMain}>Главное фото</Text> : null}
              </View>
              <View style={styles.imgArrowCol}>
                <Pressable
                  style={[styles.imgMoveBtn, i === 0 && styles.imgMoveDisabled]}
                  disabled={i === 0}
                  onPress={() => moveImage(i, -1)}
                  hitSlop={4}
                >
                  <Ionicons name="chevron-up" size={14} color={i === 0 ? colors.textMuted : colors.text} />
                </Pressable>
                <Pressable
                  style={[styles.imgMoveBtn, i === images.length - 1 && styles.imgMoveDisabled]}
                  disabled={i === images.length - 1}
                  onPress={() => moveImage(i, 1)}
                  hitSlop={4}
                >
                  <Ionicons name="chevron-down" size={14} color={i === images.length - 1 ? colors.textMuted : colors.text} />
                </Pressable>
              </View>
              <Pressable style={styles.removeImg} onPress={() => removeImage(i)} hitSlop={8}>
                <Ionicons name="close" size={18} color={colors.danger} />
              </Pressable>
            </View>
          )}
        />
        {images.length < 10 ? (
          <Pressable style={styles.addImage} onPress={pickImage} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <>
                <Ionicons name="add" size={20} color={colors.accent} />
                <Text style={styles.addImageText}>Добавить фото</Text>
              </>
            )}
          </Pressable>
        ) : null}
        {uploading ? <Text style={styles.hint}>Загрузка…</Text> : null}
      </Card>
      </DropZone>

      <Accordion title="Основное" icon="cube-outline" defaultOpen>
        <Field label="Название *" value={form.name} onChangeText={(v) => set("name", v)} />
        <View style={styles.row2}>
          <View style={styles.col}>
            <Field label="Цена, ₽" value={form.price} onChangeText={(v) => set("price", v)} keyboardType="numeric" />
          </View>
          <View style={styles.col}>
            <Field label="Скидка %" value={form.discountPercent} onChangeText={(v) => set("discountPercent", v)} keyboardType="numeric" />
          </View>
        </View>
        <View style={styles.row2}>
          <View style={styles.col}>
            <Field label="Цена со скидкой, ₽" value={form.salePrice} onChangeText={(v) => set("salePrice", v)} keyboardType="numeric" />
          </View>
          <View style={styles.col}>
            <Field label="Остаток (шт)" value={form.stock} onChangeText={(v) => set("stock", v)} keyboardType="numeric" />
          </View>
        </View>
        <View style={styles.row2}>
          <View style={styles.col}>
            <Field label="Оптовая цена, ₽" value={form.wholesalePrice} onChangeText={(v) => set("wholesalePrice", v)} keyboardType="numeric" />
          </View>
          <View style={styles.col}>
            <Field label="Оптовая скидка %" value={form.wholesaleDiscountPercent} onChangeText={(v) => set("wholesaleDiscountPercent", v)} keyboardType="numeric" />
          </View>
        </View>
        <SelectField
          label="Категория *"
          value={form.category}
          options={categoryOptions}
          placeholder="Выберите категорию"
          onChange={(v) => {
            set("category", v);
            // Как на сайте: при смене категории сбрасываем подкатегорию и под-подкатегорию
            set("subcategory", "");
            set("subSubcategory", "");
          }}
        />
        {subcategories.length > 0 ? (
          <SelectField
            label="Подкатегория"
            value={form.subcategory}
            options={subcategories.map((s) => ({ value: s.name, label: s.name }))}
            placeholder="Без подкатегории"
            onChange={(v) => {
              set("subcategory", v || "");
              // Как на сайте: при смене подкатегории сбрасываем под-подкатегорию
              set("subSubcategory", "");
            }}
          />
        ) : (
          <Field
            label="Подкатегория"
            value={form.subcategory}
            onChangeText={(v) => {
              set("subcategory", v);
              set("subSubcategory", "");
            }}
            placeholder="Футболки"
          />
        )}
        {subSubs.length > 0 && form.subcategory ? (
          <SelectField
            label="Под-подкатегория"
            value={form.subSubcategory}
            options={subSubs.map((s) => ({ value: s.name, label: s.name }))}
            placeholder="Без под-подкатегории"
            onChange={(v) => set("subSubcategory", v || "")}
          />
        ) : null}
        <Field label="Цвет" value={form.color} onChangeText={(v) => set("color", v)} />
        <Field label="Артикул (SKU)" value={form.sku} onChangeText={(v) => set("sku", v)} />
        <Field label="Slug" value={form.slug} onChangeText={(v) => set("slug", v)} autoCapitalize="none" />
        <Field label="Бейдж (NEW…)" value={form.badgeText} onChangeText={(v) => set("badgeText", v)} />
        <Toggle label="Новинка" value={form.isNew} onValueChange={(v) => set("isNew", v)} />
      </Accordion>

      <Accordion
        title="Размеры"
        icon="resize-outline"
        badge={<BadgeCount>{sizes.sizes.length ? String(sizes.sizes.length) : ""}</BadgeCount>}
        defaultOpen
      >
        <SizesEditor
          value={sizes}
          onChange={onSizesChange}
          priceKopeks={toKopeks(form.price)}
        />
      </Accordion>

      <Accordion
        title="Дополнительные категории"
        icon="copy-outline"
        badge={<BadgeCount>{additionalCategories.length ? String(additionalCategories.length) : ""}</BadgeCount>}
      >
        <AdditionalCategoriesEditor
          value={additionalCategories}
          onChange={setAdditionalCategories}
          categories={mergedCategories}
        />
      </Accordion>

      <Accordion title="Описание и характеристики" icon="document-text-outline">
        <Field label="Описание" value={form.description} onChangeText={(v) => set("description", v)} multiline />
        <Field label="Состав" value={form.composition} onChangeText={(v) => set("composition", v)} />
        <Field label="Уход" value={form.careInstructions} onChangeText={(v) => set("careInstructions", v)} multiline />
        <Field label="Примечание" value={form.note} onChangeText={(v) => set("note", v)} multiline />
        <Field label="Доставка" value={form.delivery} onChangeText={(v) => set("delivery", v)} multiline />
        <Field label="Возврат" value={form.returnPolicy} onChangeText={(v) => set("returnPolicy", v)} multiline />
        <Field label="Характеристики (HTML)" value={form.specsHtml} onChangeText={(v) => set("specsHtml", v)} multiline />
        <Field label="Ссылка на видео" value={form.videoUrl} onChangeText={(v) => set("videoUrl", v)} />
      </Accordion>

      <Accordion
        title="Таблица обмеров"
        icon="analytics-outline"
        badge={<BadgeCount>{measurements.length + measurementSections.length ? "✓" : ""}</BadgeCount>}
      >
        <MeasurementsEditor
          value={{ measurements, sections: measurementSections, labels: measurementLabels }}
          onChange={(v) => {
            setMeasurements(v.measurements);
            setMeasurementSections(v.sections);
            setMeasurementLabels(v.labels);
          }}
        />
      </Accordion>

      <Accordion
        title="SEO (поисковая оптимизация)"
        icon="search-outline"
        badge={
          <BadgeCount>
            {form.seoTitle || form.seoDescription || form.seoBody ? "✓" : ""}
          </BadgeCount>
        }
      >
        <Field label="SEO-заголовок" value={form.seoTitle} onChangeText={(v) => set("seoTitle", v)} multiline />
        <SeoCounter text={form.seoTitle} min={50} max={65} />
        <Field label="SEO-описание" value={form.seoDescription} onChangeText={(v) => set("seoDescription", v)} multiline />
        <SeoCounter text={form.seoDescription} min={120} max={165} />
        <Field label="SEO-текст (HTML)" value={form.seoBody} onChangeText={(v) => set("seoBody", v)} multiline />
        <Field label="JSON-LD (разметка)" value={form.seoJsonLd} onChangeText={(v) => set("seoJsonLd", v)} multiline />
        <Field label="Alt-тексты фото (по одному на строку)" value={form.imageAlts} onChangeText={(v) => set("imageAlts", v)} multiline />
      </Accordion>

      <Accordion
        title="Предзаказ"
        icon="time-outline"
        badge={<BadgeCount>{form.preorderEnabled ? "вкл" : ""}</BadgeCount>}
      >
        <Toggle label="Включить предзаказ" value={form.preorderEnabled} onValueChange={(v) => set("preorderEnabled", v)} />
        {form.preorderEnabled ? (
          <>
            <Field label="Сбор до (YYYY-MM-DD)" value={form.preorderDeadline} onChangeText={(v) => set("preorderDeadline", v)} />
            <Field label="В производстве" value={form.preorderProductionDate} onChangeText={(v) => set("preorderProductionDate", v)} />
            <Field label="Отправка" value={form.preorderShippingDate} onChangeText={(v) => set("preorderShippingDate", v)} />
            <SelectField
              label="Коллаборация"
              value={form.preorderGroup}
              options={campaigns}
              placeholder="Не привязан"
              onChange={(v) => set("preorderGroup", v)}
            />
            <Text style={styles.hint}>
              Покупатель оплачивает полную стоимость при оформлении предзаказа.
            </Text>
          </>
        ) : null}
      </Accordion>

      <Accordion
        title="Значки-характеристики"
        icon="sparkles-outline"
        badge={<BadgeCount>{featureBadgeIds.length ? String(featureBadgeIds.length) : ""}</BadgeCount>}
      >
        <FeatureBadgesEditor value={featureBadgeIds} onChange={setFeatureBadgeIds} />
      </Accordion>

      <Accordion title="Look («дополните образ»)" icon="images-outline">
        <Field label="ID товаров (через запятую)" value={form.lookProducts} onChangeText={(v) => set("lookProducts", v)} keyboardType="numeric" />
        <Field label="Категория look" value={form.lookCategory} onChangeText={(v) => set("lookCategory", v)} />
        <Field label="Подкатегория look" value={form.lookSubcategory} onChangeText={(v) => set("lookSubcategory", v)} />
        <Field label="Артист (slug)" value={form.artistSlug} onChangeText={(v) => set("artistSlug", v)} autoCapitalize="none" />
      </Accordion>

      <View style={styles.actions}>
        <Button title="Сохранить" onPress={save} loading={saving} icon="save-outline" />
        <Button
          title={confirmDelete ? "Точно удалить?" : "Удалить товар"}
          onPress={remove}
          variant="danger"
          loading={saving && confirmDelete}
          icon="trash-outline"
        />
      </View>
    </Screen>
  );
}

function Toggle({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => onValueChange(!value)}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <View style={[styles.toggleDot, value && styles.toggleDotOn]} />
      </View>
    </Pressable>
  );
}

function BadgeCount({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <Text style={styles.badgeCount}>{children}</Text>;
}

const styles = StyleSheet.create({
  photosCard: { marginBottom: spacing.md },
  photosCardInner: { marginBottom: 0 },
  imgRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  image: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surface },
  imgMeta: { flex: 1, minWidth: 0 },
  imgName: { color: colors.text, fontSize: 14, fontWeight: "600" },
  imgMain: { color: colors.accent, fontSize: 11, marginTop: 1, fontWeight: "600" },
  imgArrowCol: { gap: 2 },
  imgMoveBtn: {
    width: 22,
    height: 20,
    borderRadius: 6,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  imgMoveDisabled: { opacity: 0.4 },
  removeImg: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: "#2a1114",
    alignItems: "center",
    justifyContent: "center",
  },
  addImage: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  addImageText: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm, lineHeight: 17 },
  row2: { flexDirection: "row", gap: spacing.md },
  col: { flex: 1 },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  toggleLabel: { color: colors.text, fontSize: 14, flexShrink: 1 },
  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: colors.surfaceAlt, padding: 3 },
  toggleOn: { backgroundColor: colors.accent },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.textMuted },
  toggleDotOn: { backgroundColor: colors.white, alignSelf: "flex-end" },
  badgeCount: {
    fontSize: 10,
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },
});
