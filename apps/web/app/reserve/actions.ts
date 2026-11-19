"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@restaurant/database";
import { assignTable, type Booking } from "@restaurant/shared";

const DURATION_MS = 90 * 60_000;
const LAGOS_OFFSET = "+01:00"; // Nigeria does not use daylight saving time

function fail(message: string): never {
  redirect(`/reserve?error=${encodeURIComponent(message)}`);
}

export async function createReservation(formData: FormData) {
  const parsed = z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(7).max(20),
    email: z.string().trim().email().max(254).optional().or(z.literal("")),
    partySize: z.coerce.number().int().min(1).max(12),
    when: z.string().min(16).max(16),
    requests: z.string().trim().max(300).optional(),
  }).safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email") || undefined,
    partySize: formData.get("partySize"),
    when: formData.get("when"),
    requests: formData.get("requests") || undefined,
  });
  if (!parsed.success) fail("Check your name, phone, party size and time");

  const startsAt = new Date(`${parsed.data.when}:00${LAGOS_OFFSET}`);
  const now = Date.now();
  if (Number.isNaN(startsAt.getTime())) fail("Choose a valid date and time");
  if (startsAt.getTime() < now + 60 * 60_000) fail("Reservations must be made at least 1 hour ahead");
  if (startsAt.getTime() > now + 60 * 24 * 3600_000) fail("Reservations can be made up to 60 days ahead");
  const endsAt = new Date(startsAt.getTime() + DURATION_MS);

  const [tables, bookings] = await Promise.all([
    prisma.diningTable.findMany({ where: { isActive: true }, select: { id: true, capacity: true, isActive: true } }),
    prisma.reservation.findMany({
      where: {
        tableId: { not: null },
        status: { in: ["PENDING", "CONFIRMED", "SEATED"] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true, tableId: true, startsAt: true, endsAt: true, status: true },
    }),
  ]);
  const tableId = assignTable(parsed.data.partySize, startsAt, endsAt, tables, bookings as Booking[]);
  if (!tableId) fail("No table is free for that party size at that time. Please try another time.");

  try {
    await prisma.reservation.create({
      data: {
        guestName: parsed.data.name,
        guestPhone: parsed.data.phone,
        guestEmail: parsed.data.email || null,
        partySize: parsed.data.partySize,
        startsAt,
        endsAt,
        status: "CONFIRMED",
        tableId,
        specialRequests: parsed.data.requests || null,
      },
    });
  } catch (e) {
    // The database refuses overlapping bookings on the same table, so a race between two guests fails here.
    console.error("reservation insert failed", e);
    fail("That table was just booked. Please try again.");
  }
  redirect("/reserve?done=1");
}
