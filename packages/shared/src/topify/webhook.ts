import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies X-Topify-Signature: HMAC-SHA512 of the RAW request body, hex-encoded.
 * Must be computed on the exact bytes received, before any JSON parsing.
 */
export function verifyTopifySignature(rawBody: string, signatureHex: string | null | undefined, webhookSecret: string): boolean {
  if (!signatureHex || !webhookSecret) return false;
  const expected = createHmac("sha512", webhookSecret).update(rawBody, "utf8").digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signatureHex.trim(), "hex");
  } catch {
    return false;
  }
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export interface TopifyWebhookEvent {
  event: string;
  reference: string;
  providerReference: string | null;
  status: string;
  amountKobo: number;
  currency: string;
  raw: unknown;
}

/** Parses a verified webhook body. Call only after verifyTopifySignature succeeds. */
export function parseTopifyWebhook(rawBody: string): TopifyWebhookEvent {
  const body = JSON.parse(rawBody) as {
    event?: unknown;
    data?: { reference?: unknown; provider_reference?: unknown; status?: unknown; amount?: unknown; currency?: unknown };
  };
  const d = body.data ?? {};
  if (typeof body.event !== "string" || typeof d.reference !== "string" || typeof d.status !== "string") {
    throw new Error("Malformed Topify webhook");
  }
  if (typeof d.amount !== "number" || !Number.isSafeInteger(d.amount)) throw new Error("Malformed webhook amount");
  return {
    event: body.event,
    reference: d.reference,
    providerReference: typeof d.provider_reference === "string" ? d.provider_reference : null,
    status: d.status,
    amountKobo: d.amount,
    currency: typeof d.currency === "string" ? d.currency : "NGN",
    raw: body,
  };
}
