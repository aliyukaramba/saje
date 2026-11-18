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
      <section className="empty" style={{ marginTop: 16 }}>
        Menu, orders and staff management screens are next.
      </section>
    </div>
  );
}
