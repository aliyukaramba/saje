"use client";

import { useEffect, useState } from "react";

const KEY = "saje-theme";
type Mode = "light" | "dark";

// One icon: moon in light mode (tap for dark), sun in dark mode (tap for light).
// The choice is saved in this browser only. Without a saved choice it follows the device setting.
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    const explicit = document.documentElement.dataset.theme;
    if (explicit === "dark" || explicit === "light") {
      setMode(explicit);
    } else {
      setMode(window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }
  }, []);

  function toggle() {
    const next: Mode = mode === "dark" ? "light" : "dark";
    setMode(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* storage blocked: the choice lasts for this page view */
    }
  }

  const goingDark = mode === "light";
  const label = goingDark ? "Switch to dark mode" : "Switch to light mode";
  return (
    <button type="button" className="theme-icon" onClick={toggle} aria-label={label} title={label}>
      {goingDark ? (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )}
    </button>
  );
}
