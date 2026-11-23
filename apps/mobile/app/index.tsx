import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { fetchMenu, type Menu, type MenuItem } from "../src/api";
import { addToCart, useCart } from "../src/cart";
import { colors } from "../src/theme";

export default function MenuScreen() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const cart = useCart();
  const count = cart.reduce((sum, l) => sum + l.quantity, 0);

  useEffect(() => {
    fetchMenu()
      .then(setMenu)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "The menu could not be loaded."));
  }, []);

  const items = useMemo<MenuItem[]>(() => {
    if (!menu) return [];
    return menu.items.filter((i) => i.isAvailable && (categoryId === "all" || i.categoryId === categoryId));
  }, [menu, categoryId]);

  if (error) {
    return <Centered><Text style={styles.error}>{error}</Text></Centered>;
  }
  if (!menu) {
    return <Centered><ActivityIndicator color={colors.brand} /></Centered>;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <Text style={styles.heading}>Our menu</Text>
        <Pressable style={styles.cartButton} onPress={() => router.push("/cart")} accessibilityRole="button" accessibilityLabel={`Your order, ${count} items`}>
          <Text style={styles.cartButtonText}>Order · {count}</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
        <Chip label="All" active={categoryId === "all"} onPress={() => setCategoryId("all")} />
        {menu.categories.map((c) => (
          <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.list}>
        {items.length === 0 ? <Text style={styles.muted}>No dishes in this category yet.</Text> : null}
        {items.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.name}>{item.name}</Text>
              {item.description ? <Text style={styles.muted}>{item.description}</Text> : null}
              <Text style={styles.price}>{item.discountPrice ?? item.price}</Text>
            </View>
            {item.hasOptions ? (
              <Text style={styles.note}>Choose options on the website</Text>
            ) : (
              <Pressable style={styles.addButton} onPress={() => addToCart({ id: item.id, name: item.name, price: item.discountPrice ?? item.price })} accessibilityRole="button" accessibilityLabel={`Add ${item.name}`}>
                <Text style={styles.addButtonText}>Add</Text>
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]} accessibilityRole="button">
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 12 },
  heading: { fontSize: 26, fontWeight: "800", color: colors.ink },
  cartButton: { backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  cartButtonText: { color: colors.brandInk, fontWeight: "700" },
  chipRow: { flexGrow: 0, marginTop: 12 },
  chipRowContent: { paddingHorizontal: 16, gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.ink, fontWeight: "600" },
  chipTextActive: { color: colors.surface },
  list: { padding: 16, gap: 12 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.line },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
  price: { fontSize: 15, fontWeight: "700", color: colors.brand },
  muted: { color: colors.muted, fontSize: 14 },
  note: { color: colors.muted, fontSize: 12, maxWidth: 110, textAlign: "right" },
  addButton: { backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  addButtonText: { color: colors.brandInk, fontWeight: "700" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.canvas },
  error: { color: colors.danger, textAlign: "center", fontSize: 15 },
});
