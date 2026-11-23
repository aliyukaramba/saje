import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createReservation } from "../../src/api";
import { readReservations, rememberReservation, type SavedReservation } from "../../src/reservations";
import { colors } from "../../src/theme";

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(value).toLocaleDateString("en-NG", options ?? {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  autoCapitalize = "sentences",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "phone-pad" | "email-address";
  autoCapitalize?: "none" | "sentences" | "words";
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={styles.input}
      />
    </View>
  );
}

export default function ReservationScreen() {
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date(Date.now() + 86400000)));
  const [time, setTime] = useState("18:00");
  const [partySize, setPartySize] = useState(2);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<SavedReservation | null>(null);
  const [reservations, setReservations] = useState<SavedReservation[]>([]);

  useEffect(() => {
    let active = true;
    void readReservations().then((items) => {
      if (active) setReservations(items);
    });
    return () => { active = false; };
  }, []);

  const dates = useMemo(() => Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + index + 1);
    return { key: dateKey(date), date };
  }), []);

  async function submit() {
    setError(null);
    const cleanName = guestName.trim();
    const cleanPhone = guestPhone.trim();
    if (cleanName.length < 2) {
      setError("Enter the name for your reservation.");
      return;
    }
    if (cleanPhone.replace(/[^0-9+]/g, "").length < 7) {
      setError("Enter a valid phone number.");
      return;
    }
    if (!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(time)) {
      setError("Enter a time in 24-hour format, for example 18:30.");
      return;
    }
    const startsAt = new Date(`${selectedDate}T${time}:00`);
    if (!Number.isFinite(startsAt.getTime()) || startsAt <= new Date()) {
      setError("Choose a future date and time.");
      return;
    }
    setBusy(true);
    try {
      const result = await createReservation({
        guestName: cleanName,
        guestPhone: cleanPhone,
        ...(guestEmail.trim() ? { guestEmail: guestEmail.trim() } : {}),
        partySize,
        startsAt: startsAt.toISOString(),
        ...(specialRequests.trim() ? { specialRequests: specialRequests.trim() } : {}),
      });
      const saved: SavedReservation = {
        id: result.id,
        guestName: result.guestName,
        partySize: result.partySize,
        startsAt: result.startsAt,
        status: result.status,
      };
      setLatest(saved);
      setReservations(await rememberReservation(saved));
      setGuestName("");
      setGuestPhone("");
      setGuestEmail("");
      setSpecialRequests("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not complete your reservation. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>SAJE  /  RESERVATIONS</Text>
        <Text style={styles.heading}>Your table, <Text style={styles.headingAccent}>your time.</Text></Text>
        <Text style={styles.intro}>Make it a date. Choose when you're coming and we'll take care of the rest.</Text>
      </View>

      {latest ? (
        <View style={styles.successCard}>
          <View style={styles.successIcon}><Ionicons name="checkmark" size={22} color="#ffffff" /></View>
          <View style={styles.successCopy}>
            <Text style={styles.successTitle}>Reservation request received</Text>
            <Text style={styles.successText}>
              {formatDate(latest.startsAt, { weekday: "long", day: "numeric", month: "long" })} at {new Date(latest.startsAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })} · {latest.partySize} guests
            </Text>
            <Text style={styles.pending}>Pending restaurant confirmation</Text>
          </View>
          <Pressable onPress={() => setLatest(null)} accessibilityRole="button" accessibilityLabel="Dismiss confirmation">
            <Ionicons name="close" size={20} color={colors.muted} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.sectionHeading}>
          <View style={styles.sectionIcon}><Ionicons name="calendar-outline" size={19} color={colors.brand} /></View>
          <View><Text style={styles.sectionTitle}>When are you coming?</Text><Text style={styles.sectionSub}>Choose a date within the next 14 days</Text></View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
          {dates.map(({ key, date }) => {
            const active = selectedDate === key;
            return (
              <Pressable key={key} onPress={() => setSelectedDate(key)} style={[styles.dateTile, active && styles.dateTileActive]}>
                <Text style={[styles.dateDay, active && styles.dateTextActive]}>{date.toLocaleDateString("en-NG", { weekday: "short" })}</Text>
                <Text style={[styles.dateNumber, active && styles.dateTextActive]}>{date.getDate()}</Text>
                <Text style={[styles.dateMonth, active && styles.dateTextActive]}>{date.toLocaleDateString("en-NG", { month: "short" })}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.formRow}>
          <View style={styles.halfField}>
            <Text style={styles.fieldLabel}>Arrival time</Text>
            <View style={styles.timeInputWrap}>
              <Ionicons name="time-outline" size={18} color={colors.muted} />
              <TextInput
                value={time}
                onChangeText={setTime}
                placeholder="18:00"
                placeholderTextColor={colors.muted}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                style={styles.timeInput}
              />
            </View>
          </View>
          <View style={styles.halfField}>
            <Text style={styles.fieldLabel}>Number of guests</Text>
            <View style={styles.stepper}>
              <Pressable onPress={() => setPartySize((n) => Math.max(1, n - 1))} style={styles.stepButton} accessibilityLabel="Remove one guest"><Ionicons name="remove" size={18} color={colors.ink} /></Pressable>
              <Text style={styles.stepValue}>{partySize}</Text>
              <Pressable onPress={() => setPartySize((n) => Math.min(30, n + 1))} style={styles.stepButton} accessibilityLabel="Add one guest"><Ionicons name="add" size={18} color={colors.ink} /></Pressable>
            </View>
          </View>
        </View>
        <Text style={styles.helper}>Use 24-hour time, for example 18:30. Reservations are for 90 minutes.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeading}>
          <View style={styles.sectionIcon}><Ionicons name="person-outline" size={19} color={colors.brand} /></View>
          <View><Text style={styles.sectionTitle}>Your details</Text><Text style={styles.sectionSub}>Who should we expect?</Text></View>
        </View>
        <Field label="Full name" value={guestName} onChangeText={setGuestName} placeholder="Name for the reservation" />
        <Field label="Phone number" value={guestPhone} onChangeText={setGuestPhone} placeholder="e.g. 08012345678" keyboardType="phone-pad" />
        <Field label="Email address (optional)" value={guestEmail} onChangeText={setGuestEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>Special requests (optional)</Text>
          <TextInput
            value={specialRequests}
            onChangeText={setSpecialRequests}
            placeholder="Celebration, seating preference, dietary needs…"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={500}
            style={[styles.input, styles.textArea]}
          />
        </View>
      </View>

      {error ? <View style={styles.errorCard}><Ionicons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={styles.errorText}>{error}</Text></View> : null}

      <Pressable style={({ pressed }) => [styles.submit, pressed && styles.submitPressed, busy && styles.submitDisabled]} onPress={() => void submit()} disabled={busy}>
        {busy ? <ActivityIndicator color="#ffffff" /> : <><Text style={styles.submitText}>Request a table</Text><Ionicons name="arrow-forward" size={19} color="#ffffff" /></>}
      </Pressable>
      <View style={styles.secureNote}><Ionicons name="checkmark-circle-outline" size={15} color={colors.muted} /><Text style={styles.secureText}>Your request is sent directly to the restaurant. We'll confirm your table shortly.</Text></View>

      {reservations.length > 0 ? (
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Your recent reservations</Text>
          {reservations.map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <View style={styles.historyIcon}><Ionicons name="restaurant-outline" size={18} color={colors.brand} /></View>
              <View style={styles.historyCopy}>
                <Text style={styles.historyDate}>{formatDate(item.startsAt, { weekday: "short", day: "numeric", month: "short" })} · {new Date(item.startsAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}</Text>
                <Text style={styles.historyMeta}>{item.partySize} {item.partySize === 1 ? "guest" : "guests"} · {item.guestName}</Text>
              </View>
              <Text style={styles.historyStatus}>Pending</Text>
            </View>
          ))}
          <Text style={styles.historyNote}>This history is saved on this phone. Contact the restaurant to change or cancel a request.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 150, gap: 16 },
  hero: { paddingHorizontal: 4, gap: 7 },
  eyebrow: { color: colors.brand, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  heading: { color: colors.ink, fontSize: 30, lineHeight: 36, fontWeight: "800", letterSpacing: -0.8 },
  headingAccent: { color: colors.brand },
  intro: { color: colors.muted, fontSize: 13, lineHeight: 20, maxWidth: 330 },
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: 17, gap: 15, borderWidth: 1, borderColor: colors.line },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 11 },
  sectionIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#fff1e8", alignItems: "center", justifyContent: "center" },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  sectionSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  dateRow: { gap: 8, paddingVertical: 2 },
  dateTile: { width: 57, borderRadius: 15, paddingVertical: 10, alignItems: "center", gap: 3, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.line },
  dateTileActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  dateDay: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  dateNumber: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  dateMonth: { color: colors.muted, fontSize: 10 },
  dateTextActive: { color: "#ffffff" },
  formRow: { flexDirection: "row", gap: 12 },
  halfField: { flex: 1, gap: 7, minWidth: 0 },
  fieldWrap: { gap: 7 },
  fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  input: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fbfbfc", paddingHorizontal: 13, color: colors.ink, fontSize: 13 },
  timeInputWrap: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fbfbfc", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  timeInput: { flex: 1, color: colors.ink, fontSize: 14, paddingVertical: 0 },
  stepper: { height: 48, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fbfbfc", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5 },
  stepButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line },
  stepValue: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  helper: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: -5 },
  textArea: { minHeight: 88, paddingTop: 12, textAlignVertical: "top" },
  submit: { minHeight: 56, borderRadius: 17, backgroundColor: colors.brand, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, shadowColor: colors.brand, shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  submitPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  submitDisabled: { opacity: 0.65 },
  submitText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  secureNote: { flexDirection: "row", justifyContent: "center", alignItems: "flex-start", gap: 7, paddingHorizontal: 8 },
  secureText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 16 },
  successCard: { flexDirection: "row", alignItems: "flex-start", gap: 11, padding: 14, borderRadius: 17, backgroundColor: "#f0f8f3", borderWidth: 1, borderColor: "#d4eadb" },
  successIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#23834f", alignItems: "center", justifyContent: "center" },
  successCopy: { flex: 1, gap: 4 },
  successTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  successText: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  pending: { color: "#8a4b16", fontSize: 10, fontWeight: "800", marginTop: 2 },
  errorCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff2f0", borderColor: "#f3c7c2", borderWidth: 1, borderRadius: 13, padding: 12 },
  errorText: { flex: 1, color: colors.danger, fontSize: 12, lineHeight: 17 },
  historySection: { gap: 10, marginTop: 4 },
  historyTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  historyCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 15, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  historyIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#fff1e8", alignItems: "center", justifyContent: "center" },
  historyCopy: { flex: 1, gap: 3 },
  historyDate: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  historyMeta: { color: colors.muted, fontSize: 10 },
  historyStatus: { color: "#9a5b20", fontSize: 10, fontWeight: "800" },
  historyNote: { color: colors.muted, fontSize: 10, lineHeight: 15 },
});
