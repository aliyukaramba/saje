"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { getOrders, getProfile, signIn, signOut, type StaffOrder, type StaffUser } from "../src/api";
import { colors } from "../src/theme";

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
      setToken(result.token);
      setUser(result.user);
      await load(result.token);
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally { setBusy(false); }
  };

  const onRefresh = async () => {
    if (!token) return;
    setRefreshing(true);
    try { await load(token); } catch (e) { setError(e instanceof Error ? e.message : "Refresh failed."); }
    finally { setRefreshing(false); }
  };

  const onLogout = async () => {
    if (token) await signOut(token).catch(() => undefined);
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

  const home = roleHome(user.roles);
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>
        <View style={styles.top}>
          <View>
            <Text style={styles.eyebrow}>SAJE STAFF</Text>
            <Text style={styles.greeting}>Good service starts here.</Text>
          </View>
          <Pressable onPress={onLogout} style={styles.logout}><Ionicons name="log-out-outline" size={20} color={colors.text} /></Pressable>
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
