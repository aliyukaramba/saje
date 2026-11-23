import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { API_URL, fetchMenu, type Menu, type MenuItem } from "../../src/api";
import { useOptionChoice } from "../../src/options";
import { formatKobo } from "../../src/money";
import { colors } from "../../src/theme";

type TableLine = { productId: string; quantity: number; variantId?: string; modifierIds: string[] };
type TrackedOrder = { orderNumber: string; status: string; placedAt: string; items: { quantity: number; nameSnapshot: string }[] };
const statusLabels: Record<string, string> = { PENDING: "Received", CONFIRMED: "Sent to kitchen", ACCEPTED: "Accepted", PREPARING: "Preparing", READY: "Ready to serve", COMPLETED: "Served", CANCELLED: "Cancelled" };

export default function TableOrderScreen() {
  const params = useLocalSearchParams<{ token: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const [menu, setMenu] = useState<Menu | null>(null);
  const [tableNumber, setTableNumber] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [lines, setLines] = useState<TableLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderNumbers, setOrderNumbers] = useState<string[]>([]);
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const validToken = !!token && /^[A-Za-z0-9_-]{20,120}$/.test(token);
  const storageKey = `saje-native-table-orders:${token ?? ""}`;

  useEffect(() => {
    if (!validToken) { setLoading(false); return; }
    let active = true;
    fetchMenu().then((data) => { if (active) setMenu(data); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Could not load the table menu."); })
      .finally(() => { if (active) setLoading(false); });
    AsyncStorage.getItem(storageKey).then((raw) => {
      if (!active || !raw) return;
      try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) setOrderNumbers(parsed.filter((x): x is string => typeof x === "string").slice(-20)); } catch { /* ignore invalid saved data */ }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [token, validToken, storageKey]);

  const refreshOrders = useCallback(async () => {
    if (!validToken || orderNumbers.length === 0) { setOrders([]); return; }
    try {
      const response = await fetch(`${API_URL}/api/table-orders/status`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, orders: orderNumbers }),
      });
      if (!response.ok) return;
      const data = await response.json() as { orders: TrackedOrder[] };
      setOrders(data.orders);
    } catch { /* keep the last known status */ }
  }, [token, validToken, orderNumbers]);

  useEffect(() => {
    void refreshOrders();
    if (!orderNumbers.length) return;
    const timer = setInterval(() => void refreshOrders(), 15000);
    return () => clearInterval(timer);
  }, [refreshOrders, orderNumbers.length]);

  const visibleItems = useMemo(() => menu?.items.filter((item) => item.isAvailable && (categoryId === "all" || item.categoryId === categoryId)) ?? [], [menu, categoryId]);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  function addLine(line: TableLine) {
    const key = [line.productId, line.variantId ?? "", [...line.modifierIds].sort().join(",")].join("|");
    setLines((current) => {
      const existing = current.find((x) => [x.productId, x.variantId ?? "", [...x.modifierIds].sort().join(",")].join("|") === key);
      return existing
        ? current.map((x) => [x.productId, x.variantId ?? "", [...x.modifierIds].sort().join(",")].join("|") === key ? { ...x, quantity: Math.min(99, x.quantity + 1) } : x)
        : [...current, { ...line, modifierIds: [...line.modifierIds] }];
    });
  }

  function changeQuantity(line: TableLine, delta: number) {
    const key = [line.productId, line.variantId ?? "", [...line.modifierIds].sort().join(",")].join("|");
    setLines((current) => current.map((x) => [x.productId, x.variantId ?? "", [...x.modifierIds].sort().join(",")].join("|") === key ? { ...x, quantity: x.quantity + delta } : x).filter((x) => x.quantity > 0));
  }

  async function sendOrder() {
    if (!validToken || !lines.length || busy) return;
    setBusy(true); setError(null); setSentMessage(null);
    try {
      const response = await fetch(`${API_URL}/api/table-orders`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, lines }),
      });
      const data = await response.json().catch(() => ({})) as { orderNumber?: string; tableNumber?: string; error?: string };
      if (!response.ok || !data.orderNumber) throw new Error(data.error ?? "We could not send your order. Please try again.");
      setTableNumber(data.tableNumber ?? tableNumber);
      const next = [...orderNumbers.filter((n) => n !== data.orderNumber), data.orderNumber].slice(-20);
      setOrderNumbers(next);
      await AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => undefined);
      setLines([]);
      setSentMessage(data.orderNumber);
      void refreshOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network problem. Please try again.");
    } finally { setBusy(false); }
  }

  if (!validToken) return <Centered title="Invalid table QR code" message="Please scan the QR code placed on your table again." action={() => router.replace("/scan")} />;
  if (loading) return <Centered><ActivityIndicator size="large" color={colors.brand} /><Text style={styles.muted}>Loading your table menu…</Text></Centered>;
  if (error && !menu) return <Centered title="Could not load the menu" message={error} action={() => router.replace("/scan")} />;
  if (!menu || menu.source === "unavailable") return <Centered title="Menu unavailable" message="Please try again or ask a member of staff." />;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")} style={styles.back}><Ionicons name="chevron-back" size={22} color={colors.ink} /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.brand}>SAJE <Text style={styles.brandDot}>·</Text> DINE IN</Text><Text style={styles.headerTitle}>Your table menu</Text></View>
        <View style={styles.tablePill}><Ionicons name="restaurant-outline" size={14} color={colors.brand} /><Text style={styles.tablePillText}>{tableNumber ? `Table ${tableNumber}` : "Table"}</Text></View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {sentMessage ? <View style={styles.success}><Ionicons name="checkmark-circle" size={22} color="#16834a" /><View style={{ flex: 1 }}><Text style={styles.successTitle}>Order sent to the kitchen</Text><Text style={styles.successText}>Order {sentMessage} has been received. You can add more dishes below.</Text></View><Pressable onPress={() => setSentMessage(null)}><Ionicons name="close" size={19} color={colors.muted} /></Pressable></View> : null}
        {orders.length ? <View style={styles.statusCard}><Text style={styles.sectionTitle}>Your orders</Text>{orders.map((order) => <View key={order.orderNumber} style={styles.orderStatus}><View style={{ flex: 1 }}><Text style={styles.orderNumber}>{order.orderNumber}</Text><Text style={styles.muted}>{order.items.map((i) => `${i.quantity} × ${i.nameSnapshot}`).join(", ")}</Text></View><Text style={styles.statusPill}>{statusLabels[order.status] ?? order.status}</Text></View>)}<Text style={styles.statusFoot}>Order status refreshes automatically.</Text></View> : null}
        <View style={styles.intro}><Text style={styles.eyebrow}>FRESHLY PREPARED</Text><Text style={styles.title}>What would you like?</Text><Text style={styles.subtitle}>Choose your dishes and send your order straight to our kitchen.</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
          <Category label="All" active={categoryId === "all"} onPress={() => setCategoryId("all")} />
          {menu.categories.map((c) => <Category key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />)}
        </ScrollView>
        {visibleItems.length === 0 ? <Text style={styles.muted}>No dishes available in this category.</Text> : <View style={styles.grid}>{visibleItems.map((item) => <TableDish key={item.id} item={item} onAdd={addLine} />)}</View>}
        {lines.length ? <View style={styles.cartCard}><Text style={styles.sectionTitle}>Your selection · {itemCount} {itemCount === 1 ? "item" : "items"}</Text>{lines.map((line, index) => <View key={`${line.productId}-${line.variantId ?? ""}-${line.modifierIds.join("-")}-${index}`} style={styles.cartLine}><Text style={styles.cartLineName}>{menu.items.find((i) => i.id === line.productId)?.name ?? "Dish"}{line.variantId || line.modifierIds.length ? "\nSelected options" : ""}</Text><View style={styles.qty}><Pressable onPress={() => changeQuantity(line, -1)}><Text style={styles.qtyText}>−</Text></Pressable><Text style={styles.qtyNumber}>{line.quantity}</Text><Pressable onPress={() => changeQuantity(line, 1)}><Text style={styles.qtyText}>+</Text></Pressable></View></View>)}</View> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={{ height: lines.length ? 110 : 24 }} />
      </ScrollView>
      {lines.length ? <View style={styles.bottom}><Pressable disabled={busy} onPress={() => void sendOrder()} style={[styles.sendButton, busy && { opacity: 0.65 }]}><Text style={styles.sendText}>{busy ? "Sending order…" : `Send ${itemCount} ${itemCount === 1 ? "item" : "items"} to kitchen`}</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></Pressable></View> : null}
    </View>
  );
}

