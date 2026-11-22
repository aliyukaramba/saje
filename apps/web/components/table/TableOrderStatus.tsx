"use client";

import { useCallback, useEffect, useState } from "react";

// Order numbers are remembered on this phone only, per table link. Nothing about the guest is sent or stored on the server.
const EVENT = "saje-table-orders-change";
const keyFor = (token: string) => `saje-table-orders:${token}`;

function readRemembered(token: string): string[] {
  try {
    const raw = window.localStorage.getItem(keyFor(token));
    const value: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Remembers an order placed from this table on this phone, so the guest can see its status again later. */
export function rememberTableOrder(token: string, orderNumber: string) {
  try {
    const list = readRemembered(token).filter((n) => n !== orderNumber);
    list.push(orderNumber);
    window.localStorage.setItem(keyFor(token), JSON.stringify(list.slice(-20)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* storage unavailable: the guest simply will not see past orders */
  }
}

interface TrackedOrder {
  orderNumber: string;
  status: string;
  placedAt: string;
  items: { quantity: number; nameSnapshot: string }[];
}

const LABELS: Record<string, string> = {
  PENDING: "Received",
  CONFIRMED: "Sent to kitchen",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready to serve",
  COMPLETED: "Served",
  CANCELLED: "Cancelled",
};

export function TableOrderStatus({ token }: { token: string }) {
  const [numbers, setNumbers] = useState<string[]>([]);
  const [orders, setOrders] = useState<TrackedOrder[]>([]);

  const refresh = useCallback(async (list: string[]) => {
    if (list.length === 0) {
      setOrders([]);
      return;
    }
    try {
      const res = await fetch("/api/table-orders/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, orders: list }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { orders: TrackedOrder[] };
      setOrders(data.orders);
    } catch {
      /* keep the last known statuses */
    }
  }, [token]);

  useEffect(() => {
    const sync = () => setNumbers(readRemembered(token));
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [token]);

  useEffect(() => {
    refresh(numbers);
    if (numbers.length === 0) return;
    const id = window.setInterval(() => refresh(numbers), 15000);
    return () => window.clearInterval(id);
  }, [numbers, refresh]);

  if (orders.length === 0) return null;

  return (
    <section className="card" aria-label="Your orders at this table" style={{ marginBottom: 16 }}>
      <h2>Your orders</h2>
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
        {orders.map((o) => (
          <li key={o.orderNumber} style={{ display: "grid", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <strong>{o.orderNumber}</strong>
              <span className="pill" aria-label="Order status">{LABELS[o.status] ?? o.status}</span>
            </div>
            <div className="muted">{o.items.map((i) => `${i.quantity} × ${i.nameSnapshot}`).join(", ")}</div>
          </li>
        ))}
      </ul>
      <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>Updates every few seconds.</p>
    </section>
  );
}
