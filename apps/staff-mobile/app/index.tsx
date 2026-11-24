"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getOrders, getProfile, signIn, signOut, updateOrderStatus, type StaffOrder, type StaffUser } from "../src/api";
import { colors } from "../src/theme";
import { deactivateStaffPush, registerStaffPush } from "../src/notifications";

const TOKEN_KEY = "saje_staff_session";
const ROLE_LABELS: Record<string, string> = {
  super_admin: "Owner",
  restaurant_manager: "Manager",
  cashier: "Cashier",
  kitchen_staff: "Kitchen",
  waiter: "Waiter",
  delivery_staff: "Delivery",
  inventory_manager: "Inventory",
};

function roleHome(roles: string[]) {
  if (roles.includes("restaurant_manager") || roles.includes("super_admin")) return {
    title: "Your restaurant at a glance",
    subtitle: "Manage today's service and keep the team moving.",
    tiles: [["Orders", "Live order activity", "receipt-outline"], ["Team", "Staff operations", "people-outline"], ["Performance", "Sales and service overview", "stats-chart-outline"]],
  };
  if (roles.includes("kitchen_staff")) return {
    title: "Kitchen queue",
    subtitle: "Keep an eye on incoming tickets and preparation.",
    tiles: [["Incoming", "Orders waiting for preparation", "notifications-outline"], ["Preparing", "Work currently in progress", "flame-outline"], ["Ready", "Orders ready to serve", "checkmark-circle-outline"]],
  };
  if (roles.includes("cashier")) return {
    title: "Counter operations",
    subtitle: "Stay on top of open orders and payment activity.",
    tiles: [["Open orders", "Orders awaiting service", "receipt-outline"], ["Payments", "Payment activity", "card-outline"], ["Register", "Counter operations", "calculator-outline"]],
  };
  return {
    title: "Your service floor",
    subtitle: "Keep track of open orders and guest service.",
    tiles: [["Tables", "Dining room service", "grid-outline"], ["Orders", "Orders needing attention", "receipt-outline"], ["Guests", "Guest requests and assistance", "chatbubble-ellipses-outline"]],
  };
}

