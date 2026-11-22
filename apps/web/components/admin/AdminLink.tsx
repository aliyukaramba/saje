"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "../Icon";

/** A sidebar tab. It is highlighted while you are on that section. */
export function AdminLink({ href, label, icon, exact = false }: { href: string; label: string; icon: IconName; exact?: boolean }) {
  const pathname = usePathname() ?? "";
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link className={`admin-link${active ? " is-active" : ""}`} href={href} aria-current={active ? "page" : undefined}>
      <Icon name={icon} size={18} />
      <span>{label}</span>
    </Link>
  );
}
