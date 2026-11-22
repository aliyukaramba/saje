import { redirect } from "next/navigation";
import { prisma } from "@restaurant/database";
import { formatMinor, parseMajorToMinor } from "@restaurant/shared";
import { staffWith } from "../../../lib/auth";
import { setFulfilmentSwitches, createDeliveryZone, toggleDeliveryZone } from "./actions";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";

export const dynamic = "force-dynamic";

export default async function DeliveryAdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const staff = await staffWith("settings:manage");
  if (!staff) redirect("/admin/login");
  const { error } = await searchParams;
  const [settings, zones] = await Promise.all([
    prisma.restaurantSettings.findUnique({ where: { id: "singleton" } }),
    prisma.deliveryZone.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="shell" style={{ paddingTop: 32 }}>
      <AdminPageHeader title="Delivery" subtitle="Delivery zones and fulfilment options" />
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Ordering options</h2>
        <form action={setFulfilmentSwitches} className="checkout-form">
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
            <input type="checkbox" name="pickupEnabled" defaultChecked={settings?.pickupEnabled ?? true} /> Pickup is on
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
            <input type="checkbox" name="deliveryEnabled" defaultChecked={settings?.deliveryEnabled ?? false} /> Delivery is on
          </label>
          <button className="btn-primary" type="submit">Save options</button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Add delivery area</h2>
        <form action={createDeliveryZone} className="checkout-form">
          <label>Area name <input name="name" required minLength={2} maxLength={60} /></label>
          <label>Delivery fee in naira <input name="fee" required inputMode="decimal" placeholder="1500" /></label>
          <label>Minimum order in naira <input name="minOrderAmount" required inputMode="decimal" placeholder="5000" /></label>
          <button className="btn-primary" type="submit">Add area</button>
        </form>
      </section>

      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12, marginTop: 16 }}>
        {zones.map((z) => (
          <li key={z.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div>
              <strong>{z.name}</strong>
              <div className="muted">
                Fee {formatMinor(parseMajorToMinor(z.fee.toString()))} · minimum {formatMinor(parseMajorToMinor(z.minOrderAmount.toString()))} · {z.isActive ? "active" : "paused"}
              </div>
            </div>
            <form action={toggleDeliveryZone}>
              <input type="hidden" name="id" value={z.id} />
              <input type="hidden" name="active" value={String(z.isActive)} />
              <button className="pill" type="submit">{z.isActive ? "Pause" : "Activate"}</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