export default function StaffHome() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<StaffUser | null>(null);
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (session: string) => {
    const [profile, data] = await Promise.all([getProfile(session), getOrders(session)]);
    setUser(profile.user);
    setOrders(data.orders);
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(TOKEN_KEY).then(async saved => {
      if (!saved) return;
      try {
        const [profile, data] = await Promise.all([getProfile(saved), getOrders(saved)]);
        if (active) {
          setToken(saved);
          setUser(profile.user);
          setOrders(data.orders);
        }
      } catch {
        await AsyncStorage.removeItem(TOKEN_KEY);
      }
    });
    return () => { active = false; };
  }, []);

  const onLogin = async () => {
    setBusy(true); setError("");
    try {
      const result = await signIn(email.trim(), password);
      await AsyncStorage.setItem(TOKEN_KEY, result.token);
      await registerStaffPush(result.token).catch(() => undefined);
      setToken(result.token);
      setUser(result.user);
      await load(result.token);
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally { setBusy(false); }
  };

  const onRefresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try { await load(token); } catch (e) { setError(e instanceof Error ? e.message : "Refresh failed."); }
    finally { setRefreshing(false); }
  }, [token, load]);

  const onLogout = async () => {
    if (token) {
      await deactivateStaffPush(token).catch(() => undefined);
      await signOut(token).catch(() => undefined);
    }
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null); setUser(null); setOrders([]);
  };

  const summary = useMemo(() => ({
    open: orders.filter(o => !["COMPLETED", "CANCELLED"].includes(o.status)).length,
    preparing: orders.filter(o => o.status === "PREPARING").length,
    ready: orders.filter(o => o.status === "READY").length,
  }), [orders]);

  if (!token || !user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loginWrap}>
          <Image source={require("../assets/icon.png")} style={styles.brandLogo} />
          <Text style={styles.brand}>SAJE <Text style={styles.brandAccent}>STAFF</Text></Text>
          <Text style={styles.loginTitle}>Welcome back</Text>
          <Text style={styles.muted}>Sign in with your restaurant staff account.</Text>
          <View style={styles.form}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <TextInput autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@restaurant.com" placeholderTextColor="#a1a1aa" style={styles.input} />
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder="Enter your password" placeholderTextColor="#a1a1aa" style={styles.input} onSubmitEditing={onLogin} />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable onPress={onLogin} disabled={busy || !email || !password} style={[styles.primaryButton, (busy || !email || !password) && styles.disabled]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Sign in</Text>}
            </Pressable>
          </View>
          <Text style={styles.footer}>Secure access for authorised SAJE team members</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isKitchenOnly = user.roles.includes("kitchen_staff")
    && !user.roles.includes("restaurant_manager")
    && !user.roles.includes("super_admin");
  if (isKitchenOnly) {
    return <KitchenBoard token={token} user={user} orders={orders} onRefresh={onRefresh} onLogout={onLogout} />;
  }

  const home = roleHome(user.roles);
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>
        <View style={styles.top}>
          <View>
            <Text style={styles.eyebrow}>SAJE STAFF</Text>
            <Text style={styles.greeting}>Good service starts here.</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}><Pressable onPress={() => router.push("/notifications")} style={styles.logout} accessibilityRole="button" accessibilityLabel="Notifications"><Ionicons name="notifications-outline" size={20} color={colors.text} /></Pressable><Pressable onPress={onLogout} style={styles.logout} accessibilityRole="button" accessibilityLabel="Sign out"><Ionicons name="log-out-outline" size={20} color={colors.text} /></Pressable></View>
        </View>
        <View style={styles.profile}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{user.fullName.slice(0,1).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user.fullName}</Text>
            <Text style={styles.role}>{user.roles.map(r => ROLE_LABELS[r] ?? r).join(" · ")}</Text>
          </View>
          <View style={styles.online}><View style={styles.dot} /><Text style={styles.onlineText}>Online</Text></View>
        </View>
        <Text style={styles.sectionTitle}>{home.title}</Text>
        <Text style={styles.muted}>{home.subtitle}</Text>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statNumber}>{summary.open}</Text><Text style={styles.statLabel}>OPEN ORDERS</Text></View>
          <View style={styles.stat}><Text style={styles.statNumber}>{summary.preparing}</Text><Text style={styles.statLabel}>PREPARING</Text></View>
          <View style={styles.stat}><Text style={styles.statNumber}>{summary.ready}</Text><Text style={styles.statLabel}>READY</Text></View>
        </View>
        <Text style={styles.sectionTitle}>Your workspace</Text>
        <View style={styles.tiles}>
          {home.tiles.map(([title, subtitle, icon]) => (
            <View key={title} style={styles.tile}>
              <View style={styles.tileIcon}><Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={21} color={colors.accent} /></View>
              <Text style={styles.tileTitle}>{title}</Text>
              <Text style={styles.tileSub}>{subtitle}</Text>
            </View>
          ))}
        </View>
        <View style={styles.orderHeader}><Text style={styles.sectionTitle}>Live orders</Text><Text style={styles.count}>{orders.length}</Text></View>
        {orders.length === 0 ? <View style={styles.empty}><Text style={styles.muted}>No open orders at the moment.</Text></View> : orders.slice(0, 12).map(order => (
          <View key={order.id} style={styles.order}>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderNo}>{order.orderNumber}</Text>
              <Text style={styles.orderMeta}>{order.tableNumber ? `Table ${order.tableNumber}` : order.type.replaceAll("_", " ")} · {order.items.reduce((n, item) => n + item.quantity, 0)} items</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.orderTotal}>{order.total}</Text>
              <Text style={styles.orderStatus}>{order.status.replaceAll("_", " ")}</Text>
            </View>
          </View>
        ))}
        <Text style={styles.footer}>Pull down to refresh · SAJE operations</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loginWrap: { flex: 1, justifyContent: "center", padding: 28 },
  brandLogo: { width: 56, height: 56, borderRadius: 16, marginBottom: 18 },
  brand: { fontSize: 18, letterSpacing: 2, fontWeight: "900", color: colors.text },
  brandAccent: { color: colors.accent },
  loginTitle: { fontSize: 30, fontWeight: "800", color: colors.text, marginTop: 42 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 5 },
  form: { marginTop: 30, gap: 12 },
  label: { color: colors.muted, fontSize: 10, letterSpacing: 1.2, fontWeight: "800", marginTop: 7 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingHorizontal: 15, paddingVertical: 15, color: colors.text, fontSize: 15 },
  error: { color: colors.red, fontSize: 13 },
  primaryButton: { backgroundColor: colors.accent, borderRadius: 13, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.55 },
  footer: { color: "#a1a1aa", fontSize: 11, textAlign: "center", marginTop: 30 },
  content: { padding: 20, paddingBottom: 40 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  eyebrow: { fontSize: 10, letterSpacing: 2, color: colors.accent, fontWeight: "900" },
  greeting: { color: colors.text, fontSize: 21, fontWeight: "800", marginTop: 5 },
  logout: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line },
  profile: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 15, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 28 },
  avatar: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "900", color: colors.accent },
  name: { fontSize: 14, color: colors.text, fontWeight: "800" },
  role: { color: colors.muted, fontSize: 11, marginTop: 3 },
  online: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  onlineText: { color: colors.green, fontSize: 10, fontWeight: "700" },
  sectionTitle: { fontSize: 19, fontWeight: "800", color: colors.text, marginTop: 6 },
  stats: { flexDirection: "row", gap: 9, marginTop: 18, marginBottom: 23 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 15, borderWidth: 1, borderColor: colors.line, padding: 13 },
  statNumber: { fontSize: 24, fontWeight: "900", color: colors.text },
  statLabel: { fontSize: 8, letterSpacing: 1, color: colors.muted, fontWeight: "800", marginTop: 4 },
  tiles: { gap: 9, marginTop: 14, marginBottom: 24 },
  tile: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 15, padding: 14, minHeight: 84 },
  tileIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center", marginBottom: 9 },
  tileTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  tileSub: { color: colors.muted, fontSize: 11, marginTop: 3 },
  orderHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  count: { backgroundColor: colors.accentSoft, color: colors.accent, borderRadius: 20, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 3, fontSize: 11, fontWeight: "800" },
  order: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 14, marginTop: 9, flexDirection: "row", alignItems: "center" },
  orderNo: { color: colors.text, fontWeight: "800", fontSize: 13 },
  orderMeta: { color: colors.muted, fontSize: 10, marginTop: 4 },
  orderTotal: { color: colors.text, fontWeight: "800", fontSize: 12 },
  orderStatus: { color: colors.accent, fontSize: 9, fontWeight: "800", marginTop: 4 },
  empty: { marginTop: 10, backgroundColor: colors.surface, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: colors.line },
});


