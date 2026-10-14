import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MeronpaiStore - Top Up Robux Murah & Cepat",
  description: "Top up Robux termurah & terpercaya via QRIS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
