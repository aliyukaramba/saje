"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-fetch server-rendered data only while the staff screen is visible.
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) router.refresh();
    };
    const timer = window.setInterval(refreshIfVisible, seconds * 1000);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router, seconds]);

  return null;
}
