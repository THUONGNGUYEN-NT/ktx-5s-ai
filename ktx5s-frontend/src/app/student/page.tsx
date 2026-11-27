"use client";
// TRANG CHỦ SINH VIÊN — MODERN NAVY-BLUE THEME (DESKTOP & MOBILE)
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Home,
  Clock,
  Star,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import Panel from "@/components/Panel";
import { getSession } from "@/lib/session";
import { getRoomHistory } from "@/lib/api";
import {
  CURRENT_WEEK,
  weekMonday,
  statusToKey,
  formatDateTime,
  getRoomMembersByCode,
  getBunkCountForMembers,
  getRequiredPhotoCount,
  type RoomStatus,
} from "@/components/status";

type HistoryItem = {
  submission_id: string;
  week: string;
  submitted_at: string;
  status: RoomStatus;
  score: number;
};

export default function StudentHome() {
  const router = useRouter();
  const [room, setRoom] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const s = getSession();
    const code = s?.roomCode || "A3-301";
    setRoom(code);
    getRoomHistory(code).then((res) => setHistory(res.data.history));
  }, []);

  const members = getRoomMembersByCode(room || "A3-301");
  const bunkCount = getBunkCountForMembers(members);
  const totalPhotos = getRequiredPhotoCount(members);
  const building = (room || "A3-301")[0] || "A";
  const floor = (room || "A3-301").match(/^[A-Z](\d+)/)?.[1] || "3";

  const latest = history[0];
  const sun = new Date(weekMonday(CURRENT_WEEK).getTime() + 6 * 86400000);
  const sunStr = `${String(sun.getUTCDate()).padStart(2, "0")}/${String(
    sun.getUTCMonth() + 1
  ).padStart(2, "0")}/${sun.getUTCFullYear()}`;

  const latestKey = latest ? statusToKey(latest.status) : "not_submitted";
  const statusCardCls =
    latestKey === "clean"
      ? "bg-[#eaf8f0] border-emerald-100 text-emerald-700"
      : latestKey === "slightly_messy"
      ? "bg-[#fef4ea] border-amber-100 text-amber-700"
      : "bg-[#fef0f2] border-rose-100 text-rose-600";

  return (
    <AppShell role="student" title="Trang chủ sinh viên" showBack={false}>
      <div className="space-y-5">
        {/* Tiêu đề */}
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
            Trang chủ sinh viên
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Theo dõi tình trạng vệ sinh ký túc xá và nộp ảnh đúng hạn
          </p>
        </div>

        {/* 4 Thẻ KPI Pastel giống bản phác thảo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-[#ebf3fe] border border-blue-100 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-600/15 text-[#1d4ed8] flex items-center justify-center shrink-0">
              <Home size={22} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Phòng hiện tại</p>
              <p className="text-xl font-extrabold text-slate-800 leading-tight mt-0.5">
                {room || "A3-301"}
              </p>
              <p className="text-[11px] font-semibold text-blue-700 mt-0.5">
                Tòa {building} · Tầng {floor} · {members} SV
              </p>
            </div>
          </div>

          <div className="bg-[#fef4ea] border border-orange-100 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-orange-500/15 text-orange-600 flex items-center justify-center shrink-0">
              <Clock size={22} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Hạn nộp ảnh</p>
              <p className="text-lg font-extrabold text-slate-800 leading-tight mt-0.5">
                21:00 Chủ nhật
              </p>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">({sunStr})</p>
            </div>
          </div>

          <div className="bg-[#fef9e7] border border-amber-100 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-400/20 text-amber-500 flex items-center justify-center shrink-0">
              <Star size={22} fill="currentColor" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Điểm gần nhất</p>
              <p className="text-2xl font-black text-slate-800 leading-tight mt-0.5">
                {latest ? latest.score.toFixed(1) : "—"}
                <span className="text-xs font-semibold text-slate-400 ml-0.5">/10</span>
              </p>
            </div>
          </div>

          <div
            onClick={() => router.push("/student/history")}
            className={`border rounded-2xl p-4 flex items-center gap-3.5 cursor-pointer transition hover:opacity-95 ${statusCardCls}`}
          >
            <div className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center shrink-0">
              {latestKey === "clean" ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Trạng thái</p>
              <p className="text-xl font-extrabold leading-tight mt-0.5">
                {latest?.status ?? "Chưa nộp"}
              </p>
            </div>
          </div>
        </div>

        {/* Hàng nút Chụp ảnh chính + Hộp Yêu cầu chụp ảnh */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div className="lg:col-span-6 flex items-center">
            <button
              type="button"
              onClick={() => router.push("/student/camera")}
              className="w-full flex items-center justify-center gap-2.5 bg-[#1d4ed8] hover:bg-[#1e40af] active:scale-[0.99] text-white px-6 py-4 rounded-2xl text-base font-bold shadow-lg shadow-blue-900/15 transition"
            >
              <Camera size={21} />
              Chụp {totalPhotos} ảnh kiểm tra 5S
              <ArrowRight size={19} />
            </button>
          </div>

          <div className="lg:col-span-6 bg-[#f0f6ff] border border-blue-100 rounded-2xl p-4">
            <p className="text-sm font-bold text-slate-800 mb-2">Yêu cầu chụp ảnh (Phòng {members} SV)</p>
            <ul className="space-y-1.5 text-xs sm:text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                <span>
                  <b>{bunkCount} ảnh giường tầng</b> (trên &amp; dưới),{" "}
                  <b>3 ảnh khu vực chung</b> + <b>1 ảnh thử thách ngẫu nhiên</b> (phiên 30 phút)
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                <span>Chụp trực tiếp rõ nét, đủ ánh sáng, không dùng lại ảnh cũ</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Lịch sử nộp ảnh gần đây */}
        <Panel
          title="Lịch sử nộp ảnh gần đây"
          actions={
            <button
              type="button"
              onClick={() => router.push("/student/history")}
              className="text-xs sm:text-sm font-bold text-[#1d4ed8] hover:underline"
            >
              Xem tất cả →
            </button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="pb-2.5 font-semibold">Tuần</th>
                  <th className="pb-2.5 font-semibold">Ngày nộp</th>
                  <th className="pb-2.5 font-semibold text-center">Điểm đánh giá</th>
                  <th className="pb-2.5 font-semibold text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.slice(0, 4).map((h) => {
                  const k = statusToKey(h.status);
                  const badgeCls =
                    k === "clean"
                      ? "bg-emerald-50 text-emerald-700"
                      : k === "slightly_messy"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-rose-50 text-rose-600";
                  const scoreCls =
                    k === "clean"
                      ? "text-emerald-600"
                      : k === "slightly_messy"
                      ? "text-amber-600"
                      : "text-rose-600";
                  return (
                    <tr
                      key={h.submission_id}
                      onClick={() => router.push("/student/history")}
                      className="hover:bg-slate-50 cursor-pointer transition"
                    >
                      <td className="py-3 font-bold text-slate-800 whitespace-nowrap">
                        Tuần {h.week.split("-W")[1]}
                      </td>
                      <td className="py-3 text-slate-500 whitespace-nowrap">
                        {formatDateTime(h.submitted_at)}
                      </td>
                      <td className={`py-3 text-center font-black ${scoreCls}`}>
                        {h.score.toFixed(1)}
                        <span className="text-xs font-medium text-slate-400">/10</span>
                      </td>
                      <td className="py-3 text-right">
                        <span className={`${badgeCls} text-xs font-bold px-3 py-1 rounded-full`}>
                          {h.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
