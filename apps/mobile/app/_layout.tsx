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
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="dish/[id]" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
