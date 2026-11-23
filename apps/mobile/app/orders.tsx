import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { fetchOrderStatus, type OrderStatusResult } from "../src/api";
import { readOrders, type SavedOrder } from "../src/orders";
import { colors } from "../src/theme";

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

  const refresh = useCallback(async (list: SavedOrder[]) => {
    const results = await Promise.all(
      list.map(async (o) => {
        try {
          return [o.reference, await fetchOrderStatus(o.reference)] as const;
        } catch {
          return [o.reference, "unavailable"] as const;
        }
      }),
    );
    setStatuses(Object.fromEntries(results));
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    readOrders().then((list) => {
      if (!active) return;
      setOrders(list);
      setLoaded(true);
      void refresh(list);
      timer = setInterval(() => void refresh(list), 15000);
    });
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [refresh]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {loaded && orders.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.muted}>No orders from this phone yet.</Text>
        </View>
      ) : null}
      {orders.map((o) => (
        <View key={o.reference} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.name}>{o.orderNumber}</Text>
            <Text style={styles.pill}>{statusLabel(statuses[o.reference])}</Text>
          </View>
          <Text style={styles.muted}>
            Placed {new Date(o.placedAt).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      ))}
      {orders.length > 0 ? <Text style={styles.muted}>Statuses refresh every 15 seconds.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, backgroundColor: colors.canvas, flexGrow: 1 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
  pill: { color: colors.brand, fontWeight: "700", fontSize: 14 },
  muted: { color: colors.muted, fontSize: 14 },
});
