import { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
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
  const [error, setError] = useState<string | null>(null);
  const choice = useOptionChoice(item);
  const [fav, setFav] = useState(false);
  const [related, setRelated] = useState<MenuItem[]>([]);

  useEffect(() => {
    void isFavourite(id).then(setFav);
  }, [id]);

  useEffect(() => {
    fetchMenu()
      .then((m) => {
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
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return <View style={styles.centered}><Text style={styles.muted}>This dish is no longer available.</Text></View>;
  }
  if (!item) {
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
    else router.back();
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, { backgroundColor: colors.line }]} />
      )}

      <View style={[styles.topButtons, { paddingTop: insets.top + 8 }]}>
        <GlassButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <GlassButton
          icon={fav ? "heart" : "heart-outline"}
          label={fav ? "Remove from favourites" : "Add to favourites"}
          onPress={() => void toggleFavourite(id).then(setFav)}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: PHOTO_HEIGHT - 36, paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
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
              <Text style={styles.section}>Try these quick choices</Text>
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
              <Text style={styles.section}>Often order with</Text>
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

      {/* Floating row: no bar behind it. The glass sits on the buttons, as in the reference. */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]} pointerEvents="box-none">
        <Pressable style={styles.outlineButton} onPress={() => add(false)} accessibilityRole="button">
          <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.glassFill]} />
          <Text style={styles.outlineText}>Add to cart</Text>
        </Pressable>
        <Pressable style={styles.solidButton} onPress={() => add(true)} accessibilityRole="button">
          <Text style={styles.solidText}>Order</Text>
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
  topButtons: { position: "absolute", top: 0, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 22, paddingTop: 12, gap: 16, minHeight: "100%" },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 4 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  title: { flex: 1, fontSize: 26, color: colors.ink },
  titleBold: { fontWeight: "800" },
  titleLight: { fontWeight: "300" },
  price: { fontSize: 22, fontWeight: "800", color: colors.brand },
  description: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  section: { fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 4 },
  muted: { color: colors.muted, fontSize: 13 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 9 },
  pillSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillText: { color: colors.ink, fontWeight: "600", fontSize: 14 },
  error: { color: colors.danger, fontSize: 14 },
  relatedCard: { width: 116, gap: 4 },
  relatedPhoto: { width: 116, height: 100, borderRadius: 18 },
  relatedName: { fontSize: 13, fontWeight: "600", color: colors.ink },
  relatedPrice: { fontSize: 12, fontWeight: "700", color: colors.brand },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 14 },
  outlineButton: { flex: 1, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.9)", paddingVertical: 15, alignItems: "center", overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  // Light, see-through white over the blur, matching TopBar.
  glassFill: { backgroundColor: "rgba(255,255,255,0.45)" },
  outlineText: { color: colors.ink, fontWeight: "700" },
  solidButton: { flex: 1, borderRadius: 999, backgroundColor: colors.ink, paddingVertical: 15, alignItems: "center" },
  solidText: { color: colors.surface, fontWeight: "700" },
});
