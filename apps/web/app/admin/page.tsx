import Link from "next/link";
import { redirect } from "next/navigation";
import { currentStaff } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");
  return (
    <div className="shell" style={{ paddingTop: 32 }}>
      <section className="card" style={{ marginTop: 16 }}>
        <h3>Signed in</h3>
        <p>{staff.user.fullName} ({staff.user.email})</p>
        <p>Roles: {staff.roles.join(", ") || "none"}</p>
      </section>
      <section className="card" style={{ marginTop: 16 }}>
        <h3>Manage</h3>
        <p><Link href="/admin/menu">Menu: categories, dishes and availability</Link></p>
        <p><Link href="/admin/orders">Orders: open orders and status</Link></p>
        <p><Link href="/admin/kitchen">Kitchen display</Link></p>
        <p><Link href="/admin/staff">Staff: accounts and roles</Link></p>
        <p><Link href="/admin/tables">Tables and QR links</Link></p>
        <p><Link href="/admin/pos">Counter: walk-in cash sales</Link></p>
        <p><Link href="/admin/delivery">Delivery: areas and ordering options</Link></p>
      </section>
    </div>
  );
}
