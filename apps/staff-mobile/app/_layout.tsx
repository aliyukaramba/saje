import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { registerStaffPush } from "../src/notifications";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "../src/theme";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

export default function RootLayout() {
  useEffect(() => {
    void AsyncStorage.getItem("saje_staff_session").then(token => {
      if (token) void registerStaffPush(token).catch(() => undefined);
    });
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      router.push("/notifications");
    });
    return () => subscription.remove();
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </SafeAreaProvider>
  );
}
