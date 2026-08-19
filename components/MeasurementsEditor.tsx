import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Field, SectionTitle } from "./ui";
import { colors, radius, spacing } from "@/constants/theme";

export interface MeasurementRow {
  size?: string;
  length?: string;
  chest?: string;
  shoulders?: string;
  sleeves?: string;
  waist?: string;
  hips?: string;
  sideLength?: string;
  bottomWidth?: string;
}

export interface MeasurementSection {
  title: string;
  rows: MeasurementRow[];
}

export interface MeasurementsValue {
  measurements: MeasurementRow[];
  sections: MeasurementSection[];
  labels: Record<string, string>;
}

const FIELDS: Array<{ key: keyof MeasurementRow; def: string }> = [
  { key: "waist", def: "Шир. в поясе" },
  { key: "hips", def: "Шир. в бёдрах" },
  { key: "sideLength", def: "Дл. по боковому" },
  { key: "bottomWidth", def: "Шир. входа в низу" },
  { key: "length", def: "Длина" },
  { key: "shoulders", def: "Плечи" },
  { key: "chest", def: "Грудь" },
  { key: "sleeves", def: "Рукав" },
];

const TEMPLATES: Record<string, { label: string; sizes: MeasurementRow[] }> = {
  tshirt: {
    label: "Футболки",
    sizes: [
      { size: "XS", length: "64", chest: "96", shoulders: "42", sleeves: "19" },
      { size: "S", length: "66", chest: "100", shoulders: "44", sleeves: "20" },
      { size: "M", length: "68", chest: "104", shoulders: "46", sleeves: "21" },
      { size: "L", length: "70", chest: "110", shoulders: "48", sleeves: "22" },
      { size: "XL", length: "72", chest: "116", shoulders: "50", sleeves: "23" },
      { size: "XXL", length: "74", chest: "122", shoulders: "52", sleeves: "24" },
    ],
  },
  hoodie: {
    label: "Худи / Свитшоты",
    sizes: [
      { size: "XS", length: "64", chest: "104", shoulders: "44", sleeves: "60" },
      { size: "S", length: "66", chest: "108", shoulders: "46", sleeves: "62" },
      { size: "M", length: "68", chest: "112", shoulders: "48", sleeves: "63" },
      { size: "L", length: "70", chest: "118", shoulders: "50", sleeves: "64" },
      { size: "XL", length: "72", chest: "124", shoulders: "52", sleeves: "65" },
      { size: "XXL", length: "74", chest: "130", shoulders: "54", sleeves: "66" },
    ],
  },
  jacket: {
    label: "Куртки",
    sizes: [
      { size: "S", length: "66", chest: "110", shoulders: "46", sleeves: "63" },
      { size: "M", length: "68", chest: "114", shoulders: "48", sleeves: "64" },
      { size: "L", length: "70", chest: "120", shoulders: "50", sleeves: "65" },
      { size: "XL", length: "72", chest: "126", shoulders: "52", sleeves: "66" },
      { size: "XXL", length: "74", chest: "132", shoulders: "54", sleeves: "67" },
    ],
  },
  pants: {
    label: "Брюки / Джоггеры",
    sizes: [
      { size: "XS", waist: "34", hips: "46", length: "71" },
      { size: "S", waist: "36", hips: "48", length: "72" },
      { size: "M", waist: "38", hips: "50", length: "73" },
      { size: "L", waist: "41", hips: "53", length: "74" },
      { size: "XL", waist: "44", hips: "56", length: "75" },
      { size: "XXL", waist: "47", hips: "59", length: "76" },
    ],
  },
  shorts: {
    label: "Шорты",
    sizes: [
      { size: "XS", waist: "34", hips: "46", length: "18" },
      { size: "S", waist: "36", hips: "48", length: "19" },
      { size: "M", waist: "38", hips: "50", length: "20" },
      { size: "L", waist: "41", hips: "53", length: "22" },
      { size: "XL", waist: "44", hips: "56", length: "23" },
      { size: "XXL", waist: "47", hips: "59", length: "24" },
    ],
  },
  pants_suit: {
    label: "Низ костюма / Брюки",
    sizes: [
      { size: "XS", waist: "34", hips: "46", sideLength: "98", bottomWidth: "20" },
      { size: "S", waist: "36", hips: "48", sideLength: "100", bottomWidth: "21" },
      { size: "M", waist: "38", hips: "50", sideLength: "102", bottomWidth: "22" },
      { size: "L", waist: "41", hips: "53", sideLength: "104", bottomWidth: "23" },
      { size: "XL", waist: "44", hips: "56", sideLength: "106", bottomWidth: "24" },
      { size: "XXL", waist: "47", hips: "59", sideLength: "108", bottomWidth: "25" },
    ],
  },
};

