"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDashboard, getRooms } from "@/lib/api";
import RoomCard from "@/components/RoomCard";

type Room = {
  room_code: string;
  building: string;
  floor: number;
  status: "Sạch" | "Hơi bừa bộn" | "Bừa bộn" | null;
  score: number | null;
  submitted_at: string | null;
  image_url: string | null;
  is_overridden: boolean;
};

export default function AdminPage() {
  const [dashboard, setDashboard] = useState<{ summary: { total_rooms: number; submitted: number; not_submitted: number; submission_rate_percent: number }; breakdown: { clean: number; slightly_messy: number; messy: number }; avg_score: number } | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    Promise.all([getDashboard(), getRooms()]).then(([dash, roomsRes]) => {
      setDashboard(dash.data);
      setRooms(roomsRes.data.rooms);
      setLoading(false);
    });
  }, []);

  const filtered = filter === "all" ? rooms : rooms.filter((r) => {
    if (filter === "messy") return r.status === "Bừa bộn";
    if (filter === "slightly_messy") return r.status === "Hơi bừa bộn";
    if (filter === "clean") return r.status === "Sạch";
    if (filter === "not_submitted") return r.status === null;
    return true;
  });

  return (
    <main className="flex flex-col gap-5 p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">👮 Dashboard Cán bộ KTX</h1>
        <button onClick={() => router.push("/")} className="text-sm text-blue-500 hover:underline">← Thoát</button>
      </div>

      {/* Thẻ thống kê */}
      {dashboard && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow text-center">
            <p className="text-3xl font-black text-blue-600">{dashboard.summary.submitted}</p>
            <p className="text-xs text-gray-500 mt-1">Phòng đã nộp / {dashboard.summary.total_rooms}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow text-center">
            <p className="text-3xl font-black text-gray-700">{dashboard.avg_score.toFixed(1)}</p>
            <p className="text-xs text-gray-500 mt-1">Điểm TB toàn KTX</p>
          </div>
          <div className="bg-green-50 rounded-2xl p-4 shadow text-center">
            <p className="text-3xl font-black text-green-600">{dashboard.breakdown.clean}</p>
            <p className="text-xs text-gray-500 mt-1">✅ Phòng Sạch</p>
          </div>
          <div className="bg-red-50 rounded-2xl p-4 shadow text-center">
            <p className="text-3xl font-black text-red-600">{dashboard.breakdown.messy}</p>
            <p className="text-xs text-gray-500 mt-1">❌ Phòng Bừa bộn</p>
          </div>
        </div>
      )}

      {/* Bộ lọc */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { key: "all", label: "Tất cả" },
          { key: "messy", label: "❌ Bừa bộn" },
          { key: "slightly_messy", label: "⚠️ Hơi bừa" },
          { key: "clean", label: "✅ Sạch" },
          { key: "not_submitted", label: "— Chưa nộp" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`whitespace-nowrap px-3 py-2 rounded-xl text-sm font-medium transition-colors ${filter === f.key ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-200"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Danh sách phòng */}
      {loading && <p className="text-center text-gray-400 py-10">Đang tải...</p>}
      <div className="flex flex-col gap-3">
        {filtered.map((room) => (
          <RoomCard
            key={room.room_code}
            room={room}
            onClick={() => router.push(`/admin/rooms?code=${room.room_code}`)}
          />
        ))}
        {!loading && filtered.length === 0 && (
          <p className="text-center text-gray-400 py-10">Không có phòng nào trong bộ lọc này.</p>
        )}
      </div>
    </main>
  );
}
