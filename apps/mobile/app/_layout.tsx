import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { loadCart } from "../src/cart";
import { colors } from "../src/theme";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

export default function RootLayout() {
  useEffect(() => {
    void loadCart();
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      router.push("/notifications");
    });
    return () => subscription.remove();
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
