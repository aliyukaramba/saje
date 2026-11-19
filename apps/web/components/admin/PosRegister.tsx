"use client";

import { useState } from "react";
import { chargePosOrder } from "../../app/admin/pos/actions";

export interface PosItem {
  id: string;
  name: string;
  price: string;
  categoryName: string;
}

export function PosRegister({ items }: { items: PosItem[] }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const lines = Object.entries(qty)
    .filter(([, q]) => q > 0)
    .map(([productId, quantity]) => ({ productId, quantity }));
  const count = lines.reduce((s, l) => s + l.quantity, 0);

  function change(id: string, delta: number) {
    setQty((prev) => ({ ...prev, [id]: Math.max(0, Math.min(99, (prev[id] ?? 0) + delta)) }));
  }

  return (
    <form action={chargePosOrder} className="checkout-form">
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <label>Customer name (optional) <input name="customerName" maxLength={120} /></label>
      <ul className="product-grid">
        {items.map((item) => {
          const q = qty[item.id] ?? 0;
          return (
            <li key={item.id} className="card product">
              <h3>{item.name}</h3>
              <div className="muted">{item.categoryName} · {item.price}</div>
              <div className="qty" role="group" aria-label={`Quantity of ${item.name}`}>
                <button type="button" onClick={() => change(item.id, -1)} disabled={q === 0} aria-label="Remove one">−</button>
                <span aria-live="polite">{q}</span>
                <button type="button" onClick={() => change(item.id, 1)} aria-label="Add one">+</button>
              </div>
            </li>
          );
        })}
      </ul>
      <button className="btn-primary" type="submit" disabled={count === 0}>
        {count === 0 ? "Choose items" : `Take cash for ${count} item${count === 1 ? "" : "s"} and send to kitchen`}
      </button>
    </form>
  );
}
