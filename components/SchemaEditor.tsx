import React, { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Accordion } from "@/components/Accordion";
import { SelectField, type SelectOption } from "@/components/SelectField";
import { uploadImage } from "@/lib/api";
import { Label } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";

/** Известные enum-поля редактируются выбором, а не угадыванием значения вручную. */
const ENUM_OPTIONS: Record<string, string[]> = {
  cardStyle: ["vinyl", "poster"],
  align: ["left", "center", "right"],
  textAlign: ["left", "center", "right"],
  verticalAlign: ["top", "center", "bottom"],
  position: ["top", "center", "bottom"],
  overlay: ["none", "gradient-overlay", "blur", "parallax", "animate"],
  theme: ["dark", "light"],
  colorScheme: ["dark", "light"],
  layout: ["compact", "medium", "large"],
  source: ["manual", "auto"],
  mediaType: ["image", "video"],
  desktopMediaType: ["image", "video"],
  mobileMediaType: ["image", "video"],
  bgColor: ["black", "white", "red", "gray", "beige"],
  textColor: ["light", "dark"],
  size: ["small", "medium", "large"],
  effect: ["none", "gradient-overlay", "blur", "parallax", "animate"],
};

const ENUM_LABELS: Record<string, string> = {
  vinyl: "Винил",
  poster: "Постер",
  left: "Слева",
  center: "По центру",
  right: "Справа",
  top: "Сверху",
  bottom: "Снизу",
  none: "Нет",
  "gradient-overlay": "Градиент",
  blur: "Размытие",
  parallax: "Параллакс",
  animate: "Анимация",
  dark: "Тёмная",
  light: "Светлая",
  compact: "Компактный",
  medium: "Средний",
  large: "Большой",
  manual: "Ручной выбор",
  auto: "Авто",
  image: "Изображение",
  video: "Видео",
  black: "Чёрный",
  white: "Белый",
  red: "Красный",
  gray: "Серый",
  beige: "Бежевый",
  small: "Маленький",
};

