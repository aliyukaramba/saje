import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { fetchFulfilment, startCheckout, type CheckoutLine, type FulfilmentChoice, type Fulfilment } from "../src/api";
import { changeQuantity, clearCart, subtotalKobo, useCart } from "../src/cart";
import { rememberOrder } from "../src/orders";
import { formatKobo, nairaToKobo } from "../src/money";
import { colors } from "../src/theme";

const PICKUP_MINUTES = 30;

export default function CartScreen() {
  const lines = useCart();
  const [options, setOptions] = useState<Fulfilment | null>(null);
  const [mode, setMode] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [address, setAddress] = useState({ line1: "", city: "", state: "", landmark: "", instructions: "" });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchFulfilment()
      .then((o) => {
        setOptions(o);
        if (!o.pickupEnabled && o.deliveryEnabled) setMode("DELIVERY");
      })
      .catch(() => setOptions({ pickupEnabled: true, deliveryEnabled: false, zones: [] }));
  }, []);

  const subtotal = subtotalKobo(lines);
  const zone = options?.zones.find((z) => z.id === zoneId) ?? null;
  const feeKobo = mode === "DELIVERY" && zone ? nairaToKobo(zone.fee) : 0;
  const minKobo = zone ? nairaToKobo(zone.minOrderAmount) : 0;
  const canOrder = options !== null && (mode === "PICKUP" ? options.pickupEnabled : options.deliveryEnabled);

  async function placeOrder() {
    setError(null);
    setMessage(null);
    if (lines.length === 0) return setError("Your order is empty.");
    if (name.trim().length < 2) return setError("Please enter your name.");
    if (phone.trim().length < 7) return setError("Please enter a phone number.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Please enter a valid email for your receipt.");

    let fulfilment: FulfilmentChoice;
    if (mode === "PICKUP") {
      fulfilment = { type: "PICKUP", pickupAt: new Date(Date.now() + PICKUP_MINUTES * 60_000).toISOString() };
    } else {
      if (!zone) return setError("Choose your delivery area.");
      if (subtotal < minKobo) return setError(`The minimum order for ${zone.name} is ${formatKobo(minKobo)}.`);
      if (address.line1.trim().length < 3 || address.city.trim().length < 2 || address.state.trim().length < 2) {
        return setError("Please enter your full delivery address.");
      }
      fulfilment = {
        type: "DELIVERY",
        zoneId: zone.id,
        address: {
          line1: address.line1.trim(),
          city: address.city.trim(),
          state: address.state.trim(),
          landmark: address.landmark.trim() || undefined,
          instructions: address.instructions.trim() || undefined,
        },
      };
    }

    const payload: CheckoutLine[] = lines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      variantId: l.variantId ?? undefined,
      modifierIds: l.modifierIds,
    }));

    setBusy(true);
    try {
      const { checkoutUrl, orderNumber, reference } = await startCheckout({
        lines: payload,
        customer: { name: name.trim(), phone: phone.trim(), email: email.trim() },
        fulfilment,
      });
      await rememberOrder({ orderNumber, reference, placedAt: new Date().toISOString() });
      await WebBrowser.openBrowserAsync(checkoutUrl);
      clearCart();
      setMessage(`Order ${orderNumber} placed. Track it under My orders.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not start your order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {lines.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.muted}>{message ?? "Your order is empty. Add dishes from the menu."}</Text>
          {message ? <Pressable style={styles.primary} onPress={() => router.push("/orders")}><Text style={styles.primaryText}>View my orders</Text></Pressable> : null}
        </View>
      ) : (
        <View style={styles.card}>
          {lines.map((l) => (
            <View key={l.lineKey} style={styles.line}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name}>{l.name}</Text>
                {l.optionLabel ? <Text style={styles.muted}>{l.optionLabel}</Text> : null}
                <Text style={styles.muted}>{formatKobo(l.unitMinor * l.quantity)}</Text>
              </View>
              <View style={styles.qty}>
                <Pressable onPress={() => changeQuantity(l.lineKey, -1)} style={styles.qtyButton} accessibilityLabel={`Remove one ${l.name}`}>
                  <Text style={styles.qtyText}>−</Text>
                </Pressable>
                <Text style={styles.qtyText}>{l.quantity}</Text>
                <Pressable onPress={() => changeQuantity(l.lineKey, 1)} style={styles.qtyButton} accessibilityLabel={`Add one ${l.name}`}>
                  <Text style={styles.qtyText}>+</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text style={styles.name}>{formatKobo(subtotal)}</Text>
          </View>
          {mode === "DELIVERY" && zone ? (
            <View style={styles.totalRow}>
              <Text style={styles.muted}>Delivery to {zone.name}</Text>
              <Text style={styles.name}>{formatKobo(feeKobo)}</Text>
            </View>
          ) : null}
          <Text style={styles.muted}>Final prices are confirmed on the payment page.</Text>
        </View>
      )}

      {lines.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.section}>How do you want it?</Text>
          {!options ? <Text style={styles.muted}>Loading options…</Text> : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {options?.pickupEnabled ? <Segment label="Pickup" active={mode === "PICKUP"} onPress={() => setMode("PICKUP")} /> : null}
            {options?.deliveryEnabled ? <Segment label="Delivery" active={mode === "DELIVERY"} onPress={() => setMode("DELIVERY")} /> : null}
          </View>

          {mode === "PICKUP" ? (
            <Text style={styles.muted}>Ready in about {PICKUP_MINUTES} minutes after payment.</Text>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={styles.label}>Delivery area</Text>
              {options?.zones.map((z) => (
                <Segment key={z.id} label={`${z.name} · ${formatKobo(nairaToKobo(z.fee))}`} active={zoneId === z.id} onPress={() => setZoneId(z.id)} />
              ))}
              {zone ? <Text style={styles.muted}>Minimum order {formatKobo(minKobo)}</Text> : null}
              <Field label="Street address" value={address.line1} onChangeText={(v) => setAddress({ ...address, line1: v })} />
              <Field label="City" value={address.city} onChangeText={(v) => setAddress({ ...address, city: v })} />
              <Field label="State" value={address.state} onChangeText={(v) => setAddress({ ...address, state: v })} />
              <Field label="Landmark (optional)" value={address.landmark} onChangeText={(v) => setAddress({ ...address, landmark: v })} />
              <Field label="Delivery instructions (optional)" value={address.instructions} onChangeText={(v) => setAddress({ ...address, instructions: v })} />
            </View>
          )}

          <Text style={styles.section}>Your details</Text>
          <Field label="Your name" value={name} onChangeText={setName} autoCapitalize="words" />
          <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field label="Email for your receipt" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={[styles.primary, (busy || !canOrder) && styles.disabled]} disabled={busy || !canOrder} onPress={placeOrder} accessibilityRole="button">
            <Text style={styles.primaryText}>{busy ? "Starting payment…" : canOrder ? "Pay and place order" : "Ordering is closed right now"}</Text>
          </Pressable>
        </View>
      ) : null}

      {message && lines.length > 0 ? <Text style={styles.muted}>{message}</Text> : null}
    </ScrollView>
  );
}

function Field({ label, value, onChangeText, ...rest }: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "phone-pad" | "email-address" | "default";
  autoCapitalize?: "none" | "words" | "sentences";
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChangeText} placeholderTextColor={colors.muted} {...rest} />
    </View>
  );
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.segment, active && styles.segmentActive]}>
      <Text style={[styles.segmentText, active && { color: colors.surface }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, backgroundColor: colors.canvas, flexGrow: 1 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.line },
  line: { flexDirection: "row", alignItems: "center", gap: 12 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
  section: { fontSize: 18, fontWeight: "800", color: colors.ink, marginTop: 4 },
  label: { color: colors.ink, fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 14 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: colors.ink, backgroundColor: colors.surface },
  qty: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  qtyText: { fontSize: 16, fontWeight: "700", color: colors.ink },
  segment: { flex: 1, borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingVertical: 10, alignItems: "center" },
  segmentActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  segmentText: { color: colors.ink, fontWeight: "600" },
  primary: { backgroundColor: colors.brand, borderRadius: 999, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  primaryText: { color: colors.brandInk, fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.6 },
  error: { color: colors.danger, fontSize: 14 },
});
