import { NextResponse } from "next/server";
import { requestStaff } from "../../../../../lib/staff-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const staff = await requestStaff(request);
  if (!staff) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  return NextResponse.json({ user: { ...staff.user, roles: staff.roles, permissions: staff.permissions } });
}
