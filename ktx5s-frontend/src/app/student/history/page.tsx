"use client";
// TRANG LỊCH SỬ ĐÁNH GIÁ CỦA PHÒNG
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import Panel from "@/components/Panel";
import { getSession } from "@/lib/session";
import { getRoomHistory } from "@/lib/api";
import { TILE_STYLES, statusToKey, formatDateTime, type RoomStatus } from "@/components/status";

type HistoryItem = {
  submission_id: string;
  week: string;
  submitted_at: string;
  status: RoomStatus;
  score: number;
  is_overridden: boolean;
  override_note: string | null;
};

export default function HistoryPage() {
  const [room, setRoom] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const code = getSession()?.roomCode ?? "";
    setRoom(code);
    getRoomHistory(code).then((res) => {
      setHistory(res.data.history);
      setLoading(false);
    });
  }, []);

  return (
    <AppShell role="student" title="Lịch sử đánh giá">
      <Panel title={`Lịch sử đánh giá phòng ${room}`}>
        {loading ? (
          <p className="text-center text-gray-400 py-10">Đang tải...</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-2.5">Tuần</th>
                <th className="p-2.5">Thời gian nộp</th>
                <th className="p-2.5 text-center">Điểm</th>
                <th className="p-2.5">Xếp loại</th>
                <th className="p-2.5">Ghi chú của cán bộ</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => {
                const s = TILE_STYLES[statusToKey(h.status)];
                return (
                  <tr key={h.submission_id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="p-2.5 font-semibold">Tuần {h.week.split("-W")[1]} / {h.week.split("-")[0]}</td>
                    <td className="p-2.5">{formatDateTime(h.submitted_at)}</td>
                    <td className={`p-2.5 text-center font-bold ${s.text}`}>{h.score.toFixed(1)}</td>
                    <td className="p-2.5"><span className={`${s.bg} text-white text-[11px] px-2 py-1 rounded-sm`}>{h.status}</span></td>
                    <td className="p-2.5 text-gray-500">
                      {h.is_overridden && h.override_note ? (
                        <span className="text-[#605ca8]">📝 {h.override_note}</span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </AppShell>
  );
}
