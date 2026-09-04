import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Screenshot Joiner",
  description: "端末内だけで業務スクリーンショットを結合するツール",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}

