import { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchMenu, type MenuItem, type OptionGroup } from "../../src/api";
import { addLine } from "../../src/cart";
import { useOptionChoice } from "../../src/options";
import { formatKobo } from "../../src/money";
import { colors } from "../../src/theme";
import { isFavourite, toggleFavourite } from "../../src/favourites";
import { GlassButton } from "../../components/TopBar";

const PHOTO_HEIGHT = Dimensions.get("window").height * 0.52;

export default function DishScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<MenuItem | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const choice = useOptionChoice(item);
  const [fav, setFav] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [related, setRelated] = useState<MenuItem[]>([]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }

  async function handleToggleFavourite() {
    if (favBusy) return;
    setFavBusy(true);
    try {
      const next = await toggleFavourite(id);
      setFav(next);
    } finally {
      setFavBusy(false);
    }
  }

  useEffect(() => {
    void isFavourite(id).then(setFav);
  }, [id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    setNotFound(false);
    fetchMenu()
      .then((m) => {
        if (!active) return;
        const found = m.items.find((i) => i.id === id);
        if (found) {
          setItem(found);
          setRelated(
            m.items
              .filter((i) => i.isAvailable && i.categoryId === found.categoryId && i.id !== found.id)
              .slice(0, 8),
          );
        } else {
          setNotFound(true);
        }
      })
      .catch((e: unknown) => {
        if (!active) return;
        setLoadError(e instanceof Error ? e.message : "We could not load this dish. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id, retryCount]);

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{loadError}</Text>
        <Pressable style={styles.retryButton} onPress={() => setRetryCount((count) => count + 1)} accessibilityRole="button">
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
  if (notFound) {
    return <View style={styles.centered}><Text style={styles.muted}>This dish is no longer available.</Text></View>;
  }
  if (loading || !item) {
    return <View style={styles.centered}><ActivityIndicator color={colors.ink} /></View>;
  }

  // First word bold, the rest light, as in the reference.
  const [first, ...rest] = item.name.split(" ");

  function add(thenOpenCart: boolean) {
    const built = choice.build();
    if (!built.ok) {
      setError(built.error);
      return;
    }
    addLine(built.line);
    if (thenOpenCart) router.push("/cart");
    else goBack();
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={[styles.photo, { backgroundColor: colors.line }]} />
      )}

      <ScrollView contentContainerStyle={{ paddingTop: PHOTO_HEIGHT - 34, paddingBottom: 178 }} showsVerticalScrollIndicator={false} bounces>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.eyebrow}>MADE FRESH FOR YOU</Text>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              <Text style={styles.titleBold}>{first}</Text>
              {rest.length ? <Text style={styles.titleLight}> {rest.join(" ")}</Text> : null}
            </Text>
            <Text style={styles.price}>{formatKobo(choice.unitMinor)}</Text>
          </View>
          {item.description ? <Text style={styles.description}>{item.description}</Text> : null}

          {choice.options && choice.options.variants.length > 0 ? (
            <View style={{ gap: 10 }}>
              <Text style={styles.section}>Choose your preference</Text>
              <View style={styles.pillRow}>
                {choice.options.variants.map((v) => (
                  <Pill
                    key={v.id}
                    label={`${v.name}${Number(v.delta) ? ` +${formatKobo(Number(v.delta))}` : ""}`}
                    selected={choice.variantId === v.id}
                    disabled={!v.isAvailable}
                    onPress={() => choice.setVariantId(v.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {choice.options?.groups.map((g: OptionGroup) => (
            <View key={g.id} style={{ gap: 10 }}>
              <Text style={styles.section}>{g.name}</Text>
              <Text style={styles.muted}>
                {g.minSelect > 0 ? "Required" : "Optional"}
                {g.maxSelect > 1 ? ` · up to ${g.maxSelect}` : ""}
              </Text>
              <View style={styles.pillRow}>
                {g.modifiers.map((m) => (
                  <Pill
                    key={m.id}
                    label={`${m.name}${Number(m.delta) ? ` +${formatKobo(Number(m.delta))}` : ""}`}
                    selected={(choice.picked[g.id] ?? []).includes(m.id)}
                    disabled={!m.isAvailable}
                    onPress={() => choice.toggle(g, m.id)}
                  />
                ))}
              </View>
            </View>
          ))}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {related.length > 0 ? (
            <View style={{ gap: 10 }}>
              <Text style={styles.section}>You may also like</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {related.map((r) => (
                  <Pressable key={r.id} style={styles.relatedCard} onPress={() => router.replace(`/dish/${r.id}`)} accessibilityRole="button" accessibilityLabel={r.name}>
                    {r.imageUrl ? <Image source={{ uri: r.imageUrl }} style={styles.relatedPhoto} /> : <View style={[styles.relatedPhoto, { backgroundColor: colors.line }]} />}
                    <Text style={styles.relatedName} numberOfLines={1}>{r.name}</Text>
                    <Text style={styles.relatedPrice}>{r.discountPrice ?? r.price}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.topButtons, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <GlassButton icon="chevron-back" label="Back" onPress={goBack} />
        <View pointerEvents="auto">
          <GlassButton
            icon={fav ? "heart" : "heart-outline"}
            label={fav ? "Remove from favourites" : "Add to favourites"}
            onPress={() => void handleToggleFavourite()}
          />
        </View>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.buttonPressed]}
          onPress={() => add(false)}
          accessibilityRole="button"
          accessibilityLabel="Add this dish to cart"
        >
          <Text style={styles.addButtonText}>Add to cart</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.orderButton, pressed && styles.buttonPressed]}
          onPress={() => add(true)}
          accessibilityRole="button"
          accessibilityLabel="Order this dish now"
        >
          <Text style={styles.orderButtonText}>Order now</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Pill({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[styles.pill, selected && styles.pillSelected, disabled && { opacity: 0.4 }]}
    >
      <Text style={[styles.pillText, selected && { color: colors.surface }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.canvas },
  photo: { position: "absolute", top: 0, left: 0, right: 0, height: PHOTO_HEIGHT },
  topButtons: { position: "absolute", zIndex: 30, elevation: 30, top: 0, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 22, paddingTop: 14, paddingBottom: 28, gap: 18, minHeight: "100%" },
  handle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 0 },
  eyebrow: { color: colors.brand, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginTop: -4 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  title: { flex: 1, fontSize: 28, lineHeight: 34, color: colors.ink, letterSpacing: -0.7 },
  titleBold: { fontWeight: "800" },
  titleLight: { fontWeight: "300" },
  price: { fontSize: 21, fontWeight: "800", color: colors.brand, letterSpacing: -0.4, paddingTop: 3 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  section: { fontSize: 15, fontWeight: "800", color: colors.ink, marginTop: 2, letterSpacing: -0.2 },
  muted: { color: colors.muted, fontSize: 13 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fafafa", paddingHorizontal: 15, paddingVertical: 10 },
  pillSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillText: { color: colors.ink, fontWeight: "600", fontSize: 14 },
  error: { color: colors.danger, fontSize: 14, textAlign: "center" },
  retryButton: { marginTop: 14, borderRadius: 999, backgroundColor: colors.ink, paddingHorizontal: 22, paddingVertical: 12 },
  retryText: { color: colors.surface, fontWeight: "700" },
  relatedCard: { width: 124, gap: 5, marginRight: 2 },
  relatedPhoto: { width: 124, height: 104, borderRadius: 16, backgroundColor: colors.canvas },
  relatedName: { fontSize: 13, fontWeight: "600", color: colors.ink },
  relatedPrice: { fontSize: 12, fontWeight: "700", color: colors.brand },
  bottomBar: { position: "absolute", zIndex: 20, elevation: 20, left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 12, paddingHorizontal: 18, paddingTop: 14, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: "#eeeeef", shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: -5 } },
  addButton: { flex: 1, minHeight: 54, borderRadius: 17, backgroundColor: "#e8f1ef", borderWidth: 1, borderColor: "#c9ddda", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  addButtonText: { color: colors.brand, fontSize: 15, fontWeight: "800" },
  orderButton: { flex: 1, minHeight: 54, borderRadius: 17, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, shadowColor: colors.brand, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  orderButtonText: { color: colors.surface, fontSize: 15, fontWeight: "800" },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
