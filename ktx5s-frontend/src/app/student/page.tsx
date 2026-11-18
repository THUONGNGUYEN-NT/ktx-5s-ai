"use client";
// TRANG CHỦ SINH VIÊN
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, DoorOpen, CalendarDays, ClipboardCheck, BedDouble, Trash2, BookOpen, Footprints, Sun } from "lucide-react";
import AppShell from "@/components/AppShell";
import Panel from "@/components/Panel";
import { getSession } from "@/lib/session";
import { getRoomHistory } from "@/lib/api";
import { TILE_STYLES, statusToKey, type RoomStatus } from "@/components/status";

type HistoryItem = { submission_id: string; week: string; status: RoomStatus; score: number };

const GUIDE = [
  { icon: BedDouble, text: "Gấp chăn màn, xếp gối ngay ngắn" },
  { icon: Trash2, text: "Sàn nhà không có rác, quần áo vương vãi" },
  { icon: BookOpen, text: "Sách vở, đồ dùng trên bàn gọn gàng" },
  { icon: Footprints, text: "Giày dép xếp lên kệ, không để giữa lối đi" },
  { icon: Sun, text: "Bật đèn, chụp từ góc cửa thấy toàn bộ phòng" },
];

export default function StudentHome() {
  const router = useRouter();
  const [room, setRoom] = useState("");
  const [studentId, setStudentId] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const s = getSession();
    if (!s?.roomCode) return;
    setRoom(s.roomCode);
    setStudentId(s.studentId ?? "");
    getRoomHistory(s.roomCode).then((res) => setHistory(res.data.history));
  }, []);

  const latest = history[0];

  return (
    <AppShell role="student" title="Trang chủ sinh viên" showBack={false}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="bg-[#3c8dbc] text-white rounded-sm p-4 flex items-center justify-between shadow-sm">
          <div><p className="text-2xl font-bold">{room}</p><p className="text-xs opacity-90">Phòng của bạn · SV {studentId}</p></div>
          <DoorOpen size={40} className="opacity-40" />
        </div>
        <div className="bg-[#f39c12] text-white rounded-sm p-4 flex items-center justify-between shadow-sm">
          <div><p className="text-2xl font-bold">21:00 CN</p><p className="text-xs opacity-90">Hạn nộp ảnh tuần 47 (23/11/2026)</p></div>
          <CalendarDays size={40} className="opacity-40" />
        </div>
        <div className={`${latest ? TILE_STYLES[statusToKey(latest.status)].bg : "bg-gray-400"} text-white rounded-sm p-4 flex items-center justify-between shadow-sm`}>
          <div><p className="text-2xl font-bold">{latest ? `${latest.score}/10` : "—"}</p><p className="text-xs opacity-90">Kết quả gần nhất: {latest?.status ?? "Chưa có"}</p></div>
          <ClipboardCheck size={40} className="opacity-40" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel title="Nộp bộ 4 ảnh vệ sinh phòng tuần này" className="lg:col-span-2">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="flex-1">
              <p className="text-gray-600 leading-relaxed">
                Mỗi tuần, phòng bắt buộc chụp đủ <b>4 ảnh khu vực</b> (<b>Giường ngủ, Sàn nhà, Kệ giày dép, Bàn học</b>) trước <b>21:00 Chủ nhật</b>. AI sẽ đối chiếu cả 4 góc và chấm điểm ngay theo tiêu chuẩn 5S:{" "}
                <span className="text-[#00a65a] font-semibold">Sạch</span> –{" "}
                <span className="text-[#f39c12] font-semibold">Hơi bừa bộn</span> –{" "}
                <span className="text-[#dd4b39] font-semibold">Bừa bộn</span>.
              </p>
              <button onClick={() => router.push("/student/camera")} className="mt-5 flex items-center gap-2 bg-[#00a65a] hover:bg-[#008d4c] text-white px-6 py-3 rounded-sm text-[15px] font-semibold shadow">
                <Camera size={18} /> Chụp 4 ảnh phòng ngay
              </button>
            </div>
            <div className="w-full md:w-64 bg-gray-50 border border-gray-200 rounded-sm p-4">
              <p className="font-semibold mb-2">Lịch sử 4 tuần gần nhất</p>
              {history.map((h) => (
                <div key={h.submission_id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <span>Tuần {h.week.split("-W")[1]}</span>
                  <span className={`${TILE_STYLES[statusToKey(h.status)].bg} text-white text-[11px] px-2 py-0.5 rounded-sm`}>{h.status} · {h.score}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Hướng dẫn chuẩn 5S trước khi chụp">
          <ul className="flex flex-col gap-3">
            {GUIDE.map((g, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-[#3c8dbc]/10 text-[#3c8dbc] flex items-center justify-center shrink-0"><g.icon size={16} /></span>
                {g.text}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}
