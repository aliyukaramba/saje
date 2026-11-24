import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { readOrders, type SavedOrder } from "../src/orders";
import { API_URL } from "../src/api";
import { colors } from "../src/theme";

type GuestNotice = {
  id: string;
  title: string;
  body: string;
  type: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  readAt: string | null;
  createdAt: string;
  reference: string;
  orderNumber: string;
};

export default function NotificationsScreen() {
  const [items, setItems] = useState<GuestNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const orders: SavedOrder[] = await readOrders();
    const results = await Promise.all(orders.map(async order => {
      const response = await fetch(`${API_URL}/api/notifications/guest?ref=${encodeURIComponent(order.reference)}`);
      if (!response.ok) return [];
      const data = await response.json() as { notifications: Omit<GuestNotice, "reference" | "orderNumber">[] };
      return data.notifications.map(item => ({ ...item, reference: order.reference, orderNumber: order.orderNumber }));
    }));
    const merged = results.flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setItems(merged);
    setError("");
  }, []);

  useEffect(() => {
    let active = true;
    load().catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load updates."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try { await load(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to refresh."); }
    finally { setRefreshing(false); }
  };

  const markRead = async (item: GuestNotice) => {
    const response = await fetch(`${API_URL}/api/notifications/guest/${encodeURIComponent(item.id)}/read?ref=${encodeURIComponent(item.reference)}`, { method: "PATCH" });
    if (response.ok) setItems(current => current.map(n => n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n));
  };

  const unread = items.filter(item => !item.readAt).length;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={colors.ink} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Order updates</Text>
          <Text style={styles.subtitle}>{unread} unread notifications</Text>
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.brand} />}>
          {items.length === 0 ? <View style={styles.empty}><Ionicons name="notifications-off-outline" size={30} color={colors.muted} /><Text style={styles.emptyTitle}>No updates yet</Text><Text style={styles.subtitle}>Order progress updates will appear here after you place an order.</Text></View> : items.map(item => (
            <Pressable key={item.id} onPress={() => !item.readAt && void markRead(item)} style={[styles.card, !item.readAt && styles.unread]}>
              <View style={[styles.dot, item.priority === "HIGH" || item.priority === "URGENT" ? styles.important : null]} />
              <View style={{ flex: 1 }}>
                <View style={styles.row}><Text style={styles.cardTitle}>{item.title}</Text>{!item.readAt ? <Text style={styles.new}>NEW</Text> : null}</View>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.meta}>ORDER {item.orderNumber} · {new Date(item.createdAt).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 18, paddingTop: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  title: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  list: { padding: 16, gap: 10, paddingBottom: 30 },
  card: { flexDirection: "row", gap: 12, padding: 15, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  unread: { borderColor: "#f4c6a7", backgroundColor: "#fffaf6" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#a1a1aa", marginTop: 6 },
  important: { backgroundColor: colors.brand },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "800" },
  new: { color: colors.brand, fontSize: 9, fontWeight: "900" },
  body: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  meta: { color: colors.muted, fontSize: 10, marginTop: 10, letterSpacing: .3 },
  empty: { alignItems: "center", paddingTop: 70, paddingHorizontal: 20, gap: 8 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  error: { color: "#c84d4d", padding: 16, fontSize: 12 },
});
