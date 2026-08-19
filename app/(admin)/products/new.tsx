import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Accordion } from "@/components/Accordion";
import { Button, Card, Field, InlineError, SectionTitle } from "@/components/ui";
import { SelectField } from "@/components/SelectField";
import { SizesEditor, type SizesValue } from "@/components/SizesEditor";
import { apiGet, apiPost, getErrorMessage, uploadImage } from "@/lib/api";
import { subcategoriesFor, subSubsFor, useCategories } from "@/lib/categories";
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
      router.back();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const subcategories = category ? subcategoriesFor(categories, category) : [];
  const subSubs = subcategory ? subSubsFor(categories, category, subcategory) : [];

  return (
    <Screen title="Новый товар" scroll>
      <InlineError text={error} />

      <Card style={styles.card}>
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
        <SelectField
          label="Подкатегория"
          value={subcategory}
          options={subcategories.map((s) => ({ value: s.name, label: s.name }))}
          placeholder="Без подкатегории"
          allowEmpty={false}
          onChange={(v) => {
            setSubcategory(v);
            setSubSubcategory("");
          }}
        />
        {subSubs.length > 0 ? (
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

      <Accordion title="SEO и Look" icon="search-outline">
        <Field label="SEO title" value={seoTitle} onChangeText={setSeoTitle} multiline />
        <Field label="SEO description" value={seoDescription} onChangeText={setSeoDescription} multiline />
        <Field label="SEO body (HTML)" value={seoBody} onChangeText={setSeoBody} multiline />
        <Field label="Look: категория" value={lookCategory} onChangeText={setLookCategory} />
        <Field label="Look: подкатегория" value={lookSubcategory} onChangeText={setLookSubcategory} />
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
