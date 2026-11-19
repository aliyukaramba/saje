import Link from "next/link";
import { CartBadge } from "./CartBadge";

// Icon-only navigation for the customer top bar. Each icon keeps a text label for screen readers and a tooltip.
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function SiteNav() {
  return (
    <nav className="nav" aria-label="Site">
      <Link className="icon-link" href="/menu" aria-label="Menu" title="Menu">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...stroke}>
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      </Link>
      <Link className="icon-link" href="/reserve" aria-label="Reserve a table" title="Reserve a table">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...stroke}>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </Link>
      <Link className="icon-link" href="/cart" aria-label="Cart" title="Cart">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...stroke}>
          <path d="M5 8h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3L5 8z" />
          <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
        </svg>
        <CartBadge />
      </Link>
    </nav>
  );
}
