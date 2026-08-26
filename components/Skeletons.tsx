import React from "react";
import { StyleSheet, View } from "react-native";

/**
 * Скелетон-заглушки для списков: серые «карточки-призраки» вместо спиннера.
 * Воспринимается как более быстрая загрузка.
 */
export function ListSkeleton({
  rows = 5,
  rowHeight = 96,
  gap = 12,
}: {
  rows?: number;
  rowHeight?: number;
  gap?: number;
}) {
  return (
    <View style={[styles.wrap, { gap }]}>
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={i}
          style={[
            styles.row,
            {
              height: rowHeight,
              opacity: 1 - i * (0.55 / rows), // затухание вниз
            },
          ]}
        >
          <View style={styles.lineShort} />
          <View style={styles.lineLong} />
          <View style={styles.lineMid} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 4,
  },
  row: {
    backgroundColor: "rgba(201, 206, 216, 0.07)",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(201, 206, 216, 0.14)",
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: "center",
    gap: 9,
  },
  lineShort: {
    width: "38%",
    height: 13,
    borderRadius: 7,
    backgroundColor: "rgba(201, 206, 216, 0.16)",
  },
  lineLong: {
    width: "82%",
    height: 11,
    borderRadius: 6,
    backgroundColor: "rgba(201, 206, 216, 0.11)",
  },
  lineMid: {
    width: "58%",
    height: 11,
    borderRadius: 6,
    backgroundColor: "rgba(201, 206, 216, 0.09)",
  },
});
