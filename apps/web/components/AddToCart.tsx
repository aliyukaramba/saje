"use client";

import { useState } from "react";
import { addToCart } from "../lib/cart";
import { Icon } from "./Icon";

interface Props {
  id: string;
  name: string;
  price: string;
  /** text: labelled button. icon: round plus button for the price row. order: adds the dish and opens the cart. */
  mode?: "text" | "icon" | "order";
}

export function AddToCart({ id, name, price, mode = "text" }: Props) {
  const [added, setAdded] = useState(false);

  function add() {
    addToCart({ id, name, price });
    if (mode === "order") {
      window.location.href = "/cart";
      return;
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  }

  if (mode === "icon") {
    return (
      <button
        type="button"
        className={`icon-add${added ? " is-added" : ""}`}
        onClick={add}
        aria-label={added ? `${name} added to cart` : `Add ${name} to cart`}
        title="Add to cart"
      >
        <Icon name={added ? "check" : "cart"} size={18} />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={mode === "order" ? "btn-add btn-order" : `btn-add${added ? " is-added" : ""}`}
      onClick={add}
      aria-live="polite"
    >
      {mode === "order" ? "Order now" : added ? (<><span className="check" aria-hidden="true">✓</span> Added</>) : "Add to cart"}
    </button>
  );
}
