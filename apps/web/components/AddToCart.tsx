"use client";

import { useState } from "react";
import { addToCart } from "../lib/cart";

export function AddToCart({ id, name, price }: { id: string; name: string; price: string }) {
  const [added, setAdded] = useState(false);
  return (
    <button
      type="button"
      className={`btn-add${added ? " is-added" : ""}`}
      onClick={() => {
        addToCart({ id, name, price });
        setAdded(true);
        setTimeout(() => setAdded(false), 1400);
      }}
      aria-live="polite"
    >
      {added ? <span className="check" aria-hidden="true">✓</span> : null}
      {added ? "Added" : "Add to cart"}
    </button>
  );
}
