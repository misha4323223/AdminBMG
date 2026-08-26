import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, spacing } from "@/constants/theme";
import { OfflineBanner } from "@/components/OfflineBanner";

interface ScreenProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  scroll?: boolean;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
  /** Куда вернуться, если истории назад нет (например, после перезагрузки на вложенной странице). По умолчанию — главная админки. */
  backTo?: string;
  /** Полностью скрыть кнопку «Назад» (для корневых экранов вроде дашборда). */
  hideBack?: boolean;
}

export function Screen({
  title,
  subtitle,
  right,
  scroll = true,
  headerExtra,
  backTo = "/(admin)",
  hideBack = false,
  children,
}: ScreenProps) {
  const router = useRouter();
  const showBack = !hideBack;

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(backTo);
    }
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {showBack ? (
          <Pressable
            onPress={goBack}
            style={styles.back}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Назад"
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        ) : null}
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.headerRight}>{right}</View> : null}
      </View>
      {headerExtra}
    </View>
  );

  // ПК/широкий экран: контент не растягивается «огромным телефоном»,
  // а ограничивается удобной шириной и центрируется.
  const wideWrap = Platform.OS === "web" ? styles.wide : undefined;

  if (!scroll) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <OfflineBanner />
        {header}
        <View style={[styles.body, wideWrap]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <OfflineBanner />
      {header}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={wideWrap}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.xs,
    backgroundColor: colors.surfaceAlt,
  },
  headerText: {
    flex: 1,
  },
  headerRight: {
    marginLeft: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontFamily: font.bold,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  body: {
    flex: 1,
  },
  wide: {
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
  },
});
