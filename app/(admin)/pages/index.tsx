import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { colors, spacing } from "@/constants/theme";

const PAGES: Array<{
  key: string;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: "home", title: "Главная", desc: "Секции и порядок главной", icon: "home-outline" },
  { key: "navbar", title: "Навбар", desc: "Меню и ссылки", icon: "menu-outline" },
  { key: "footer", title: "Футер", desc: "Подвал сайта", icon: "reorder-three-outline" },
  { key: "checkout", title: "Оформление", desc: "Корзина и оплата", icon: "cart-outline" },
  { key: "categories", title: "Категории", desc: "Структура каталога", icon: "folder-open-outline" },
  { key: "artist_pages", title: "Артисты", desc: "Страницы артистов", icon: "mic-outline" },
  { key: "blog", title: "Блог", desc: "Посты блога", icon: "newspaper-outline" },
  { key: "vacancies", title: "Вакансии", desc: "Список вакансий", icon: "briefcase-outline" },
  { key: "concept", title: "Концепт", desc: "Концепт и коллаборации", icon: "color-wand-outline" },
  { key: "static", title: "Статичные", desc: "FAQ, о бренде, политика, оферта, уход", icon: "document-text-outline" },
  { key: "product_feature_templates", title: "Бейджи товаров", desc: "Шаблоны значков-характеристик", icon: "sparkles-outline" },
  { key: "site_config", title: "Сайт", desc: "Общие настройки сайта", icon: "settings-outline" },
];

export default function PagesScreen() {
  const router = useRouter();
  return (
    <Screen title="Страницы" scroll={false}>
      <FlatList
        data={PAGES}
        keyExtractor={(p) => p.key}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/pages/${item.key}` as never)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.icon}>
              <Ionicons name={item.icon} size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.sub}>{item.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.text, fontSize: 15, fontWeight: "600" },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
