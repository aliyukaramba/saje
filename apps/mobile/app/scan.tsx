import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../src/theme";

function tableLinkFromQr(value: string): { token: string; origin: string } | null {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/t\/([A-Za-z0-9_-]{20,120})\/?$/);
    if (url.protocol !== "https:" || !match) return null;
    return { token: match[1], origin: url.origin };
  } catch {
    return null;
  }
}

export default function ScanTableScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onBarcodeScanned({ data }: { data: string }) {
    if (scanned) return;
    const tableLink = tableLinkFromQr(data);
    if (!tableLink) {
      setError("This QR code is not a valid SAJE table code. Scan the code placed on your table.");
      setScanned(true);
      return;
    }
    setScanned(true);
    router.replace({ pathname: "/table/[token]", params: tableLink });
  }

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color={colors.brand} /><Text style={styles.muted}>Checking camera access…</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <View style={styles.permissionIcon}><Ionicons name="camera-outline" size={30} color={colors.brand} /></View>
        <Text style={styles.title}>Scan your table QR</Text>
        <Text style={styles.muted}>SAJE needs camera access to identify your table and open its menu.</Text>
        <Pressable style={styles.primary} onPress={() => void requestPermission()}><Text style={styles.primaryText}>Allow camera access</Text></Pressable>
        <Pressable style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>Go back</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} style={styles.close} accessibilityRole="button" accessibilityLabel="Close scanner">
          <Ionicons name="close" size={23} color={colors.ink} />
        </Pressable>
        <Text style={styles.topTitle}>Scan table QR</Text>
        <View style={styles.closePlaceholder} />
      </View>
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
        />
        <View pointerEvents="none" style={styles.overlay}>
          <View style={styles.scanFrame}><View style={styles.cornerTL} /><View style={styles.cornerTR} /><View style={styles.cornerBL} /><View style={styles.cornerBR} /></View>
        </View>
      </View>
      <View style={styles.instructions}>
        <Text style={styles.title}>Point your camera at the table QR</Text>
        <Text style={styles.muted}>We'll open the menu for your table automatically.</Text>
        {error ? (
          <View style={styles.errorWrap}>
            <Text style={styles.error}>{error}</Text>
            <Pressable style={styles.primary} onPress={() => { setError(null); setScanned(false); }}><Text style={styles.primaryText}>Scan again</Text></Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  top: { height: 58, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  closePlaceholder: { width: 40 },
  topTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  cameraWrap: { flex: 1, marginHorizontal: 16, marginTop: 10, borderRadius: 28, overflow: "hidden", backgroundColor: "#171717" },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  scanFrame: { width: 250, height: 250, position: "relative" },
  cornerTL: { position: "absolute", top: 0, left: 0, width: 34, height: 34, borderTopWidth: 5, borderLeftWidth: 5, borderColor: "#fff", borderTopLeftRadius: 12 },
  cornerTR: { position: "absolute", top: 0, right: 0, width: 34, height: 34, borderTopWidth: 5, borderRightWidth: 5, borderColor: "#fff", borderTopRightRadius: 12 },
  cornerBL: { position: "absolute", bottom: 0, left: 0, width: 34, height: 34, borderBottomWidth: 5, borderLeftWidth: 5, borderColor: "#fff", borderBottomLeftRadius: 12 },
  cornerBR: { position: "absolute", bottom: 0, right: 0, width: 34, height: 34, borderBottomWidth: 5, borderRightWidth: 5, borderColor: "#fff", borderBottomRightRadius: 12 },
  instructions: { alignItems: "center", paddingHorizontal: 26, paddingTop: 24, paddingBottom: 44, gap: 8 },
  title: { color: colors.ink, fontSize: 19, fontWeight: "800", textAlign: "center" },
  muted: { color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 19 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 14, backgroundColor: colors.canvas },
  permissionIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: colors.ink, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 999, marginTop: 8 },
  primaryText: { color: colors.surface, fontWeight: "800", fontSize: 13 },
  back: { padding: 10 },
  backText: { color: colors.muted, fontWeight: "700" },
  errorWrap: { alignItems: "center", gap: 8, marginTop: 8 },
  error: { color: colors.danger, fontSize: 12, textAlign: "center" },
});
