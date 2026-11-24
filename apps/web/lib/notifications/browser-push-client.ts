"use client";

const PUBLIC_VAPID_KEY = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ?? "";

function decodeApplicationServerKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}

export async function enableBrowserPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new Error("This browser does not support web push notifications.");
  }
  if (!PUBLIC_VAPID_KEY) throw new Error("The public VAPID key has not been configured for the web app.");
  if (Notification.permission === "denied") throw new Error("Browser notifications are blocked. Allow them in your browser settings first.");

  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeApplicationServerKey(PUBLIC_VAPID_KEY),
  });
  const response = await fetch("/api/notifications/web-push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(result.error ?? "Could not save this browser subscription.");
  }
  return true;
}

export async function disableBrowserPush() {
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return false;
  const response = await fetch("/api/notifications/web-push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  if (!response.ok) throw new Error("Could not disable browser notifications on this account.");
  await subscription.unsubscribe();
  return true;
}

export async function browserPushIsEnabled() {
  if (!("serviceWorker" in navigator)) return false;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  return Boolean(await registration?.pushManager.getSubscription());
}
