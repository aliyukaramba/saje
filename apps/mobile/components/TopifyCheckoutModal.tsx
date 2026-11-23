import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { fetchOrderStatus } from "../src/api";
import { colors } from "../src/theme";

interface Props {
  visible: boolean;
  checkoutUrl: string;
  orderNumber: string;
  reference: string;
  onClose: () => void;
  onPaid: (orderNumber: string) => void;
}

export function TopifyCheckoutModal({
  visible,
  checkoutUrl,
  orderNumber,
  reference,
  onClose,
  onPaid,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState("CHECKING");
  const [returning, setReturning] = useState(false);
  const [webError, setWebError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const notifiedRef = useRef(false);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  useEffect(() => {
    if (!visible) return;

    let active = true;
    let checking = false;
    notifiedRef.current = false;
    setPaymentStatus("CHECKING");
    setReturning(false);
    setWebError(false);
    setLoading(true);

    const checkStatus = async () => {
      if (checking) return;
      checking = true;
      try {
        const result = await fetchOrderStatus(reference);
        if (!active) return;
        setPaymentStatus(result.paymentStatus);
        if (result.paymentStatus === "PAID" && !notifiedRef.current) {
          notifiedRef.current = true;
          onPaidRef.current(result.orderNumber || orderNumber);
        }
      } catch {
        // A temporary network error must not be treated as a failed payment.
      } finally {
        checking = false;
      }
    };

    void checkStatus();
    const timer = setInterval(() => void checkStatus(), 3500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [visible, reference, orderNumber]);

  const failed = paymentStatus === "FAILED" || paymentStatus === "REFUNDED";
  const paid = paymentStatus === "PAID";

  function allowNavigation(url: string) {
    if (url === "about:blank") return true;
    return url.startsWith("https://");
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <View style={styles.heading}>
            <Text style={styles.title}>Secure checkout</Text>
            <Text style={styles.subtitle}>Order {orderNumber} · Powered by Topify</Text>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close checkout" style={styles.closeButton}>
            <Ionicons name="close" size={20} color={colors.ink} />
          </Pressable>
        </View>

        {paid ? (
          <View style={styles.result}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={36} color={colors.surface} />
            </View>
            <Text style={styles.resultTitle}>Payment confirmed</Text>
            <Text style={styles.resultText}>Your payment for order {orderNumber} has been verified. You can track your order in the Orders tab.</Text>
            <Pressable onPress={onClose} style={styles.primaryButton} accessibilityRole="button">
              <Text style={styles.primaryButtonText}>Done</Text>
            </Pressable>
          </View>
        ) : failed ? (
          <View style={styles.result}>
            <View style={styles.failureIcon}>
              <Ionicons name="alert" size={32} color={colors.danger} />
            </View>
            <Text style={styles.resultTitle}>Payment not completed</Text>
            <Text style={styles.resultText}>The payment provider did not confirm this payment. Your cart has been kept. You can close this screen and try again.</Text>
            <Pressable onPress={onClose} style={styles.primaryButton} accessibilityRole="button">
              <Text style={styles.primaryButtonText}>Back to cart</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.webContainer}>
            <View style={styles.statusBar}>
              <View style={styles.statusIcon}><Ionicons name="lock-closed" size={13} color={colors.brand} /></View>
              <View style={styles.statusCopy}>
                <Text style={styles.statusTitle}>{returning ? "Confirming your payment" : "Secure payment"}</Text>
                <Text style={styles.statusText}>{returning ? "Please wait while we verify your transaction" : "Your payment details are protected"}</Text>
              </View>
              {loading || paymentStatus === "CHECKING" ? <ActivityIndicator size="small" color={colors.brand} /> : <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>}
            </View>
            {webError ? (
              <View style={styles.webError}>
                <Ionicons name="cloud-offline-outline" size={30} color={colors.muted} />
                <Text style={styles.resultTitle}>Checkout could not load</Text>
                <Text style={styles.resultText}>Check your internet connection and try loading the payment page again.</Text>
                <Pressable
                  onPress={() => {
                    setWebError(false);
                    setLoading(true);
                    setReloadKey((key) => key + 1);
                  }}
                  style={styles.primaryButton}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryButtonText}>Reload payment page</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.webFrame}>
              <WebView
                key={reloadKey}
                source={{ uri: checkoutUrl }}
                style={styles.webView}
                originWhitelist={["https://*"]}
                javaScriptEnabled
                domStorageEnabled
                sharedCookiesEnabled
                thirdPartyCookiesEnabled
                setSupportMultipleWindows={false}
                // Checkout never needs camera, microphone, or photo uploads.
                mediaCapturePermissionGrantType="deny"
                // Keep Android's WebView at the normal system text scale and disable pinch zoom.
                contentMode="mobile"
                automaticallyAdjustContentInsets={false}
                contentInsetAdjustmentBehavior="never"
                bounces={false}
                textZoom={100}
                setBuiltInZoomControls={false}
                setDisplayZoomControls={false}
                // Normalize the hosted page's viewport for narrow mobile screens.
                injectedJavaScriptBeforeContentLoaded={`
                  (function () {
                    var applyMobileViewport = function () {
                      var head = document.head || document.getElementsByTagName('head')[0];
                      if (!head) return;
                      var viewport = document.querySelector('meta[name="viewport"]');
                      if (!viewport) {
                        viewport = document.createElement('meta');
                        viewport.name = 'viewport';
                        head.appendChild(viewport);
                      }
                      viewport.setAttribute('content', 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
                      var style = document.getElementById('saje-mobile-checkout-style');
                      if (!style) {
                        style = document.createElement('style');
                        style.id = 'saje-mobile-checkout-style';
                        style.textContent = 'html,body{width:100%!important;max-width:100%!important;min-width:0!important;margin:0!important;overflow-x:hidden!important;-webkit-text-size-adjust:100%!important}*,*:before,*:after{box-sizing:border-box}';
                        head.appendChild(style);
                      }
                    };
                    applyMobileViewport();
                    document.addEventListener('DOMContentLoaded', applyMobileViewport);
                    window.addEventListener('load', applyMobileViewport);
                    // Block checkout file pickers on iOS (Photos/Camera) and Android.
                    // This payment flow does not require document or image uploads.
                    var originalInputClick = HTMLInputElement.prototype.click;
                    HTMLInputElement.prototype.click = function () {
                      if (this.type === 'file') return;
                      return originalInputClick.apply(this, arguments);
                    };
                    if (HTMLInputElement.prototype.showPicker) {
                      var originalShowPicker = HTMLInputElement.prototype.showPicker;
                      HTMLInputElement.prototype.showPicker = function () {
                        if (this.type === 'file') return;
                        return originalShowPicker.apply(this, arguments);
                      };
                    }
                    document.addEventListener('click', function (event) {
                      var target = event.target;
                      if (target && target.closest && target.closest('input[type="file"]')) {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                      }
                    }, true);
                    var blockMediaCapture = function () {
                      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                        navigator.mediaDevices.getUserMedia = function () {
                          return Promise.reject(new DOMException('Media capture is disabled in checkout.', 'NotAllowedError'));
                        };
                      }
                    };
                    blockMediaCapture();
                    return true;
                  })();
                  true;
                `}
                allowsBackForwardNavigationGestures
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setWebError(true);
                }}
                onShouldStartLoadWithRequest={(request) => allowNavigation(request.url)}
                onNavigationStateChange={(navigation) => {
                  if (navigation.url.includes("/checkout/return")) setReturning(true);
                }}
              />
              </View>
            )}
            <View style={styles.footer}>
              <View style={styles.footerIcon}><Ionicons name="shield-checkmark" size={14} color={colors.brand} /></View>
              <Text style={styles.footerText}>SAJE verifies every payment securely. Never share your PIN or OTP.</Text>
            </View>
          </View>
        )}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  header: {
    paddingTop: 12,
    paddingBottom: 18,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.canvas,
  },
  heading: { flex: 1, gap: 5 },
  title: { color: colors.ink, fontSize: 21, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 12, fontWeight: "500" },
  closeButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, marginLeft: 12 },
  webContainer: { flex: 1, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8, gap: 10 },
  statusBar: {
    minHeight: 66,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statusIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#eaf3f1", alignItems: "center", justifyContent: "center" },
  statusCopy: { flex: 1, gap: 3 },
  statusTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  statusText: { color: colors.muted, fontSize: 11, fontWeight: "500" },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#eaf3f1", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand },
  liveText: { color: colors.brand, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  webFrame: { flex: 1, overflow: "hidden", borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  webView: { flex: 1, backgroundColor: colors.surface },
  footer: {
    minHeight: 42,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  footerIcon: { width: 24, height: 24, borderRadius: 8, backgroundColor: "#eaf3f1", alignItems: "center", justifyContent: "center" },
  footerText: { color: colors.muted, fontSize: 10, flexShrink: 1, textAlign: "left", lineHeight: 15 },
  result: { flex: 1, margin: 16, padding: 28, alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: colors.surface, borderRadius: 28, borderWidth: 1, borderColor: colors.line },
  successIcon: { width: 82, height: 82, borderRadius: 28, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  failureIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#fdecea", alignItems: "center", justifyContent: "center" },
  resultTitle: { color: colors.ink, fontSize: 21, fontWeight: "800", textAlign: "center" },
  resultText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 340 },
  primaryButton: { width: "100%", maxWidth: 340, backgroundColor: colors.ink, borderRadius: 999, paddingVertical: 15, alignItems: "center", marginTop: 8 },
  primaryButtonText: { color: colors.surface, fontSize: 15, fontWeight: "700" },
  webError: { flex: 1, padding: 28, alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: colors.canvas },
});
