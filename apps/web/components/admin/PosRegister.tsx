"use client";

import { useState } from "react";
import { chargePosOrder } from "../../app/admin/pos/actions";
import { lineKeyOf } from "../../lib/cart";
import { OptionsPicker, type OptionChoice, type OptionsItem } from "../OptionsPicker";

export interface PosItem {
  id: string;
  name: string;
  price: string;
  categoryName: string;
  options: OptionsItem["options"] | null;
}

interface Line {
  lineKey: string;
  productId: string;
  name: string;
  optionLabel: string;
  variantId?: string;
  modifierIds: string[];
  quantity: number;
}

export function PosRegister({ items }: { items: PosItem[] }) {
  const [lines, setLines] = useState<Line[]>([]);
  const count = lines.reduce((s, l) => s + l.quantity, 0);

  function addLine(item: { id: string; name: string }, choice: { variantId?: string; modifierIds: string[]; optionLabel: string }) {
    const lineKey = lineKeyOf(item.id, choice.variantId, choice.modifierIds);
    setLines((prev) => {
      if (prev.some((l) => l.lineKey === lineKey)) {
        return prev.map((l) => (l.lineKey === lineKey ? { ...l, quantity: Math.min(99, l.quantity + 1) } : l));
      }
      return [...prev, {
        lineKey,
        productId: item.id,
        name: item.name,
        optionLabel: choice.optionLabel,
        variantId: choice.variantId,
        modifierIds: [...choice.modifierIds].sort(),
        quantity: 1,
      }];
    });
  }

  function changeLine(lineKey: string, delta: number) {
    setLines((prev) => prev
      .map((l) => (l.lineKey === lineKey ? { ...l, quantity: Math.max(0, Math.min(99, l.quantity + delta)) } : l))
      .filter((l) => l.quantity > 0));
  }

  const qtyOf = (productId: string) => lines.find((l) => l.lineKey === lineKeyOf(productId))?.quantity ?? 0;
  const optionLines = lines.filter((l) => l.optionLabel);
  const payload = lines.map((l) => ({ productId: l.productId, quantity: l.quantity, variantId: l.variantId, modifierIds: l.modifierIds }));

  return (
    <form action={chargePosOrder} className="checkout-form">
      <input type="hidden" name="lines" value={JSON.stringify(payload)} />
      <label>Customer name (optional) <input name="customerName" maxLength={120} /></label>
      <ul className="product-grid">
        {items.map((item) => (
          <li key={item.id} className="card product">
            <h3>{item.name}</h3>
            <div className="muted">{item.categoryName} · {item.price}</div>
            {item.options ? (
              <OptionsPicker
                item={{ id: item.id, name: item.name, options: item.options }}
                onAdd={(choice: OptionChoice) => addLine(item, choice)}
              />
            ) : (
              <div className="qty" role="group" aria-label={`Quantity of ${item.name}`}>
                <button type="button" onClick={() => changeLine(lineKeyOf(item.id), -1)} disabled={qtyOf(item.id) === 0} aria-label="Remove one">−</button>
                <span aria-live="polite">{qtyOf(item.id)}</span>
                <button type="button" onClick={() => addLine(item, { modifierIds: [], optionLabel: "" })} aria-label="Add one">+</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {optionLines.length > 0 ? (
        <ul className="cart-lines">
          {optionLines.map((l) => (
            <li key={l.lineKey} className="card cart-line">
              <div>
                <strong>{l.name}</strong>
                <div className="muted">{l.optionLabel}</div>
              </div>
              <div className="qty" role="group" aria-label={`Quantity of ${l.name}, ${l.optionLabel}`}>
                <button type="button" onClick={() => changeLine(l.lineKey, -1)} aria-label="Remove one">−</button>
                <span aria-live="polite">{l.quantity}</span>
                <button type="button" onClick={() => changeLine(l.lineKey, 1)} aria-label="Add one">+</button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <label>Cash received (optional, for change) <input name="cashReceived" inputMode="decimal" placeholder="e.g. 5000" /></label>
      <p className="muted">Leave blank if the customer paid the exact amount.</p>

      <button className="btn-primary" type="submit" disabled={count === 0}>
        {count === 0 ? "Choose items" : `Take cash for ${count} item${count === 1 ? "" : "s"} and send to kitchen`}
      </button>
    </form>
  );
}
