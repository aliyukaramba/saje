import Link from "next/link";
import { canAny, type Permission, type RoleKey } from "@restaurant/shared";
import { logoutAction } from "../../app/admin/login/actions";
import { ThemeToggle } from "../ThemeToggle";

const SECTIONS: { href: string; label: string; permission: Permission }[] = [
  { href: "/admin/orders", label: "Orders", permission: "orders:read" },
  { href: "/admin/kitchen", label: "Kitchen", permission: "kitchen:view" },
  { href: "/admin/pos", label: "Counter", permission: "pos:sell" },
  { href: "/admin/tables", label: "Tables", permission: "tables:manage" },
  { href: "/admin/menu", label: "Menu", permission: "menu:manage" },
  { href: "/admin/delivery", label: "Delivery", permission: "settings:manage" },
  { href: "/admin/staff", label: "Staff", permission: "staff:manage" },
];

/** Sidebar on desktop, top bar on phones. Only shows sections the user's roles can open. */
export function AdminNav({ roleKeys }: { roleKeys: RoleKey[] }) {
  const sections = SECTIONS.filter((s) => canAny(roleKeys, s.permission));
  return (
    <aside className="admin-side" aria-label="Admin navigation">
      <Link className="brand" href="/admin">Admin<span>.</span></Link>
      <nav aria-label="Admin sections" className="admin-links">
        <Link className="admin-link" href="/admin">Overview</Link>
        {sections.map((s) => (
          <Link key={s.href} className="admin-link" href={s.href}>{s.label}</Link>
        ))}
      </nav>
      <ThemeToggle />
      <form action={logoutAction} className="admin-signout">
        <button className="pill" type="submit">Sign out</button>
      </form>
    </aside>
  );
}
