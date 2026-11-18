"use client";

import { useState } from "react";
import { addToCart } from "../lib/cart";

export function AddToCart({ id, name, price }: { id: string; name: string; price: string }) {
  const [added, setAdded] = useState(false);
  return (
    <button
      type="button"
      className="btn-add"
      onClick={() => {
        addToCart({ id, name, price });
        setAdded(true);
        setTimeout(() => setAdded(false), 1200);
      }}
      aria-live="polite"
    >
      {added ? "Added" : "Add to cart"}
    </button>
  );
}
