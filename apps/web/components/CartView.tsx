"use client";

import { useEffect, useState } from "react";
import { readCart, writeCart, CART_EVENT, type CartLine } from "../lib/cart";

const MIN_LEAD_MINUTES = 20;

interface Zone { id: string; name: string; fee: string; minOrderAmount: string }
export interface FulfilmentOptions { pickupEnabled: boolean; deliveryEnabled: boolean; zones: Zone[] }

function earliestPickupLocal(): string {
  const d = new Date(Date.now() + MIN_LEAD_MINUTES * 60_000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CartView({ options }: { options: FulfilmentOptions }) {
  const [lines, setLines] = useState<CartLine[] | null>(null);
  const [type, setType] = useState<"PICKUP" | "DELIVERY">(options.pickupEnabled ? "PICKUP" : "DELIVERY");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pickup, setPickup] = useState("");
  const [zoneId, setZoneId] = useState(options.zones[0]?.id ?? "");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [landmark, setLandmark] = useState("");
  const [instructions, setInstructions] = useState("");
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

  const hasOptions = options.pickupEnabled || options.deliveryEnabled;
  const selectedZone = options.zones.find((z) => z.id === zoneId);

  function setQty(lineKey: string, quantity: number) {
    writeCart(lines!.map((l) => (l.lineKey === lineKey ? { ...l, quantity } : l)).filter((l) => l.quantity > 0));
  }

  async function checkout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (lines!.length === 0) return setError("Your cart is empty.");

    let fulfilment: unknown;
    if (type === "PICKUP") {
      const pickupAt = new Date(pickup);
      if (Number.isNaN(pickupAt.getTime())) return setError("Choose a pickup time.");
      if (pickupAt.getTime() < Date.now() + MIN_LEAD_MINUTES * 60_000 - 30_000) {
        return setError(`Pickup must be at least ${MIN_LEAD_MINUTES} minutes from now.`);
      }
      fulfilment = { type: "PICKUP", pickupAt: pickupAt.toISOString() };
    } else {
      if (!zoneId) return setError("We do not deliver to any area right now.");
      fulfilment = {
        type: "DELIVERY",
        zoneId,
        address: { line1, city, state, landmark: landmark || undefined, instructions: instructions || undefined },
      };
    }

    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: lines!.map((l) => ({ productId: l.productId, quantity: l.quantity, variantId: l.variantId, modifierIds: l.modifierIds })),
          customer: { name, phone, email },
          fulfilment,
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
          <li key={l.lineKey} className="card cart-line">
            <div>
              <strong>{l.name}</strong>
              {l.optionLabel ? <div className="muted">{l.optionLabel}</div> : null}
              <div className="muted">{l.unitLabel} each</div>
            </div>
            <div className="qty" role="group" aria-label={`Quantity of ${l.name}`}>
              <button type="button" onClick={() => setQty(l.lineKey, l.quantity - 1)} aria-label="Decrease">−</button>
              <span aria-live="polite">{l.quantity}</span>
              <button type="button" onClick={() => setQty(l.lineKey, Math.min(99, l.quantity + 1))} aria-label="Increase">+</button>
            </div>
          </li>
        ))}
      </ul>

      <form className="card checkout-form" onSubmit={checkout}>
        <h2>How would you like it?</h2>
        {!hasOptions ? <p className="form-error">Ordering is paused right now. Please check back soon.</p> : null}
        <div role="radiogroup" aria-label="Pickup or delivery" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {options.pickupEnabled ? (
            <button type="button" className="pill" aria-pressed={type === "PICKUP"} onClick={() => setType("PICKUP")}>Pickup</button>
          ) : null}
          {options.deliveryEnabled ? (
            <button type="button" className="pill" aria-pressed={type === "DELIVERY"} onClick={() => setType("DELIVERY")}>Delivery</button>
          ) : null}
        </div>

        <h2>Your details</h2>
        <label>Full name
          <input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
        <label>Phone
          <input required type="tel" minLength={7} maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        </label>
        <label>Email (for your receipt)
          <input required type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>

        {type === "PICKUP" ? (
          <label>Pickup time
            <input required type="datetime-local" min={earliestPickupLocal()} value={pickup} onChange={(e) => setPickup(e.target.value)} />
          </label>
        ) : (
          <>
            <label>Delivery area
              <select required value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                {options.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </label>
            {selectedZone ? (
              <p className="muted">Delivery fee {selectedZone.fee} · minimum order {selectedZone.minOrderAmount}</p>
            ) : null}
            <label>Street address
              <input required minLength={3} maxLength={160} value={line1} onChange={(e) => setLine1(e.target.value)} autoComplete="street-address" />
            </label>
            <label>City
              <input required minLength={2} maxLength={80} value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />
            </label>
            <label>State
              <input required minLength={2} maxLength={80} value={state} onChange={(e) => setState(e.target.value)} autoComplete="address-level1" />
            </label>
            <label>Landmark (optional)
              <input maxLength={160} value={landmark} onChange={(e) => setLandmark(e.target.value)} />
            </label>
            <label>Delivery instructions (optional)
              <input maxLength={300} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
            </label>
          </>
        )}

        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button type="submit" className="btn-primary" disabled={busy || !hasOptions}>
          {busy ? "Starting payment…" : "Pay with Topify"}
        </button>
        <p className="muted">Prices are confirmed on the server at checkout.</p>
      </form>
    </div>
  );
}
