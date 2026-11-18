"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-fetches the server-rendered page on an interval, so the kitchen screen stays current.
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
