import "./admin.css";
import { currentStaff } from "../../lib/auth";
import { AdminNav } from "../../components/admin/AdminNav";

export const dynamic = "force-dynamic";

// Keep authentication and role-aware navigation at the admin layout boundary.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await currentStaff();
  if (!staff) return <>{children}</>;
  return (
    <div className="admin-layout">
      <AdminNav roleKeys={staff.roleKeys} />
      <main className="admin-main">{children}</main>
    </div>
  );
}
