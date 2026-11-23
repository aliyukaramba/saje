import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { fetchMenu, type MenuItem, type OptionGroup } from "../../src/api";
import { addLine } from "../../src/cart";
import { useOptionChoice } from "../../src/options";
import { formatKobo } from "../../src/money";
import { colors } from "../../src/theme";

export default function DishScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<MenuItem | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choice = useOptionChoice(item);

  useEffect(() => {
    fetchMenu()
      .then((m) => {
        const found = m.items.find((i) => i.id === id);
        if (found) setItem(found);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return <View style={styles.centered}><Text style={styles.muted}>This dish is no longer available.</Text></View>;
  }
  if (!item) {
    return <View style={styles.centered}><ActivityIndicator color={colors.brand} /></View>;
  }

  // Split the name: first word bold, the rest light, as in the reference design.
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
      <Stack.Screen options={{ title: "" }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoEmpty]} />
        )}

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              <Text style={styles.titleBold}>{first}</Text>
              {rest.length ? <Text style={styles.titleLight}> {rest.join(" ")}</Text> : null}
            </Text>
            <Text style={styles.price}>{item.discountPrice ?? item.price}</Text>
          </View>
          {item.description ? <Text style={styles.description}>{item.description}</Text> : null}

          {choice.options && choice.options.variants.length > 0 ? (
            <View style={{ gap: 10 }}>
              <Text style={styles.section}>Size</Text>
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
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.muted}>Total</Text>
          <Text style={styles.totalText}>{formatKobo(choice.unitMinor)}</Text>
        </View>
        <Pressable style={styles.outlineButton} onPress={() => add(false)} accessibilityRole="button">
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
  photo: { width: "100%", height: 320, backgroundColor: colors.line, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  photoEmpty: { backgroundColor: colors.line },
  body: { padding: 20, gap: 16 },
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
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 10, padding: 16, paddingBottom: 28, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  totalText: { fontSize: 18, fontWeight: "800", color: colors.ink },
  outlineButton: { flex: 1, borderRadius: 999, borderWidth: 1.5, borderColor: colors.ink, paddingVertical: 14, alignItems: "center" },
  outlineText: { color: colors.ink, fontWeight: "700" },
  solidButton: { flex: 1, borderRadius: 999, backgroundColor: colors.brand, paddingVertical: 14, alignItems: "center" },
  solidText: { color: colors.brandInk, fontWeight: "700" },
});
