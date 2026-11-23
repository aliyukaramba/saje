import { useMemo, useRef, type ReactNode } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../src/theme";

const REVEAL = 84;

/** A row that slides left to reveal a delete button. A long swipe deletes it straight away. */
export function SwipeRow({ onDelete, children }: { onDelete: () => void; children: ReactNode }) {
  const x = useRef(new Animated.Value(0)).current;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_, g) => {
          x.setValue(Math.min(0, Math.max(-REVEAL * 1.6, g.dx)));
        },
        onPanResponderRelease: (_, g) => {
          if (g.dx < -120) {
            Animated.timing(x, { toValue: -480, duration: 180, useNativeDriver: true }).start(() => onDelete());
          } else if (g.dx < -40) {
            Animated.spring(x, { toValue: -REVEAL, useNativeDriver: true }).start();
          } else {
            Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [x, onDelete],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.behind}>
        <Pressable onPress={onDelete} style={styles.deleteButton} accessibilityRole="button" accessibilityLabel="Delete">
          <Ionicons name="trash-outline" size={20} color={colors.surface} />
        </Pressable>
      </View>
      <Animated.View style={{ transform: [{ translateX: x }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 24, overflow: "hidden" },
  behind: { ...StyleSheet.absoluteFill, backgroundColor: colors.danger, alignItems: "flex-end", justifyContent: "center", borderRadius: 24 },
  deleteButton: { width: REVEAL, height: "100%", alignItems: "center", justifyContent: "center" },
});
