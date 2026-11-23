import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { loadCart } from "../src/cart";
import { colors } from "../src/theme";

export default function RootLayout() {
  useEffect(() => {
    void loadCart();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.ink, fontWeight: "700" },
          headerTintColor: colors.brand,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Menu" }} />
        <Stack.Screen name="cart" options={{ title: "Your order" }} />
      </Stack>
    </>
  );
}
