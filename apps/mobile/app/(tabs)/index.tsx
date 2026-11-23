import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { fetchMenu, type Menu, type MenuItem } from "../../src/api";
import { addLine } from "../../src/cart";
import { colors } from "../../src/theme";

export default function MenuScreen() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | "all">("all");

  async function loadMenu(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try { setMenu(await fetchMenu()); }
    catch (e) { setError(e instanceof Error ? e.message : "The menu could not be loaded."); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { void loadMenu(); }, []);

  const available = useMemo(() => (menu ? menu.items.filter((i) => i.isAvailable) : []), [menu]);
  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    return available.filter((i) => (categoryId === "all" || i.categoryId === categoryId) &&
      (!query || i.name.toLowerCase().includes(query) || (i.description ?? "").toLowerCase().includes(query)));
  }, [available, categoryId, search]);
  const featured = useMemo(() => items.filter((i) => i.isFeatured), [items]);

  if (loading && !menu) return <Centered><ActivityIndicator size="large" color={colors.brand} /><Text style={styles.loadingText}>Loading menu…</Text></Centered>;
  if (error && !menu) return <Centered><Text style={styles.error}>{error}</Text><Pressable style={styles.retryButton} onPress={() => void loadMenu()}><Text style={styles.retryText}>Try again</Text></Pressable></Centered>;
  if (!menu || menu.source === "unavailable") return <Centered><Text style={styles.error}>The menu is temporarily unavailable.</Text><Pressable style={styles.retryButton} onPress={() => void loadMenu()}><Text style={styles.retryText}>Reload menu</Text></Pressable></Centered>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadMenu(true)} tintColor={colors.brand} />}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Today's menu</Text>
        <Text style={styles.heading}>What are you <Text style={styles.headingLight}>craving?</Text></Text>
        <Pressable style={styles.scanButton} onPress={() => router.push("/scan")} accessibilityRole="button">
          <Ionicons name="qr-code-outline" size={18} color={colors.surface} />
          <Text style={styles.scanButtonText}>Scan table QR</Text>
        </Pressable>
      </View>

      <View style={styles.searchBox}><Ionicons name="search-outline" size={19} color={colors.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Search dishes…" placeholderTextColor={colors.muted} style={styles.searchInput} returnKeyType="search" />{search.length > 0 ? <Pressable onPress={() => setSearch("")} accessibilityRole="button" accessibilityLabel="Clear search"><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}</View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label="All" active={categoryId === "all"} onPress={() => setCategoryId("all")} />
        {menu.categories.map((c) => (
          <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
        ))}
      </ScrollView>

      {featured.length > 0 && !search.trim() ? (
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

      <View style={styles.sectionHeader}><View><Text style={styles.section}>{search.trim() ? "Search results" : categoryId === "all" ? "All dishes" : menu.categories.find((c) => c.id === categoryId)?.name}</Text><Text style={styles.resultCount}>{items.length} {items.length === 1 ? "dish" : "dishes"} available</Text></View></View>
      {items.length === 0 ? <View style={styles.emptyState}><Ionicons name="search-outline" size={26} color={colors.muted} /><Text style={styles.emptyTitle}>No dishes found</Text><Text style={styles.muted}>Try another search or category.</Text><Pressable onPress={() => { setSearch(""); setCategoryId("all"); }}><Text style={styles.clearFilters}>Clear filters</Text></Pressable></View> : null}
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
  content: { paddingTop: 12, paddingBottom: 150, gap: 18 },
  hero: { paddingHorizontal: 20, gap: 4 },
  scanButton: { alignSelf: "flex-start", marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.ink, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 999 },
  scanButtonText: { color: colors.surface, fontSize: 12, fontWeight: "800" },
  kicker: { color: colors.brand, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  heading: { fontSize: 30, lineHeight: 36, fontWeight: "800", color: colors.ink, letterSpacing: -0.6 },
  headingLight: { fontWeight: "300" },
  searchBox: { marginHorizontal: 16, height: 50, borderRadius: 16, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  searchInput: { flex: 1, color: colors.ink, fontSize: 14, paddingVertical: 0 },
  chipRow: { paddingHorizontal: 16, gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 9 },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.ink, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: colors.surface },
  section: { fontSize: 18, fontWeight: "800", color: colors.ink, paddingHorizontal: 20, marginTop: 6 },
  featuredRow: { paddingHorizontal: 16, gap: 12 },
  featuredCard: { width: 240, height: 170, borderRadius: 26, overflow: "hidden", backgroundColor: colors.line },
  featuredPhoto: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  featuredShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.28)" },
  featuredText: { position: "absolute", left: 16, right: 16, bottom: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 8 },
  featuredName: { flex: 1, color: "#fff", fontWeight: "800", fontSize: 17 },
  featuredPrice: { color: "#fff", fontWeight: "700", backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" },
  sectionHeader: { paddingHorizontal: 0 },
  resultCount: { color: colors.muted, fontSize: 12, paddingHorizontal: 20, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingHorizontal: 16, rowGap: 14 },
  card: { width: "48.2%", backgroundColor: colors.surface, borderRadius: 21, padding: 9, gap: 5, borderWidth: 1, borderColor: colors.line },
  cardPhoto: { width: "100%", height: 124, borderRadius: 15, marginBottom: 5 },
  name: { fontSize: 14, fontWeight: "800", color: colors.ink, marginTop: 2 },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  price: { fontSize: 14, fontWeight: "800", color: colors.brand },
  addRound: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  choose: { borderRadius: 999, borderWidth: 1, borderColor: colors.ink, paddingHorizontal: 10, paddingVertical: 5 },
  chooseText: { color: colors.ink, fontWeight: "700", fontSize: 12 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 10, backgroundColor: colors.canvas },
  loadingText: { color: colors.muted, fontSize: 13 },
  retryButton: { backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12, marginTop: 6 },
  retryText: { color: colors.surface, fontWeight: "700", fontSize: 13 },
  emptyState: { marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 22, padding: 24, alignItems: "center", gap: 9, borderWidth: 1, borderColor: colors.line },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  clearFilters: { color: colors.brand, fontWeight: "800", fontSize: 13 },
  error: { color: colors.danger, textAlign: "center", fontSize: 15 },
});
