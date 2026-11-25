"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Tự động chuyển hướng về trang Lịch sử đánh giá (tránh trùng lặp menu)
export default function ResultPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/student/history");
  }, [router]);

  return null;
}
