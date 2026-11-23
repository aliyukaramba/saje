import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { fetchFulfilment, startCheckout, type CheckoutLine, type FulfilmentChoice, type Fulfilment } from "../../src/api";
import { changeQuantity, clearCart, removeLine, subtotalKobo, useCart } from "../../src/cart";
import { SwipeRow } from "../../components/SwipeRow";
import { rememberOrder } from "../../src/orders";
import { formatKobo, nairaToKobo } from "../../src/money";
import { colors } from "../../src/theme";

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
      setMessage(`Order ${orderNumber} placed. Track it under Orders.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not start your order.");
    } finally {
      setBusy(false);
    }
  }

  if (lines.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.muted}>{message ?? "Your cart is empty. Add dishes from the menu."}</Text>
          <Pressable style={styles.solid} onPress={() => (message ? router.push("/orders") : router.push("/"))} accessibilityRole="button">
            <Text style={styles.solidText}>{message ? "View my orders" : "Back to the menu"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.section}>Your cart</Text>
      {lines.map((l) => (
        <SwipeRow key={l.lineKey} onDelete={() => removeLine(l.lineKey)}>
        <View style={styles.line}>
          {l.imageUrl ? <Image source={{ uri: l.imageUrl }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: colors.line }]} />}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.name} numberOfLines={1}>{l.name}</Text>
            {l.optionLabel ? <Text style={styles.muted} numberOfLines={2}>{l.optionLabel}</Text> : null}
            <Text style={styles.price}>{formatKobo(l.unitMinor * l.quantity)}</Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 8 }}>
            <View style={styles.stepper}>
              <Pressable onPress={() => changeQuantity(l.lineKey, -1)} style={styles.stepButton} accessibilityLabel={`Remove one ${l.name}`}>
                <Text style={styles.stepSign}>−</Text>
              </Pressable>
              <Text style={styles.stepText}>{l.quantity}</Text>
              <Pressable onPress={() => changeQuantity(l.lineKey, 1)} style={styles.stepButton} accessibilityLabel={`Add one ${l.name}`}>
                <Text style={styles.stepSign}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>
        </SwipeRow>
      ))}

      <View style={styles.card}>
        <Text style={styles.section}>Order Summary</Text>
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
        <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 }]}>
          <Text style={styles.name}>Total</Text>
          <Text style={styles.price}>{formatKobo(subtotal + feeKobo)}</Text>
        </View>
        <Text style={styles.muted}>Final prices are confirmed on the payment page.</Text>
      </View>

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
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Your details</Text>
        <Field label="Your name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="Email for your receipt" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={[styles.checkout, (busy || !canOrder) && styles.disabled]} disabled={busy || !canOrder} onPress={placeOrder} accessibilityRole="button">
        <Text style={styles.solidText}>{busy ? "Starting payment…" : canOrder ? "Checkout" : "Ordering is closed right now"}</Text>
      </Pressable>
      {message ? <Text style={styles.muted}>{message}</Text> : null}
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
  content: { padding: 16, gap: 14, backgroundColor: colors.canvas, paddingBottom: 140 },
  section: { fontSize: 18, fontWeight: "800", color: colors.ink },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.line },
  line: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: 24, padding: 10, borderWidth: 1, borderColor: colors.line },
  thumb: { width: 80, height: 80, borderRadius: 18 },
  trash: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#fdecea" },
  checkout: { backgroundColor: colors.ink, borderRadius: 999, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
  price: { fontSize: 15, fontWeight: "800", color: colors.brand },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { color: colors.ink, fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 14 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  stepText: { fontSize: 15, fontWeight: "700", color: colors.ink, minWidth: 14, textAlign: "center" },
  // The +/− sit on the dark button, so they must be light (previously dark on dark).
  stepSign: { fontSize: 18, fontWeight: "700", color: colors.surface, lineHeight: 20, textAlign: "center" },
  remove: { color: colors.danger, fontWeight: "600", fontSize: 13 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: colors.ink, backgroundColor: colors.surface },
  segment: { flex: 1, borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingVertical: 10, alignItems: "center" },
  segmentActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  segmentText: { color: colors.ink, fontWeight: "600" },
  solid: { backgroundColor: colors.brand, borderRadius: 999, paddingVertical: 15, alignItems: "center" },
  solidText: { color: colors.brandInk, fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.6 },
  error: { color: colors.danger, fontSize: 14 },
});
