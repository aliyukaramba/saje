import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { API_URL } from "./api";

const INSTALLATION_KEY = "saje_staff_installation_id";

async function installationId() {
  const existing = await AsyncStorage.getItem(INSTALLATION_KEY);
  if (existing) return existing;
  const created = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  await AsyncStorage.setItem(INSTALLATION_KEY, created);
  return created;
}

export async function registerStaffPush(sessionToken: string) {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof projectId !== "string" || !projectId) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("orders", {
      name: "Restaurant updates",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
    });
  }
  const permission = await Notifications.getPermissionsAsync();
  const finalPermission = permission.granted ? permission : await Notifications.requestPermissionsAsync();
  if (!finalPermission.granted) return;
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  const response = await fetch(`${API_URL}/api/notifications/devices/register`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({
      token: token.data,
      installationId: await installationId(),
      platform: Platform.OS.toUpperCase(),
      app: "STAFF",
      deviceName: Constants.deviceName ?? undefined,
      appVersion: Constants.expoConfig?.version ?? "unknown",
    }),
  });
  if (!response.ok) throw new Error("Could not register this device for staff notifications.");
}
