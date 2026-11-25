"use client";
import Link from "next/link";
import { AlertCircle, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#ecf0f5] flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 shadow-md rounded p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 text-[#dd4b39] rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={36} />
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">404</h1>
        <p className="text-gray-600 mb-6 font-medium">Trang bạn yêu cầu không tồn tại hoặc đã được di chuyển.</p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 bg-[#3c8dbc] hover:bg-[#367fa9] text-white px-5 py-2.5 rounded font-semibold text-sm transition"
        >
          <Home size={16} /> Về trang đăng nhập
        </Link>
      </div>
    </div>
  );
}
