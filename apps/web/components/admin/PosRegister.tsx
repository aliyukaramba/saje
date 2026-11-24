"use client";

import { useState } from "react";
import { chargePosOrder } from "../../app/admin/pos/actions";
import { lineKeyOf } from "../../lib/cart";
import { OptionsPicker, type OptionChoice, type OptionsItem } from "../OptionsPicker";

type Method = "CASH" | "POS_TERMINAL" | "BANK_TRANSFER";
const METHODS: { value: Method; label: string; description: string; mark: string }[] = [
  { value: "CASH", label: "Cash", description: "Customer paid with cash", mark: "₦" },
  { value: "POS_TERMINAL", label: "Card / POS", description: "Paid through a card terminal", mark: "POS" },
  { value: "BANK_TRANSFER", label: "Bank transfer", description: "Transfer received in the account", mark: "↗" },
];

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
  const [method, setMethod] = useState<Method>("CASH");
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
    <form action={chargePosOrder} className="checkout-form pos-register">
      <input type="hidden" name="lines" value={JSON.stringify(payload)} />

      <section className="pos-catalog" aria-label="Menu items">
        <div className="pos-section-heading">
          <div>
            <span className="pos-eyebrow">REGISTER</span>
            <h2>Choose items</h2>
            <p>Select products to add them to this walk-in order.</p>
          </div>
          <span className="pos-count">{count} {count === 1 ? "item" : "items"}</span>
        </div>

        <label className="pos-customer-field">
          <span>Customer name <small>Optional</small></span>
          <input name="customerName" maxLength={120} placeholder="Enter customer name" />
        </label>

        <ul className="product-grid">
          {items.map((item) => (
            <li key={item.id} className="card product">
              <div className="pos-product-copy">
                <h3>{item.name}</h3>
                <div className="muted">{item.categoryName || "Menu item"}</div>
                <strong className="pos-product-price">{item.price}</strong>
              </div>
              {item.options ? (
                <OptionsPicker
                  item={{ id: item.id, name: item.name, options: item.options }}
                  onAdd={(choice: OptionChoice) => addLine(item, choice)}
                />
              ) : (
                <div className="qty pos-product-qty" role="group" aria-label={`Quantity of ${item.name}`}>
                  <button type="button" onClick={() => changeLine(lineKeyOf(item.id), -1)} disabled={qtyOf(item.id) === 0} aria-label="Remove one">−</button>
                  <span aria-live="polite">{qtyOf(item.id)}</span>
                  <button type="button" onClick={() => addLine(item, { modifierIds: [], optionLabel: "" })} aria-label={`Add ${item.name}`}>+</button>
                </div>
              )}
            </li>
          ))}
          {items.length === 0 ? <li className="pos-no-products">No available menu items found.</li> : null}
        </ul>
      </section>

      <aside className="pos-checkout" aria-label="Payment and checkout">
        <div className="pos-section-heading pos-checkout-heading">
          <div>
            <span className="pos-eyebrow">CHECKOUT</span>
            <h2>Payment details</h2>
            <p>Record how the customer settled this order.</p>
          </div>
        </div>

        <div className="pos-cart-summary">
          <div className="pos-cart-summary-top">
            <strong>Order summary</strong>
            <span>{count} {count === 1 ? "item" : "items"}</span>
          </div>
          {lines.length === 0 ? (
            <p className="pos-cart-empty">Your order is empty. Add menu items to get started.</p>
          ) : (
            <ul className="pos-cart-list">
              {lines.map((line) => (
                <li key={line.lineKey}>
                  <div className="pos-cart-item-name">
                    <strong>{line.name}</strong>
                    {line.optionLabel ? <small>{line.optionLabel}</small> : null}
                  </div>
                  <div className="qty pos-cart-qty" role="group" aria-label={`Quantity of ${line.name}`}>
                    <button type="button" onClick={() => changeLine(line.lineKey, -1)} aria-label="Remove one">−</button>
                    <span aria-live="polite">{line.quantity}</span>
                    <button type="button" onClick={() => changeLine(line.lineKey, 1)} aria-label="Add one">+</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <fieldset className="pos-payment-methods">
          <legend>How did the customer pay?</legend>
          <div className="pos-payment-options">
            {METHODS.map((m) => (
              <label key={m.value} className={`pos-payment-option${method === m.value ? " is-selected" : ""}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value={m.value}
                  checked={method === m.value}
                  onChange={() => setMethod(m.value)}
                />
                <span className="pos-payment-mark" aria-hidden="true">{m.mark}</span>
                <span className="pos-payment-copy">
                  <strong>{m.label}</strong>
                  <small>{m.description}</small>
                </span>
                <span className="pos-payment-check" aria-hidden="true">{method === m.value ? "✓" : ""}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {method === "CASH" ? (
          <div className="pos-cash-panel">
            <label htmlFor="pos-cash-received">Cash received</label>
            <div className="pos-cash-input-wrap">
              <span>₦</span>
              <input id="pos-cash-received" name="cashReceived" inputMode="decimal" placeholder="Enter amount received" />
            </div>
            <p>Optional. Enter the amount handed over to calculate change. Leave blank for exact cash.</p>
          </div>
        ) : (
          <div className="pos-payment-note">
            {method === "POS_TERMINAL"
              ? "Confirm the card payment on the terminal before completing this sale."
              : "Confirm that the transfer has arrived before completing this sale."}
          </div>
        )}

        <button className="btn-primary pos-complete-sale" type="submit" disabled={count === 0}>
          {count === 0 ? "Add items to continue" : "Complete sale & send to kitchen"}
        </button>
        <p className="pos-secure-note">The sale will be recorded and sent to the kitchen.</p>
      </aside>
    </form>
  );
}
