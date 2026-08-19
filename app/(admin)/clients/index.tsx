import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Badge, EmptyState, LoadingView, SearchBar } from "@/components/ui";
import { useFetch } from "@/lib/useFetch";
import { formatDate, formatRub, initials } from "@/lib/format";
import type { Client, WholesaleClient } from "@/lib/types";
import { colors, spacing } from "@/constants/theme";

export default function ClientsScreen() {
  const [tab, setTab] = useState<"retail" | "wholesale">("retail");
  const [query, setQuery] = useState("");

  const retail = useFetch<{ users: Client[] }>("/admin/users", tab === "retail");
  const wholesale = useFetch<{ users: WholesaleClient[] }>(
    "/admin/wholesale-users",
    tab === "wholesale",
  );

  const active = tab === "retail" ? retail : wholesale;

  const filtered = useMemo(() => {
    const list = (active.data?.users || []) as (Client | WholesaleClient)[];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      const hay = [c.email, c.name, c.phone, c.companyName, c.inn]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [active.data, query]);

  return (
    <Screen
      title="Клиенты"
      subtitle={active.error || `${filtered.length} записей`}
      scroll={false}
    >
      <View style={styles.tabs}>
        <TabButton label="Розница" active={tab === "retail"} onPress={() => setTab("retail")} />
        <TabButton label="Опт" active={tab === "wholesale"} onPress={() => setTab("wholesale")} />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={styles.list}
        onRefresh={active.reload}
        refreshing={active.refreshing}
        ListHeaderComponent={
          <View style={styles.search}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder={tab === "retail" ? "Поиск по имени, email, телефону" : "Поиск по компании, email, ИНН"}
            />
          </View>
        }
        renderItem={({ item }) => {
          if (tab === "retail") {
            const c = item as Client;
            return (
              <ClientRow
                key={c.id}
                avatar={initials(c.name)}
                title={c.name || c.email}
                subtitle={`${c.email}${c.phone ? ` · ${c.phone}` : ""}`}
                right={<Badge tone="neutral">{formatRub(c.totalSpent)}</Badge>}
              />
            );
          }
          const w = item as WholesaleClient;
          return (
            <ClientRow
              key={w.id}
              avatar={initials(w.companyName || w.name)}
              title={w.companyName || w.name || w.email}
              subtitle={`${w.email}${w.inn ? ` · ИНН ${w.inn}` : ""}`}
              right={
                w.wholesaleApproved ? (
                  <Badge tone="success">одобрен</Badge>
                ) : (
                  <Badge tone="warning">на модерации</Badge>
                )
              }
            />
          );
        }}
        ListEmptyComponent={
          active.loading ? <LoadingView /> : <EmptyState text="Клиентов не найдено" />
        }
      />
    </Screen>
  );
}

function ClientRow({
  avatar,
  title,
  subtitle,
  right,
}: {
  avatar: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{avatar}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.name}>{title}</Text>
        {subtitle ? (
          <Text style={styles.sub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
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
  tabActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabText: {
    color: colors.textMuted,
    fontWeight: "600",
  },
  tabTextActive: {
    color: colors.white,
  },
  search: {
    padding: spacing.lg,
  },
  list: {
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.textMuted,
    fontWeight: "700",
  },
  rowBody: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  sub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
