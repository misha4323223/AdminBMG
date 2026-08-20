import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Screen } from "@/components/Screen";
import { Badge, Button, Field, InlineError, LoadingView, SectionTitle } from "@/components/ui";
import { SelectField } from "@/components/SelectField";
import { apiGet, apiPost, getErrorMessage, uploadImage } from "@/lib/api";
import { colors, radius, spacing } from "@/constants/theme";

interface Slide {
  heroImage: string;
  heroImageMobile: string;
  heroImageAlt: string;
  bgType: string;
  heroVideo: string;
  tagline1: string;
  tagline2: string;
  buttonText: string;
  buttonLink: string;
  duration: number;
}

const EMPTY_SLIDE: Slide = {
  heroImage: "",
  heroImageMobile: "",
  heroImageAlt: "",
  bgType: "image",
  heroVideo: "",
  tagline1: "",
  tagline2: "",
  buttonText: "",
  buttonLink: "",
  duration: 7,
};

const BANNER_STYLES = [
  { value: "neutral", label: "Нейтральный", desc: "Тёмный фон — для общих объявлений" },
  { value: "urgent", label: "Срочный", desc: "Красный — для важных предупреждений" },
  { value: "info", label: "Информационный", desc: "Синий — для пояснений и уведомлений" },
  { value: "highlight", label: "Акцентный", desc: "Жёлто-зелёный (фирменный) — для анонсов" },
];

