import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, InlineError } from "@/components/ui";
import { exportExcel, exportPdf, toExportError, type ExportColumn, type ExportRow } from "@/lib/export";
import { spacing } from "@/constants/theme";

export function ExportButtons({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: ExportColumn[];
  rows: ExportRow[];
}) {
  const [busy, setBusy] = useState<"excel" | "pdf" | null>(null);
  const [error, setError] = useState("");

  const run = async (kind: "excel" | "pdf") => {
    if (!rows.length) {
      setError("Нет данных для выгрузки");
      return;
    }
    setBusy(kind);
    setError("");
    try {
      if (kind === "excel") await exportExcel(title, columns, rows);
      else await exportPdf(title, columns, rows);
    } catch (e) {
      setError(toExportError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.buttons}>
        <Button
          title="Excel (.xls)"
          variant="secondary"
          icon="document-text-outline"
          onPress={() => run("excel")}
          loading={busy === "excel"}
          disabled={busy !== null}
        />
        <Button
          title="PDF / печать"
          variant="secondary"
          icon="print-outline"
          onPress={() => run("pdf")}
          loading={busy === "pdf"}
          disabled={busy !== null}
        />
      </View>
      <InlineError text={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm, marginBottom: spacing.sm },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
