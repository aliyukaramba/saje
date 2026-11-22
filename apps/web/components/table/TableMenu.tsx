"use client";

import { useEffect, useState } from "react";
import type { WebMenuData } from "../../lib/catalog-source";
import { lineKeyOf } from "../../lib/cart";
import { OptionsPicker, type OptionChoice } from "../OptionsPicker";
import { TableOrderStatus, rememberTableOrder } from "./TableOrderStatus";

interface Line {
  lineKey: string;
  productId: string;
  name: string;
  optionLabel: string;
  variantId?: string;
  modifierIds: string[];
  quantity: number;
}

/** Reads a saved table cart. Older saves have no option fields, so they are filled in here. */
function normalise(raw: Partial<Line>[]): Line[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((l) => {
    if (!l || typeof l.productId !== "string" || !(typeof l.quantity === "number" && l.quantity > 0)) return [];
    const modifierIds = Array.isArray(l.modifierIds) ? l.modifierIds.filter((x) => typeof x === "string") : [];
    const variantId = typeof l.variantId === "string" ? l.variantId : undefined;
    return [{
      lineKey: lineKeyOf(l.productId, variantId, modifierIds),
      productId: l.productId,
      name: String(l.name ?? ""),
      optionLabel: String(l.optionLabel ?? ""),
      variantId,
      modifierIds,
      quantity: Math.min(99, Math.floor(l.quantity)),
    }];
  });
}

export function TableMenu({ token, menu, tableNumber }: { token: string; menu: WebMenuData; tableNumber: string }) {
  const storageKey = `saje-table-cart:${token}`;
  const [lines, setLines] = useState<Line[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | "all">("all");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setLines(normalise(JSON.parse(raw) as Partial<Line>[]));
    } catch { /* storage unavailable */ }
    setLoaded(true);
  }, [storageKey]);

  function save(next: Line[]) {
    setLines(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
  }

  function addLine(item: { id: string; name: string }, choice: { variantId?: string; modifierIds: string[]; optionLabel: string }) {
    const lineKey = lineKeyOf(item.id, choice.variantId, choice.modifierIds);
    const existing = lines.find((l) => l.lineKey === lineKey);
    if (existing) {
      save(lines.map((l) => (l.lineKey === lineKey ? { ...l, quantity: Math.min(99, l.quantity + 1) } : l)));
    } else {
      save([...lines, {
        lineKey,
        productId: item.id,
        name: item.name,
        optionLabel: choice.optionLabel,
        variantId: choice.variantId,
        modifierIds: [...choice.modifierIds].sort(),
        quantity: 1,
      }]);
    }
  }

  function changeLine(lineKey: string, delta: number) {
    save(lines
      .map((l) => (l.lineKey === lineKey ? { ...l, quantity: Math.max(0, Math.min(99, l.quantity + delta)) } : l))
      .filter((l) => l.quantity > 0));
  }

  const qtyOf = (productId: string) => lines.find((l) => l.lineKey === lineKeyOf(productId))?.quantity ?? 0;

  async function send() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/table-orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, variantId: l.variantId, modifierIds: l.modifierIds })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { orderNumber?: string; error?: string };
      if (!res.ok || !data.orderNumber) {
        setError(data.error ?? "We could not send your order.");
      } else {
        save([]);
        rememberTableOrder(token, data.orderNumber);
        setSent(data.orderNumber);
      }
    } catch {
      setError("Network problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div>
      <TableOrderStatus token={token} />
      <div className="card">
        <h2>Order sent to the kitchen</h2>
        <p>Order {sent} for table {tableNumber}. Add more any time. Ask staff for the bill when you are ready.</p>
        <button className="btn-primary" type="button" onClick={() => setSent(null)}>Order more</button>
      </div>
      </div>
    );
  }

  const count = lines.reduce((s, l) => s + l.quantity, 0);
  const available = menu.items.filter((i) => i.isAvailable && (categoryId === "all" || i.categoryId === categoryId));
  const optionLines = lines.filter((l) => l.optionLabel);

  return (
    <div>
      <TableOrderStatus token={token} />
      <p className="muted">Table {tableNumber}</p>
      <div className="nav" role="group" aria-label="Filter by category" style={{ marginBottom: 16 }}>
        <button type="button" className="pill" aria-pressed={categoryId === "all"} onClick={() => setCategoryId("all")}>All</button>
        {menu.categories.map((c) => (
          <button key={c.id} type="button" className="pill" aria-pressed={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
            {c.name}
          </button>
        ))}
      </div>
      <ul className="product-grid">
        {available.map((item) => (
          <li key={item.id} className="card product">
            <h3>{item.name}</h3>
            {item.description ? <p>{item.description}</p> : null}
            <div className="price-row"><span className="price">{item.discountPrice ?? item.price}</span></div>
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
        <>
          <h2 style={{ marginTop: 22 }}>Your choices</h2>
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
        </>
      ) : null}

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="sticky-send" style={{ position: "sticky", bottom: 0, padding: "12px 0" }}>
        <button className="btn-primary" type="button" disabled={!loaded || busy || count === 0} onClick={send}>
          {busy ? "Sending…" : count === 0 ? "Choose items to order" : `Send ${count} item${count === 1 ? "" : "s"} to the kitchen`}
        </button>
      </div>
    </div>
  );
}
