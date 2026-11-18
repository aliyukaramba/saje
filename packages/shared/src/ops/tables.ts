import { createHash, randomBytes } from "node:crypto";
import type { Minor } from "../money";

/** Unpredictable QR token. The raw token is shown once in the printed QR; only its hash is stored. */
export function generateQrToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashQrToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export type TableSessionStatus = "OPEN" | "BILL_REQUESTED" | "CLOSED";

/** A table may have at most one non-closed session. */
export function canOpenSession(sessions: readonly { status: TableSessionStatus }[]): boolean {
  return !sessions.some((s) => s.status !== "CLOSED");
}

/** Orders can be added only while the session is open. */
export function canAddOrder(status: TableSessionStatus): boolean {
  return status === "OPEN";
}

/**
 * Splits a bill across shares. Each share is a weight (e.g. the value of a member's items).
 * Amounts sum exactly to total; remainder minor units go to the largest shares first.
 */
export function splitBill(total: Minor, weights: readonly { memberId: string; weight: Minor }[]): { memberId: string; amount: Minor }[] {
  if (total < 0n) throw new Error("Total cannot be negative");
  if (weights.length === 0) throw new Error("No members to split across");
  if (weights.some((w) => w.weight < 0n)) throw new Error("Weights cannot be negative");
  const sum = weights.reduce((a, w) => a + w.weight, 0n);
  if (sum === 0n) throw new Error("Nothing to split");
  const base = weights.map((w) => ({ memberId: w.memberId, weight: w.weight, amount: (total * w.weight) / sum }));
  let remainder = total - base.reduce((a, b) => a + b.amount, 0n);
  const order = [...base].sort((a, b) => (a.weight > b.weight ? -1 : a.weight < b.weight ? 1 : 0));
  for (let i = 0; remainder > 0n; i = (i + 1) % order.length) {
    order[i].amount += 1n;
    remainder -= 1n;
  }
  return base.map(({ memberId, amount }) => ({ memberId, amount }));
}
