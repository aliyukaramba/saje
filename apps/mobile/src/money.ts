// Money in the app is kept in kobo (integers). Naira amounts from the server are converted once, here.
export function formatKobo(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minor));
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}₦${whole}.${String(abs % 100).padStart(2, "0")}`;
}

export function nairaToKobo(naira: string | null | undefined): number {
  const n = Number(naira ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
