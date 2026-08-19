import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Screen } from "@/components/Screen";
import { Badge, EmptyState, LoadingView } from "@/components/ui";
import { useFetch } from "@/lib/useFetch";
import { formatRub } from "@/lib/format";
import { colors, radius, spacing } from "@/constants/theme";

type Tab = "hidden" | "noimage" | "zeroprice";

export default function ProblemsScreen() {
  const [tab, setTab] = useState<Tab>("hidden");
  return (
    <Screen title="Проблемные товары" scroll={false}>
      <View style={styles.tabs}>
        <TabBtn label="Скрытые" active={tab === "hidden"} onPress={() => setTab("hidden")} />
        <TabBtn label="Без фото" active={tab === "noimage"} onPress={() => setTab("noimage")} />
        <TabBtn label="Цена 0" active={tab === "zeroprice"} onPress={() => setTab("zeroprice")} />
      </View>
      {tab === "hidden" ? <List url="/products/hidden" /> : null}
      {tab === "noimage" ? <List url="/products/no-image" /> : null}
      {tab === "zeroprice" ? <List url="/products/zero-price" /> : null}
    </Screen>
  );
}

function List({ url }: { url: string }) {
  const router = useRouter();
  const { data, loading, refreshing, error, reload } = useFetch<any>(url);

  const items = useMemo(() => {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.products)) return data.products;
    return [];
  }, [data]);

  return (
    <FlatList
      data={items}
      keyExtractor={(p) => String(p.id)}
      onRefresh={reload}
      refreshing={refreshing}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/products/${item.id}` as never)}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        >
          <Image
            source={{ uri: item.imageUrl || item.images?.[0] }}
            style={styles.thumb}
            contentFit="cover"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.sub}>
              {item.category || "—"} · {formatRub(item.price)}
            </Text>
          </View>
          <Badge tone="warning">
            {Number(item.price || 0) <= 0 ? "цена 0" : "проблема"}
          </Badge>
        </Pressable>
      )}
      ListEmptyComponent={loading ? <LoadingView /> : <EmptyState text={error || "Проблем нет"} />}
    />
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.textMuted, fontWeight: "600", fontSize: 13 },
  tabTextActive: { color: colors.white },
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
  thumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  title: { color: colors.text, fontSize: 15, fontWeight: "600" },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
