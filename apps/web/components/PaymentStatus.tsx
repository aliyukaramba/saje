"use client";

import { useEffect, useState } from "react";
import { clearCart } from "../lib/cart";

type State = "checking" | "paid" | "failed" | "pending" | "unknown";

interface StatusBody { paymentStatus?: string; orderNumber?: string; orderStatus?: string }

export function PaymentStatus({ reference }: { reference: string | null }) {
  const [state, setState] = useState<State>(reference ? "checking" : "unknown");
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) return;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    async function poll() {
      attempts += 1;
      try {
        const res = await fetch(`/api/orders/status?ref=${encodeURIComponent(reference!)}`, { cache: "no-store" });
        if (res.ok) {
          const body = (await res.json()) as StatusBody;
          if (body.orderNumber) setOrderNumber(body.orderNumber);
          if (body.paymentStatus === "SUCCESSFUL") {
            clearCart();
            return setState("paid");
          }
          if (body.paymentStatus === "FAILED" || body.paymentStatus === "CANCELLED") return setState("failed");
        }
      } catch {
        /* keep polling */
      }
      if (attempts >= 15) return setState("pending");
      timer = setTimeout(poll, 2000);
    }
    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      void cancelled;
    };
  }, [reference]);

  if (state === "checking") return <p role="status">Confirming your payment…</p>;
  if (state === "paid") {
    return (
      <div className="card">
        <h1>Thank you!</h1>
        <p>Your payment is confirmed{orderNumber ? ` (order ${orderNumber})` : ""}. We will have it ready for pickup.</p>
        <a href="/menu">Back to the menu</a>
      </div>
    );
  }
  if (state === "failed") {
    return (
      <div className="card">
        <h1>Payment not completed</h1>
        <p>Your payment did not go through. Your cart is still saved, so you can try again.</p>
        <a href="/cart">Return to cart</a>
      </div>
    );
  }
  if (state === "pending") {
    return (
      <div className="card">
        <h1>Payment pending</h1>
        <p>We have not received confirmation yet. This can take a minute. Refresh this page shortly{orderNumber ? `, quoting order ${orderNumber}` : ""}.</p>
      </div>
    );
  }
  return (
    <div className="card">
      <h1>Nothing to confirm</h1>
      <p><a href="/menu">Go to the menu</a></p>
    </div>
  );
}
