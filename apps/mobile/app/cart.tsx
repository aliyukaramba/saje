import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { startPickupCheckout } from "../src/api";
import { changeQuantity, clearCart, useCart } from "../src/cart";
import { colors } from "../src/theme";

const PICKUP_MINUTES = 30;

export default function CartScreen() {
  const lines = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function placeOrder() {
    setError(null);
    setMessage(null);
    if (lines.length === 0) return setError("Your order is empty.");
    if (name.trim().length < 2) return setError("Please enter your name.");
    if (phone.trim().length < 7) return setError("Please enter a phone number.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Please enter a valid email for your receipt.");

    setBusy(true);
    try {
      const pickupAt = new Date(Date.now() + PICKUP_MINUTES * 60_000);
      const { checkoutUrl, orderNumber } = await startPickupCheckout({
        lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        customer: { name: name.trim(), phone: phone.trim(), email: email.trim() },
        pickupAt,
      });
      await WebBrowser.openBrowserAsync(checkoutUrl);
      clearCart();
      setMessage(`Order ${orderNumber} is waiting for payment. Pick up in about ${PICKUP_MINUTES} minutes once paid.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not start your order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {lines.length === 0 ? (
        <Text style={styles.muted}>{message ?? "Your order is empty. Add dishes from the menu."}</Text>
      ) : (
        <View style={styles.card}>
          {lines.map((l) => (
            <View key={l.productId} style={styles.line}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{l.name}</Text>
                <Text style={styles.muted}>{l.price}</Text>
              </View>
              <View style={styles.qty}>
                <Pressable onPress={() => changeQuantity(l.productId, -1)} style={styles.qtyButton} accessibilityLabel={`Remove one ${l.name}`}>
                  <Text style={styles.qtyText}>−</Text>
                </Pressable>
                <Text style={styles.qtyText}>{l.quantity}</Text>
                <Pressable onPress={() => changeQuantity(l.productId, 1)} style={styles.qtyButton} accessibilityLabel={`Add one ${l.name}`}>
                  <Text style={styles.qtyText}>+</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {lines.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.section}>Pickup</Text>
          <Text style={styles.muted}>Ready in about {PICKUP_MINUTES} minutes after payment.</Text>
          <Text style={styles.label}>Your name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} autoCapitalize="words" placeholder="Full name" placeholderTextColor={colors.muted} />
          <Text style={styles.label}>Phone</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="080…" placeholderTextColor={colors.muted} />
          <Text style={styles.label}>Email for your receipt</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" placeholderTextColor={colors.muted} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={[styles.primary, busy && styles.disabled]} disabled={busy} onPress={placeOrder} accessibilityRole="button">
            <Text style={styles.primaryText}>{busy ? "Starting payment…" : "Pay and place order"}</Text>
          </Pressable>
          <Text style={styles.muted}>Prices are confirmed on the payment page.</Text>
        </View>
      ) : null}

      {message && lines.length > 0 ? <Text style={styles.muted}>{message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, backgroundColor: colors.canvas, flexGrow: 1 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: colors.line },
  line: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
  section: { fontSize: 18, fontWeight: "800", color: colors.ink },
  label: { color: colors.ink, fontWeight: "600", marginTop: 6 },
  muted: { color: colors.muted, fontSize: 14 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: colors.ink, backgroundColor: colors.surface },
  qty: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  qtyText: { fontSize: 16, fontWeight: "700", color: colors.ink },
  primary: { backgroundColor: colors.brand, borderRadius: 999, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  primaryText: { color: colors.brandInk, fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.6 },
  error: { color: colors.danger, fontSize: 14 },
});
