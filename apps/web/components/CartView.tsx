"use client";

import { useEffect, useState } from "react";
import { readCart, writeCart, CART_EVENT, type CartLine } from "../lib/cart";

const MIN_LEAD_MINUTES = 20;

function earliestPickupLocal(): string {
  const d = new Date(Date.now() + MIN_LEAD_MINUTES * 60_000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CartView() {
  const [lines, setLines] = useState<CartLine[] | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pickup, setPickup] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sync = () => setLines(readCart());
    sync();
    setPickup(earliestPickupLocal());
    window.addEventListener(CART_EVENT, sync);
    return () => window.removeEventListener(CART_EVENT, sync);
  }, []);

  if (lines === null) return null;

  function update(next: CartLine[]) {
    writeCart(next);
  }

  function setQty(productId: string, quantity: number) {
    update(lines!.map((l) => (l.productId === productId ? { ...l, quantity } : l)).filter((l) => l.quantity > 0));
  }

  async function checkout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (lines!.length === 0) return setError("Your cart is empty.");
    const pickupAt = new Date(pickup);
    if (Number.isNaN(pickupAt.getTime())) return setError("Choose a pickup time.");
    if (pickupAt.getTime() < Date.now() + MIN_LEAD_MINUTES * 60_000 - 30_000) {
      return setError(`Pickup must be at least ${MIN_LEAD_MINUTES} minutes from now.`);
    }
    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: lines!.map((l) => ({ productId: l.productId, quantity: l.quantity, modifierIds: [] })),
          customer: { name, phone, email },
          pickupAt: pickupAt.toISOString(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string };
      if (!res.ok || !data.checkoutUrl) {
        setError(data.error ?? "We could not start your payment. Please try again.");
        setBusy(false);
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setError("Network problem. Please check your connection and try again.");
      setBusy(false);
    }
  }

  if (lines.length === 0) {
    return (
      <div className="empty">
        Your cart is empty. <a href="/menu">Browse the menu</a>
      </div>
    );
  }

  return (
    <div className="cart">
      <ul className="cart-lines">
        {lines.map((l) => (
          <li key={l.productId} className="card cart-line">
            <div>
              <strong>{l.name}</strong>
              <div className="muted">{l.unitLabel} each</div>
            </div>
            <div className="qty" role="group" aria-label={`Quantity of ${l.name}`}>
              <button type="button" onClick={() => setQty(l.productId, l.quantity - 1)} aria-label="Decrease">−</button>
              <span aria-live="polite">{l.quantity}</span>
              <button type="button" onClick={() => setQty(l.productId, Math.min(99, l.quantity + 1))} aria-label="Increase">+</button>
            </div>
          </li>
        ))}
      </ul>

      <form className="card checkout-form" onSubmit={checkout}>
        <h2>Pickup details</h2>
        <label>Full name
          <input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
        <label>Phone
          <input required type="tel" minLength={7} maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        </label>
        <label>Email (for your receipt)
          <input required type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label>Pickup time
          <input required type="datetime-local" min={earliestPickupLocal()} value={pickup} onChange={(e) => setPickup(e.target.value)} />
        </label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Starting payment…" : "Pay with Topify"}
        </button>
        <p className="muted">Prices are confirmed on the server at checkout. Taxes are included where applicable.</p>
      </form>
    </div>
  );
}
