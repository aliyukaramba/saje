import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://saje-web.akarambaaleeyu.workers.dev";
const INSTALLATION_KEY = "saje_mobile_installation_id";

async function installationId() {
  const existing = await AsyncStorage.getItem(INSTALLATION_KEY);
  if (existing) return existing;
  const created = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  await AsyncStorage.setItem(INSTALLATION_KEY, created);
  return created;
}

async function expoToken() {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return null;
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof projectId !== "string" || !projectId) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("orders", {
      name: "Order updates",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
    });
  }
  const permission = await Notifications.getPermissionsAsync();
  const finalPermission = permission.granted ? permission : await Notifications.requestPermissionsAsync();
  if (!finalPermission.granted) return null;
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

export async function registerGuestOrderPush(reference: string) {
  const token = await expoToken();
  if (!token) return;
  const response = await fetch(`${API_URL}/api/notifications/guest-devices/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      reference,
      token,
      installationId: await installationId(),
      platform: Platform.OS.toUpperCase(),
      appVersion: Constants.expoConfig?.version ?? "unknown",
    }),
  });
  if (!response.ok) throw new Error("Could not register this device for order updates.");
}

export async function registerTableOrderPush(tableToken: string, orderNumber: string) {
  const token = await expoToken();
  if (!token) return;
  const response = await fetch(`${API_URL}/api/notifications/table-guest-devices/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tableToken,
      orderNumber,
      token,
      installationId: await installationId(),
      platform: Platform.OS.toUpperCase(),
      appVersion: Constants.expoConfig?.version ?? "unknown",
    }),
  });
  if (!response.ok) throw new Error("Could not register this device for table order updates.");
}
