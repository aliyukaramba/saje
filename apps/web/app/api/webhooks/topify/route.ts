import { NextResponse } from "next/server";
import { notifyOrderStatusChange } from "../../../../lib/notifications/service";
import { prisma, findPaymentByReference, applyGatewayResult, recordWebhookEvent } from "@restaurant/database";
import {
  TopifyClient, verifyTopifySignature, parseTopifyWebhook, confirmGatewayPayment,
  PaymentMismatchError, parseMajorToMinor,
} from "@restaurant/shared";

export const dynamic = "force-dynamic";

const PAYMENT_EVENTS = new Set(["charge.success", "charge.failed", "card_payment.success", "card_payment.failed"]);

export async function POST(req: Request) {
  // Verify the signature on the raw body before trusting anything in it.
  const raw = await req.text();
  const secret = process.env.TOPIFY_WEBHOOK_SECRET ?? "";
  if (!verifyTopifySignature(raw, req.headers.get("x-topify-signature"), secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event;
  try {
    event = parseTopifyWebhook(raw);
  } catch {
    return NextResponse.json({ error: "malformed" }, { status: 400 });
  }
  if (!PAYMENT_EVENTS.has(event.event)) return NextResponse.json({ ok: true, ignored: true });

  const payment = await findPaymentByReference(prisma, event.reference);
  if (!payment) return NextResponse.json({ ok: true, unknownReference: true });

  // Confirm with Topify's API using the secret key, then check reference, amount and currency.
  const client = new TopifyClient({ secretKey: process.env.TOPIFY_SECRET_KEY });
  try {
    const verified = await client.verifyTransaction(event.reference);
    const status = confirmGatewayPayment(
      {
        reference: event.reference,
        amountKobo: parseMajorToMinor(payment.amount.toString()),
        currency: "NGN",
      },
      { reference: verified.reference, status: verified.status, amountKobo: verified.amount, currency: event.currency },
    );
    await applyGatewayResult(prisma, payment.id, status, "gateway_webhook");
    if (status === "SUCCESSFUL" && payment.order.status === "PENDING") {
      try { await notifyOrderStatusChange(payment.order.id, "PENDING", "CONFIRMED"); }
      catch (notificationError) { console.error("SAJE payment notification dispatch failed", notificationError); }
    }
  } catch (e) {
    if (e instanceof PaymentMismatchError) {
      console.error("topify mismatch", event.reference, e.message);
      return NextResponse.json({ ok: false, mismatch: true });
    }
    // Transient failure: return 500 so Topify retries the delivery.
    console.error("topify verify failed", e);
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }

  await recordWebhookEvent(prisma, "topify", `${event.event}:${event.reference}`, JSON.parse(raw));
  return NextResponse.json({ ok: true });
}
