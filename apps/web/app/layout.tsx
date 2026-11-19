import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env.RESTAURANT_NAME ?? "Restaurant",
  description: "Order online, scan to order at your table, or pick up and delivery.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f2f2f4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Applies the saved theme before the first paint, so the page does not flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{var t=localStorage.getItem('saje-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
