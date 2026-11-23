import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";
import { TopBar } from "../../components/TopBar";
import { useCart } from "../../src/cart";
import { colors } from "../../src/theme";

export default function TabsLayout() {
  const cart = useCart();
  const count = cart.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <Tabs
      screenOptions={{
        header: ({ options }) => <TopBar title={typeof options.title === "string" ? options.title : ""} />,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: styles.bar,
        tabBarItemStyle: styles.item,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Menu", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "restaurant" : "restaurant-outline"} size={24} color={color as string} /> }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Your order",
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "bag-handle" : "bag-handle-outline"} size={24} color={color as string} />,
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.brand, color: colors.brandInk },
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: "My orders", tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "receipt" : "receipt-outline"} size={24} color={color as string} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 24,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  item: { paddingTop: 14 },
});
