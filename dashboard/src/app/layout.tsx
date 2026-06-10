import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Trading Bot",
  description: "Real-time AI trading bot dashboard (MT5 local-bridge)",
};

export const viewport: Viewport = {
  themeColor: "#060908",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#060908] text-[#e6f0ec] antialiased">
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
