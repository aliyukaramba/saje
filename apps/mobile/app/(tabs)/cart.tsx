import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { fetchFulfilment, startCheckout, type CheckoutLine, type CheckoutResult, type FulfilmentChoice, type Fulfilment } from "../../src/api";
import { changeQuantity, clearCart, removeLine, subtotalKobo, useCart } from "../../src/cart";
import { SwipeRow } from "../../components/SwipeRow";
import { TopifyCheckoutModal } from "../../components/TopifyCheckoutModal";
import { rememberOrder } from "../../src/orders";
import { formatKobo, nairaToKobo } from "../../src/money";
import { colors } from "../../src/theme";

const PICKUP_MINUTES = 30;

export default function CartScreen() {
  const lines = useCart();
  const [options, setOptions] = useState<Fulfilment | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [optionsRetry, setOptionsRetry] = useState(0);
  const [mode, setMode] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [address, setAddress] = useState({ line1: "", city: "", state: "", landmark: "", instructions: "" });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeCheckout, setActiveCheckout] = useState<CheckoutResult | null>(null);

  useEffect(() => {
    let active = true;
    setOptionsLoading(true);
    setOptionsError(null);
    fetchFulfilment()
      .then((result) => {
        if (!active) return;
        setOptions(result);
        setMode((current) => {
          if (current === "PICKUP" && !result.pickupEnabled && result.deliveryEnabled) return "DELIVERY";
          if (current === "DELIVERY" && !result.deliveryEnabled && result.pickupEnabled) return "PICKUP";
          return current;
        });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setOptions(null);
        setOptionsError(cause instanceof Error ? cause.message : "We could not load ordering options.");
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });
    return () => { active = false; };
  }, [optionsRetry]);

  const subtotal = subtotalKobo(lines);
  const zone = options?.zones.find((z) => z.id === zoneId) ?? null;
  const feeKobo = mode === "DELIVERY" && zone ? nairaToKobo(zone.fee) : 0;
  const minKobo = zone ? nairaToKobo(zone.minOrderAmount) : 0;
  const canOrder = !optionsLoading && !optionsError && options !== null && (mode === "PICKUP" ? options.pickupEnabled : options.deliveryEnabled);

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
      setActiveCheckout({ checkoutUrl, orderNumber, reference });
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not start your order.");
    } finally {
      setBusy(false);
    }
  }

  function handlePaymentPaid(paidOrderNumber: string) {
    clearCart();
    setMessage(`Payment confirmed for order ${paidOrderNumber}. Track it under Orders.`);
  }

  const checkoutModal = activeCheckout ? (
    <TopifyCheckoutModal
      visible
      checkoutUrl={activeCheckout.checkoutUrl}
      orderNumber={activeCheckout.orderNumber}
      reference={activeCheckout.reference}
      onClose={() => {
        const orderNumber = activeCheckout.orderNumber;
        setActiveCheckout(null);
        setMessage((current) => current ?? `Payment is not confirmed yet. Order ${orderNumber} is saved under Orders; check its status before placing another order.`);
      }}
      onPaid={handlePaymentPaid}
    />
  ) : null;

  if (lines.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.emptyContent}>
        <View style={styles.emptyIllustration}>
          <Ionicons name="bag-handle-outline" size={42} color={colors.brand} />
        </View>
        <Text style={styles.emptyTitle}>{message ? "Order received" : "Your bag is waiting"}</Text>
        <Text style={styles.emptyDescription}>
          {message ?? "Looks like you haven't added anything yet. Explore the menu and find something delicious."}
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => (message ? router.push("/orders") : router.push("/"))} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>{message ? "Track my order" : "Explore the menu"}</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.surface} />
        </Pressable>
        {checkoutModal}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.intro}>
        <View>
          <Text style={styles.eyebrow}>SAJE • ORDERING</Text>
          <Text style={styles.pageTitle}>Your order</Text>
          <Text style={styles.introCopy}>A few details and your favourites will be on their way.</Text>
        </View>
        <View style={styles.itemCount}>
          <Ionicons name="bag-handle-outline" size={17} color={colors.brand} />
          <Text style={styles.itemCountText}>{lines.reduce((sum, line) => sum + line.quantity, 0)} items</Text>
        </View>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Your selection</Text>
        <Text style={styles.sectionMeta}>{lines.length} {lines.length === 1 ? "dish" : "dishes"}</Text>
      </View>
      <View style={styles.itemsCard}>
        {lines.map((l, index) => (
          <View key={l.lineKey}>
            {index > 0 ? <View style={styles.itemDivider} /> : null}
            <SwipeRow onDelete={() => removeLine(l.lineKey)}>
              <View style={styles.line}>
                {l.imageUrl ? (
                  <Image source={{ uri: l.imageUrl }} style={{ width: 76, height: 76, borderRadius: 17, backgroundColor: colors.canvas }} />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]}>
                    <Ionicons name="restaurant-outline" size={25} color={colors.muted} />
                  </View>
                )}
                <View style={styles.lineInfo}>
                  <Text style={styles.name} numberOfLines={2}>{l.name}</Text>
                  {l.optionLabel ? <Text style={styles.optionLabel} numberOfLines={2}>{l.optionLabel}</Text> : null}
                  <Text style={styles.price}>{formatKobo(l.unitMinor * l.quantity)}</Text>
                </View>
                <View style={styles.stepper}>
                  <Pressable onPress={() => changeQuantity(l.lineKey, -1)} style={styles.stepButton} accessibilityRole="button" accessibilityLabel={`Remove one ${l.name}`}>
                    <Ionicons name="remove" size={16} color={colors.ink} />
                  </Pressable>
                  <Text style={styles.stepText}>{l.quantity}</Text>
                  <Pressable onPress={() => changeQuantity(l.lineKey, 1)} style={styles.stepButton} accessibilityRole="button" accessibilityLabel={`Add one ${l.name}`}>
                    <Ionicons name="add" size={16} color={colors.ink} />
                  </Pressable>
                </View>
              </View>
            </SwipeRow>
          </View>
        ))}
        <Text style={styles.swipeHint}><Ionicons name="arrow-back" size={12} color={colors.muted} /> Swipe a dish left to remove it</Text>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Fulfilment</Text>
        <Text style={styles.sectionMeta}>How would you like it?</Text>
      </View>
      <View style={styles.panel}>
        {optionsLoading ? <InlineNotice icon="time-outline" text="Loading pickup and delivery options…" /> : null}
        {optionsError ? (
          <View style={styles.noticeError}>
            <Text style={styles.error}>{optionsError}</Text>
            <Pressable style={styles.retryButton} onPress={() => setOptionsRetry((value) => value + 1)} accessibilityRole="button">
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
        {!optionsLoading && !optionsError && options && !options.pickupEnabled && !options.deliveryEnabled ? (
          <InlineNotice icon="alert-circle-outline" text="Online ordering is currently unavailable. Please try again later." danger />
        ) : null}
        <View style={styles.modeRow}>
          {options?.pickupEnabled ? (
            <ModeOption icon="storefront-outline" title="Pickup" subtitle="Collect in person" active={mode === "PICKUP"} onPress={() => setMode("PICKUP")} />
          ) : null}
          {options?.deliveryEnabled ? (
            <ModeOption icon="bicycle-outline" title="Delivery" subtitle="To your doorstep" active={mode === "DELIVERY"} onPress={() => setMode("DELIVERY")} />
          ) : null}
        </View>
        {mode === "PICKUP" ? (
          <View style={styles.infoStrip}>
            <Ionicons name="time-outline" size={17} color={colors.brand} />
            <Text style={styles.infoText}>Your order should be ready in about {PICKUP_MINUTES} minutes after payment.</Text>
          </View>
        ) : (
          <View style={styles.formStack}>
            <Text style={styles.fieldGroupTitle}>Choose your delivery area</Text>
            <View style={styles.zoneList}>
              {options?.zones.map((z) => (
                <Pressable key={z.id} onPress={() => setZoneId(z.id)} accessibilityRole="radio" accessibilityState={{ checked: zoneId === z.id }} style={[styles.zoneOption, zoneId === z.id && styles.zoneOptionActive]}>
                  <View style={styles.zoneCopy}>
                    <Text style={[styles.zoneName, zoneId === z.id && styles.zoneNameActive]}>{z.name}</Text>
                    <Text style={[styles.zoneFee, zoneId === z.id && styles.zoneFeeActive]}>Delivery fee · {formatKobo(nairaToKobo(z.fee))}</Text>
                  </View>
                  <Ionicons name={zoneId === z.id ? "checkmark-circle" : "ellipse-outline"} size={21} color={zoneId === z.id ? colors.brand : colors.muted} />
                </Pressable>
              ))}
            </View>
            {zone ? <Text style={styles.helperText}>Minimum order for this area: {formatKobo(minKobo)}</Text> : null}
            <Text style={styles.fieldGroupTitle}>Delivery address</Text>
            <Field label="Street address" value={address.line1} onChangeText={(v) => setAddress({ ...address, line1: v })} />
            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}>
                <Field label="City" value={address.city} onChangeText={(v) => setAddress({ ...address, city: v })} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="State" value={address.state} onChangeText={(v) => setAddress({ ...address, state: v })} />
              </View>
            </View>
            <Field label="Landmark (optional)" value={address.landmark} onChangeText={(v) => setAddress({ ...address, landmark: v })} />
            <Field label="Delivery instructions (optional)" value={address.instructions} onChangeText={(v) => setAddress({ ...address, instructions: v })} />
          </View>
        )}
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Contact details</Text>
        <Text style={styles.sectionMeta}>For order updates</Text>
      </View>
      <View style={styles.panel}>
        <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View>
            <Text style={styles.summaryTitle}>Order summary</Text>
            <Text style={styles.summarySubtitle}>A clear breakdown of your total</Text>
          </View>
          <View style={styles.summaryIcon}><Ionicons name="receipt-outline" size={19} color={colors.brand} /></View>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatKobo(subtotal)}</Text>
        </View>
        {mode === "DELIVERY" && zone ? (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery · {zone.name}</Text>
            <Text style={styles.summaryValue}>{formatKobo(feeKobo)}</Text>
          </View>
        ) : null}
        <View style={styles.summaryDivider} />
        <View style={styles.totalRow}>
          <View>
            <Text style={styles.totalLabel}>Total to pay</Text>
            <Text style={styles.totalNote}>Final amount confirmed at payment</Text>
          </View>
          <Text style={styles.totalAmount}>{formatKobo(subtotal + feeKobo)}</Text>
        </View>
      </View>

      {error ? <View style={styles.formError}><Ionicons name="alert-circle" size={18} color={colors.danger} /><Text style={styles.error}>{error}</Text></View> : null}
      {message ? <Text style={styles.successMessage}>{message}</Text> : null}
      <Pressable style={[styles.checkoutButton, (busy || !canOrder) && styles.disabled]} disabled={busy || !canOrder} onPress={placeOrder} accessibilityRole="button">
        <View style={styles.checkoutButtonCopy}>
          <Text style={styles.checkoutButtonTitle}>{busy ? "Preparing checkout…" : optionsLoading ? "Loading options…" : optionsError ? "Checkout unavailable" : canOrder ? "Continue to secure payment" : "Ordering is closed"}</Text>
          <Text style={styles.checkoutButtonSubtitle}>Powered by Topify</Text>
        </View>
        <View style={styles.checkoutArrow}><Ionicons name="arrow-forward" size={20} color={colors.ink} /></View>
      </Pressable>
      <View style={styles.secureNote}>
        <Ionicons name="lock-closed-outline" size={13} color={colors.muted} />
        <Text style={styles.secureNoteText}>Your payment is processed securely. SAJE never stores your card details.</Text>
      </View>
      {checkoutModal}
    </ScrollView>
  );
}

