import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { fetchMenu, type Menu, type MenuItem } from "../../src/api";
import { addLine } from "../../src/cart";
import { colors } from "../../src/theme";

export default function MenuScreen() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | "all">("all");

  useEffect(() => {
    fetchMenu()
      .then(setMenu)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "The menu could not be loaded."));
  }, []);

  const items = useMemo<MenuItem[]>(() => {
    if (!menu) return [];
    return menu.items.filter((i) => i.isAvailable && (categoryId === "all" || i.categoryId === categoryId));
  }, [menu, categoryId]);

  if (error) return <Centered><Text style={styles.error}>{error}</Text></Centered>;
  if (!menu) return <Centered><ActivityIndicator color={colors.brand} /></Centered>;

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <Text style={styles.heading}>Our menu</Text>
        <Text style={styles.muted}>Pick a dish to see its sizes and extras</Text>
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
          <Pressable key={item.id} style={styles.card} onPress={() => router.push(`/dish/${item.id}`)} accessibilityRole="button" accessibilityLabel={item.name}>
            {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: colors.line }]} />}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              {item.description ? <Text style={styles.muted} numberOfLines={2}>{item.description}</Text> : null}
              <Text style={styles.price}>{item.discountPrice ?? item.price}</Text>
            </View>
            {item.hasOptions ? (
              <View style={styles.outlinePill}><Text style={styles.outlineText}>Choose</Text></View>
            ) : (
              <Pressable
                style={styles.addPill}
                onPress={(e) => {
                  e.stopPropagation();
                  addLine({
                    productId: item.id,
                    name: item.name,
                    imageUrl: item.imageUrl,
                    variantId: null,
                    modifierIds: [],
                    optionLabel: "",
                    unitMinor: Number(item.discountPriceMinor ?? item.priceMinor),
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel={`Add ${item.name}`}
              >
                <Text style={styles.addText}>Add</Text>
              </Pressable>
            )}
          </Pressable>
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
  topRow: { paddingHorizontal: 16, paddingTop: 8, gap: 2 },
  heading: { fontSize: 28, fontWeight: "800", color: colors.ink },
  muted: { color: colors.muted, fontSize: 13 },
  cartButton: { backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  cartButtonText: { color: colors.brandInk, fontWeight: "700" },
  ghostButton: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 9 },
  ghostText: { color: colors.ink, fontWeight: "600" },
  chipRow: { flexGrow: 0, marginTop: 14 },
  chipRowContent: { paddingHorizontal: 16, gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.ink, fontWeight: "600" },
  chipTextActive: { color: colors.surface },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: 20, padding: 10, borderWidth: 1, borderColor: colors.line },
  thumb: { width: 84, height: 84, borderRadius: 16 },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
  price: { fontSize: 15, fontWeight: "800", color: colors.brand },
  addPill: { backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  addText: { color: colors.surface, fontWeight: "700" },
  outlinePill: { borderRadius: 999, borderWidth: 1.5, borderColor: colors.ink, paddingHorizontal: 14, paddingVertical: 8 },
  outlineText: { color: colors.ink, fontWeight: "700" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.canvas },
  error: { color: colors.danger, textAlign: "center", fontSize: 15 },
});