function TableDish({ item, onAdd }: { item: MenuItem; onAdd: (line: TableLine) => void }) {
  const choice = useOptionChoice(item);
  const [showOptions, setShowOptions] = useState(false);
  const qtyLabel = item.options ? "Choose options" : "Add";
  function add() {
    const built = choice.build();
    if (!built.ok) { setShowOptions(true); return; }
    onAdd({ productId: item.id, quantity: 1, variantId: built.line.variantId ?? undefined, modifierIds: built.line.modifierIds });
    setShowOptions(false);
  }
  return (
    <View style={styles.dishCard}>
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.dishImage} /> : <View style={[styles.dishImage, { backgroundColor: colors.line }]} />}
      <Text style={styles.dishName}>{item.name}</Text>
      {item.description ? <Text style={styles.dishDescription} numberOfLines={2}>{item.description}</Text> : null}
      <View style={styles.dishFooter}><Text style={styles.price}>{item.discountPrice ?? item.price}</Text><Pressable onPress={() => item.options ? setShowOptions((v) => !v) : add()} style={styles.addButton}><Ionicons name={item.options ? "options-outline" : "add"} size={16} color="#fff" /><Text style={styles.addButtonText}>{qtyLabel}</Text></Pressable></View>
      {showOptions ? <View style={styles.optionPanel}>
        {choice.options?.variants.length ? <><Text style={styles.optionHeading}>Choose size</Text><View style={styles.optionChoices}>{choice.options.variants.map((v) => <Pressable key={v.id} disabled={!v.isAvailable} onPress={() => choice.setVariantId(v.id)} style={[styles.optionChip, choice.variantId === v.id && styles.optionSelected]}><Text style={[styles.optionText, choice.variantId === v.id && styles.optionTextSelected]}>{v.name}{Number(v.delta) ? ` +${formatKobo(Number(v.delta))}` : ""}</Text></Pressable>)}</View></> : null}
        {choice.options?.groups.map((g) => <View key={g.id}><Text style={styles.optionHeading}>{g.name}{g.minSelect ? " · Required" : ""}</Text><View style={styles.optionChoices}>{g.modifiers.map((m) => { const selected = (choice.picked[g.id] ?? []).includes(m.id); return <Pressable key={m.id} disabled={!m.isAvailable} onPress={() => choice.toggle(g, m.id)} style={[styles.optionChip, selected && styles.optionSelected]}><Text style={[styles.optionText, selected && styles.optionTextSelected]}>{m.name}{Number(m.delta) ? ` +${formatKobo(Number(m.delta))}` : ""}</Text></Pressable>; })}</View></View>)}
        <Pressable onPress={add} style={styles.confirmAdd}><Text style={styles.confirmAddText}>Add to order · {formatKobo(choice.unitMinor)}</Text></Pressable>
      </View> : null}
    </View>
  );
}

