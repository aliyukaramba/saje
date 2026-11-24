import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@restaurant/database";
import { assignTable } from "@restaurant/shared";
import { notifyReservationCreated } from "../../../lib/notifications/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  guestName: z.string().trim().min(2).max(120),
  guestPhone: z.string().trim().min(7).max(20),
  guestEmail: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  partySize: z.number().int().min(1).max(30),
  startsAt: z.string().datetime(),
  specialRequests: z.string().trim().max(500).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check your reservation details and try again." }, { status: 422 });
  }

  const input = parsed.data;
  const startsAt = new Date(input.startsAt);
  const now = new Date();
  if (!Number.isFinite(startsAt.getTime()) || startsAt <= now || startsAt.getTime() > now.getTime() + 90 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "Choose a future date within the next 90 days." }, { status: 422 });
  }

  // Reservations are scheduled in 90-minute dining windows.
  const endsAt = new Date(startsAt.getTime() + 90 * 60 * 1000);

  try {
    const tables = await prisma.diningTable.findMany({
      where: { isActive: true, capacity: { gte: input.partySize } },
      select: { id: true, capacity: true, isActive: true },
      orderBy: { capacity: "asc" },
    });
    if (tables.length === 0) {
      return NextResponse.json({ error: "We do not have a table large enough for this group. Please contact the restaurant." }, { status: 409 });
    }

    const bookings = await prisma.reservation.findMany({
      where: {
        tableId: { in: tables.map((table) => table.id) },
        status: { in: ["PENDING", "CONFIRMED", "SEATED"] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true, tableId: true, startsAt: true, endsAt: true, status: true },
    });

    const tableId = assignTable(input.partySize, startsAt, endsAt, tables, bookings);
    if (!tableId) {
      return NextResponse.json({ error: "That time is fully booked. Please choose another time." }, { status: 409 });
    }

    const reservation = await prisma.reservation.create({
      data: {
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        guestEmail: input.guestEmail || null,
        partySize: input.partySize,
        startsAt,
        endsAt,
        tableId,
        specialRequests: input.specialRequests || null,
        status: "PENDING",
      },
      select: { id: true, guestName: true, partySize: true, startsAt: true, status: true },
    });

    try { await notifyReservationCreated(reservation.id); }
    catch (notificationError) { console.error("SAJE reservation notification dispatch failed", notificationError); }
    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    // The database exclusion constraint is the final guard against concurrent double-booking.
    console.error("reservation creation failed", error);
    return NextResponse.json({ error: "We could not complete your reservation. Please try another time." }, { status: 409 });
  }
}
