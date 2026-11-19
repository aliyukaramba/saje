"use client";

// Opens the browser's print dialog. The receipt's own print styles hide everything else.
export function PrintButton() {
  return (
    <button type="button" className="pill" onClick={() => window.print()}>
      Print receipt
    </button>
  );
}
