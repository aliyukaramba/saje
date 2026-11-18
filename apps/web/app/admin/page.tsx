import Link from "next/link";
import { redirect } from "next/navigation";
import { currentStaff } from "../../lib/auth";
import { logoutAction } from "./login/actions";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");
  return (
    <div className="shell" style={{ paddingTop: 32 }}>
      <header className="topbar">
        <div className="brand">Admin<span>.</span></div>
        <form action={logoutAction}>
          <button className="pill" type="submit">Sign out</button>
        </form>
      </header>
      <section className="card" style={{ marginTop: 16 }}>
        <h3>Signed in</h3>
        <p>{staff.user.fullName} ({staff.user.email})</p>
        <p>Roles: {staff.roles.join(", ") || "none"}</p>
      </section>
      <section className="card" style={{ marginTop: 16 }}>
        <h3>Manage</h3>
        <p><Link href="/admin/menu">Menu: categories, dishes and availability</Link></p>
      </section>
    </div>
  );
}
