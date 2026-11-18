import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@restaurant/database";
import { ROLE_KEYS } from "@restaurant/shared";
import { staffWith } from "../../../lib/auth";
import { createStaff, updateStaffRoles, suspendStaff, reactivateStaff } from "./actions";

export const dynamic = "force-dynamic";

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const actor = await staffWith("staff:manage");
  if (!actor) redirect("/admin/login");
  const { error } = await searchParams;
  const [roles, staff] = await Promise.all([
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { kind: "STAFF", deletedAt: null },
      include: { roles: { include: { role: true } } },
      orderBy: { fullName: "asc" },
    }),
  ]);
  const canGrantSuper = actor.roleKeys.includes("super_admin");
  const assignable = roles.filter((r) => r.key !== "super_admin" || canGrantSuper);

  return (
    <div className="shell" style={{ paddingTop: 32 }}>
      <header className="topbar">
        <Link className="brand" href="/admin">Staff<span>.</span></Link>
      </header>
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Add staff member</h2>
        <form action={createStaff} className="checkout-form">
          <label>Full name <input name="fullName" required minLength={2} maxLength={120} /></label>
          <label>Email <input name="email" type="email" required maxLength={254} /></label>
          <label>Starting password (at least 10 characters) <input name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" /></label>
          <fieldset style={{ border: 0, padding: 0, display: "grid", gap: 6 }}>
            <legend style={{ fontWeight: 600 }}>Roles</legend>
            {assignable.map((r) => (
              <label key={r.key} style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
                <input type="checkbox" name="roles" value={r.key} /> {r.name}
              </label>
            ))}
          </fieldset>
          <button className="btn-primary" type="submit">Create account</button>
        </form>
        <p className="muted">Share the starting password with the staff member in person. They can sign in at /admin/login.</p>
      </section>

      <section style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {staff.map((s) => {
          const current = s.roles.map((r) => r.role.key);
          const isSelf = s.id === actor.user.id;
          return (
            <div key={s.id} className="card" style={{ display: "grid", gap: 10 }}>
              <div>
                <strong>{s.fullName}</strong> <span className="muted">{s.email}</span>
                <div className="muted">{s.status === "ACTIVE" ? "Active" : "Suspended"}{isSelf ? " · you" : ""}</div>
              </div>
              <form action={updateStaffRoles} style={{ display: "grid", gap: 6 }}>
                <input type="hidden" name="userId" value={s.id} />
                {assignable.map((r) => (
                  <label key={r.key} style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
                    <input type="checkbox" name="roles" value={r.key} defaultChecked={current.includes(r.key)} /> {r.name}
                  </label>
                ))}
                <button className="pill" type="submit" style={{ justifySelf: "start" }}>Save roles</button>
              </form>
              {!isSelf ? (
                s.status === "ACTIVE" ? (
                  <form action={suspendStaff}>
                    <input type="hidden" name="userId" value={s.id} />
                    <button className="pill" type="submit">Suspend and sign out</button>
                  </form>
                ) : (
                  <form action={reactivateStaff}>
                    <input type="hidden" name="userId" value={s.id} />
                    <button className="pill" type="submit">Reactivate</button>
                  </form>
                )
              ) : null}
            </div>
          );
        })}
      </section>
      <p className="muted" style={{ marginTop: 16 }}>Roles known to the system: {ROLE_KEYS.join(", ")}</p>
    </div>
  );
}
