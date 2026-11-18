"use client";
// Trang gốc: tự chuyển hướng theo trạng thái đăng nhập
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/session";

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    const s = getSession();
    if (s?.role === "admin") router.replace("/admin");
    else if (s?.role === "student") router.replace("/student");
    else router.replace("/login");
  }, [router]);

  return <div className="min-h-screen flex items-center justify-center bg-[#ecf0f5] text-gray-500 text-sm">Đang chuyển hướng...</div>;
}
