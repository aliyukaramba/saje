"use client";

import { useEffect, useState } from "react";
import type { WebMenuData } from "../../lib/catalog-source";

interface Line { productId: string; quantity: number }

export function TableMenu({ token, menu, tableNumber }: { token: string; menu: WebMenuData; tableNumber: string }) {
  const storageKey = `saje-table-cart:${token}`;
  const [lines, setLines] = useState<Line[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setLines(JSON.parse(raw) as Line[]);
    } catch { /* storage unavailable */ }
    setLoaded(true);
  }, [storageKey]);

  function save(next: Line[]) {
    setLines(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
  }

  function change(productId: string, delta: number) {
    const existing = lines.find((l) => l.productId === productId);
    const qty = Math.max(0, Math.min(99, (existing?.quantity ?? 0) + delta));
    const next = existing
      ? lines.map((l) => (l.productId === productId ? { ...l, quantity: qty } : l)).filter((l) => l.quantity > 0)
      : qty > 0 ? [...lines, { productId, quantity: qty }] : lines;
    save(next);
  }

  async function send() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/table-orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, lines }),
      });
      const data = (await res.json().catch(() => ({}))) as { orderNumber?: string; error?: string };
      if (!res.ok || !data.orderNumber) {
        setError(data.error ?? "We could not send your order.");
      } else {
        save([]);
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
      <div className="card">
        <h2>Order sent to the kitchen</h2>
        <p>Order {sent} for table {tableNumber}. Add more any time. Ask staff for the bill when you are ready.</p>
        <button className="btn-primary" type="button" onClick={() => setSent(null)}>Order more</button>
      </div>
    );
  }

  const count = lines.reduce((s, l) => s + l.quantity, 0);
  const available = menu.items.filter((i) => i.isAvailable && !i.hasOptions);

  return (
    <div>
      <p className="muted">Table {tableNumber}</p>
      <ul className="product-grid">
        {available.map((item) => {
          const qty = lines.find((l) => l.productId === item.id)?.quantity ?? 0;
          return (
            <li key={item.id} className="card product">
              <h3>{item.name}</h3>
              {item.description ? <p>{item.description}</p> : null}
              <div className="price-row"><span className="price">{item.discountPrice ?? item.price}</span></div>
              <div className="qty" role="group" aria-label={`Quantity of ${item.name}`}>
                <button type="button" onClick={() => change(item.id, -1)} disabled={qty === 0} aria-label="Remove one">−</button>
                <span aria-live="polite">{qty}</span>
                <button type="button" onClick={() => change(item.id, 1)} aria-label="Add one">+</button>
              </div>
            </li>
          );
        })}
      </ul>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="sticky-send" style={{ position: "sticky", bottom: 0, padding: "12px 0" }}>
        <button className="btn-primary" type="button" disabled={!loaded || busy || count === 0} onClick={send}>
          {busy ? "Sending…" : count === 0 ? "Choose items to order" : `Send ${count} item${count === 1 ? "" : "s"} to the kitchen`}
        </button>
      </div>
    </div>
  );
}
