import { currentStaff } from "../../lib/auth";
import { AdminNav } from "../../components/admin/AdminNav";

export const dynamic = "force-dynamic";

// Sidebar layout for signed-in staff. The login page has no session, so it renders without the sidebar.
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
