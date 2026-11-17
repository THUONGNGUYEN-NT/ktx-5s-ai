import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KTX 5S AI — Hệ thống đánh giá vệ sinh phòng ở",
  description: "Hệ thống đánh giá vệ sinh phòng ký túc xá tự động bằng AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
