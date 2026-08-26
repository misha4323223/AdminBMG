import React, { useState } from "react";
import { Platform, StyleSheet, Text, View, type ViewProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/constants/theme";

/**
 * Обёртка, принимающая перетащенные файлы (рабочий стол → окно).
 * Работает только на web/Electron; на нативе — обычный View без обработчиков.
 */

export interface DroppedFile {
  uri: string; // blob:-URL, пригодный для uploadImage()
  name: string;
}

interface DropZoneProps extends ViewProps {
  onFiles: (files: DroppedFile[]) => void;
  children: React.ReactNode;
  /** Подсказка поверх контента при перетаскивании. */
  hint?: string;
}

export function DropZone({ onFiles, children, hint = "Отпустите, чтобы загрузить", style, ...rest }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);

  if (Platform.OS !== "web") {
    return (
      <View style={style} {...rest}>
        {children}
      </View>
    );
  }

  const toFiles = (list: FileList | null): DroppedFile[] =>
    Array.from(list || [])
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({ uri: URL.createObjectURL(f), name: f.name }));

  // web-only DOM-события, которых нет в типах RN View.
  const webProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = toFiles(e.dataTransfer?.files ?? null);
      if (files.length > 0) onFiles(files);
    },
  };

  return (
    <View
      style={[style, dragging && styles.zoneActive]}
      {...(webProps as unknown as Record<string, unknown>)}
      {...rest}
    >
      {children}
      {dragging ? (
        <View style={styles.overlay}>
          <Ionicons name="cloud-upload-outline" size={22} color={colors.accent} />
          <Text style={styles.overlayText}>{hint}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  zoneActive: {
    borderColor: colors.accent,
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.md,
    backgroundColor: "rgba(9, 10, 14, 0.88)",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    zIndex: 20,
  },
  overlayText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
});
