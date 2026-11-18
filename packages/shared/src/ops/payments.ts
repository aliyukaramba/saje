import type { Minor } from "../money";

export type PaymentMethod = "TOPIFY" | "CASH" | "BANK_TRANSFER" | "POS_TERMINAL";
export type PaymentRecordStatus = "PENDING" | "SUCCESSFUL" | "FAILED" | "CANCELLED" | "REFUNDED" | "PARTIALLY_REFUNDED";
export type BankTransferState = "AWAITING_PROOF" | "PROOF_SUBMITTED" | "VERIFIED" | "REJECTED";

const TOPIFY_TRANSITIONS: Record<PaymentRecordStatus, PaymentRecordStatus[]> = {
  PENDING: ["SUCCESSFUL", "FAILED", "CANCELLED"],
  SUCCESSFUL: ["PARTIALLY_REFUNDED", "REFUNDED"],
  PARTIALLY_REFUNDED: ["PARTIALLY_REFUNDED", "REFUNDED"],
  FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransitionPayment(from: PaymentRecordStatus, to: PaymentRecordStatus): boolean {
  return TOPIFY_TRANSITIONS[from].includes(to);
}

/**
 * Successful status is never set from a browser redirect. Only the server-side verifier
 * or a verified webhook may call this with source "gateway_verify" or "gateway_webhook".
 */
export function markGatewayPayment(
  current: PaymentRecordStatus,
  next: PaymentRecordStatus,
  source: "gateway_verify" | "gateway_webhook" | "redirect",
): PaymentRecordStatus {
  if (source === "redirect") throw new Error("Payment status cannot be set from a browser redirect");
  if (!canTransitionPayment(current, next)) throw new Error(`Invalid payment transition ${current} -> ${next}`);
  return next;
}

/** Offline methods are recorded by authorised staff. Bank transfers need verification first. */
export function recordOfflinePayment(method: "CASH" | "POS_TERMINAL" | "BANK_TRANSFER", opts: {
  amount: Minor;
  reference: string;
  terminalInfo?: string;
  bankState?: BankTransferState;
}): { status: PaymentRecordStatus; bankTransferState: BankTransferState | null } {
  if (opts.amount <= 0n) throw new Error("Amount must be positive");
  if (!opts.reference.trim()) throw new Error("A reference is required");
  if (method === "CASH") return { status: "SUCCESSFUL", bankTransferState: null };
  if (method === "POS_TERMINAL") {
    if (!opts.terminalInfo?.trim()) throw new Error("Terminal information is required for POS payments");
    // Recorded by staff; not claimed as verified by the terminal.
    return { status: "SUCCESSFUL", bankTransferState: null };
  }
  const state = opts.bankState ?? "AWAITING_PROOF";
  return { status: state === "VERIFIED" ? "SUCCESSFUL" : "PENDING", bankTransferState: state };
}

export type OrderPaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";

/** Derives the order payment status from its payments and refunds. */
export function derivePaymentStatus(
  orderTotal: Minor,
  payments: readonly { status: PaymentRecordStatus; amount: Minor; refunded: Minor }[],
): OrderPaymentStatus {
  const paid = payments
    .filter((p) => p.status === "SUCCESSFUL" || p.status === "PARTIALLY_REFUNDED" || p.status === "REFUNDED")
    .reduce((a, p) => a + p.amount, 0n);
  const refunded = payments.reduce((a, p) => a + p.refunded, 0n);
  const net = paid - refunded;
  if (refunded > 0n && net <= 0n) return "REFUNDED";
  if (refunded > 0n) return "PARTIALLY_REFUNDED";
  if (net >= orderTotal && orderTotal > 0n) return "PAID";
  if (net > 0n) return "PARTIALLY_PAID";
  return "UNPAID";
}

/** Ignores a webhook already processed. Returns false on duplicates so the caller skips side effects. */
export function claimWebhookEvent(processed: Set<string>, provider: string, eventId: string): boolean {
  const key = `${provider}:${eventId}`;
  if (processed.has(key)) return false;
  processed.add(key);
  return true;
}