const FIELD_LABELS: Record<string, string> = {
  visible: "Видимость",
  title: "Заголовок",
  subtitle: "Подзаголовок",
  description: "Описание",
  text: "Текст",
  excerpt: "Анонс",
  buttonText: "Текст кнопки",
  buttonLink: "Ссылка кнопки",
  buttonUrl: "Ссылка кнопки",
  linkText: "Текст ссылки",
  linkUrl: "Ссылка",
  ctaText: "Текст кнопки",
  terminalLabel: "Подпись таймера",
  successText: "Текст об успехе",
  slides: "Слайды",
  duration: "Длительность (сек)",
  typingEffect: "Эффект печати текста",
  tagline1: "Слоган — строка 1",
  tagline2: "Слоган — строка 2",
  bgType: "Тип фона",
  heroImageAlt: "Alt-текст главного изображения",
  heroVideo: "Видео баннера",
  heroVideoUrl: "Видео баннера",
  heroBgType: "Тип фона баннера",
  heroOpacity: "Прозрачность затемнения",
  heroTitle: "Заголовок баннера",
  heroSubtitle: "Подзаголовок баннера",
  productId: "ID товара",
  pinnedProductIds: "Закреплённые товары (ID)",
  count: "Количество",
  mode: "Режим",
  sectionOrder: "Порядок секций",
  rounded: "Скруглённые углы",
  span: "Размер плитки",
  alt: "Alt-текст",
  imageAlt: "Alt-текст изображения",
  image: "Изображение",
  imageUrl: "Изображение",
  bgImage: "Фоновое изображение",
  desktopImage: "Изображение для компьютера",
  mobileImage: "Изображение для телефона",
  videoUrl: "Ссылка на видео",
  mobileVideo: "Видео для телефона",
  heroImage: "Главное изображение",
  heroImageMobile: "Главное изображение для телефона",
  logoUrl: "Логотип",
  coverImage: "Обложка",
  badgeImage: "Бейдж",
  position: "Позиция",
  layout: "Компоновка",
  cardStyle: "Стиль карточки",
  overlay: "Эффект наложения",
  mediaType: "Тип медиа",
  desktopMediaType: "Тип медиа для компьютера",
  mobileMediaType: "Тип медиа для телефона",
  bgColor: "Цвет фона",
  textColor: "Цвет текста",
  seoTitle: "SEO-заголовок",
  seoDescription: "SEO-описание",
  seoBody: "SEO-текст",
  content: "Содержимое",
  tags: "Теги",
  items: "Элементы",
  collection: "Коллекция",
  quoteText: "Цитата",
  quoteAuthor: "Автор цитаты",
  galleryTitle: "Заголовок галереи",
  galleryImages: "Изображения галереи",
  aboutTitle: "Заголовок блока «О коллаборации»",
  aboutText: "Текст блока «О коллаборации»",
  aboutImages: "Изображения блока «О коллаборации»",
  productsTitle: "Заголовок товаров коллекции",
  productsCategory: "Категория товаров",
  productsSubcategory: "Подкатегория товаров",
  productsLinkText: "Текст ссылки на товары",
  shortDescription: "Краткое описание",
  socialTelegram: "Telegram",
  socialVk: "ВКонтакте",
  socialYoutube: "YouTube",
  socialInstagram: "Instagram",
  socialOther: "Другая соцсеть",
  socialOtherLabel: "Подпись другой соцсети",
  featuredPartnerSlug: "Slug партнёра (карточка)",
  featuredPartnerTitle: "Заголовок карточки партнёра",
  featuredPartnerDescription: "Описание карточки партнёра",
  featuredPartnerImage: "Изображение карточки партнёра",
  featuredPartnerVisible: "Показывать карточку партнёра",
  heroVisible: "Показывать блок Hero",
  aboutVisible: "Показывать блок «О коллаборации»",
  galleryVisible: "Показывать галерею",
  productsVisible: "Показывать товары",
  quoteVisible: "Показывать цитату",
  videoVisible: "Показывать видео",
  socialsVisible: "Показывать соцсети",
  lookCategory: "Категория образа",
  lookSubcategory: "Подкатегория образа",
  lookProducts: "ID товаров образа",
  logo: "Логотип",
  logoMobile: "Логотип для телефона",
  brandName: "Название бренда",
  brandTitle: "Название бренда",
  menu: "Меню",
  menuItems: "Пункты меню",
  navItems: "Пункты навигации",
  navLinks: "Ссылки навигации",
  links: "Ссылки",
  link: "Ссылка",
  href: "Адрес ссылки",
  url: "Адрес ссылки",
  external: "Внешняя ссылка",
  openInNewTab: "Открывать в новой вкладке",
  showSearch: "Показывать поиск",
  showAccount: "Показывать аккаунт",
  showCart: "Показывать корзину",
  showFavorites: "Показывать избранное",
  showPhone: "Показывать телефон",
  showSocials: "Показывать соцсети",
  phone: "Телефон",
  phones: "Телефоны",
  email: "Email",
  emails: "Email-адреса",
  address: "Адрес",
  city: "Город",
  contacts: "Контакты",
  contact: "Контактные данные",
  social: "Соцсеть",
  socials: "Социальные сети",
  socialLinks: "Ссылки на соцсети",
  columns: "Колонки футера",
  column: "Колонка",
  legal: "Юридическая информация",
  legalLinks: "Юридические ссылки",
  copyright: "Копирайт",
  policy: "Политика",
  terms: "Оферта",
  privacy: "Конфиденциальность",
  footer: "Футер",
  header: "Шапка сайта",
  navbar: "Навигация",
  navigation: "Навигация",
  brand: "Бренд",
  settings: "Настройки",
  defaults: "Значения по умолчанию",
  analytics: "Аналитика",
  counters: "Счётчики аналитики",
  integrations: "Интеграции",
  scripts: "Скрипты",
  favicon: "Иконка сайта",
  theme: "Тема",
  colorScheme: "Цветовая схема",
  colors: "Цвета",
  background: "Фон",
  backgroundColor: "Цвет фона",
  accentColor: "Акцентный цвет",
  currency: "Валюта",
  locale: "Язык",
  timezone: "Часовой пояс",
  enabled: "Включено",
  active: "Активно",
  order: "Порядок",
  sortOrder: "Порядок сортировки",
};

