import { useCallback, useRef, useState } from "react";
import {
  Alert,
  Animated,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchOrderStatus, type OrderStatusResult } from "../../src/api";
import { readOrders, removeSavedOrder, type SavedOrder } from "../../src/orders";
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

function OrderRow({
  order,
  status,
  onRemove,
}: {
  order: SavedOrder;
  status: OrderStatusResult | "unavailable" | undefined;
  onRemove: (reference: string) => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);
  const callbacks = useRef({ order, onRemove });
  callbacks.current = { order, onRemove };

  const close = useCallback(() => {
    openRef.current = false;
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 220,
    }).start();
  }, [translateX]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
      onPanResponderMove: (_, gesture) => {
        const start = openRef.current ? -112 : 0;
        translateX.setValue(Math.max(-112, Math.min(0, start + gesture.dx)));
      },
      onPanResponderRelease: (_, gesture) => {
        const start = openRef.current ? -112 : 0;
        const next = start + gesture.dx < -56;
        openRef.current = next;
        Animated.spring(translateX, {
          toValue: next ? -112 : 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 220,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: openRef.current ? -112 : 0,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  const confirmRemove = () => {
    Alert.alert(
      "Remove this order?",
      "This only removes it from your order history on this phone. It will not cancel the order or affect its payment.",
      [
        { text: "Keep order", style: "cancel", onPress: close },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => callbacks.current.onRemove(callbacks.current.order.reference),
        },
      ],
    );
  };

  return (
    <View style={styles.swipeShell}>
      <View style={styles.deleteUnderlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove order ${order.orderNumber} from this device`}
          style={styles.deleteAction}
          onPress={confirmRemove}
        >
          <Ionicons name="trash-outline" size={19} color="#ffffff" />
          <Text style={styles.deleteText}>Remove</Text>
        </Pressable>
      </View>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.card, { transform: [{ translateX }] }]}
      >
        <View style={styles.row}>
          <Text style={styles.name}>{order.orderNumber}</Text>
          <Text style={styles.pill}>{statusLabel(status)}</Text>
        </View>
        <Text style={styles.muted}>
          Placed {new Date(order.placedAt).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </Text>
      </Animated.View>
    </View>
  );
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

  const handleRemove = useCallback(async (reference: string) => {
    const remaining = await removeSavedOrder(reference);
    setOrders(remaining);
    setStatuses((current) => {
      const next = { ...current };
      delete next[reference];
      return next;
    });
  }, []);

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
        <View style={styles.emptyCard}>
          <Text style={styles.muted}>No orders from this phone yet.</Text>
        </View>
      ) : null}
      {orders.map((order) => (
        <OrderRow
          key={order.reference}
          order={order}
          status={statuses[order.reference]}
          onRemove={handleRemove}
        />
      ))}
      {orders.length > 0 ? (
        <Text style={styles.hint}>Swipe an order left to remove it from this phone. Statuses refresh every 15 seconds.</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 140, gap: 12, backgroundColor: colors.canvas, flexGrow: 1 },
  swipeShell: { position: "relative", borderRadius: 16, overflow: "hidden" },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: colors.line, minHeight: 82, justifyContent: "center" },
  deleteUnderlay: { ...StyleSheet.absoluteFillObject, alignItems: "flex-end", justifyContent: "center", backgroundColor: "#d92d20", borderRadius: 16 },
  deleteAction: { width: 112, height: "100%", alignItems: "center", justifyContent: "center", gap: 5 },
  deleteText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
  pill: { color: colors.brand, fontWeight: "700", fontSize: 14 },
  muted: { color: colors.muted, fontSize: 14 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18, paddingHorizontal: 2 },
});
