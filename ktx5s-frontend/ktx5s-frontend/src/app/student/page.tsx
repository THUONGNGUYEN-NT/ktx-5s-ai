"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StudentPage() {
  const [roomCode, setRoomCode] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (!code) return alert("Vui lòng nhập mã phòng!");
    // Lưu mã phòng vào sessionStorage để dùng ở trang camera
    sessionStorage.setItem("room_code", code);
    router.push("/student/camera");
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Nộp ảnh phòng</h1>
        <p className="text-gray-500 text-sm mb-6">
          Nhập mã phòng của bạn (ghi trên cửa phòng hoặc quét mã QR).
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="VD: A3-205"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            className="border-2 border-gray-200 rounded-xl px-4 py-3 text-lg font-mono uppercase focus:border-blue-500 focus:outline-none"
            maxLength={10}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white py-3 rounded-xl text-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Tiếp theo →
          </button>
        </form>
        <button
          onClick={() => router.push("/student/history")}
          className="mt-4 w-full text-center text-blue-500 text-sm hover:underline"
        >
          Xem lịch sử đánh giá tuần trước
        </button>
      </div>
    </main>
  );
}