function UrlField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  kind = "image",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  kind?: "image" | "video";
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const pick = async () => {
    setUploadError("");
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setUploadError("Нужен доступ к фото");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === "image" ? ["images"] : ["videos"],
      quality: 0.9,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets?.length) return;
    setUploading(true);
    try {
      const url = await uploadImage(result.assets[0].uri, result.assets[0].fileName || undefined);
      onChange(url);
    } catch (e) {
      setUploadError(getErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.urlRow}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder || (kind === "video" ? "Прямая ссылка на MP4/WebM" : "URL или загрузите файл")}
          placeholderTextColor={colors.textMuted}
          style={styles.urlInput}
        />
        {kind === "image" ? (
          <Pressable onPress={pick} style={({ pressed }) => [styles.uploadBtn, pressed && { opacity: 0.8 }]}>
            {uploading ? <Text style={styles.uploadBtnText}>…</Text> : <Ionicons name="cloud-upload-outline" size={16} color={colors.text} />}
          </Pressable>
        ) : null}
      </View>
      {value ? (
        <View style={styles.thumbRow}>
          <Text style={styles.thumbUrl} numberOfLines={1}>{value}</Text>
          <Pressable onPress={() => onChange("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}
      {uploadError ? <Text style={styles.fieldError}>{uploadError}</Text> : null}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export default function ConceptScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const [slides, setSlides] = useState<Slide[]>([{ ...EMPTY_SLIDE }, { ...EMPTY_SLIDE }, { ...EMPTY_SLIDE }]);
  const [slideIndex, setSlideIndex] = useState(0);

  const [bannerEnabled, setBannerEnabled] = useState(false);
  const [bannerStyle, setBannerStyle] = useState("neutral");
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerText, setBannerText] = useState("");
  const [bannerButtonText, setBannerButtonText] = useState("");
  const [bannerButtonUrl, setBannerButtonUrl] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<Record<string, unknown>>("/page-settings/concept");
        const hero = (res.hero as Record<string, unknown> | undefined) || {};
        const raw = Array.isArray(hero.slides)
          ? (hero.slides as Slide[])
          : hero.heroImage
            ? [{ ...EMPTY_SLIDE, heroImage: String(hero.heroImage), heroImageMobile: String(hero.heroImageMobile || ""), heroImageAlt: String(hero.heroImageAlt || "") }]
            : [];
        const normalized = [...raw].map((s) => ({ ...EMPTY_SLIDE, ...s }));
        while (normalized.length < 3) normalized.push({ ...EMPTY_SLIDE });
        setSlides(normalized);

        const b = (res.promo_banner as Record<string, unknown> | undefined) || {};
        setBannerEnabled(!!b.enabled);
        setBannerStyle(typeof b.style === "string" ? b.style : "neutral");
        setBannerTitle(String(b.title || ""));
        setBannerText(String(b.text || ""));
        setBannerButtonText(String(b.buttonText || ""));
        setBannerButtonUrl(String(b.buttonUrl || ""));
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateSlide = (updates: Partial<Slide>) => {
    setSlides((prev) => prev.map((s, i) => (i === slideIndex ? { ...s, ...updates } : s)));
  };

  const saveHero = async () => {
    setSaving(true);
    setError("");
    setSavedMsg("");
    try {
      await apiPost("/admin/page-settings/concept/hero", { slides });
      setSavedMsg("Баннеры Pre-drop сохранены");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const saveBanner = async () => {
    setSaving(true);
    setError("");
    setSavedMsg("");
    try {
      await apiPost("/admin/page-settings/concept/promo_banner", {
        enabled: bannerEnabled,
        style: bannerStyle,
        title: bannerTitle,
        text: bannerText,
        buttonText: bannerButtonText,
        buttonUrl: bannerButtonUrl,
      });
      setSavedMsg("Промо-баннер сохранён");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen title="Концепт" scroll={false}>
        <LoadingView />
      </Screen>
    );
  }

  const current = slides[slideIndex] || EMPTY_SLIDE;
  const isFilled = (s: Slide) => !!(s.heroImage || s.heroVideo);

  return (
    <Screen title="Концепт" subtitle="Концепт и коллаборации (Pre-drop)">
      <InlineError text={error} />
      {savedMsg ? <Text style={styles.saved}>{savedMsg}</Text> : null}

      <SectionTitle>Слайды баннера «Pre-drop»</SectionTitle>
      <Text style={styles.hint}>
        До 3 слайдов. Слайды с заполненным изображением или видео показываются на странице. Один слайд — статичный баннер, несколько — слайдер.
      </Text>

      <View style={styles.slideTabs}>
        {[0, 1, 2].map((i) => (
          <Pressable
            key={i}
            onPress={() => setSlideIndex(i)}
            style={[styles.slideTab, slideIndex === i && styles.slideTabActive]}
          >
            <Text style={[styles.slideTabText, slideIndex === i && styles.slideTabTextActive]}>Слайд {i + 1}</Text>
            {isFilled(slides[i]) ? <View style={styles.dot} /> : null}
          </Pressable>
        ))}
      </View>

      <View style={styles.block}>
        <View style={styles.segRow}>
          <Pressable style={[styles.seg, current.bgType !== "video" && styles.segActive]} onPress={() => updateSlide({ bgType: "image", heroVideo: "" })}>
            <Text style={[styles.segText, current.bgType !== "video" && styles.segTextActive]}>Изображение</Text>
          </Pressable>
          <Pressable style={[styles.seg, current.bgType === "video" && styles.segActive]} onPress={() => updateSlide({ bgType: "video", heroImage: "", heroImageMobile: "" })}>
            <Text style={[styles.segText, current.bgType === "video" && styles.segTextActive]}>Видео</Text>
          </Pressable>
        </View>

        {current.bgType !== "video" ? (
          <>
            <UrlField
              label="Изображение (десктоп)"
              value={current.heroImage}
              onChange={(v) => updateSlide({ heroImage: v })}
              hint="Широкий формат — 2560×900 px, WebP/JPG"
            />
            <UrlField
              label="Изображение (мобильный)"
              value={current.heroImageMobile}
              onChange={(v) => updateSlide({ heroImageMobile: v })}
              hint="Если не загружено — используется десктопное (1080×720 px)"
            />
            <Field label="Alt-текст (SEO)" value={current.heroImageAlt} onChangeText={(v) => updateSlide({ heroImageAlt: v })} placeholder="Краткое описание изображения" />
          </>
        ) : (
          <UrlField
            label="Видео (MP4 / WebM)"
            value={current.heroVideo}
            onChange={(v) => updateSlide({ heroVideo: v })}
            kind="video"
            hint="Видео воспроизводится в цикле без звука. Вставьте прямую ссылку на файл — загрузка видео с устройства не поддерживается."
          />
        )}

        <Field label="Слоган — строка 1" value={current.tagline1} onChangeText={(v) => updateSlide({ tagline1: v })} placeholder="Текст поверх баннера" />
        <Field label="Слоган — строка 2" value={current.tagline2} onChangeText={(v) => updateSlide({ tagline2: v })} placeholder="Вторая строка" />
        <Field label="Текст кнопки" value={current.buttonText} onChangeText={(v) => updateSlide({ buttonText: v })} placeholder="Например: Смотреть коллекцию" />
        <Field label="Ссылка кнопки" value={current.buttonLink} onChangeText={(v) => updateSlide({ buttonLink: v })} placeholder="/concept или /products" />
        <Field
          label="Задержка (сек)"
          value={String(current.duration ?? 7)}
          onChangeText={(v) => updateSlide({ duration: Number(v) || 7 })}
          keyboardType="number-pad"
        />

        {(current.heroImage || current.heroVideo) ? (
          <Pressable onPress={() => updateSlide({ ...EMPTY_SLIDE })} hitSlop={8}>
            <Text style={styles.clearText}>Очистить слайд {slideIndex + 1}</Text>
          </Pressable>
        ) : null}

        <Button title="Сохранить баннеры" onPress={saveHero} loading={saving} icon="save-outline" />
      </View>

      <View style={styles.divider} />

      <View style={styles.bannerHeader}>
        <View style={{ flex: 1 }}>
          <SectionTitle>Промо-баннер</SectionTitle>
          <Text style={styles.hint}>Небольшой информационный блок между хиро и сеткой товаров.</Text>
        </View>
        <Pressable onPress={() => setBannerEnabled((v) => !v)} style={styles.switchRow}>
          <Text style={styles.switchLabel}>{bannerEnabled ? "Включён" : "Выключен"}</Text>
          <View style={[styles.switch, bannerEnabled && styles.switchOn]}>
            <View style={[styles.switchKnob, bannerEnabled && styles.switchKnobOn]} />
          </View>
        </Pressable>
      </View>

      <View style={styles.block}>
        <SelectField
          label="Стиль баннера"
          value={bannerStyle}
          options={BANNER_STYLES.map((s) => ({ value: s.value, label: s.label }))}
          onChange={setBannerStyle}
          allowEmpty={false}
        />
        {BANNER_STYLES.filter((s) => s.value === bannerStyle).map((s) => (
          <Text key={s.value} style={styles.hint}>
            {s.desc}
          </Text>
        ))}
        <Field label="Заголовок" value={bannerTitle} onChangeText={setBannerTitle} placeholder="Например: Важное объявление" maxLength={80} />
        <Field label="Текст" value={bannerText} onChangeText={setBannerText} placeholder="Описание объявления" multiline maxLength={400} />
        <Field label="Текст кнопки" value={bannerButtonText} onChangeText={setBannerButtonText} placeholder="Например: Подробнее" maxLength={40} />
        <Field label="Ссылка кнопки" value={bannerButtonUrl} onChangeText={setBannerButtonUrl} placeholder="/concept или https://..." maxLength={200} />

        {bannerTitle || bannerText ? (
          <View style={[styles.preview, bannerStyle === "urgent" && styles.previewUrgent, bannerStyle === "info" && styles.previewInfo, bannerStyle === "highlight" && styles.previewHighlight]}>
            <Text style={styles.previewIcon}>{bannerStyle === "urgent" ? "⚠️" : bannerStyle === "info" ? "ℹ️" : bannerStyle === "highlight" ? "🔥" : "📢"}</Text>
            <View style={{ flex: 1 }}>
              {bannerTitle ? <Text style={styles.previewTitle}>{bannerTitle}</Text> : null}
              {bannerText ? <Text style={styles.previewText}>{bannerText}</Text> : null}
            </View>
            {bannerButtonText ? <Badge tone="accent">{bannerButtonText}</Badge> : null}
          </View>
        ) : null}

        <Button title="Сохранить промо-баннер" onPress={saveBanner} loading={saving} icon="save-outline" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  saved: { color: colors.success, fontSize: 13, marginBottom: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: spacing.md },
  slideTabs: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  slideTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  slideTabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  slideTabText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  slideTabTextActive: { color: colors.white },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  block: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  segRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  seg: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  segActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  segText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  segTextActive: { color: colors.accent },
  fieldWrap: { marginBottom: spacing.md },
  fieldLabel: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs },
  urlRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  urlInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  uploadBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadBtnText: { color: colors.accent, fontSize: 16, fontWeight: "700" },
  thumbRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  thumbUrl: { flex: 1, color: colors.textMuted, fontSize: 12 },
  fieldHint: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  fieldError: { color: colors.danger, fontSize: 11, marginTop: 4 },
  clearText: { color: colors.textMuted, fontSize: 12, textDecorationLine: "underline", alignSelf: "flex-start" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.md },
  bannerHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  switchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  switchLabel: { color: colors.textMuted, fontSize: 12 },
  switch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    justifyContent: "center",
    padding: 2,
  },
  switchOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  switchKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.textMuted },
  switchKnobOn: { backgroundColor: colors.accent, alignSelf: "flex-end" },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  previewUrgent: { backgroundColor: "#2a1114", borderColor: "#7f1d1d" },
  previewInfo: { backgroundColor: "#0f2030", borderColor: "#1e3a5f" },
  previewHighlight: { backgroundColor: "#1a1f00", borderColor: "#4d5500" },
  previewIcon: { fontSize: 16 },
  previewTitle: { color: colors.text, fontSize: 13, fontWeight: "700" },
  previewText: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
