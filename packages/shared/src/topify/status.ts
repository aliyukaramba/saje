import type { PaymentRecordStatus } from "../ops/payments";

// Topify documents two spellings: "successful" (checkout, payments) and "success" (verify, webhook examples).
// Both are accepted. "expired" is mapped to FAILED: the customer did not cancel, the session timed out.
export function normalizeTopifyStatus(raw: string): PaymentRecordStatus | null {
  switch (raw.trim().toLowerCase()) {
    case "successful":
    case "success":
      return "SUCCESSFUL";
    case "pending":
    case "processing":
      return "PENDING";
    case "failed":
    case "expired":
      return "FAILED";
    default:
      return null;
  }
}
