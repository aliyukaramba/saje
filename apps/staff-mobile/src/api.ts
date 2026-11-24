export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://saje-web.akarambaaleeyu.workers.dev";

export type StaffRole =
  | "super_admin"
  | "restaurant_manager"
  | "cashier"
  | "kitchen_staff"
  | "waiter"
  | "delivery_staff"
  | "inventory_manager";

export interface StaffUser {
  id: string;
  fullName: string;
  email: string | null;
  roles: StaffRole[];
  permissions: string[];
}

export interface StaffOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  type: string;
  guestName: string | null;
  tableNumber: string | null;
  total: string;
  placedAt: string;
  items: { name: string; quantity: number; notes?: string | null; modifiers?: string[] }[];
}

async function request<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Something went wrong. Please try again.");
  return body as T;
}

export async function signIn(email: string, password: string) {
  const response = await fetch(`${API_URL}/api/staff/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.token) throw new Error(body.error ?? "Unable to sign in.");
  return body as { token: string; user: StaffUser };
}

export const getProfile = (token: string) =>
  request<{ user: StaffUser }>("/api/staff/auth/me", token);

export const getOrders = (token: string) =>
  request<{ orders: StaffOrder[] }>("/api/staff/orders", token);

export async function signOut(token: string) {
  await fetch(`${API_URL}/api/staff/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateOrderStatus(token: string, orderId: string, status: "ACCEPTED" | "PREPARING" | "READY") {
  const response = await fetch(`${API_URL}/api/staff/orders/${encodeURIComponent(orderId)}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Unable to update order.");
  return body as { success: true; status: string };
}

export interface StaffNotification {
  id: string;
  type: string;
  category: string;
  title: string;
  body: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  readAt: string | null;
  createdAt: string;
}

export async function getNotifications(token: string) {
  return request<{ notifications: StaffNotification[]; nextCursor: string | null }>("/api/notifications?limit=50", token);
}

export async function getUnreadNotificationCount(token: string) {
  return request<{ count: number }>("/api/notifications/unread-count", token);
}

export async function markNotificationRead(token: string, id: string) {
  const response = await fetch(`${API_URL}/api/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Unable to update notification.");
}

export async function markAllNotificationsRead(token: string) {
  const response = await fetch(`${API_URL}/api/notifications/read-all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Unable to update notifications.");
}
