import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";

export default function TableOrderScreen() {
  const params = useLocalSearchParams<{ token: string; origin: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const originValue = Array.isArray(params.origin) ? params.origin[0] : params.origin;

  const target = useMemo(() => {
    if (!token || !/^[A-Za-z0-9_-]{20,120}$/.test(token) || !originValue) return null;
    try {
      const origin = new URL(originValue);
      if (origin.protocol !== "https:" || origin.origin !== originValue) return null;
      return new URL(`/t/${token}`, origin).toString();
    } catch {
      return null;
    }
  }, [token, originValue]);

  if (!target) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={34} color={colors.danger} />
        <Text style={styles.title}>Invalid table QR code</Text>
        <Text style={styles.muted}>Please scan the QR code placed on your table again.</Text>
        <Pressable style={styles.button} onPress={() => router.replace("/scan")}><Text style={styles.buttonText}>Scan again</Text></Pressable>
      </View>
    );
  }

  const allowedOrigin = new URL(target).origin;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={23} color={colors.ink} />
        </Pressable>
        <Text style={styles.topTitle}>SAJE · Dine in</Text>
        <View style={styles.backPlaceholder} />
      </View>
      <WebView
        source={{ uri: target }}
        style={styles.web}
        originWhitelist={[allowedOrigin]}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        setSupportMultipleWindows={false}
        startInLoadingState
        renderLoading={() => <View style={styles.loading}><ActivityIndicator size="large" color={colors.brand} /><Text style={styles.muted}>Opening your table menu…</Text></View>}
        onShouldStartLoadWithRequest={(request) => request.url === "about:blank" || request.url.startsWith(allowedOrigin + "/") }
        onError={() => undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  top: { height: 54, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.canvas },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  backPlaceholder: { width: 40 },
  topTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  web: { flex: 1, backgroundColor: colors.canvas },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: colors.canvas },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12, backgroundColor: colors.canvas },
  title: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  muted: { color: colors.muted, fontSize: 13, textAlign: "center" },
  button: { backgroundColor: colors.ink, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 999, marginTop: 8 },
  buttonText: { color: colors.surface, fontWeight: "800" },
});