function KitchenBoard({ token, user, orders, onRefresh, onLogout }: {
  token: string;
  user: StaffUser;
  orders: StaffOrder[];
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => { void onRefresh(); }, 8000);
    return () => clearInterval(timer);
  }, [onRefresh]);

  const update = async (order: StaffOrder, status: "ACCEPTED" | "PREPARING" | "READY") => {
    setBusyId(order.id);
    setMessage("");
    try {
      await updateOrderStatus(token, order.id, status);
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update order.");
    } finally {
      setBusyId(null);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  };

  const incoming = orders.filter(order => order.status === "CONFIRMED");
  const preparing = orders.filter(order => ["ACCEPTED", "PREPARING"].includes(order.status));
  const ready = orders.filter(order => order.status === "READY");

  const elapsed = (date: string) => {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
    return minutes < 1 ? "Just now" : minutes < 60 ? `${minutes} min waiting` : `${Math.floor(minutes / 60)}h ${minutes % 60}m waiting`;
  };

  const lane = (title: string, subtitle: string, list: StaffOrder[], kind: "incoming" | "preparing" | "ready") => (
    <View style={kitchenStyles.lane}>
      <View style={kitchenStyles.laneHead}>
        <View><Text style={kitchenStyles.laneTitle}>{title}</Text><Text style={kitchenStyles.laneSub}>{subtitle}</Text></View>
        <Text style={kitchenStyles.laneCount}>{list.length}</Text>
      </View>
      {list.length === 0 ? <View style={kitchenStyles.empty}><Text style={kitchenStyles.emptyText}>No orders here</Text></View> : list.map(order => {
        const next = kind === "incoming" ? "ACCEPTED" : order.status === "ACCEPTED" ? "PREPARING" : kind === "preparing" ? "READY" : null;
        const label = kind === "incoming" ? "Accept order" : order.status === "ACCEPTED" ? "Start preparing" : "Mark ready";
        return (
          <View key={order.id} style={kitchenStyles.ticket}>
            <View style={kitchenStyles.ticketTop}>
              <View style={{ flex: 1 }}>
                <Text style={kitchenStyles.ticketNo}>{order.orderNumber}</Text>
                <Text style={kitchenStyles.ticketMeta}>{order.tableNumber ? `Table ${order.tableNumber}` : order.type.replaceAll("_", " ")} · {elapsed(order.placedAt)}</Text>
              </View>
              <Text style={kitchenStyles.status}>{order.status.replaceAll("_", " ")}</Text>
            </View>
            <View style={kitchenStyles.items}>
              {order.items.map((item, index) => (
                <View key={index} style={kitchenStyles.itemRow}>
                  <Text style={kitchenStyles.qty}>{item.quantity}×</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={kitchenStyles.itemName}>{item.name}</Text>
                    {!!item.modifiers?.length && <Text style={kitchenStyles.itemExtra}>+ {item.modifiers.join(", ")}</Text>}
                    {!!item.notes && <Text style={kitchenStyles.itemNote}>Note: {item.notes}</Text>}
                  </View>
                </View>
              ))}
            </View>
            {!!order.guestName && <Text style={kitchenStyles.note}>Guest: {order.guestName}</Text>}
            {next && <Pressable disabled={busyId === order.id} onPress={() => void update(order, next)} style={[kitchenStyles.action, busyId === order.id && { opacity: 0.6 }]}>
              {busyId === order.id ? <ActivityIndicator color="#fff" /> : <Text style={kitchenStyles.actionText}>{label}</Text>}
            </Pressable>}
            {kind === "ready" && <Text style={kitchenStyles.readyText}>Waiting for service staff</Text>}
          </View>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={kitchenStyles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}>
        <View style={kitchenStyles.header}>
          <View>
            <Text style={styles.eyebrow}>SAJE · KITCHEN</Text>
            <Text style={kitchenStyles.heading}>Kitchen display</Text>
            <Text style={styles.muted}>Hi {user.fullName.split(" ")[0]}, here is your live ticket queue.</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}><Pressable onPress={() => router.push("/notifications")} style={styles.logout} accessibilityRole="button" accessibilityLabel="Notifications"><Ionicons name="notifications-outline" size={20} color={colors.text} /></Pressable><Pressable onPress={onLogout} style={styles.logout} accessibilityRole="button" accessibilityLabel="Sign out"><Ionicons name="log-out-outline" size={20} color={colors.text} /></Pressable></View>
        </View>
        <View style={kitchenStyles.summary}>
          <View style={kitchenStyles.summaryCell}><Text style={kitchenStyles.summaryNumber}>{incoming.length}</Text><Text style={kitchenStyles.summaryLabel}>NEW</Text></View>
          <View style={kitchenStyles.summaryCell}><Text style={kitchenStyles.summaryNumber}>{preparing.length}</Text><Text style={kitchenStyles.summaryLabel}>IN PROGRESS</Text></View>
          <View style={kitchenStyles.summaryCell}><Text style={kitchenStyles.summaryNumber}>{ready.length}</Text><Text style={kitchenStyles.summaryLabel}>READY</Text></View>
        </View>
        {!!message && <Text style={kitchenStyles.error}>{message}</Text>}
        {lane("Incoming", "New paid and confirmed tickets", incoming, "incoming")}
        {lane("Preparing", "Orders being worked on", preparing, "preparing")}
        {lane("Ready to serve", "Completed kitchen tickets", ready, "ready")}
        <Text style={styles.footer}>Auto-refreshes every 8 seconds · Pull down to refresh</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const kitchenStyles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 42, gap: 18 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heading: { color: colors.text, fontSize: 25, fontWeight: "900", marginTop: 5 },
  summary: { flexDirection: "row", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 17, padding: 14, gap: 8 },
  summaryCell: { flex: 1, alignItems: "center" },
  summaryNumber: { fontSize: 25, fontWeight: "900", color: colors.text },
  summaryLabel: { fontSize: 9, fontWeight: "800", color: colors.muted, letterSpacing: 1, marginTop: 3 },
  lane: { gap: 10 },
  laneHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  laneTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  laneSub: { color: colors.muted, fontSize: 11, marginTop: 3 },
  laneCount: { color: colors.accent, backgroundColor: colors.accentSoft, overflow: "hidden", borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5, fontWeight: "900" },
  empty: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 18 },
  emptyText: { color: colors.muted, fontSize: 12, textAlign: "center" },
  ticket: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 14, gap: 12 },
  ticketTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  ticketNo: { color: colors.text, fontSize: 16, fontWeight: "900" },
  ticketMeta: { color: colors.muted, fontSize: 11, marginTop: 4 },
  status: { color: colors.accent, fontSize: 9, fontWeight: "900", backgroundColor: colors.accentSoft, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, overflow: "hidden" },
  items: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 9, gap: 8 },
  itemRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  qty: { color: colors.accent, fontWeight: "900", width: 28 },
  itemName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  itemExtra: { color: colors.muted, fontSize: 11, marginTop: 3 },
  itemNote: { color: colors.accent, fontSize: 11, fontWeight: "700", marginTop: 3 },
  note: { color: colors.muted, fontSize: 11 },
  action: { backgroundColor: colors.accent, borderRadius: 11, paddingVertical: 13, alignItems: "center" },
  actionText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  readyText: { color: colors.green, fontSize: 12, fontWeight: "800", textAlign: "center" },
  error: { color: colors.red, fontSize: 12, fontWeight: "700" },
});
