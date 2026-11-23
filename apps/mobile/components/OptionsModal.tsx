import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { MenuItem, OptionGroup } from "../src/api";
import type { NewLine } from "../src/cart";
import { formatKobo } from "../src/money";
import { colors } from "../src/theme";

/** Size and add-on picker for dishes with options. Totals and rules match the website picker. */
export function OptionsModal({ item, onClose, onAdd }: { item: MenuItem | null; onClose: () => void; onAdd: (line: NewLine) => void }) {
  const options = item?.options ?? null;
  const key = item?.id ?? "";
  const defaultVariant = (m: MenuItem | null) => m?.options?.variants.find((v) => v.isAvailable)?.id ?? null;

  const [shownKey, setShownKey] = useState(key);
  const [variantId, setVariantId] = useState<string | null>(defaultVariant(item));
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  // Reset the choices when a different dish is opened.
  if (shownKey !== key) {
    setShownKey(key);
    setVariantId(defaultVariant(item));
    setPicked({});
    setError(null);
  }

  const variant = options?.variants.find((v) => v.id === variantId) ?? null;
  const selectedModifiers = useMemo(() => {
    if (!options) return [];
    return options.groups.flatMap((g) => g.modifiers.filter((m) => (picked[g.id] ?? []).includes(m.id)));
  }, [options, picked]);

  const unitMinor = options
    ? Number(options.unitMinor) + (variant ? Number(variant.delta) : 0) + selectedModifiers.reduce((s, m) => s + Number(m.delta), 0)
    : 0;

  function toggle(group: OptionGroup, modifierId: string) {
    setPicked((prev) => {
      const current = prev[group.id] ?? [];
      if (group.maxSelect === 1) return { ...prev, [group.id]: current[0] === modifierId ? [] : [modifierId] };
      if (current.includes(modifierId)) return { ...prev, [group.id]: current.filter((x) => x !== modifierId) };
      if (current.length >= group.maxSelect) return prev;
      return { ...prev, [group.id]: [...current, modifierId] };
    });
  }

  function submit() {
    if (!item || !options) return;
    if (options.variants.length > 0 && !variant) {
      setError("Choose a size.");
      return;
    }
    for (const g of options.groups) {
      if ((picked[g.id] ?? []).length < g.minSelect) {
        setError(`Choose ${g.name.toLowerCase()}.`);
        return;
      }
    }
    onAdd({
      productId: item.id,
      name: item.name,
      variantId: variant?.id ?? null,
      modifierIds: selectedModifiers.map((m) => m.id),
      optionLabel: [variant?.name, ...selectedModifiers.map((m) => m.name)].filter(Boolean).join(" · "),
      unitMinor,
    });
    onClose();
  }

  return (
    <Modal visible={item !== null && options !== null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{item?.name}</Text>
          <ScrollView contentContainerStyle={{ gap: 8 }}>
            {options && options.variants.length > 0 ? (
              <View style={{ gap: 8 }}>
                <Text style={styles.section}>Size</Text>
                {options.variants.map((v) => (
                  <Option
                    key={v.id}
                    label={`${v.name}${Number(v.delta) ? ` +${formatKobo(Number(v.delta))}` : ""}`}
                    selected={variantId === v.id}
                    disabled={!v.isAvailable}
                    onPress={() => setVariantId(v.id)}
                  />
                ))}
              </View>
            ) : null}
            {options?.groups.map((g) => (
              <View key={g.id} style={{ gap: 8 }}>
                <Text style={styles.section}>{g.name}</Text>
                <Text style={styles.muted}>
                  {g.minSelect > 0 ? "Required" : "Optional"}
                  {g.maxSelect > 1 ? ` · up to ${g.maxSelect}` : ""}
                </Text>
                {g.modifiers.map((m) => (
                  <Option
                    key={m.id}
                    label={`${m.name}${Number(m.delta) ? ` +${formatKobo(Number(m.delta))}` : ""}`}
                    selected={(picked[g.id] ?? []).includes(m.id)}
                    disabled={!m.isAvailable}
                    onPress={() => toggle(g, m.id)}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.primary} onPress={submit} accessibilityRole="button">
            <Text style={styles.primaryText}>Add · {formatKobo(unitMinor)}</Text>
          </Pressable>
          <Pressable onPress={onClose} accessibilityRole="button" style={{ alignItems: "center", paddingVertical: 8 }}>
            <Text style={styles.muted}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Option({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[styles.option, selected && styles.optionSelected, disabled && { opacity: 0.4 }]}
    >
      <Text style={[styles.optionText, selected && { color: colors.surface }]}>{label}</Text>
      <Text style={[styles.optionText, selected && { color: colors.surface }]}>{selected ? "✓" : ""}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12, maxHeight: "80%" },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink },
  section: { fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 6 },
  muted: { color: colors.muted, fontSize: 13 },
  option: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  optionSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  optionText: { color: colors.ink, fontWeight: "600", fontSize: 15 },
  error: { color: colors.danger, fontSize: 14 },
  primary: { backgroundColor: colors.brand, borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  primaryText: { color: colors.brandInk, fontWeight: "700", fontSize: 16 },
});
