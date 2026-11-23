import { Pressable, StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { TopBar } from "../../components/TopBar";
import { colors } from "../../src/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0];

const BAR_WIDTH = 230;
const BAR_HEIGHT = 70;
const ITEM_WIDTH = 76; // 3 tabs x 76 = 228, inside the 230px capsule

/** The active tab sits in a dark circle, as in the reference. */
function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconActive]}>
      <Ionicons name={name} size={22} color={focused ? colors.surface : colors.ink} />
    </View>
  );
}

/**
 * Our own bar: one frosted capsule, centred in a full-width dock, with the
 * tabs laid out inside it. The library's internal row is not used, so the
 * tabs cannot drift outside the capsule.
 */
function CapsuleTabBar({ state, descriptors, navigation }: TabBarProps) {
  return (
    <View style={styles.dock} pointerEvents="box-none">
      <View style={styles.capsule}>
        <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.row}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const onPress = () => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            };
            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={typeof options.title === "string" ? options.title : route.name}
                style={styles.item}
              >
                {options.tabBarIcon?.({ focused, color: colors.ink, size: 22 })}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CapsuleTabBar {...props} />}
      screenOptions={{
        header: ({ options }) => <TopBar title={typeof options.title === "string" ? options.title : ""} />,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Menu", tabBarIcon: ({ focused }) => <TabIcon name={focused ? "restaurant" : "restaurant-outline"} focused={focused} /> }}
      />
      <Tabs.Screen
        name="cart"
        options={{ title: "Your order", tabBarIcon: ({ focused }) => <TabIcon name={focused ? "bag-handle" : "bag-handle-outline"} focused={focused} /> }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: "My orders", tabBarIcon: ({ focused }) => <TabIcon name={focused ? "receipt" : "receipt-outline"} focused={focused} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 26,
    alignItems: "center",
  },
  capsule: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  item: { width: ITEM_WIDTH, height: BAR_HEIGHT, alignItems: "center", justifyContent: "center" },
  iconWrap: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  iconActive: { backgroundColor: colors.ink },
});
