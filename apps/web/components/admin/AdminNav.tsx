import Link from "next/link";
import { canAny, type Permission, type RoleKey } from "@restaurant/shared";
import { logoutAction } from "../../app/admin/login/actions";
import { ThemeToggle } from "../ThemeToggle";
import type { IconName } from "../Icon";
import { AdminLink } from "./AdminLink";

const GROUPS: { label: string; items: { href: string; label: string; permission: Permission; icon: IconName }[] }[] = [
  { label: "WORKSPACE", items: [
    { href: "/admin/orders", label: "Orders", permission: "orders:read", icon: "orders" },
    { href: "/admin/notifications", label: "Notifications", permission: "orders:read", icon: "notifications" },
    { href: "/admin/receipts", label: "Receipts", permission: "orders:read", icon: "receipts" },
    { href: "/admin/kitchen", label: "Kitchen", permission: "kitchen:view", icon: "kitchen" },
    { href: "/admin/pos", label: "Point of sale", permission: "pos:sell", icon: "counter" },
    { href: "/admin/tables", label: "Tables", permission: "tables:manage", icon: "tables" },
    { href: "/admin/reservations", label: "Reservations", permission: "reservations:manage", icon: "reservations" },
    { href: "/admin/dispatch", label: "Dispatch", permission: "delivery:assign", icon: "dispatch" },
    { href: "/admin/driver", label: "My deliveries", permission: "delivery:update_own", icon: "truck" },
  ]},
  { label: "MANAGEMENT", items: [
    { href: "/admin/menu", label: "Menu", permission: "menu:manage", icon: "menu" },
    { href: "/admin/inventory", label: "Inventory", permission: "inventory:manage", icon: "inventory" },
    { href: "/admin/delivery", label: "Delivery settings", permission: "settings:manage", icon: "zone" },
    { href: "/admin/staff", label: "Team", permission: "staff:manage", icon: "staff" },
  ]},
  { label: "INSIGHTS", items: [
    { href: "/admin/reports", label: "Reports", permission: "reports:read", icon: "reports" },
  ]},
];

export function AdminNav({ roleKeys }: { roleKeys: RoleKey[] }) {
  return (
    <aside className="admin-side" aria-label="Admin navigation">
      <div className="admin-brand-row">
        <Link className="admin-brand" href="/admin" aria-label="SAJE admin home">
          <span>SAJE<span className="admin-brand-dot">.</span></span>
        </Link>
        <span className="admin-workspace-label">RESTAURANT WORKSPACE</span>
      </div>
      <nav aria-label="Admin sections" className="admin-links">
        <div className="admin-nav-group">
          <span className="admin-nav-label">OVERVIEW</span>
          <AdminLink href="/admin" label="Dashboard" icon="overview" exact />
        </div>
        {GROUPS.map((group) => {
          const items = group.items.filter((item) => canAny(roleKeys, item.permission));
          if (!items.length) return null;
          return (
            <div className="admin-nav-group" key={group.label}>
              <span className="admin-nav-label">{group.label}</span>
              {items.map((item) => <AdminLink key={item.href} href={item.href} label={item.label} icon={item.icon} />)}
            </div>
          );
        })}
      </nav>
      <div className="admin-foot">
        <ThemeToggle />
        <form action={logoutAction} className="admin-signout">
          <button className="admin-signout-button" type="submit"><span aria-hidden="true">↗</span> Sign out</button>
        </form>
      </div>
    </aside>
  );
}
