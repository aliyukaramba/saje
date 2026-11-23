import { useEffect, useState } from "react";
import type { MenuItem, OptionGroup } from "./api";
import type { NewLine } from "./cart";

export type BuiltLine = { ok: true; line: NewLine } | { ok: false; error: string };

/** Size and add-on choices for one dish. Prices and rules match the website. */
export function useOptionChoice(item: MenuItem | null) {
  const options = item?.options ?? null;
  const key = item?.id ?? "";
  const defaultVariant = (m: MenuItem | null) => m?.options?.variants.find((v) => v.isAvailable)?.id ?? null;

  const [variantId, setVariantId] = useState<string | null>(defaultVariant(item));
  const [picked, setPicked] = useState<Record<string, string[]>>({});

  // Reset selections when navigating from one dish to another. Do this in an
  // effect rather than updating state during render.
  useEffect(() => {
    setVariantId(defaultVariant(item));
    setPicked({});
  }, [key]);

  const variant = options?.variants.find((v) => v.id === variantId) ?? null;
  const selectedModifiers = options
    ? options.groups.flatMap((g) => g.modifiers.filter((m) => (picked[g.id] ?? []).includes(m.id)))
    : [];

  const unitMinor = options
    ? Number(options.unitMinor) + (variant ? Number(variant.delta) : 0) + selectedModifiers.reduce((s, m) => s + Number(m.delta), 0)
    : Number(item?.discountPriceMinor ?? item?.priceMinor ?? 0);

  function toggle(group: OptionGroup, modifierId: string) {
    setPicked((prev) => {
      const current = prev[group.id] ?? [];
      if (group.maxSelect === 1) return { ...prev, [group.id]: current[0] === modifierId ? [] : [modifierId] };
      if (current.includes(modifierId)) return { ...prev, [group.id]: current.filter((x) => x !== modifierId) };
      if (current.length >= group.maxSelect) return prev;
      return { ...prev, [group.id]: [...current, modifierId] };
    });
  }

  function build(): BuiltLine {
    if (!item) return { ok: false, error: "This dish is no longer available." };
    if (options) {
      if (options.variants.length > 0 && !variant) return { ok: false, error: "Choose a size." };
      for (const g of options.groups) {
        if ((picked[g.id] ?? []).length < g.minSelect) return { ok: false, error: `Choose ${g.name.toLowerCase()}.` };
      }
    }
    return {
      ok: true,
      line: {
        productId: item.id,
        name: item.name,
        imageUrl: item.imageUrl,
        variantId: variant?.id ?? null,
        modifierIds: selectedModifiers.map((m) => m.id),
        optionLabel: [variant?.name, ...selectedModifiers.map((m) => m.name)].filter(Boolean).join(" · "),
        unitMinor,
      },
    };
  }

  return { options, variantId, setVariantId, picked, toggle, variant, unitMinor, build };
}
