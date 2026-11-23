import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { TopBar } from "../../components/TopBar";
import { colors } from "../../src/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const BAR_WIDTH = 230;
const BAR_HEIGHT = 70;
const ITEM_WIDTH = 76; // 3 tabs x 76 = 228, fits inside BAR_WIDTH

/** Floating frosted-glass capsule. The active tab sits in a dark circle, as in the reference. */
function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconActive]}>
      <Ionicons name={name} size={22} color={focused ? colors.surface : colors.ink} />
    </View>
  );
}

/**
 * The bar row spans the screen but its children are centred with flexbox,
 * so the glass capsule and the three tabs always sit in the middle.
 */
function GlassCapsule() {
  return (
    <View style={styles.centreRow}>
      <BlurView intensity={70} tint="light" style={styles.capsule} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        header: ({ options }) => <TopBar title={typeof options.title === "string" ? options.title : ""} />,
        tabBarShowLabel: false,
        tabBarStyle: styles.bar,
        tabBarBackground: GlassCapsule,
        tabBarItemStyle: styles.item,
        tabBarIconStyle: { width: 46, height: 46 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Menu", tabBarIcon: ({ focused }) => <TabIcon name={focused ? "restaurant" : "restaurant-outline"} focused={focused} /> }}
      />
      <Tabs.Screen
        name="cart"
        options={{ title: "Your order", tabBarIcon: ({ focused }) => <TabIcon name={focused ? "bag-handle" : "bag-handle-outline"} focused={focused} /> }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: "My orders", tabBarIcon: ({ focused }) => <TabIcon name={focused ? "receipt" : "receipt-outline"} focused={focused} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Full-width floating row, with its tabs centred horizontally.
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 26,
    height: BAR_HEIGHT,
    paddingTop: 0,
    paddingBottom: 0,
    borderTopWidth: 0,
    backgroundColor: "transparent",
    elevation: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  centreRow: { flex: 1, alignItems: "center", justifyContent: "center" },
  capsule: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  item: { width: ITEM_WIDTH, height: BAR_HEIGHT, alignItems: "center", justifyContent: "center", paddingTop: 0, paddingBottom: 0 },
  iconWrap: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  iconActive: { backgroundColor: colors.ink },
});
