"use client";

import { useEffect, useState } from "react";
import { readCart, cartCount, CART_EVENT } from "../lib/cart";

// Shows the number of items in the cart. The badge is re-keyed on each change so its bump animation replays.
export function CartBadge() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const sync = () => setCount(cartCount(readCart()));
    sync();
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  if (count === 0) return null;
  return (
    <span key={count} className="cart-badge" aria-label={`${count} items in cart`}>
      {count}
    </span>
  );
}
