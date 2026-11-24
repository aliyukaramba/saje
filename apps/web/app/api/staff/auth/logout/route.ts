import { NextResponse } from "next/server";
import { getAuthService } from "../../../../../lib/auth";
import { requestStaff } from "../../../../../lib/staff-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const staff = await requestStaff(request);
  if (staff) await getAuthService().logout(staff.sessionId);
  return NextResponse.json({ success: true });
}
