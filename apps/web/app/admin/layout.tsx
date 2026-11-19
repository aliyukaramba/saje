import { currentStaff } from "../../lib/auth";
import { AdminNav } from "../../components/admin/AdminNav";

export const dynamic = "force-dynamic";

// Shared navigation for every admin page. The login page has no session, so it shows no nav.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await currentStaff();
  return (
    <>
      {staff ? <AdminNav roleKeys={staff.roleKeys} /> : null}
      {children}
    </>
  );
}
