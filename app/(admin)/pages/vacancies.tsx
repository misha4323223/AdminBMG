import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Accordion } from "@/components/Accordion";
import { Button, Card, Field, InlineError, LoadingView, SectionTitle } from "@/components/ui";
import { apiGet, apiPost, getErrorMessage } from "@/lib/api";
import { colors, spacing } from "@/constants/theme";

interface VacancyItem {
  id: string;
  title: string;
  location: string;
  type: string;
  description: string;
  visible: boolean;
}

interface VacanciesData {
  pageTitle?: string;
  pageSubtitle?: string;
  hrEmail?: string;
  resumeText?: string;
  emptyText?: string;
  pageVisible?: boolean;
  vacancies?: VacancyItem[];
}

export default function VacanciesScreen() {
  const [data, setData] = useState<VacanciesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<{ vacancies_data?: VacanciesData }>("/page-settings/vacancies");
        setData(res?.vacancies_data || {});
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async (next: VacanciesData) => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await apiPost("/admin/page-settings/vacancies/vacancies_data", next);
      setData(next);
      setSaved(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen title="Вакансии" scroll={false}>
        <LoadingView />
      </Screen>
    );
  }

  const vacancies = data?.vacancies || [];
  const patch = (p: Partial<VacanciesData>) => setData((d) => ({ ...(d || {}), ...p }));
  const setVacancies = (v: VacancyItem[]) => setData((d) => ({ ...(d || {}), vacancies: v }));

  return (
    <Screen title="Вакансии" scroll>
      <InlineError text={error} />
      {saved ? <Text style={styles.saved}>Сохранено ✓</Text> : null}

      <Accordion title="Заголовок и контакты" icon="text-outline" defaultOpen>
        <Field label="Заголовок страницы" value={data?.pageTitle || ""} onChangeText={(v) => patch({ pageTitle: v })} />
        <Field label="Подзаголовок" value={data?.pageSubtitle || ""} onChangeText={(v) => patch({ pageSubtitle: v })} multiline />
        <Field label="Email HR" value={data?.hrEmail || ""} onChangeText={(v) => patch({ hrEmail: v })} autoCapitalize="none" keyboardType="email-address" />
        <Field label="Текст «отправить резюме»" value={data?.resumeText || ""} onChangeText={(v) => patch({ resumeText: v })} multiline />
        <Field label="Текст «нет вакансий»" value={data?.emptyText || ""} onChangeText={(v) => patch({ emptyText: v })} multiline />
        <Toggle label="Страница видима" value={data?.pageVisible !== false} onValueChange={(v) => patch({ pageVisible: v })} />
      </Accordion>

      <Accordion title={`Вакансии (${vacancies.length})`} icon="briefcase-outline" defaultOpen>
        {vacancies.map((v, i) => (
          <Card key={v.id} style={styles.vacCard}>
            <View style={styles.vacHeader}>
              <Text style={styles.vacTitle}>{v.title || `Вакансия ${i + 1}`}</Text>
              <View style={styles.vacActions}>
                <Toggle label="" value={v.visible} onValueChange={(val) => setVacancies(vacancies.map((x, j) => (j === i ? { ...x, visible: val } : x)))} />
                <Pressable onPress={() => setVacancies(vacancies.filter((_, j) => j !== i))} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>
            </View>
            <Field label="Название" value={v.title} onChangeText={(t) => setVacancies(vacancies.map((x, j) => (j === i ? { ...x, title: t } : x)))} />
            <Field label="Город" value={v.location} onChangeText={(t) => setVacancies(vacancies.map((x, j) => (j === i ? { ...x, location: t } : x)))} />
            <Field label="Тип занятости" value={v.type} onChangeText={(t) => setVacancies(vacancies.map((x, j) => (j === i ? { ...x, type: t } : x)))} />
            <Field label="Описание" value={v.description} onChangeText={(t) => setVacancies(vacancies.map((x, j) => (j === i ? { ...x, description: t } : x)))} multiline />
          </Card>
        ))}
        <Button
          title="Добавить вакансию"
          variant="secondary"
          icon="add"
          onPress={() =>
            setVacancies([
              ...vacancies,
              { id: String(Date.now()), title: "", location: "", type: "Полная занятость", description: "", visible: true },
            ])
          }
        />
      </Accordion>

      <Button title="Сохранить вакансии" onPress={() => save(data || {})} loading={saving} icon="save-outline" />
    </Screen>
  );
}

function Toggle({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => onValueChange(!value)}>
      {label ? <Text style={styles.toggleLabel}>{label}</Text> : null}
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <View style={[styles.toggleDot, value && styles.toggleDotOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  saved: { color: colors.success, fontSize: 13, marginBottom: spacing.sm },
  vacCard: { marginBottom: spacing.md },
  vacHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  vacTitle: { color: colors.text, fontSize: 15, fontWeight: "700", flex: 1 },
  vacActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm, gap: spacing.sm },
  toggleLabel: { color: colors.text, fontSize: 14, flexShrink: 1 },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: colors.surfaceAlt, padding: 3 },
  toggleOn: { backgroundColor: colors.accent },
  toggleDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.textMuted },
  toggleDotOn: { backgroundColor: colors.white, alignSelf: "flex-end" },
});
