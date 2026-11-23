import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../src/cart";
import { colors } from "../src/theme";

/** Top bar: brand on the left (or back), screen title in the middle, cart on the right. */
export function TopBar({ title = "", showBack = false }: { title?: string; showBack?: boolean }) {
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const count = cart.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      <View style={styles.side}>
        {showBack ? (
          <RoundButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        ) : (
          <Text style={styles.brand}>
            saje<Text style={{ color: colors.brand }}>.</Text>
          </Text>
        )}
      </View>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={[styles.side, { alignItems: "flex-end" }]}>
        <RoundButton icon="bag-handle-outline" label={`Cart, ${count} items`} onPress={() => router.push("/cart")} badge={count} />
      </View>
    </View>
  );
}

function RoundButton({ icon, label, onPress, badge }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void; badge?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.round}>
      <Ionicons name={icon} size={20} color={colors.ink} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10, backgroundColor: colors.canvas },
  side: { width: 56, justifyContent: "center" },
  brand: { fontSize: 22, fontWeight: "800", color: colors.ink },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: colors.ink },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: colors.brandInk, fontSize: 11, fontWeight: "700" },
});
