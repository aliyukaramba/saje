import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { TopBar } from "../../components/TopBar";
import { colors } from "../../src/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Floating frosted-glass capsule. The active tab sits in a dark circle, as in the reference. */
function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconActive]}>
      <Ionicons name={name} size={22} color={focused ? colors.surface : colors.ink} />
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
        tabBarBackground: () => <BlurView intensity={70} tint="light" style={[StyleSheet.absoluteFill, styles.glass]} />,
        tabBarItemStyle: styles.item,
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
  bar: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 26,
    height: 70,
    borderRadius: 35,
    borderTopWidth: 0,
    backgroundColor: "transparent",
    elevation: 0,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  glass: { backgroundColor: "rgba(255,255,255,0.55)" },
  item: { alignItems: "center", justifyContent: "center", paddingTop: 0 },
  iconWrap: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  iconActive: { backgroundColor: colors.ink },
});