function Category({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.category, active && styles.categoryActive]}><Text style={[styles.categoryText, active && styles.categoryTextActive]}>{label}</Text></Pressable>;
}
function Centered({ children, title, message, action }: { children?: React.ReactNode; title?: string; message?: string; action?: () => void }) {
  return <View style={styles.centered}>{children ?? <><Ionicons name="alert-circle-outline" size={34} color={colors.danger} /><Text style={styles.centerTitle}>{title}</Text><Text style={styles.muted}>{message}</Text>{action ? <Pressable onPress={action} style={styles.retry}><Text style={styles.retryText}>Scan another QR code</Text></Pressable> : null}</>}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 14, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, gap: 2 },
  brand: { fontSize: 9, fontWeight: "900", letterSpacing: 1.4, color: colors.brand },
  brandDot: { color: colors.ink },
  headerTitle: { fontSize: 17, fontWeight: "800", color: colors.ink },
  tablePill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#fff1e8", paddingHorizontal: 11, paddingVertical: 8, borderRadius: 99 },
  tablePillText: { color: colors.brand, fontSize: 11, fontWeight: "800" },
  content: { paddingTop: 18, paddingBottom: 26, gap: 18 },
  intro: { paddingHorizontal: 20, gap: 5 },
  eyebrow: { color: colors.brand, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 27, fontWeight: "900", letterSpacing: -0.6 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  categories: { paddingHorizontal: 16, gap: 8 },
  category: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 99, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  categoryActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  categoryText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  categoryTextActive: { color: "#fff" },
  grid: { paddingHorizontal: 16, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 13 },
  dishCard: { width: "48.4%", padding: 9, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 6 },
  dishImage: { width: "100%", height: 116, borderRadius: 14, backgroundColor: colors.canvas },
  dishName: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  dishDescription: { color: colors.muted, fontSize: 11, lineHeight: 15, minHeight: 30 },
  dishFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 5, marginTop: 4 },
  price: { color: colors.brand, fontSize: 12, fontWeight: "900" },
  addButton: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.ink, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 99 },
  addButtonText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  optionPanel: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, gap: 10 },
  optionHeading: { color: colors.ink, fontSize: 11, fontWeight: "800", marginBottom: 6 },
  optionChoices: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  optionChip: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 7, borderWidth: 1, borderColor: colors.line },
  optionSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  optionText: { color: colors.ink, fontSize: 10, fontWeight: "600" },
  optionTextSelected: { color: "#fff" },
  confirmAdd: { backgroundColor: colors.brand, padding: 10, borderRadius: 12, alignItems: "center" },
  confirmAddText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  cartCard: { marginHorizontal: 16, padding: 16, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 12 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  cartLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  cartLineName: { color: colors.ink, fontSize: 12, fontWeight: "700", flex: 1 },
  qty: { flexDirection: "row", alignItems: "center", gap: 15, backgroundColor: colors.canvas, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  qtyText: { color: colors.brand, fontSize: 19, fontWeight: "800" },
  qtyNumber: { color: colors.ink, fontWeight: "800" },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 26, backgroundColor: "rgba(255,255,255,0.97)", borderTopWidth: 1, borderTopColor: colors.line },
  sendButton: { minHeight: 54, borderRadius: 99, backgroundColor: colors.brand, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 },
  sendText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  error: { color: colors.danger, paddingHorizontal: 20, fontSize: 12 },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  success: { marginHorizontal: 16, padding: 13, borderRadius: 16, backgroundColor: "#eaf8ef", flexDirection: "row", gap: 10, alignItems: "center" },
  successTitle: { color: "#146c3c", fontSize: 13, fontWeight: "900" },
  successText: { color: "#276b45", fontSize: 11, lineHeight: 16, marginTop: 2 },
  statusCard: { marginHorizontal: 16, padding: 15, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 10 },
  orderStatus: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  orderNumber: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  statusPill: { color: colors.brand, fontSize: 10, fontWeight: "800", backgroundColor: "#fff1e8", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99 },
  statusFoot: { color: colors.muted, fontSize: 10 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 10, backgroundColor: colors.canvas },
  centerTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  retry: { marginTop: 8, backgroundColor: colors.ink, borderRadius: 99, paddingHorizontal: 18, paddingVertical: 12 },
  retryText: { color: "#fff", fontWeight: "800", fontSize: 12 },
});
