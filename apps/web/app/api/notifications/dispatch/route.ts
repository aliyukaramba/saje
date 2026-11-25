import { NextResponse } from "next/server";
import { prisma } from "@restaurant/database";
import { notifyDeliveryAssigned, notifyOrderStatusChange, notifyPaymentFailed, notifyReservationCreated } from "../../../../lib/notifications/service";

export const dynamic = "force-dynamic";

// How long a worker holds an event. If it crashes mid-dispatch, the event becomes claimable again after this.
const CLAIM_LEASE_MS = 5 * 60_000;

/** Compares two secrets without leaking how many leading characters match (hashes both to equal length). */
async function sameSecret(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function POST(request: Request) {
  const secret = process.env.NOTIFICATION_CRON_SECRET ?? "";
  if (secret.length < 32) {
    return NextResponse.json({ error: "Notification dispatcher is not configured." }, { status: 503 });
  }
  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!(await sameSecret(provided, secret))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  // Pending and failed events that are due, plus processing events whose lease has expired (worker crashed).
  const events = await prisma.notificationOutboxEvent.findMany({
    where: {
      availableAt: { lte: now },
      OR: [{ status: { in: ["PENDING", "FAILED"] } }, { status: "PROCESSING" }],
    },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  let processed = 0;
  let failed = 0;
  for (const event of events) {
    // Compare-and-set on the status and due time we read, so two workers cannot claim the same event.
    const claimed = await prisma.notificationOutboxEvent.updateMany({
      where: { id: event.id, status: event.status, availableAt: event.availableAt },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
        availableAt: new Date(Date.now() + CLAIM_LEASE_MS),
      },
    });
    if (!claimed.count) continue;

    try {
      const payload = event.payload as { fromStatus?: unknown; toStatus?: unknown; driverId?: unknown; paymentId?: unknown };
      if (event.eventType === "RESERVATION_CREATED" && event.aggregateType === "Reservation") {
        await notifyReservationCreated(event.aggregateId);
      } else if (event.aggregateType === "Order" && event.eventType === "ORDER_STATUS_CHANGED") {
        if (typeof payload.fromStatus !== "string" || typeof payload.toStatus !== "string") {
          throw new Error("Outbox order-status payload is invalid.");
        }
        await notifyOrderStatusChange(event.aggregateId, payload.fromStatus, payload.toStatus);
      } else if (event.aggregateType === "Order" && event.eventType === "PAYMENT_FAILED") {
        if (typeof payload.paymentId !== "string" || !payload.paymentId) {
          throw new Error("Outbox payment-failure payload is invalid.");
        }
        await notifyPaymentFailed(payload.paymentId);
      } else if (event.aggregateType === "Order" && event.eventType === "DELIVERY_ASSIGNED") {
        if (typeof payload.driverId !== "string" || !payload.driverId) {
          throw new Error("Outbox delivery-assignment payload is invalid.");
        }
        await notifyDeliveryAssigned(event.aggregateId, payload.driverId);
      } else {
        throw new Error(`Unsupported notification event: ${event.eventType}`);
      }
      await prisma.notificationOutboxEvent.update({
        where: { id: event.id },
        data: { status: "PROCESSED", processedAt: new Date(), lastError: null },
      });
      processed += 1;
    } catch (error) {
      const attempts = event.attempts + 1;
      const delayMinutes = Math.min(60, 2 ** Math.min(attempts, 6));
      await prisma.notificationOutboxEvent.update({
        where: { id: event.id },
        data: {
          status: "FAILED",
          availableAt: new Date(Date.now() + delayMinutes * 60_000),
          lastError: error instanceof Error ? error.message.slice(0, 500) : "Notification dispatch failed.",
        },
      });
      failed += 1;
    }
  }

  return NextResponse.json({ success: true, examined: events.length, processed, failed });
}
