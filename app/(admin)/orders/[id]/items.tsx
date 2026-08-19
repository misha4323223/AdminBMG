import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Button, Card, Field, InlineError, LoadingView, SearchBar, SectionTitle } from "@/components/ui";
import { apiGet, apiPatch, getErrorMessage } from "@/lib/api";
import { formatRub } from "@/lib/format";
import type { Order, Product } from "@/lib/types";
import { colors, spacing } from "@/constants/theme";

interface EditableItem {
  key: string;
  productId?: number;
  name: string;
  priceRub: string;
  quantity: string;
  size: string;
  color: string;
}

function toEditable(it: any, i: number): EditableItem {
  return {
    key: String(i),
    productId: it.productId,
    name: it.name || `Товар #${it.productId ?? ""}`,
    priceRub: it.price ? String(Number(it.price) / 100) : "",
    quantity: String(it.quantity ?? 1),
    size: it.size || "",
    color: it.color || "",
  };
}

export default function OrderItemsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [items, setItems] = useState<EditableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Add product search
  const [adding, setAdding] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [orders, drafts] = await Promise.all([
          apiGet<Order[]>("/admin/orders"),
          apiGet<Order[]>("/admin/draft-orders"),
        ]);
        const found = [...(orders || []), ...(drafts || [])].find((o) => String(o.id) === String(id));
        if (found && Array.isArray(found.items)) {
          setItems(found.items.map(toEditable));
        } else {
          setError("Заказ не найден");
        }
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const loadProducts = async () => {
    try {
      const data = await apiGet<{ products: Product[] }>("/products?limit=5000&admin=true");
      setProducts(data.products || []);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  useEffect(() => {
    if (adding && products.length === 0) loadProducts();
  }, [adding]);

  const matchingProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 50);
    return products
      .filter((p) => (p.name || "").toLowerCase().includes(q))
      .slice(0, 50);
  }, [products, query]);

  const total = items.reduce((s, it) => s + (Number(it.priceRub) || 0) * (Number(it.quantity) || 0), 0);

  const update = (key: string, patch: Partial<EditableItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };

  const remove = (key: string) => setItems((prev) => prev.filter((it) => it.key !== key));

  const addProduct = (p: Product) => {
    setItems((prev) => [
      ...prev,
      {
        key: `add-${Date.now()}`,
        productId: p.id,
        name: p.name,
        priceRub: p.price ? String(Number(p.price) / 100) : "",
        quantity: "1",
        size: "",
        color: p.color || "",
      },
    ]);
    setAdding(false);
    setQuery("");
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const body = items.map((it) => ({
        productId: it.productId,
        name: it.name,
        price: Math.round((Number(it.priceRub) || 0) * 100),
        quantity: Number(it.quantity) || 1,
        size: it.size || undefined,
        color: it.color || undefined,
      }));
      await apiPatch(`/admin/orders/${id}/items`, { items: body });
      router.back();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen title="Состав заказа" scroll={false}>
        <LoadingView />
      </Screen>
    );
  }

  return (
    <Screen
      title="Состав заказа"
      subtitle={`Итого: ${formatRub(Math.round(total * 100))}`}
      scroll={false}
      right={
        <Pressable onPress={() => setAdding((v) => !v)} style={styles.addBtn} hitSlop={8}>
          <Ionicons name="add" size={20} color={colors.accent} />
        </Pressable>
      }
    >
      <InlineError text={error} />

      {adding ? (
        <View style={styles.addPanel}>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Поиск товара для добавления" />
          <FlatList
            data={matchingProducts}
            keyExtractor={(p) => String(p.id)}
            style={{ maxHeight: 260 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => addProduct(item)} style={styles.productRow}>
                <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.productPrice}>{formatRub(item.price)}</Text>
              </Pressable>
            )}
          />
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(it) => it.key}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
              <Pressable onPress={() => remove(item.key)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
            <View style={styles.itemFields}>
              <Field
                label="Цена, ₽"
                value={item.priceRub}
                onChangeText={(v) => update(item.key, { priceRub: v })}
                keyboardType="numeric"
              />
              <Field
                label="Кол-во"
                value={item.quantity}
                onChangeText={(v) => update(item.key, { quantity: v })}
                keyboardType="numeric"
              />
              <Field label="Размер" value={item.size} onChangeText={(v) => update(item.key, { size: v })} />
              <Field label="Цвет" value={item.color} onChangeText={(v) => update(item.key, { color: v })} />
            </View>
          </Card>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Состав пуст</Text>}
      />

      <View style={styles.footer}>
        <Button title="Сохранить состав" onPress={save} loading={saving} icon="save-outline" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  addPanel: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  productRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  productName: { color: colors.text, fontSize: 13, flex: 1 },
  productPrice: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  list: { padding: spacing.lg, gap: spacing.md },
  itemCard: { marginBottom: spacing.sm },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  itemName: { color: colors.text, fontSize: 15, fontWeight: "600", flex: 1 },
  itemFields: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  empty: { color: colors.textMuted, textAlign: "center", padding: spacing.xl },
  footer: { padding: spacing.lg },
});