function InlineNotice({ icon, text, danger = false }: { icon: React.ComponentProps<typeof Ionicons>["name"]; text: string; danger?: boolean }) {
  return (
    <View style={[styles.infoStrip, danger && styles.dangerStrip]}>
      <Ionicons name={icon} size={17} color={danger ? colors.danger : colors.brand} />
      <Text style={[styles.infoText, danger && { color: colors.danger }]}>{text}</Text>
    </View>
  );
}

function ModeOption({ icon, title, subtitle, active, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; subtitle: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: active }} style={[styles.modeOption, active && styles.modeOptionActive]}>
      <View style={[styles.modeIcon, active && styles.modeIconActive]}>
        <Ionicons name={icon} size={20} color={active ? colors.surface : colors.ink} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.modeTitle}>{title}</Text>
        <Text style={styles.modeSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name={active ? "checkmark-circle" : "ellipse-outline"} size={20} color={active ? colors.brand : colors.muted} />
    </Pressable>
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
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={colors.muted}
        selectionColor={colors.brand}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 160, gap: 16, backgroundColor: colors.canvas },
  intro: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 4, paddingBottom: 4 },
  eyebrow: { color: colors.brand, fontSize: 10, fontWeight: "800", letterSpacing: 1.7, marginBottom: 7 },
  pageTitle: { color: colors.ink, fontSize: 29, fontWeight: "800", letterSpacing: -0.8 },
  introCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5, maxWidth: 240 },
  itemCount: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#e7efed", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  itemCountText: { color: colors.brand, fontSize: 12, fontWeight: "700" },
  sectionHeading: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 3 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  sectionMeta: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  itemsCard: { backgroundColor: colors.surface, borderRadius: 22, padding: 12, borderWidth: 1, borderColor: colors.line, gap: 2 },
  itemDivider: { height: 1, backgroundColor: colors.line, marginHorizontal: 4, marginVertical: 9 },
  line: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: colors.surface, paddingVertical: 5, paddingHorizontal: 2 },
  thumb: { width: 76, height: 76, borderRadius: 17, backgroundColor: colors.canvas },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  lineInfo: { flex: 1, gap: 4, minWidth: 0 },
  name: { fontSize: 14, fontWeight: "700", color: colors.ink },
  optionLabel: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  price: { fontSize: 14, fontWeight: "800", color: colors.brand, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.canvas, borderRadius: 999, padding: 4 },
  stepButton: { width: 27, height: 27, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  stepText: { color: colors.ink, fontSize: 13, fontWeight: "800", minWidth: 12, textAlign: "center" },
  swipeHint: { color: colors.muted, fontSize: 10, textAlign: "right", paddingTop: 9, paddingRight: 4 },
  panel: { backgroundColor: colors.surface, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.line, gap: 14 },
  modeRow: { flexDirection: "row", gap: 9 },
  modeOption: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  modeOptionActive: { borderColor: colors.brand, backgroundColor: "#f0f6f4" },
  modeIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  modeIconActive: { backgroundColor: colors.brand },
  modeTitle: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  modeSubtitle: { color: colors.muted, fontSize: 9, lineHeight: 12 },
  infoStrip: { flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: "#edf4f2", borderRadius: 13, padding: 12 },
  dangerStrip: { backgroundColor: "#fdf0ef" },
  infoText: { flex: 1, color: colors.brand, fontSize: 12, lineHeight: 17 },
  formStack: { gap: 12 },
  fieldGroupTitle: { color: colors.ink, fontSize: 13, fontWeight: "800", marginTop: 2 },
  zoneList: { gap: 8 },
  zoneOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  zoneOptionActive: { borderColor: colors.brand, backgroundColor: "#f0f6f4" },
  zoneCopy: { gap: 4 },
  zoneName: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  zoneNameActive: { color: colors.brand },
  zoneFee: { color: colors.muted, fontSize: 11 },
  zoneFeeActive: { color: colors.brand },
  helperText: { color: colors.brand, fontSize: 11, fontWeight: "600" },
  fieldRow: { flexDirection: "row", gap: 10 },
  field: { gap: 6 },
  fieldLabel: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 12, fontSize: 14, color: colors.ink, backgroundColor: "#fbfbfc" },
  summaryCard: { backgroundColor: colors.surface, borderRadius: 22, padding: 17, borderWidth: 1, borderColor: colors.line, gap: 14 },
  summaryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  summaryTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  summarySubtitle: { color: colors.muted, fontSize: 11, marginTop: 3 },
  summaryIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#eaf1ef", alignItems: "center", justifyContent: "center" },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryLabel: { color: colors.muted, fontSize: 13 },
  summaryValue: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  summaryDivider: { height: 1, backgroundColor: colors.line },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  totalLabel: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  totalNote: { color: colors.muted, fontSize: 10, marginTop: 3 },
  totalAmount: { color: colors.brand, fontSize: 20, fontWeight: "900" },
  checkoutButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.ink, borderRadius: 18, paddingVertical: 13, paddingHorizontal: 16, marginTop: 1 },
  checkoutButtonCopy: { flex: 1, gap: 4 },
  checkoutButtonTitle: { color: colors.surface, fontSize: 14, fontWeight: "800" },
  checkoutButtonSubtitle: { color: "rgba(255,255,255,0.6)", fontSize: 10 },
  checkoutArrow: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  secureNote: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingHorizontal: 8 },
  secureNoteText: { color: colors.muted, fontSize: 10, textAlign: "center", lineHeight: 15, flex: 1 },
  formError: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fdf0ef", borderRadius: 13, padding: 12 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 17, flex: 1 },
  successMessage: { color: colors.brand, fontSize: 12, lineHeight: 18, textAlign: "center" },
  retryButton: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 15, paddingVertical: 9, backgroundColor: colors.ink },
  retryButtonText: { color: colors.surface, fontWeight: "700", fontSize: 12 },
  disabled: { opacity: 0.5 },
  emptyContent: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 13, backgroundColor: colors.canvas, paddingBottom: 150 },
  emptyIllustration: { width: 92, height: 92, borderRadius: 30, backgroundColor: "#e7efed", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  emptyTitle: { color: colors.ink, fontSize: 23, fontWeight: "900", textAlign: "center", letterSpacing: -0.5 },
  emptyDescription: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center", maxWidth: 280, marginBottom: 8 },
  primaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 15, minWidth: 210 },
  primaryButtonText: { color: colors.surface, fontSize: 14, fontWeight: "800" },
});
