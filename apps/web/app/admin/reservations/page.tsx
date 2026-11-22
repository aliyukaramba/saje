import { redirect } from "next/navigation";
import { prisma } from "@restaurant/database";
import { staffWith } from "../../../lib/auth";
import { setReservationStatus, setTableCapacity } from "./actions";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";

export const dynamic = "force-dynamic";

const when = (d: Date) => d.toLocaleString("en-NG", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const staff = await staffWith("reservations:manage");
  if (!staff) redirect("/admin/login");
  const { error } = await searchParams;
  const since = new Date(Date.now() - 3 * 3600_000);
  const until = new Date(Date.now() + 14 * 24 * 3600_000);
  const [reservations, tables] = await Promise.all([
    prisma.reservation.findMany({
      where: { startsAt: { gte: since, lte: until } },
      include: { table: { select: { number: true } } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.diningTable.findMany({ where: { isActive: true }, orderBy: { number: "asc" } }),
  ]);

  return (
    <div>
      <AdminPageHeader title="Reservations" subtitle="Bookings for today and the next two weeks" />
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {reservations.length === 0 ? <div className="empty" style={{ marginTop: 16 }}>No reservations in the next two weeks.</div> : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12, marginTop: 16 }}>
          {reservations.map((r) => (
            <li key={r.id} className="card" style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <strong>{r.guestName} · {r.partySize} guest{r.partySize === 1 ? "" : "s"}</strong>
                <span className="muted">{r.status.replace(/_/g, " ").toLowerCase()}</span>
              </div>
              <div className="muted">
                {when(r.startsAt)} · table {r.table?.number ?? "not assigned"} · {r.guestPhone}
              </div>
              {r.specialRequests ? <div>{r.specialRequests}</div> : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(r.status === "CONFIRMED" || r.status === "PENDING") ? (
                  <>
                    <form action={setReservationStatus}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="to" value="SEATED" /><button className="pill" type="submit">Seat</button></form>
                    <form action={setReservationStatus}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="to" value="NO_SHOW" /><button className="pill" type="submit">No-show</button></form>
                    <form action={setReservationStatus}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="to" value="CANCELLED" /><button className="pill" type="submit">Cancel</button></form>
                  </>
                ) : null}
                {r.status === "SEATED" ? (
                  <form action={setReservationStatus}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="to" value="COMPLETED" /><button className="pill" type="submit">Completed</button></form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Seats per table</h2>
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 10 }}>
          {tables.map((t) => (
            <li key={t.id}>
              <form action={setTableCapacity} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input type="hidden" name="tableId" value={t.id} />
                <span style={{ minWidth: 90 }}>Table {t.number}</span>
                <input name="capacity" type="number" min="1" max="30" defaultValue={t.capacity} aria-label={`Seats at table ${t.number}`} style={{ width: 90, padding: 8, borderRadius: 12, border: "1px solid var(--hairline)", background: "var(--surface)", color: "var(--ink)" }} />
                <button className="pill" type="submit">Save</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
