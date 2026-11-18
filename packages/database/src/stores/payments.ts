import { Prisma, type PrismaClient } from "@prisma/client";
import {
  assertTransition, canTransitionPayment, derivePaymentStatus, parseMajorToMinor,
  type OrderStatus, type PaymentRecordStatus,
} from "@restaurant/shared";

export async function findPaymentByReference(db: PrismaClient, reference: string) {
  return db.payment.findUnique({ where: { reference }, include: { order: { include: { payments: true } } } });
}

/**
 * Applies a verified gateway status. Idempotent: repeating the same status does nothing.
 * Moves the order to CONFIRMED when its payment succeeds.
 */
export async function applyGatewayResult(
  db: PrismaClient,
  paymentId: string,
  next: PaymentRecordStatus,
  source: "gateway_verify" | "gateway_webhook",
): Promise<"applied" | "unchanged"> {
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { order: { include: { payments: true } } },
    });
    if (payment.status === next) return "unchanged" as const;
    if (!canTransitionPayment(payment.status, next)) return "unchanged" as const;

    await tx.payment.update({ where: { id: paymentId }, data: { status: next } });
    await tx.paymentEvent.create({
      data: { paymentId, fromStatus: payment.status, toStatus: next, source },
    });

    const order = payment.order;
    const payments = order.payments.map((p) =>
      p.id === paymentId ? { ...p, status: next } : p,
    );
    const paymentStatus = derivePaymentStatus(
      parseMajorToMinor(order.total.toString()),
      payments.map((p) => ({
        status: p.status,
        amount: parseMajorToMinor(p.amount.toString()),
        refunded: 0n,
      })),
    );

    const data: Prisma.OrderUpdateInput = { paymentStatus };
    if (next === "SUCCESSFUL" && order.status === "PENDING") {
      const to: OrderStatus = "CONFIRMED";
      assertTransition("PENDING", to);
      data.status = to;
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, fromStatus: "PENDING", toStatus: to, note: "Payment confirmed" },
      });
    }
    await tx.order.update({ where: { id: order.id }, data });
    return "applied" as const;
  });
}

/** Records a webhook delivery for audit. Returns false if this exact event was already stored. */
export async function recordWebhookEvent(
  db: PrismaClient,
  provider: string,
  externalEventId: string,
  payload: unknown,
): Promise<boolean> {
  try {
    await db.webhookEvent.create({
      data: { provider, externalEventId, payload: payload as Prisma.InputJsonValue, processedAt: new Date() },
    });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}
