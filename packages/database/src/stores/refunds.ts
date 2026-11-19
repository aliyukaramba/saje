import type { PrismaClient } from "@prisma/client";
import { formatMinor, parseMajorToMinor, type Minor } from "@restaurant/shared";
import { minorToDecimal, OrderInputError } from "./orders";

const money = (v: { toString(): string }): Minor => parseMajorToMinor(v.toString());

/**
 * Refunds part or all of a successful payment. Cannot exceed what is still refundable on that payment.
 * The payment and the order move to PARTIALLY_REFUNDED or REFUNDED. Only managers may call this.
 */
export async function refundPayment(
  db: PrismaClient,
  input: { paymentId: string; amount: Minor; reason: string; staffEmail: string; staffId: string },
) {
  const payment = await db.payment.findUnique({
    where: { id: input.paymentId },
    include: { refunds: true, order: { include: { payments: { include: { refunds: true } } } } },
  });
  if (!payment) throw new OrderInputError("Payment not found");
  if (payment.status !== "SUCCESSFUL" && payment.status !== "PARTIALLY_REFUNDED") {
    throw new OrderInputError("Only a successful payment can be refunded");
  }
  if (input.amount <= 0n) throw new OrderInputError("Refund amount must be more than zero");

  const refundedOn = (refunds: { status: string; amount: { toString(): string } }[]) =>
    refunds.filter((r) => r.status === "SUCCESSFUL").reduce<Minor>((s, r) => s + money(r.amount), 0n);

  const paidMinor = money(payment.amount);
  const remaining = paidMinor - refundedOn(payment.refunds);
  if (input.amount > remaining) {
    throw new OrderInputError(`Only ${formatMinor(remaining)} can still be refunded on this payment`);
  }

  const orderTotal = money(payment.order.total);
  const orderRefunded = payment.order.payments.reduce<Minor>((s, p) => s + refundedOn(p.refunds), 0n) + input.amount;
  const paymentNext = input.amount === remaining ? "REFUNDED" : "PARTIALLY_REFUNDED";
  const orderNext = orderRefunded >= orderTotal ? "REFUNDED" : "PARTIALLY_REFUNDED";

  await db.$transaction(async (tx) => {
    await tx.refund.create({
      data: {
        paymentId: payment.id,
        amount: minorToDecimal(input.amount),
        reason: input.reason,
        status: "SUCCESSFUL",
        createdById: input.staffId,
      },
    });
    await tx.payment.update({ where: { id: payment.id }, data: { status: paymentNext } });
    await tx.paymentEvent.create({
      data: { paymentId: payment.id, fromStatus: payment.status, toStatus: paymentNext, source: `staff:${input.staffEmail}` },
    });
    await tx.order.update({ where: { id: payment.orderId }, data: { paymentStatus: orderNext } });
  });

  return { refundedMinor: input.amount, remainingAfter: remaining - input.amount };
}