export function humanizeLabel(key: string): string {
  const shortKey = key.split(".").pop() || key;
  if (FIELD_LABELS[shortKey]) return FIELD_LABELS[shortKey];
  return shortKey
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function isImageUrl(value: string, fieldKey: string): boolean {
  return (
    /\.(png|jpe?g|gif|webp|svg|avif|bmp|heic)(\?|#|$)/i.test(value) ||
    /storage\.yandex|yastatic|\/images?\//i.test(value) ||
    /(image|logo|cover|hero|banner|background|desktopMedia|mobileMedia)/i.test(fieldKey)
  );
}

function optionList(fieldKey: string): SelectOption[] | null {
  const key = fieldKey.split(".").pop() || fieldKey;
  const values = ENUM_OPTIONS[key];
  if (!values) return null;
  return values.map((value) => ({ value, label: ENUM_LABELS[value] || value }));
}

export function SchemaEditor({
  value,
  onChange,
  rootLabel = "Секция",
}: {
  value: unknown;
  onChange: (next: unknown) => void;
  rootLabel?: string;
}) {
  return <SchemaField label={rootLabel} fieldKey="" value={value} onChange={onChange} depth={0} />;
}

function SchemaField({
  label,
  fieldKey,
  value,
  onChange,
  depth,
}: {
  label: string;
  fieldKey: string;
  value: unknown;
  onChange: (next: unknown) => void;
  depth: number;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setUploadError("Нужен доступ к фото");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setUploading(true);
    setUploadError("");
    try {
      const asset = result.assets[0];
      onChange(await uploadImage(asset.uri, asset.fileName || undefined));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Не удалось загрузить изображение");
    } finally {
      setUploading(false);
    }
  };

  if (value === null || value === undefined) {
    return <Text style={styles.emptyHint}>— не задано —</Text>;
  }

  if (typeof value === "boolean") {
    return (
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Pressable onPress={() => onChange(!value)} style={[styles.toggle, value && styles.toggleOn]}>
          <View style={[styles.dot, value && styles.dotOn]} />
        </Pressable>
      </View>
    );
  }

  if (typeof value === "number") {
    return (
      <View style={styles.fieldWrap}>
        <Label>{label}</Label>
        <TextInput
          value={String(value)}
          onChangeText={(text) => {
            const next = Number(text.replace(",", "."));
            onChange(Number.isNaN(next) ? 0 : next);
          }}
          keyboardType="numeric"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
      </View>
    );
  }

  if (typeof value === "string") {
    const enumOptions = optionList(fieldKey);
    if (enumOptions) {
      const options = enumOptions.some((item) => item.value === value)
        ? enumOptions
        : value
          ? [{ value, label: value }, ...enumOptions]
          : enumOptions;
      return (
        <SelectField
          label={label}
          value={value}
          options={options}
          placeholder="Выберите значение"
          onChange={onChange}
        />
      );
    }

    const isImage = isImageUrl(value, fieldKey);
    const isLong = value.length > 120 || /(description|content|body|text|html)/i.test(fieldKey);
    return (
      <View style={styles.fieldWrap}>
        <Label>{label}</Label>
        {isImage && value ? <Image source={{ uri: value }} style={styles.imagePreview} contentFit="cover" /> : null}
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholderTextColor={colors.textMuted}
          multiline={isLong}
          autoCapitalize="none"
          style={[styles.input, isLong && styles.inputMultiline]}
        />
        {isImage ? (
          <View style={styles.imageActions}>
            <Pressable onPress={pickImage} disabled={uploading} style={styles.uploadBtn}>
              <Ionicons name="cloud-upload-outline" size={16} color={colors.accent} />
              <Text style={styles.uploadText}>{uploading ? "Загрузка…" : "Выбрать изображение"}</Text>
            </Pressable>
            {value ? (
              <Pressable onPress={() => onChange("")} disabled={uploading} hitSlop={8}>
                <Text style={styles.clearText}>Очистить</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {uploadError ? <Text style={styles.uploadError}>{uploadError}</Text> : null}
      </View>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <View style={styles.fieldWrap}>
          <Label>{label}</Label>
          <Pressable style={styles.addBtn} onPress={() => onChange([{}])}>
            <Ionicons name="add" size={16} color={colors.accent} />
            <Text style={styles.addBtnText}>Добавить элемент</Text>
          </Pressable>
        </View>
      );
    }

    const allPrimitive = value.every(
      (item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean",
    );
    if (allPrimitive) {
      return <PrimitiveList label={label} fieldKey={fieldKey} value={value} onChange={onChange} />;
    }

    return (
      <View style={styles.fieldWrap}>
        <Label>{label}</Label>
        {value.map((item, index) => (
          <Accordion
            key={index}
            title={`${label} ${index + 1}`}
            icon="list-outline"
            badge={
              <Pressable onPress={() => onChange(value.filter((_, i) => i !== index))} hitSlop={8} style={styles.miniDelete}>
                <Ionicons name="trash-outline" size={15} color={colors.danger} />
              </Pressable>
            }
          >
            <SchemaField
              label={`Элемент ${index + 1}`}
              fieldKey={fieldKey}
              value={item}
              onChange={(next) => onChange(value.map((current, i) => (i === index ? next : current)))}
              depth={depth + 1}
            />
          </Accordion>
        ))}
        <Pressable
          style={styles.addBtn}
          onPress={() => {
            const first = value[0];
            const template =
              typeof first === "object" && first !== null
                ? Object.fromEntries(
                    Object.entries(first).map(([key, item]) => [
                      key,
                      typeof item === "string" ? "" : Array.isArray(item) ? [] : item,
                    ]),
                  )
                : "";
            onChange([...value, template]);
          }}
        >
          <Ionicons name="add" size={16} color={colors.accent} />
          <Text style={styles.addBtnText}>Добавить {label.toLowerCase()}</Text>
        </Pressable>
      </View>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return <Text style={styles.emptyHint}>— пусто —</Text>;

  return (
    <Accordion
      title={label}
      icon="options-outline"
      defaultOpen={depth === 0}
      badge={<Text style={styles.countBadge}>{entries.length}</Text>}
    >
      {entries.map(([key, item]) => (
        <SchemaField
          key={key}
          label={humanizeLabel(key)}
          fieldKey={fieldKey ? `${fieldKey}.${key}` : key}
          value={item}
          onChange={(next) => onChange({ ...(value as Record<string, unknown>), [key]: next })}
          depth={depth + 1}
        />
      ))}
    </Accordion>
  );
}

function PrimitiveList({
  label,
  fieldKey,
  value,
  onChange,
}: {
  label: string;
  fieldKey: string;
  value: Array<string | number | boolean>;
  onChange: (next: unknown) => void;
}) {
  const [draft, setDraft] = useState("");
  const isBool = value.every((item) => typeof item === "boolean");
  const enumOptions = optionList(fieldKey);

  if (isBool) {
    return (
      <View style={styles.fieldWrap}>
        <Label>{label}</Label>
        <View style={styles.chips}>
          {value.map((item, index) => (
            <Pressable key={index} style={[styles.chip, item && styles.chipOn]} onPress={() => onChange(value.map((v, i) => (i === index ? !v : v)))}>
              <Text style={[styles.chipText, item && styles.chipTextOn]}>{index + 1}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fieldWrap}>
      <Label>{label}</Label>
      {enumOptions ? (
        <SelectField
          label={label}
          value=""
          options={enumOptions}
          onChange={(item) => {
            if (item && !value.includes(item)) onChange([...value, item]);
          }}
          placeholder="+ Добавить из списка…"
        />
      ) : null}
      <View style={styles.chips}>
        {value.map((item, index) => {
          const matched = enumOptions?.find((option) => option.value === String(item));
          return (
            <View key={index} style={[styles.chip, matched && styles.chipOn]}>
              <Text style={[styles.chipText, matched && styles.chipTextOn]}>{matched?.label || String(item)}</Text>
              <Pressable onPress={() => onChange(value.filter((_, i) => i !== index))} hitSlop={8}>
                <Ionicons name="close" size={13} color={colors.textMuted} />
              </Pressable>
            </View>
          );
        })}
      </View>
      <View style={styles.chipAddRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Новый элемент…"
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={() => {
            const text = draft.trim();
            if (!text) return;
            onChange([...value, typeof value[0] === "number" ? Number(text) : text]);
            setDraft("");
          }}
          style={styles.chipInput}
        />
        <Pressable
          style={styles.addBtnCompact}
          onPress={() => {
            const text = draft.trim();
            if (!text) return;
            onChange([...value, typeof value[0] === "number" ? Number(text) : text]);
            setDraft("");
          }}
        >
          <Ionicons name="add" size={16} color={colors.accent} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: { marginBottom: spacing.md },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 14,
    minHeight: 46,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: "top" },
  imagePreview: {
    width: "100%",
    height: 120,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.sm,
  },
  imageActions: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm },
  uploadBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xs },
  uploadText: { color: colors.accent, fontSize: 12, fontWeight: "600" },
  clearText: { color: colors.textMuted, fontSize: 12 },
  uploadError: { color: colors.danger, fontSize: 12, marginTop: spacing.xs },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  toggleLabel: { color: colors.text, fontSize: 14, flex: 1, marginRight: spacing.md },
  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: colors.surfaceAlt, padding: 3 },
  toggleOn: { backgroundColor: colors.success },
  dot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.textMuted },
  dotOn: { backgroundColor: colors.white, alignSelf: "flex-end" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: spacing.sm },
  addBtnText: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  addBtnCompact: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  miniDelete: { padding: 4 },
  countBadge: {
    color: colors.textMuted,
    fontSize: 12,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { backgroundColor: colors.accentSoft },
  chipText: { color: colors.textMuted, fontSize: 12 },
  chipTextOn: { color: colors.accent, fontWeight: "600" },
  chipAddRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center", marginTop: spacing.sm },
  chipInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
  },
  emptyHint: { color: colors.textMuted, fontSize: 12, paddingVertical: spacing.sm },
});
