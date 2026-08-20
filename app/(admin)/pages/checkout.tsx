import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Accordion } from "@/components/Accordion";
import { Badge, Button, Field, InlineError, LoadingView, SectionTitle } from "@/components/ui";
import { apiGet, apiPost, getErrorMessage } from "@/lib/api";
import { colors, radius, spacing } from "@/constants/theme";

type Settings = Record<string, unknown>;

const SECTIONS: Array<{ id: string; label: string; icon: keyof typeof Ionicons.glyphMap; fields: Array<[string, string]> }> = [
  {
    id: "general",
    label: "Основные",
    icon: "settings-outline",
    fields: [
      ["pageTitle", "Заголовок страницы"],
      ["successTitle", "Заголовок успешного заказа"],
      ["successDescription", "Описание успешного заказа"],
      ["successButtonText", "Текст кнопки после заказа"],
      ["emptyCartText", "Текст пустой корзины"],
      ["emptyCartButtonText", "Текст кнопки пустой корзины"],
    ],
  },
  {
    id: "delivery",
    label: "Доставка",
    icon: "cube-outline",
    fields: [
      ["deliverySectionTitle", "Заголовок секции «Способ доставки»"],
      ["deliverySectionTitleWholesale", "Заголовок доставки (опт)"],
      ["cdekOptionTitle", "Название СДЭК"],
      ["cdekOptionDescription", "Описание СДЭК"],
      ["citySearchLabel", "Подпись поиска города"],
      ["citySearchPlaceholder", "Плейсхолдер поиска города"],
      ["pvzLabel", "Подпись «Выберите пункт выдачи»"],
      ["selectedPointLabel", "Подпись «Выбранный пункт»"],
      ["deliveryCostLabel", "Подпись «Стоимость доставки»"],
      ["selectCityHint", "Подсказка выбора города"],
      ["selectPointHint", "Подсказка выбора пункта"],
      ["freeDeliveryText", "Текст бесплатной доставки ({threshold})"],
    ],
  },
  {
    id: "contacts",
    label: "Контакты",
    icon: "person-outline",
    fields: [
      ["contactsSectionTitle", "Заголовок «Контактные данные»"],
      ["nameLabel", "Подпись «Полное имя»"],
      ["namePlaceholder", "Плейсхолдер имени"],
      ["emailLabel", "Подпись «Email»"],
      ["emailPlaceholder", "Плейсхолдер email"],
      ["phoneLabel", "Подпись «Телефон»"],
      ["phonePlaceholder", "Плейсхолдер телефона"],
      ["addressPlaceholder", "Плейсхолдер адреса"],
      ["addressWholesaleDescription", "Описание адреса (опт)"],
    ],
  },
  {
    id: "payment",
    label: "Оплата и промокоды",
    icon: "card-outline",
    fields: [
      ["paymentSectionTitle", "Заголовок «Способ оплаты»"],
      ["promoCodeLabel", "Подпись «Промокод»"],
      ["promoCodePlaceholder", "Плейсхолдер промокода"],
      ["promoCodeApplyText", "Текст кнопки «Применить» (промокод)"],
      ["giftCardLabel", "Подпись «Подарочный сертификат»"],
      ["giftCardPlaceholder", "Плейсхолдер сертификата"],
      ["giftCardApplyText", "Текст кнопки «Применить» (сертификат)"],
    ],
  },
  {
    id: "summary",
    label: "Итоги заказа",
    icon: "receipt-outline",
    fields: [
      ["orderSummaryTitle", "Заголовок «Ваш заказ»"],
      ["summarySubtotalLabel", "Сумма"],
      ["summaryPromoLabel", "Скидка по промокоду"],
      ["summaryLoyaltyLabel", "Накопительная скидка"],
      ["summaryGiftCardLabel", "Подарочный сертификат"],
      ["summaryDeliveryLabel", "Доставка СДЭК"],
      ["summaryDeliveryLabelWholesale", "Доставка (опт)"],
      ["summaryDeliveryWholesaleValue", "Значение доставки (опт)"],
      ["summaryTotalLabel", "Всего"],
      ["wholesaleBadgeText", "Бейдж «Оптовый заказ»"],
      ["wholesaleTransportTitle", "Заголовок транспортной компании"],
      ["wholesaleTransportDescription", "Описание транспортной компании"],
      ["wholesaleMinOrderText", "Текст минимального оптового заказа"],
    ],
  },
  {
    id: "agreements",
    label: "Согласия и ссылки",
    icon: "shield-checkmark-outline",
    fields: [
      ["offerAgreementText", "Текст перед офертой"],
      ["offerLinkText", "Текст ссылки на оферту"],
      ["offerLinkUrl", "URL оферты"],
      ["policyAgreementText", "Текст перед политикой"],
      ["policyLinkText", "Текст ссылки на политику"],
      ["policyLinkUrl", "URL политики"],
      ["consentText", "Текст согласия на обработку данных"],
    ],
  },
  {
    id: "delivery_info",
    label: "Инфо о доставке",
    icon: "information-circle-outline",
    fields: [
      ["deliveryInfoTitle", "Заголовок «Информация о доставке»"],
      ["deliveryInfoButtonText", "Текст кнопки «Информация о доставке»"],
      ["deliveryInfoText", "Основной текст"],
      ["wholesaleDeliveryInfoText", "Текст доставки (опт)"],
    ],
  },
];