export function MeasurementsEditor({
  value,
  onChange,
}: {
  value: MeasurementsValue;
  onChange: (v: MeasurementsValue) => void;
}) {
  const sectionsMode = value.sections.length > 0;

  // Which columns are currently visible (UI concern, not persisted).
  const [visible, setVisible] = useState<Set<string> | null>(null);
  const [labelsOpen, setLabelsOpen] = useState(false);

  const allRows = useMemo(
    () => [...value.measurements, ...value.sections.flatMap((s) => s.rows)],
    [value],
  );

  const activeVisible = useMemo(() => {
    if (visible) return visible;
    const keys = FIELDS.filter((f) => allRows.some((r) => (r[f.key] || "").toString().trim()));
    if (keys.length > 0) return new Set(keys.map((f) => f.key));
    return new Set(["length", "chest", "shoulders", "sleeves"]);
  }, [visible, allRows]);

  const toggleVisible = (key: string) => {
    const next = new Set(activeVisible);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setVisible(next);
  };

  const label = (key: string) => value.labels[key] || FIELDS.find((f) => f.key === key)?.def || key;

  const setLabel = (key: string, text: string) =>
    onChange({ ...value, labels: { ...value.labels, [key]: text } });

  const setMeasurements = (m: MeasurementRow[]) => onChange({ ...value, measurements: m });

  const setSections = (s: MeasurementSection[]) => onChange({ ...value, sections: s });

  const applyTemplate = (templateKey: string) => {
    const tmpl = TEMPLATES[templateKey];
    if (!tmpl) return;
    const rows = tmpl.sizes.map((r) => ({ ...r }));
    if (sectionsMode) {
      setSections(value.sections.map((s) => ({ ...s, rows })));
    } else {
      setMeasurements(rows);
    }
    setVisible(null);
  };

  const RowEditor = ({ rows, onChangeRows }: { rows: MeasurementRow[]; onChangeRows: (r: MeasurementRow[]) => void }) => {
    const updateRow = (i: number, field: keyof MeasurementRow, text: string) =>
      onChangeRows(rows.map((r, idx) => (idx === i ? { ...r, [field]: text } : r)));
    const removeRow = (i: number) => onChangeRows(rows.filter((_, idx) => idx !== i));

    return (
      <View>
        {rows.map((row, i) => (
          <Card key={i} style={styles.rowCard}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowIndex}>Размер #{i + 1}</Text>
              <Pressable onPress={() => removeRow(i)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
            <Field label="Размер" value={row.size || ""} onChangeText={(v) => updateRow(i, "size", v)} placeholder="S, M, L…" />
            <View style={styles.grid}>
              {FIELDS.filter((f) => activeVisible.has(f.key)).map((f) => (
                <View key={f.key} style={styles.gridCell}>
                  <Text style={styles.gridLabel}>{label(f.key)}</Text>
                  <TextInput
                    value={row[f.key] || ""}
                    onChangeText={(v) => updateRow(i, f.key, v)}
                    placeholder="см"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={styles.gridInput}
                  />
                </View>
              ))}
            </View>
          </Card>
        ))}
      </View>
    );
  };

  return (
    <View>
      {/* Mode toggle */}
      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeBtn, !sectionsMode && styles.modeBtnActive]}
          onPress={() => onChange({ ...value, sections: [] })}
        >
          <Text style={[styles.modeText, !sectionsMode && styles.modeTextActive]}>Одна таблица</Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, sectionsMode && styles.modeBtnActive]}
          onPress={() => {
            if (!sectionsMode) {
              onChange({
                ...value,
                measurements: [],
                sections: [
                  { title: "Верх", rows: [] },
                  { title: "Низ", rows: [] },
                ],
              });
            }
          }}
        >
          <Text style={[styles.modeText, sectionsMode && styles.modeTextActive]}>Верх + Низ (костюм)</Text>
        </Pressable>
      </View>

      {/* Templates */}
      <Text style={styles.subLabel}>Шаблон</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
        {Object.entries(TEMPLATES).map(([k, t]) => (
          <Pressable key={k} style={styles.templateChip} onPress={() => applyTemplate(k)}>
            <Text style={styles.templateText}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Columns + labels accordion */}
      <Pressable style={styles.accordion} onPress={() => setLabelsOpen((v) => !v)}>
        <Text style={styles.accordionTitle}>Колонки и названия</Text>
        <Ionicons name={labelsOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
      </Pressable>
      {labelsOpen ? (
        <View style={styles.accordionBody}>
          <Text style={styles.subLabel}>Показать колонки</Text>
          <View style={styles.chipWrap}>
            {FIELDS.map((f) => (
              <Pressable
                key={f.key}
                style={[styles.chip, activeVisible.has(f.key) && styles.chipActive]}
                onPress={() => toggleVisible(f.key)}
              >
                <Text style={[styles.chipText, activeVisible.has(f.key) && styles.chipTextActive]}>
                  {label(f.key)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.subLabel}>Названия колонок</Text>
          {FIELDS.filter((f) => activeVisible.has(f.key)).map((f) => (
            <Field key={f.key} label={f.def} value={label(f.key)} onChangeText={(v) => setLabel(f.key, v)} />
          ))}
        </View>
      ) : null}

      {/* Single mode */}
      {!sectionsMode ? (
        <View>
          <RowEditor rows={value.measurements} onChangeRows={setMeasurements} />
          <Button
            title="Добавить строку"
            variant="secondary"
            icon="add"
            onPress={() => setMeasurements([...value.measurements, { size: "" }])}
          />
        </View>
      ) : (
        /* Sections mode */
        <View style={styles.sections}>
          {value.sections.map((section, sIdx) => (
            <SectionAccordion key={sIdx} title={section.title}>
              <View style={styles.sectionBody}>
                <Field
                  label="Название секции"
                  value={section.title}
                  onChangeText={(v) =>
                    setSections(value.sections.map((s, i) => (i === sIdx ? { ...s, title: v } : s)))
                  }
                />
                <RowEditor
                  rows={section.rows}
                  onChangeRows={(rows) =>
                    setSections(value.sections.map((s, i) => (i === sIdx ? { ...s, rows } : s)))
                  }
                />
                <Button
                  title="Добавить строку"
                  variant="secondary"
                  icon="add"
                  onPress={() =>
                    setSections(
                      value.sections.map((s, i) =>
                        i === sIdx ? { ...s, rows: [...s.rows, { size: "" }] } : s,
                      ),
                    )
                  }
                />
                <View style={styles.dangerRow}>
                  <Button
                    title="Удалить секцию"
                    variant="danger"
                    icon="trash-outline"
                    onPress={() => setSections(value.sections.filter((_, i) => i !== sIdx))}
                  />
                </View>
              </View>
            </SectionAccordion>
          ))}
          <Button
            title="Добавить секцию"
            variant="secondary"
            icon="add"
            onPress={() => setSections([...value.sections, { title: "Секция", rows: [] }])}
          />
        </View>
      )}
    </View>
  );
}

function SectionAccordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <View style={styles.sectionCard}>
      <Pressable style={styles.sectionHeader} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.sectionTitle}>{title || "Секция"}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
      </Pressable>
      {open ? <View style={styles.sectionContent}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: "row", borderRadius: radius.sm, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginBottom: spacing.md },
  modeBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: "center", backgroundColor: colors.surface },
  modeBtnActive: { backgroundColor: colors.accent },
  modeText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  modeTextActive: { color: colors.white },
  subLabel: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.xs },
  templateRow: { gap: spacing.sm, paddingRight: spacing.lg },
  templateChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  templateText: { color: colors.text, fontSize: 12 },
  accordion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  accordionTitle: { color: colors.text, fontSize: 14, fontWeight: "600" },
  accordionBody: { paddingVertical: spacing.sm },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: 11 },
  chipTextActive: { color: colors.accent, fontWeight: "600" },
  rowCard: { marginBottom: spacing.md },
  rowHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  rowIndex: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  gridCell: { width: "48%", flexGrow: 1 },
  gridLabel: { color: colors.textMuted, fontSize: 11, marginBottom: 4 },
  gridInput: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 14,
  },
  sections: { gap: spacing.md, marginTop: spacing.sm },
  sectionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  sectionContent: { padding: spacing.md, paddingTop: 0 },
  sectionBody: {},
  dangerRow: { marginTop: spacing.sm },
});
