import Link from "next/link";
import { canAny, type Permission, type RoleKey } from "@restaurant/shared";
import { logoutAction } from "../../app/admin/login/actions";

const SECTIONS: { href: string; label: string; permission: Permission }[] = [
  { href: "/admin/orders", label: "Orders", permission: "orders:read" },
  { href: "/admin/kitchen", label: "Kitchen", permission: "kitchen:view" },
  { href: "/admin/pos", label: "Counter", permission: "pos:sell" },
  { href: "/admin/tables", label: "Tables", permission: "tables:manage" },
  { href: "/admin/menu", label: "Menu", permission: "menu:manage" },
  { href: "/admin/delivery", label: "Delivery", permission: "settings:manage" },
  { href: "/admin/staff", label: "Staff", permission: "staff:manage" },
];

/** Top navigation for signed-in staff. Only shows sections the user's roles can open. */
export function AdminNav({ roleKeys }: { roleKeys: RoleKey[] }) {
  const sections = SECTIONS.filter((s) => canAny(roleKeys, s.permission));
  return (
    <div className="shell" style={{ paddingTop: 24 }}>
      <header className="topbar">
        <Link className="brand" href="/admin">Admin<span>.</span></Link>
        <form action={logoutAction}>
          <button className="pill" type="submit">Sign out</button>
        </form>
      </header>
      <nav aria-label="Admin sections" className="nav" style={{ flexWrap: "wrap", marginTop: 12 }}>
        <Link className="pill" href="/admin">Home</Link>
        {sections.map((s) => (
          <Link key={s.href} className="pill" href={s.href}>{s.label}</Link>
        ))}
      </nav>
    </div>
  );
}
