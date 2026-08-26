import React, { useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { DropZone } from "@/components/DropZone";
import { Accordion } from "@/components/Accordion";
import { Button, Card, Field, InlineError, SectionTitle, SeoCounter } from "@/components/ui";
import { SelectField } from "@/components/SelectField";
import { SizesEditor, type SizesValue } from "@/components/SizesEditor";
import { apiGet, apiPost, getErrorMessage, uploadImage } from "@/lib/api";import { subcategoriesFor, subSubsFor, useCategories } from "@/lib/categories";
import { clearStoredDraft, getStoredDraft, setStoredDraft } from "@/lib/storage";
import { registerHotkey } from "@/lib/hotkeys";
import { colors, radius, spacing } from "@/constants/theme";

const EMPTY_SIZES: SizesValue = {
  sizes: [],
  sizeStock: {},
  sizeDiscounts: {},
  disabledNotifySizes: [],
  noSize: false,
};

export default function NewProductScreen() {
  const router = useRouter();
  const { categories } = useCategories();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [subSubcategory, setSubSubcategory] = useState("");
  const [color, setColor] = useState("");
  const [sizes, setSizes] = useState<SizesValue>(EMPTY_SIZES);
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [badgeText, setBadgeText] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [discountPercent, setDiscountPercent] = useState("");
  const [wholesaleDiscountPercent, setWholesaleDiscountPercent] = useState("");
  const [composition, setComposition] = useState("");
  const [careInstructions, setCareInstructions] = useState("");
  const [note, setNote] = useState("");
  const [delivery, setDelivery] = useState("");
  const [returnPolicy, setReturnPolicy] = useState("");
  const [specsHtml, setSpecsHtml] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoBody, setSeoBody] = useState("");
  const [lookCategory, setLookCategory] = useState("");
  const [lookSubcategory, setLookSubcategory] = useState("");
  const [preorderGroup, setPreorderGroup] = useState("");
  const [artistSlug, setArtistSlug] = useState("");
  const [campaigns, setCampaigns] = useState<{ value: string; label: string }[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ─── Черновик: автосохранение незавершённой формы ────────────────
  const DRAFT_KEY = "new_product";

  // Применяет сохранённые значения черновика к форме.
  const applyDraft = (d: Record<string, unknown>) => {
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    const num = (v: unknown) => (typeof v === "number" ? String(v) : str(v));
    setName(str(d.name));
    setPrice(num(d.price));
    setCategory(str(d.category));
    setSubcategory(str(d.subcategory));
    setSubSubcategory(str(d.subSubcategory));
    setColor(str(d.color));
    setDescription(str(d.description));
    setSku(str(d.sku));
    setWholesalePrice(num(d.wholesalePrice));
    setVideoUrl(str(d.videoUrl));
    setBadgeText(str(d.badgeText));
    setIsNew(d.isNew === true);
    setDiscountPercent(num(d.discountPercent));
    setWholesaleDiscountPercent(num(d.wholesaleDiscountPercent));
    setComposition(str(d.composition));
    setCareInstructions(str(d.careInstructions));
    setNote(str(d.note));
    setDelivery(str(d.delivery));
    setReturnPolicy(str(d.returnPolicy));
    setSpecsHtml(str(d.specsHtml));
    setSeoTitle(str(d.seoTitle));
    setSeoDescription(str(d.seoDescription));
    setSeoBody(str(d.seoBody));
    setLookCategory(str(d.lookCategory));
    setLookSubcategory(str(d.lookSubcategory));
    setPreorderGroup(str(d.preorderGroup));
    setArtistSlug(str(d.artistSlug));
    if (d.sizes && Array.isArray(d.sizes)) setSizes((prev) => ({ ...prev, sizes: d.sizes as string[] }));
    if (d.sizeStock && typeof d.sizeStock === "object")
      setSizes((prev) => ({ ...prev, sizeStock: d.sizeStock as Record<string, number> }));
    if (d.sizeDiscounts && typeof d.sizeDiscounts === "object")
      setSizes((prev) => ({ ...prev, sizeDiscounts: d.sizeDiscounts as Record<string, number> }));
    if (typeof d.noSize === "boolean") setSizes((prev) => ({ ...prev, noSize: d.noSize as boolean }));
  };

  useEffect(() => {
    (async () => {
      const d = await getStoredDraft(DRAFT_KEY);
      if (!d) return;
      if (Platform.OS === "web") {
        // На web Alert не работает — применяем молча.
        applyDraft(d);
        return;
      }
      Alert.alert(
        "Найден черновик",
        "Продолжить редактирование несохранённого товара?",
        [
          { text: "Начать заново", style: "destructive", onPress: () => void clearStoredDraft(DRAFT_KEY) },
          { text: "Продолжить", onPress: () => applyDraft(d) },
        ],
        { cancelable: false },
      );
    })();
  }, []);

  // Дебаунс-автосохранение всех полей формы (без фото — они тяжёлые).
  useEffect(() => {
    const t = setTimeout(() => {
      void setStoredDraft(DRAFT_KEY, {
        name,
        price,
        category,
        subcategory,
        subSubcategory,
        color,
        description,
        sku,
        wholesalePrice,
        videoUrl,
        badgeText,
        isNew,
        discountPercent,
        wholesaleDiscountPercent,
        composition,
        careInstructions,
        note,
        delivery,
        returnPolicy,
        specsHtml,
        seoTitle,
        seoDescription,
        seoBody,
        lookCategory,
        lookSubcategory,
        preorderGroup,
        artistSlug,
        sizes: sizes.sizes,
        sizeStock: sizes.sizeStock,
        sizeDiscounts: sizes.sizeDiscounts,
        noSize: sizes.noSize,
      });
    }, 800);
    return () => clearTimeout(t);
  }, [
    name, price, category, subcategory, subSubcategory, color,
    description, sku, wholesalePrice, videoUrl, badgeText, isNew,
    discountPercent, wholesaleDiscountPercent, composition, careInstructions,
    note, delivery, returnPolicy, specsHtml, seoTitle, seoDescription, seoBody,
    lookCategory, lookSubcategory, preorderGroup, artistSlug, sizes,
  ]);

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

  const addImage = async () => {
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
      setImages((prev) => [...prev, ...urls]);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setError("");
    if (!name.trim() || !price || !category.trim()) {
      setError("Название, цена и категория обязательны");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        price: Math.round(Number(price) * 100),
        category: category.trim(),
        subcategory: subcategory.trim() || undefined,
        subSubcategory: subSubcategory.trim() || undefined,
        color: color.trim() || undefined,
        sizes: sizes.sizes,
        sizeStock: Object.keys(sizes.sizeStock).length > 0 ? sizes.sizeStock : undefined,
        sizeDiscounts: sizes.sizeDiscounts,
        stock: Object.values(sizes.sizeStock).reduce((a, b) => a + b, 0),
        description: description || undefined,
        sku: sku.trim() || undefined,
        wholesalePrice: wholesalePrice ? Math.round(Number(wholesalePrice) * 100) : undefined,
        wholesaleDiscountPercent: wholesaleDiscountPercent ? Number(wholesaleDiscountPercent) : 0,
        discountPercent: discountPercent ? Number(discountPercent) : 0,
        videoUrl: videoUrl.trim() || undefined,
        badgeText: badgeText.trim() || undefined,
        isNew,
        noSize: sizes.noSize,
        composition: composition.trim() || undefined,
        careInstructions: careInstructions.trim() || undefined,
        note: note.trim() || undefined,
        delivery: delivery.trim() || undefined,
        returnPolicy: returnPolicy.trim() || undefined,
        specsHtml: specsHtml || undefined,
        seoTitle: seoTitle.trim() || "",
        seoDescription: seoDescription.trim() || "",
        seoBody: seoBody || "",
        lookCategory: lookCategory.trim() || undefined,
        lookSubcategory: lookSubcategory.trim() || undefined,
        preorderGroup: preorderGroup || undefined,
        artistSlug: artistSlug.trim() || undefined,
        images,
        imageUrl: images[0],
      };
      await apiPost("/admin/products", body);
      await clearStoredDraft(DRAFT_KEY);
      router.back();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  // ПК: Ctrl+S — создать товар.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    return registerHotkey("new-product-save", { key: "s", ctrl: true }, () => void save(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subcategories = category ? subcategoriesFor(categories, category) : [];
  const subSubs = subcategory ? subSubsFor(categories, category, subcategory) : [];

  return (
    <Screen title="Новый товар" scroll>
      <InlineError text={error} />

      <DropZone
        onFiles={async (files) => {
          setUploading(true);
          setError("");
          try {
            const urls: string[] = [];
            for (const file of files.slice(0, 8)) {
              urls.push(await uploadImage(file.uri, file.name || undefined));
            }
            setImages((prev) => [...prev, ...urls]);
          } catch (e) {
            setError(getErrorMessage(e));
          } finally {
            setUploading(false);
          }
        }}
        hint="Отпустите, чтобы загрузить фото"
        style={styles.card}
      >
      <Card style={styles.cardInner}>
        <SectionTitle>Фото</SectionTitle>
        <View style={styles.imageRow}>
          {images.map((uri, i) => (
            <View key={i}>
              <Image source={{ uri }} style={styles.image} contentFit="cover" />
              <Pressable
                style={styles.remove}
                onPress={() => setImages(images.filter((_, j) => j !== i))}
              >
                <Ionicons name="close" size={12} color="#fff" />
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.addImage} onPress={addImage}>
            <Ionicons name="add" size={24} color={colors.accent} />
          </Pressable>
        </View>
        {uploading ? <Text style={styles.hint}>Загрузка…</Text> : null}
      </Card>
      </DropZone>

      <Accordion title="Основное" icon="cube-outline" defaultOpen>
        <Field label="Название *" value={name} onChangeText={setName} />
        <View style={styles.row2}>
          <View style={styles.col}>
            <Field label="Цена, ₽ *" value={price} onChangeText={setPrice} keyboardType="numeric" />
          </View>
          <View style={styles.col}>
            <Field label="Скидка %" value={discountPercent} onChangeText={setDiscountPercent} keyboardType="numeric" />
          </View>
        </View>
        <View style={styles.row2}>
          <View style={styles.col}>
            <Field label="Оптовая цена, ₽" value={wholesalePrice} onChangeText={setWholesalePrice} keyboardType="numeric" />
          </View>
          <View style={styles.col}>
            <Field label="Оптовая скидка %" value={wholesaleDiscountPercent} onChangeText={setWholesaleDiscountPercent} keyboardType="numeric" />
          </View>
        </View>
        <SelectField
          label="Категория *"
          value={category}
          options={Object.entries(categories).map(([slug, c]) => ({ value: slug, label: c.name }))}
          placeholder="Выберите категорию"
          onChange={(v) => {
            setCategory(v);
            setSubcategory("");
            setSubSubcategory("");
          }}
        />
        {subcategories.length > 0 ? (
          <SelectField
            label="Подкатегория"
            value={subcategory}
            options={subcategories.map((s) => ({ value: s.name, label: s.name }))}
            placeholder="Без подкатегории"
            onChange={(v) => {
              setSubcategory(v || "");
              setSubSubcategory("");
            }}
          />
        ) : (
          <Field
            label="Подкатегория"
            value={subcategory}
            onChangeText={(v) => {
              setSubcategory(v);
              setSubSubcategory("");
            }}
            placeholder="Футболки"
          />
        )}
        {subSubs.length > 0 && subcategory ? (
          <SelectField
            label="Под-подкатегория"
            value={subSubcategory}
            options={subSubs.map((s) => ({ value: s.name, label: s.name }))}
            placeholder="Без под-подкатегории"
            onChange={(v) => setSubSubcategory(v || "")}
          />
        ) : null}
        <Field label="Цвет" value={color} onChangeText={setColor} />
        <Field label="Артикул (SKU)" value={sku} onChangeText={setSku} />
        <Field label="Бейдж (NEW и т.п.)" value={badgeText} onChangeText={setBadgeText} />
        <Field label="Ссылка на видео" value={videoUrl} onChangeText={setVideoUrl} />
        <Toggle label="Новинка" value={isNew} onValueChange={setIsNew} />
      </Accordion>

      <Accordion title="Размеры" icon="resize-outline" defaultOpen>
        <SizesEditor value={sizes} onChange={setSizes} priceKopeks={Math.round(Number(price || 0) * 100)} />
      </Accordion>

      <Accordion title="Описание и характеристики" icon="document-text-outline">
        <Field label="Описание" value={description} onChangeText={setDescription} multiline />
        <Field label="Состав" value={composition} onChangeText={setComposition} />
        <Field label="Уход" value={careInstructions} onChangeText={setCareInstructions} multiline />
        <Field label="Примечание" value={note} onChangeText={setNote} multiline />
        <Field label="Доставка" value={delivery} onChangeText={setDelivery} multiline />
        <Field label="Возврат" value={returnPolicy} onChangeText={setReturnPolicy} multiline />
        <Field label="Характеристики (HTML)" value={specsHtml} onChangeText={setSpecsHtml} multiline />
      </Accordion>

      <Accordion title="SEO и «Дополните образ»" icon="search-outline">
        <Field label="SEO-заголовок" value={seoTitle} onChangeText={setSeoTitle} multiline />
        <SeoCounter text={seoTitle} min={50} max={65} />
        <Field label="SEO-описание" value={seoDescription} onChangeText={setSeoDescription} multiline />
        <SeoCounter text={seoDescription} min={120} max={165} />
        <Field label="SEO-текст (HTML)" value={seoBody} onChangeText={setSeoBody} multiline />
        <Field label="Образ: категория" value={lookCategory} onChangeText={setLookCategory} />
        <Field label="Образ: подкатегория" value={lookSubcategory} onChangeText={setLookSubcategory} />
        <Field label="Артист (slug)" value={artistSlug} onChangeText={setArtistSlug} autoCapitalize="none" />
        <SelectField
          label="Коллаборация (предзаказ)"
          value={preorderGroup}
          options={campaigns}
          placeholder="Не привязан"
          onChange={setPreorderGroup}
        />
      </Accordion>

      <Button title="Создать товар" onPress={save} loading={saving} icon="add-circle-outline" />
    </Screen>
  );
}

function Toggle({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => onValueChange(!value)}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <View style={[styles.dot, value && styles.dotOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  cardInner: { marginBottom: 0 },
  imageRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  image: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  remove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  addImage: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  row2: { flexDirection: "row", gap: spacing.md },
  col: { flex: 1 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  toggleLabel: { color: colors.text, fontSize: 14 },
  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: colors.surfaceAlt, padding: 3 },
  toggleOn: { backgroundColor: colors.accent },
  dot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.textMuted },
  dotOn: { backgroundColor: colors.white, alignSelf: "flex-end" },
});
