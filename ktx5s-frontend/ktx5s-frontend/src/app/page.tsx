"use client";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 gap-6">
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold text-gray-800">🏠 KTX 5S AI</h1>
        <p className="text-gray-500 mt-2">Hệ thống đánh giá vệ sinh phòng ở tự động</p>
      </div>
      <button
        onClick={() => router.push("/student")}
        className="w-full max-w-xs bg-blue-600 text-white py-4 px-6 rounded-2xl text-lg font-semibold hover:bg-blue-700 transition-colors shadow-md"
      >
        👨‍🎓 Tôi là Sinh viên
      </button>
      <button
        onClick={() => router.push("/admin")}
        className="w-full max-w-xs bg-gray-700 text-white py-4 px-6 rounded-2xl text-lg font-semibold hover:bg-gray-800 transition-colors shadow-md"
      >
        👮 Tôi là Cán bộ KTX
      </button>
    </main>
  );
}
