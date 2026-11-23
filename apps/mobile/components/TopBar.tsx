import { Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../src/cart";
import { colors } from "../src/theme";

/** Top bar with frosted-glass round buttons: back or brand on the left, title in the middle, cart on the right. */
export function TopBar({ title = "", showBack = false }: { title?: string; showBack?: boolean }) {
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const count = cart.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      <View style={styles.side}>
        {showBack ? (
          <GlassButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        ) : (
          <Text style={styles.brand}>
            saje<Text style={{ color: colors.brand }}>.</Text>
          </Text>
        )}
      </View>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={[styles.side, { alignItems: "flex-end" }]}>
        <GlassButton icon="bag-handle-outline" label={`Cart, ${count} items`} onPress={() => router.push("/cart")} badge={count} />
      </View>
    </View>
  );
}

export function GlassButton({ icon, label, onPress, badge }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void; badge?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.wrap}>
      <View style={styles.round}>
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.roundFill} />
        <Ionicons name={icon} size={20} color={colors.ink} />
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10, backgroundColor: "transparent" },
  side: { width: 56, justifyContent: "center" },
  brand: { fontSize: 22, fontWeight: "800", color: colors.ink },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: colors.ink },
  wrap: { width: 44, height: 44 },
  round: { width: 44, height: 44, borderRadius: 22, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.8)" },
  roundFill: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(255,255,255,0.45)" },
  badge: { position: "absolute", top: -3, right: -3, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: colors.surface, fontSize: 11, fontWeight: "700" },
});
