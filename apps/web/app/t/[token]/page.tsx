import { prisma, findTableByToken } from "@restaurant/database";
import { loadMenu } from "../../../lib/catalog-source";
import { TableMenu } from "../../../components/table/TableMenu";

export const dynamic = "force-dynamic";

export default async function TablePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const table = /^[A-Za-z0-9_-]{20,120}$/.test(token) ? await findTableByToken(prisma, token) : null;
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">{process.env.RESTAURANT_NAME ?? "Restaurant"}<span>.</span></div>
      </header>
      {table ? (
        <>
          <h1 className="page-title"><strong>Order</strong> from your table</h1>
          <TableMenu token={token} menu={await loadMenu()} tableNumber={table.number} />
        </>
      ) : (
        <div className="empty">This table link is no longer valid. Please ask a member of staff for a new one.</div>
      )}
    </div>
  );
}
