"use client";

import { useEffect, useState } from "react";

const KEY = "saje-theme";
type Mode = "light" | "dark";

// Per-viewer preference, stored in this browser only. The page works without it.
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setMode(current === "dark" ? "dark" : "light");
  }, []);

  function choose(next: Mode) {
    setMode(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* storage blocked: the choice lasts for this page view */
    }
  }

  return (
    <div className="theme-toggle">
      <div className="seg-group" role="group" aria-label="Colour theme">
        <button type="button" className="seg" aria-pressed={mode === "light"} onClick={() => choose("light")}>Light</button>
        <button type="button" className="seg" aria-pressed={mode === "dark"} onClick={() => choose("dark")}>Dark</button>
      </div>
    </div>
  );
}
