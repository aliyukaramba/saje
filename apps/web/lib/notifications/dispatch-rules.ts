// Pure rules used by the notification dispatcher. Kept apart from the route so they can be tested directly.

/** How long a worker holds an event. If it crashes mid-dispatch, the event becomes claimable again after this. */
export const CLAIM_LEASE_MS = 5 * 60_000;

/** Minutes to wait before retrying a failed event: doubles each attempt, capped at one hour. */
export function retryDelayMinutes(attempts: number): number {
  return Math.min(60, 2 ** Math.min(attempts, 6));
}

/** Compares two secrets without leaking how many leading characters match (hashes both to equal length). */
export async function sameSecret(provided: string, expected: string): Promise<boolean> {
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
