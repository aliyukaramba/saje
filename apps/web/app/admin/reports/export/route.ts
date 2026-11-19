import { NextResponse } from "next/server";
import { staffWith } from "../../../../lib/auth";
import { loadReport, RANGES, type RangeKey } from "../../../../lib/reports-data";
import { formatMinor } from "@restaurant/shared";

export const dynamic = "force-dynamic";

// CSV of orders in the period. Requires a staff session with report access.
export async function GET(req: Request) {
  const staff = await staffWith("reports:read");
  if (!staff) return NextResponse.redirect(new URL("/admin/login", req.url));
  const raw = new URL(req.url).searchParams.get("range");
  const range = (RANGES.find((r) => r.key === raw)?.key ?? "today") as RangeKey;
  const report = await loadReport(range);

  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [
    ["Order", "Placed (UTC)", "Type", "Channel", "Status", "Payment", "Total"].join(","),
    ...report.orders.map((o) => [
      esc(o.orderNumber),
      esc(o.placedAt.toISOString()),
      o.type,
      o.channel,
      o.status,
      o.paymentStatus,
      esc(formatMinor(BigInt(Math.round(Number(o.total.toString()) * 100)))),
    ].join(",")),
  ];
  return new NextResponse(rows.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="orders-${range}.csv"`,
    },
  });
}