export default function CheckoutScreen() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<Record<string, unknown>>("/page-settings/checkout");
        const raw = res.checkout_data;
        setSettings(
          raw && typeof raw === "object" ? (raw as Settings) : {},
        );
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const str = (key: string) => {
    const v = settings?.[key];
    return typeof v === "string" ? v : "";
  };

  const setStr = (key: string, value: string) => {
    setSettings((prev) => ({ ...(prev || {}), [key]: value }));
  };

  const bool = (key: string) => !!settings?.[key];

  const setBool = (key: string, value: boolean) => {
    setSettings((prev) => ({ ...(prev || {}), [key]: value }));
  };

  const thresholdRub = useMemo(() => {
    const v = settings?.freeDeliveryThreshold;
    const kop = typeof v === "number" ? v : Number(v) || 0;
    return String(Math.round(kop / 100));
  }, [settings?.freeDeliveryThreshold]);

  const setThresholdRub = (rub: string) => {
    const n = Number(rub);
    setSettings((prev) => ({ ...(prev || {}), freeDeliveryThreshold: Number.isFinite(n) ? Math.round(n * 100) : 0 }));
  };

  const items = useMemo(() => {
    const raw = settings?.retailDeliveryInfoItems;
    return Array.isArray(raw)
      ? raw.map((it) => (it && typeof it === "object" ? (it as Settings) : {}))
      : [];
  }, [settings?.retailDeliveryInfoItems]);

  const setItems = (next: Settings[]) => {
    setSettings((prev) => ({ ...(prev || {}), retailDeliveryInfoItems: next }));
  };

  const updateItem = (idx: number, patch: Settings) => {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = [...items];
    const to = idx + dir;
    if (to < 0 || to >= next.length) return;
    [next[idx], next[to]] = [next[to], next[idx]];
    setItems(next);
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setError("");
    setSavedMsg("");
    try {
      await apiPost("/admin/page-settings/checkout/checkout_data", settings);
      setSavedMsg("Настройки оформления сохранены");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen title="Оформление" scroll={false}>
        <LoadingView />
      </Screen>
    );
  }

  return (
    <Screen title="Оформление" subtitle="Тексты и настройки корзины и чекаута">
      <InlineError text={error} />
      {savedMsg ? <Text style={styles.saved}>{savedMsg}</Text> : null}

      <SectionTitle>Настройки чекаута</SectionTitle>

      {SECTIONS.map((sec) => (
        <Accordion key={sec.id} title={sec.label} icon={sec.icon}>
          {sec.fields.map(([key, label]) => (
            <Field key={key} label={label} value={str(key)} onChangeText={(v) => setStr(key, v)} multiline={key === "consentText" || key === "deliveryInfoText" || key === "wholesaleDeliveryInfoText"} />
          ))}

          {sec.id === "delivery" ? (
            <View style={styles.rowBetween}>
              <Text style={styles.rowLabel}>Баннер «Бесплатная доставка»</Text>
              <SwitchInline value={bool("showFreeDeliveryBanner")} onChange={(v) => setBool("showFreeDeliveryBanner", v)} />
            </View>
          ) : null}

          {sec.id === "delivery" ? (
            <Field
              label="Порог бесплатной доставки (₽)"
              value={thresholdRub}
              onChangeText={setThresholdRub}
              keyboardType="number-pad"
            />
          ) : null}

          {sec.id === "delivery_info" ? (
            <View style={styles.subBlock}>
              <Text style={styles.subTitle}>Пункты «Информация о доставке»</Text>
              {items.length === 0 ? <Text style={styles.hint}>Нет пунктов</Text> : null}
              {items.map((it, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <View style={styles.itemControls}>
                    <Pressable onPress={() => moveItem(idx, -1)} disabled={idx === 0} hitSlop={6} style={({ pressed }) => [styles.moveBtn, (idx === 0 || pressed) && { opacity: 0.35 }]}>
                      <Ionicons name="chevron-up" size={15} color={colors.textMuted} />
                    </Pressable>
                    <Pressable onPress={() => moveItem(idx, 1)} disabled={idx === items.length - 1} hitSlop={6} style={({ pressed }) => [styles.moveBtn, (idx === items.length - 1 || pressed) && { opacity: 0.35 }]}>
                      <Ionicons name="chevron-down" size={15} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label={`Пункт ${idx + 1}`} value={typeof it.text === "string" ? it.text : ""} onChangeText={(v) => updateItem(idx, { text: v })} multiline />
                  </View>
                  <View style={styles.itemRight}>
                    <SwitchInline value={!!it.visible} onChange={(v) => updateItem(idx, { visible: v })} />
                    <Pressable onPress={() => setItems(items.filter((_, i) => i !== idx))} hitSlop={8}>
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                </View>
              ))}
              <Button title="Добавить пункт" variant="secondary" icon="add" onPress={() => setItems([...items, { text: "", visible: true }])} />
            </View>
          ) : null}
        </Accordion>
      ))}

      <Button title="Сохранить все настройки" onPress={save} loading={saving} icon="save-outline" />
    </Screen>
  );
}

function SwitchInline({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.switchRow}>
      <Text style={styles.switchLabel}>{value ? "Вкл" : "Выкл"}</Text>
      <View style={[styles.switch, value && styles.switchOn]}>
        <View style={[styles.switchKnob, value && styles.switchKnobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  saved: { color: colors.success, fontSize: 13, marginBottom: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  rowLabel: { color: colors.text, fontSize: 14, fontWeight: "600", flex: 1 },
  subBlock: {
    marginTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  subTitle: { color: colors.text, fontSize: 14, fontWeight: "700", marginBottom: spacing.sm },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  itemControls: { flexDirection: "column", gap: 2, paddingTop: 24 },
  moveBtn: { width: 22, height: 18, alignItems: "center", justifyContent: "center" },
  itemRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingTop: 24 },
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
});
