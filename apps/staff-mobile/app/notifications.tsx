import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getNotifications, markAllNotificationsRead, markNotificationRead, type StaffNotification } from "../src/api";
import { colors } from "../src/theme";

const TOKEN_KEY = "saje_staff_session";

export default function NotificationsScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<StaffNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (session: string) => {
    const result = await getNotifications(session);
    setItems(result.notifications);
    setError("");
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(TOKEN_KEY).then(async saved => {
      if (!saved) { if (active) setError("Sign in to view your notifications."); return; }
      if (active) setToken(saved);
      try { await load(saved); } catch (e) { if (active) setError(e instanceof Error ? e.message : "Unable to load notifications."); }
      finally { if (active) setLoading(false); }
    });
    return () => { active = false; };
  }, [load]);

  const refresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try { await load(token); } catch (e) { setError(e instanceof Error ? e.message : "Unable to refresh."); }
    finally { setRefreshing(false); }
  }, [load, token]);

  const markRead = async (id: string) => {
    if (!token) return;
    try {
      await markNotificationRead(token, id);
      setItems(current => current.map(item => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update notification."); }
  };

  const markAll = async () => {
    if (!token) return;
    try {
      await markAllNotificationsRead(token);
      setItems(current => current.map(item => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update notifications."); }
  };

  const unread = items.filter(item => !item.readAt).length;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={21} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>{unread} unread updates</Text>
        </View>
        <Pressable onPress={() => void markAll()} disabled={!unread} style={[styles.markAll, !unread && styles.disabled]}>
          <Text style={styles.markAllText}>Read all</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 36 }} /> : (
        <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.accent} />}>
          {items.length === 0 ? <View style={styles.empty}><Ionicons name="notifications-off-outline" size={28} color={colors.muted} /><Text style={styles.emptyTitle}>You're all caught up</Text><Text style={styles.subtitle}>Restaurant updates will appear here.</Text></View> : items.map(item => (
            <Pressable key={item.id} onPress={() => !item.readAt && void markRead(item.id)} style={[styles.card, !item.readAt && styles.unread]}>
              <View style={[styles.dot, item.priority === "HIGH" || item.priority === "URGENT" ? styles.important : null]} />
              <View style={{ flex: 1 }}>
                <View style={styles.row}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  {!item.readAt ? <Text style={styles.new}>NEW</Text> : null}
                </View>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.time}>{new Date(item.createdAt).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.surface },
  back: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  title: { fontSize: 19, fontWeight: "800", color: colors.text },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
  markAll: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9, backgroundColor: colors.accentSoft },
  markAllText: { color: colors.accent, fontSize: 12, fontWeight: "800" },
  disabled: { opacity: 0.4 },
  list: { padding: 16, gap: 10, paddingBottom: 30 },
  card: { flexDirection: "row", gap: 12, padding: 15, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  unread: { borderColor: "#f5c5a5", backgroundColor: "#fffaf6" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#a1a1aa", marginTop: 6 },
  important: { backgroundColor: colors.accent },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: colors.text, flex: 1 },
  new: { color: colors.accent, fontSize: 9, fontWeight: "900" },
  body: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  time: { color: colors.muted, fontSize: 10, marginTop: 10 },
  empty: { alignItems: "center", paddingTop: 65, gap: 8 },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  error: { color: colors.red, paddingHorizontal: 18, paddingTop: 12, fontSize: 12 },
});
