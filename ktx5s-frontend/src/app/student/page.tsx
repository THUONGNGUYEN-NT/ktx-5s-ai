"use client";
// TRANG CHỦ SINH VIÊN — Tối ưu hóa cho điện thoại & tự động nhận diện số lượng sinh viên / số giường tầng của phòng
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  DoorOpen,
  CalendarDays,
  ClipboardCheck,
  BedDouble,
  Trash2,
  BookOpen,
  Footprints,
  Sun,
  Users,
  ChevronRight,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import Panel from "@/components/Panel";
import { getSession } from "@/lib/session";
import { getRoomHistory } from "@/lib/api";
import {
  TILE_STYLES,
  CURRENT_WEEK,
  weekMonday,
  statusToKey,
  getRoomMembersByCode,
  getBunkCountForMembers,
  getRequiredPhotoCount,
  type RoomStatus,
} from "@/components/status";

type HistoryItem = { submission_id: string; week: string; status: RoomStatus; score: number };

const GUIDE = [
  { icon: BedDouble, text: "Mỗi giường tầng chụp 1 ảnh thấy rõ cả giường trên & giường dưới" },
  { icon: Trash2, text: "Sàn nhà và lối đi giữa các giường sạch rác, không vương vãi" },
  { icon: BookOpen, text: "Sách vở, đồ dùng trên bàn học sắp xếp gọn gàng" },
  { icon: Footprints, text: "Giày dép xếp ngay ngắn lên kệ, không để tràn lối đi" },
  { icon: Sun, text: "Bật sáng đèn phòng, giữ chắc điện thoại khi bấm chụp" },
];

export default function StudentHome() {
  const router = useRouter();
  const [room, setRoom] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const s = getSession();
    if (!s?.roomCode) return;
    setRoom(s.roomCode);
    getRoomHistory(s.roomCode).then((res) => setHistory(res.data.history));
  }, []);

  const members = getRoomMembersByCode(room || "A3-301");
  const bunkCount = getBunkCountForMembers(members);
  const totalPhotos = getRequiredPhotoCount(members);

  const latest = history[0];
  const sun = new Date(weekMonday(CURRENT_WEEK).getTime() + 6 * 86400000);
  const sunStr = `${String(sun.getUTCDate()).padStart(2, "0")}/${String(
    sun.getUTCMonth() + 1
  ).padStart(2, "0")}/${sun.getUTCFullYear()}`;

  return (
    <AppShell role="student" title="Trang chủ sinh viên" showBack={false}>
      {/* 3 Thẻ thông tin tóm tắt: Rõ ràng, chữ to dễ nhìn trên điện thoại */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-5">
        <div className="bg-[#3c8dbc] text-white rounded-md p-4 flex items-center justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-2xl sm:text-3xl font-extrabold tracking-tight">{room || "—"}</p>
              <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Users size={13} /> Phòng {members} SV
              </span>
            </div>
            <p className="text-xs sm:text-sm opacity-95 mt-1">
              {bunkCount} giường tầng ({bunkCount} ảnh giường + 3 ảnh chung)
            </p>
          </div>
          <DoorOpen size={42} className="opacity-35 shrink-0" />
        </div>

        <div className="bg-[#f39c12] text-white rounded-md p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-2xl sm:text-3xl font-extrabold">21:00 CN</p>
            <p className="text-xs sm:text-sm opacity-95 mt-1">
              Hạn nộp tuần {CURRENT_WEEK} ({sunStr})
            </p>
          </div>
          <CalendarDays size={42} className="opacity-35 shrink-0" />
        </div>

        <div
          onClick={() => router.push("/student/history")}
          className={`${
            latest ? TILE_STYLES[statusToKey(latest.status)].bg : "bg-gray-500"
          } text-white rounded-md p-4 flex items-center justify-between shadow-sm cursor-pointer active:opacity-90`}
        >
          <div>
            <p className="text-2xl sm:text-3xl font-extrabold">
              {latest ? `${latest.score}/10` : "—"}
            </p>
            <p className="text-xs sm:text-sm opacity-95 mt-1">
              Kết quả tuần gần nhất: <b>{latest?.status ?? "Chưa có"}</b>
            </p>
          </div>
          <ClipboardCheck size={42} className="opacity-35 shrink-0" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <Panel
          title={`Nộp bộ ${totalPhotos} ảnh kiểm tra 5S — Phòng ${room} (${members} SV)`}
          className="lg:col-span-2"
        >
          <div className="flex flex-col md:flex-row gap-5 items-stretch md:items-center">
            <div className="flex-1 space-y-3">
              <div className="bg-blue-50/80 border border-blue-200 rounded-md p-3.5 text-sm text-gray-700 leading-relaxed">
                Phòng <b>{room}</b> được phân bổ <b>{members} sinh viên ({bunkCount} giường tầng)</b>.
                Khi nộp ảnh tuần này, bạn chụp trực tiếp đủ <b>{totalPhotos} ảnh bắt buộc</b> gồm:
                <ul className="mt-2 space-y-1.5 text-[13px] sm:text-sm text-gray-800 font-medium">
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#3c8dbc] shrink-0" />
                    <b>{bunkCount} ảnh Giường tầng:</b> Mỗi ảnh chụp trọn 1 giường tầng (gồm cả giường trên &amp; giường dưới).
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00a65a] shrink-0" />
                    <b>3 ảnh Khu vực chung:</b> 1 ảnh Sàn nhà, 1 ảnh Bàn học, 1 ảnh Kệ giày dép.
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => router.push("/student/camera")}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-[#00a65a] hover:bg-[#008d4c] active:scale-[0.99] text-white px-6 py-3.5 rounded-md text-base font-bold shadow-md transition"
              >
                <Camera size={20} />
                Chụp {totalPhotos} ảnh phòng {room} ngay
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="w-full md:w-64 bg-gray-50 border border-gray-200 rounded-md p-3.5">
              <div className="flex items-center justify-between mb-2.5">
                <p className="font-bold text-gray-800 text-sm">Lịch sử 4 tuần gần nhất</p>
                <button
                  type="button"
                  onClick={() => router.push("/student/history")}
                  className="text-xs text-[#3c8dbc] font-semibold hover:underline"
                >
                  Xem tất cả
                </button>
              </div>
              <div className="space-y-1.5">
                {history.slice(0, 4).map((h) => (
                  <div
                    key={h.submission_id}
                    onClick={() => router.push("/student/history")}
                    className="flex items-center justify-between py-2 px-2.5 bg-white rounded border border-gray-100 cursor-pointer hover:border-blue-200"
                  >
                    <span className="font-semibold text-sm text-gray-700">
                      Tuần {h.week.split("-W")[1]}
                    </span>
                    <span
                      className={`${
                        TILE_STYLES[statusToKey(h.status)].bg
                      } text-white text-xs font-bold px-2.5 py-1 rounded-sm`}
                    >
                      {h.status} · {h.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Hướng dẫn chuẩn 5S trước khi chụp">
          <ul className="flex flex-col gap-3">
            {GUIDE.map((g, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-700 leading-snug">
                <span className="w-9 h-9 rounded-full bg-[#3c8dbc]/10 text-[#3c8dbc] flex items-center justify-center shrink-0 mt-0.5">
                  <g.icon size={18} />
                </span>
                <span className="pt-1">{g.text}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}
