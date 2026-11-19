"use client";

import { useMemo, useState } from "react";
import { formatMinor } from "@restaurant/shared";
import { addToCart } from "../lib/cart";

export interface OptionChoice {
  variantId?: string;
  modifierIds: string[];
  optionLabel: string;
  priceLabel: string;
}

export interface OptionsItem {
  id: string;
  name: string;
  options: {
    unitMinor: string;
    variants: { id: string; name: string; delta: string; isAvailable: boolean }[];
    groups: {
      id: string; name: string; isRequired: boolean; minSelect: number; maxSelect: number;
      modifiers: { id: string; name: string; delta: string; isAvailable: boolean }[];
    }[];
  };
}

const signed = (delta: bigint) => `${delta > 0n ? "+" : delta < 0n ? "−" : ""}${formatMinor(delta < 0n ? -delta : delta)}`;

/** Size and add-on picker. The browser shows the price; the server recalculates it at checkout. */
export function OptionsPicker({ item, onAdd }: { item: OptionsItem; onAdd?: (choice: OptionChoice) => void }) {
  const { options } = item;
  const [open, setOpen] = useState(false);
  const [variantId, setVariantId] = useState(options.variants.find((v) => v.isAvailable)?.id ?? "");
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const variant = options.variants.find((v) => v.id === variantId);

  const totalMinor = useMemo(() => {
    let t = BigInt(options.unitMinor);
    if (variant) t += BigInt(variant.delta);
    for (const g of options.groups) {
      for (const m of g.modifiers) {
        if ((picked[g.id] ?? []).includes(m.id)) t += BigInt(m.delta);
      }
    }
    return t;
  }, [options, variant, picked]);

  function toggle(groupId: string, maxSelect: number, modifierId: string) {
    setError(null);
    setPicked((prev) => {
      const current = prev[groupId] ?? [];
      if (maxSelect === 1) return { ...prev, [groupId]: current[0] === modifierId ? [] : [modifierId] };
      if (current.includes(modifierId)) return { ...prev, [groupId]: current.filter((id) => id !== modifierId) };
      if (current.length >= maxSelect) return prev;
      return { ...prev, [groupId]: [...current, modifierId] };
    });
  }

  function add() {
    setError(null);
    if (options.variants.length > 0 && !variant) return setError("Choose a size.");
    for (const g of options.groups) {
      const count = (picked[g.id] ?? []).length;
      if (count < g.minSelect) return setError(`Choose ${g.name.toLowerCase()}.`);
    }
    const modifierIds = options.groups.flatMap((g) => picked[g.id] ?? []);
    const names = [
      variant?.name,
      ...options.groups.flatMap((g) => g.modifiers.filter((m) => (picked[g.id] ?? []).includes(m.id)).map((m) => m.name)),
    ].filter(Boolean);
    const choice: OptionChoice = {
      variantId: variant?.id,
      modifierIds,
      optionLabel: names.join(" · "),
      priceLabel: formatMinor(totalMinor),
    };
    if (onAdd) onAdd(choice);
    else addToCart({ id: item.id, name: item.name, price: choice.priceLabel, variantId: choice.variantId, modifierIds, optionLabel: choice.optionLabel });
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  }

  if (!open) {
    return (
      <button type="button" className="btn-add" aria-expanded="false" onClick={() => setOpen(true)}>
        Choose options
      </button>
    );
  }

  return (
    <div className="options-panel">
      {options.variants.length > 0 ? (
        <fieldset>
          <legend>Size</legend>
          {options.variants.map((v) => (
            <label key={v.id} className="opt-row">
              <input
                type="radio"
                name={`${item.id}-size`}
                value={v.id}
                disabled={!v.isAvailable}
                checked={variantId === v.id}
                onChange={() => { setError(null); setVariantId(v.id); }}
              />
              <span>{v.name}</span>
              {BigInt(v.delta) !== 0n ? <span className="muted">{signed(BigInt(v.delta))}</span> : null}
              {!v.isAvailable ? <span className="muted">Sold out</span> : null}
            </label>
          ))}
        </fieldset>
      ) : null}

      {options.groups.map((g) => (
        <fieldset key={g.id}>
          <legend>
            {g.name}{" "}
            <span className="muted">
              {g.minSelect > 0 ? "Required" : "Optional"}
              {g.maxSelect > 1 ? ` · up to ${g.maxSelect}` : ""}
            </span>
          </legend>
          {g.modifiers.map((m) => {
            const selected = (picked[g.id] ?? []).includes(m.id);
            return (
              <label key={m.id} className="opt-row">
                <input
                  type={g.maxSelect === 1 ? "radio" : "checkbox"}
                  name={`${item.id}-${g.id}`}
                  checked={selected}
                  disabled={!m.isAvailable || (!selected && g.maxSelect > 1 && (picked[g.id] ?? []).length >= g.maxSelect)}
                  onChange={() => toggle(g.id, g.maxSelect, m.id)}
                />
                <span>{m.name}</span>
                {BigInt(m.delta) !== 0n ? <span className="muted">{signed(BigInt(m.delta))}</span> : null}
                {!m.isAvailable ? <span className="muted">Sold out</span> : null}
              </label>
            );
          })}
        </fieldset>
      ))}

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button
        type="button"
        className="btn-add"
        onClick={add}
        disabled={options.variants.length > 0 && !variant}
        aria-live="polite"
      >
        {added ? "Added" : `Add to cart · ${formatMinor(totalMinor)}`}
      </button>
    </div>
  );
}
