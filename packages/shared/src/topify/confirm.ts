import type { Minor } from "../money";
import { normalizeTopifyStatus } from "./status";
import type { PaymentRecordStatus } from "../ops/payments";

export class PaymentMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentMismatchError";
  }
}

export interface ExpectedPayment {
  reference: string;
  amountKobo: Minor;
  currency: "NGN";
}

export interface GatewayReport {
  reference: string;
  status: string;
  amountKobo: number;
  currency: string;
}

/**
 * Decides whether a gateway report may mark our payment successful. The report must match our reference,
 * amount (kobo) and currency exactly. Anything else is rejected, never trusted.
 */
export function confirmGatewayPayment(expected: ExpectedPayment, report: GatewayReport): PaymentRecordStatus {
  if (report.reference !== expected.reference) throw new PaymentMismatchError("Reference mismatch");
  if (report.currency !== expected.currency) throw new PaymentMismatchError("Currency mismatch");
  if (BigInt(report.amountKobo) !== expected.amountKobo) throw new PaymentMismatchError("Amount mismatch");
  const status = normalizeTopifyStatus(report.status);
  if (!status) throw new PaymentMismatchError(`Unknown gateway status: ${report.status}`);
  return status;
}
