import Link from "next/link";
import { canAny, type Permission, type RoleKey } from "@restaurant/shared";
import { logoutAction } from "../../app/admin/login/actions";
import { ThemeToggle } from "../ThemeToggle";
import { Icon, type IconName } from "../Icon";

const SECTIONS: { href: string; label: string; permission: Permission; icon: IconName }[] = [
  { href: "/admin/orders", label: "Orders", permission: "orders:read", icon: "orders" },
  { href: "/admin/receipts", label: "Receipts", permission: "orders:read", icon: "receipts" },
  { href: "/admin/kitchen", label: "Kitchen", permission: "kitchen:view", icon: "kitchen" },
  { href: "/admin/pos", label: "Counter", permission: "pos:sell", icon: "counter" },
  { href: "/admin/tables", label: "Tables", permission: "tables:manage", icon: "tables" },
  { href: "/admin/menu", label: "Menu", permission: "menu:manage", icon: "menu" },
  { href: "/admin/dispatch", label: "Dispatch", permission: "delivery:assign", icon: "dispatch" },
  { href: "/admin/driver", label: "My deliveries", permission: "delivery:update_own", icon: "truck" },
  { href: "/admin/delivery", label: "Delivery", permission: "settings:manage", icon: "zone" },
  { href: "/admin/inventory", label: "Inventory", permission: "inventory:manage", icon: "inventory" },
  { href: "/admin/reservations", label: "Reservations", permission: "reservations:manage", icon: "reservations" },
  { href: "/admin/reports", label: "Reports", permission: "reports:read", icon: "reports" },
  { href: "/admin/staff", label: "Staff", permission: "staff:manage", icon: "staff" },
];

/** Sidebar on desktop, top bar on phones. Only shows sections the user's roles can open. */
export function AdminNav({ roleKeys }: { roleKeys: RoleKey[] }) {
  const sections = SECTIONS.filter((s) => canAny(roleKeys, s.permission));
  return (
    <aside className="admin-side" aria-label="Admin navigation">
      <Link className="brand" href="/admin">Admin<span>.</span></Link>
      <nav aria-label="Admin sections" className="admin-links">
        <Link className="admin-link" href="/admin"><Icon name="overview" size={18} /><span>Overview</span></Link>
        {sections.map((s) => (
          <Link key={s.href} className="admin-link" href={s.href}><Icon name={s.icon} size={18} /><span>{s.label}</span></Link>
        ))}
      </nav>
      <div className="admin-foot">
        <ThemeToggle />
        <form action={logoutAction} className="admin-signout">
          <button className="pill" type="submit">Sign out</button>
        </form>
      </div>
    </aside>
  );
}
