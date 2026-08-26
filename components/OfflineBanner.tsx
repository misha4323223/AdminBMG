import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@/constants/theme";

/**
 * Тонкая плашка «Нет связи», показывается глобально на всех экранах
 * (встраивается в Screen). Пропадает сама, как только интернет вернулся.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false);
    });
    return unsub;
  }, []);

  if (!offline) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline-outline" size={13} color={colors.bg} />
      <Text style={styles.text}>Нет связи с интернетом</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.warning,
  },
  text: {
    color: colors.bg,
    fontSize: 12,
    fontWeight: "700",
  },
});
