import { SiteNav } from "../../components/SiteNav";
import Link from "next/link";
import { createReservation } from "./actions";

export const dynamic = "force-dynamic";

export default async function ReservePage({ searchParams }: { searchParams: Promise<{ error?: string; done?: string }> }) {
  const { error, done } = await searchParams;
  const field = { width: "100%", padding: 12, borderRadius: 12, border: "1px solid var(--hairline)", background: "var(--surface)", color: "var(--ink)", font: "inherit" } as const;
  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/">{process.env.RESTAURANT_NAME ?? "Restaurant"}<span>.</span></Link>
        <SiteNav />
      </header>
      <h1 className="page-title"><strong>Reserve</strong> a table</h1>
      {done ? <p role="status" className="card">Your table is booked. We look forward to seeing you.</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <form action={createReservation} className="card checkout-form" style={{ maxWidth: 560 }}>
        <label>Name <input name="name" required minLength={2} maxLength={120} autoComplete="name" /></label>
        <label>Phone <input name="phone" type="tel" required minLength={7} maxLength={20} autoComplete="tel" /></label>
        <label>Email (optional) <input name="email" type="email" maxLength={254} autoComplete="email" /></label>
        <label>Party size
          <select name="partySize" required style={field}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label>Date and time (Lagos time)
          <input name="when" type="datetime-local" required style={field} />
        </label>
        <label>Special requests (optional) <input name="requests" maxLength={300} /></label>
        <button className="btn-primary" type="submit">Book table</button>
        <p className="muted">Bookings last 90 minutes. Changes: call the restaurant.</p>
      </form>
    </div>
  );
}
