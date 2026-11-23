import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

  const available = useMemo(() => (menu ? menu.items.filter((i) => i.isAvailable) : []), [menu]);
  const items = useMemo(
    () => available.filter((i) => categoryId === "all" || i.categoryId === categoryId),
    [available, categoryId],
  );
  const featured = useMemo(() => items.filter((i) => i.isFeatured), [items]);

  if (error) return <Centered><Text style={styles.error}>{error}</Text></Centered>;
  if (!menu) return <Centered><ActivityIndicator color={colors.ink} /></Centered>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Today's menu</Text>
        <Text style={styles.heading}>What are you <Text style={styles.headingLight}>craving?</Text></Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label="All" active={categoryId === "all"} onPress={() => setCategoryId("all")} />
        {menu.categories.map((c) => (
          <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
        ))}
      </ScrollView>

      {featured.length > 0 ? (
        <>
          <Text style={styles.section}>Featured</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
            {featured.map((item) => (
              <Pressable key={item.id} style={styles.featuredCard} onPress={() => router.push(`/dish/${item.id}`)} accessibilityRole="button" accessibilityLabel={item.name}>
                <Photo uri={item.imageUrl} style={styles.featuredPhoto} />
                <View style={styles.featuredShade} />
                <View style={styles.featuredText}>
                  <Text style={styles.featuredName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.featuredPrice}>{item.discountPrice ?? item.price}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      <Text style={styles.section}>{categoryId === "all" ? "All dishes" : menu.categories.find((c) => c.id === categoryId)?.name}</Text>
      {items.length === 0 ? <Text style={styles.muted}>No dishes in this category yet.</Text> : null}
      <View style={styles.grid}>
        {items.map((item) => (
          <DishCard key={item.id} item={item} />
        ))}
      </View>
    </ScrollView>
  );
}

function DishCard({ item }: { item: MenuItem }) {
  const open = () => router.push(`/dish/${item.id}`);
  return (
    <Pressable style={styles.card} onPress={open} accessibilityRole="button" accessibilityLabel={item.name}>
      <Photo uri={item.imageUrl} style={styles.cardPhoto} />
      <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
      {item.description ? <Text style={styles.muted} numberOfLines={1}>{item.description}</Text> : null}
      <View style={styles.cardFooter}>
        <Text style={styles.price}>{item.discountPrice ?? item.price}</Text>
        {item.hasOptions ? (
          <View style={styles.choose}><Text style={styles.chooseText}>Choose</Text></View>
        ) : (
          <Pressable
            style={styles.addRound}
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
            <Ionicons name="add" size={20} color={colors.surface} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

function Photo({ uri, style }: { uri: string | null; style: object }) {
  return uri ? <Image source={{ uri }} style={style} /> : <View style={[style, { backgroundColor: colors.line }]} />;
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
  content: { paddingTop: 4, paddingBottom: 130, gap: 14 },
  hero: { paddingHorizontal: 20, gap: 2 },
  kicker: { color: colors.muted, fontSize: 13, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase" },
  heading: { fontSize: 30, fontWeight: "800", color: colors.ink },
  headingLight: { fontWeight: "300" },
  chipRow: { paddingHorizontal: 16, gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 9 },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.ink, fontWeight: "600" },
  chipTextActive: { color: colors.surface },
  section: { fontSize: 18, fontWeight: "800", color: colors.ink, paddingHorizontal: 20, marginTop: 6 },
  featuredRow: { paddingHorizontal: 16, gap: 12 },
  featuredCard: { width: 240, height: 170, borderRadius: 26, overflow: "hidden", backgroundColor: colors.line },
  featuredPhoto: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  featuredShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.28)" },
  featuredText: { position: "absolute", left: 16, right: 16, bottom: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 8 },
  featuredName: { flex: 1, color: "#fff", fontWeight: "800", fontSize: 17 },
  featuredPrice: { color: "#fff", fontWeight: "700", backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingHorizontal: 16, rowGap: 14 },
  card: { width: "48%", backgroundColor: colors.surface, borderRadius: 24, padding: 10, gap: 4, borderWidth: 1, borderColor: colors.line },
  cardPhoto: { width: "100%", height: 130, borderRadius: 18, marginBottom: 6 },
  name: { fontSize: 15, fontWeight: "700", color: colors.ink, marginTop: 2 },
  muted: { color: colors.muted, fontSize: 12 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  price: { fontSize: 14, fontWeight: "800", color: colors.brand },
  addRound: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  choose: { borderRadius: 999, borderWidth: 1, borderColor: colors.ink, paddingHorizontal: 10, paddingVertical: 5 },
  chooseText: { color: colors.ink, fontWeight: "700", fontSize: 12 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.canvas },
  error: { color: colors.danger, textAlign: "center", fontSize: 15 },
});
