"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRoomHistory } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";

type HistoryItem = {
  submission_id: string;
  week: string;
  submitted_at: string;
  status: "Sạch" | "Hơi bừa bộn" | "Bừa bộn";
  score: number;
  is_overridden: boolean;
  override_note: string | null;
};

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const code = sessionStorage.getItem("room_code") ?? "A3-205";
    setRoomCode(code);
    getRoomHistory(code).then((res) => {
      setHistory(res.data.history);
      setLoading(false);
    });
  }, []);

  return (
    <main className="flex flex-col gap-4 p-6 max-w-sm mx-auto">
      <div>
        <button onClick={() => router.back()} className="text-blue-500 text-sm mb-2 hover:underline">← Quay lại</button>
        <h1 className="text-2xl font-bold text-gray-800">📅 Lịch sử phòng {roomCode}</h1>
      </div>

      {loading && <p className="text-gray-400 text-center py-10">Đang tải...</p>}

      {!loading && history.map((item) => (
        <div key={item.submission_id} className="bg-white rounded-2xl p-5 shadow flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-700">Tuần {item.week.split("-W")[1]} · {item.week.split("-")[0]}</span>
            <StatusBadge status={item.status} />
          </div>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Điểm: <strong className="text-gray-800">{item.score}/10</strong></span>
            <span>{new Date(item.submitted_at).toLocaleDateString("vi-VN")}</span>
          </div>
          {item.is_overridden && item.override_note && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-700">
              📝 Cán bộ đã chỉnh sửa: {item.override_note}
            </div>
          )}
        </div>
      ))}
    </main>
  );
}
