import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { fetchOrderStatus, type OrderStatusResult } from "../../src/api";
import { readOrders, type SavedOrder } from "../../src/orders";
import { colors } from "../../src/theme";

const LABELS: Record<string, string> = {
  CONFIRMED: "Confirmed",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  OUT_FOR_DELIVERY: "On the way",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function statusLabel(s: OrderStatusResult | "unavailable" | undefined): string {
  if (s === undefined) return "Loading…";
  if (s === "unavailable") return "Status unavailable";
  if (s.orderStatus === "PENDING") return "Waiting for payment";
  return LABELS[s.orderStatus] ?? s.orderStatus;
}

export default function OrdersScreen() {
  const [orders, setOrders] = useState<SavedOrder[]>([]);
  const [statuses, setStatuses] = useState<Record<string, OrderStatusResult | "unavailable">>({});
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refreshStatuses = useCallback(async (list: SavedOrder[], isActive: () => boolean) => {
    const results = await Promise.all(
      list.map(async (order) => {
        try {
          return [order.reference, await fetchOrderStatus(order.reference)] as const;
        } catch {
          return [order.reference, "unavailable"] as const;
        }
      }),
    );
    if (isActive()) {
      setStatuses((current) => ({ ...current, ...Object.fromEntries(results) }));
    }
  }, []);

  const refreshOrders = useCallback(async (isActive: () => boolean) => {
    const list = await readOrders();
    if (!isActive()) return;
    setOrders(list);
    setLoaded(true);
    await refreshStatuses(list, isActive);
  }, [refreshStatuses]);

  // Refresh the local order list every time the tab becomes active. This picks
  // up orders created while the user was on the Menu or Cart tab.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      let refreshingNow = false;
      const isActive = () => active;

      const load = async () => {
        if (refreshingNow) return;
        refreshingNow = true;
        try {
          await refreshOrders(isActive);
        } finally {
          refreshingNow = false;
        }
      };

      void load();
      const timer = setInterval(() => void load(), 15000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [refreshOrders]),
  );

  const onPullToRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshOrders(() => true);
    } finally {
      setRefreshing(false);
    }
  }, [refreshOrders]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullToRefresh} tintColor={colors.brand} />}
    >
      {loaded && orders.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.muted}>No orders from this phone yet.</Text>
        </View>
      ) : null}
      {orders.map((order) => (
        <View key={order.reference} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.name}>{order.orderNumber}</Text>
            <Text style={styles.pill}>{statusLabel(statuses[order.reference])}</Text>
          </View>
          <Text style={styles.muted}>
            Placed {new Date(order.placedAt).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      ))}
      {orders.length > 0 ? <Text style={styles.muted}>Statuses refresh every 15 seconds. Pull down to refresh now.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 140, gap: 12, backgroundColor: colors.canvas, flexGrow: 1 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
  pill: { color: colors.brand, fontWeight: "700", fontSize: 14 },
  muted: { color: colors.muted, fontSize: 14 },
});
