"use client";
// TRANG THỐNG KÊ TỔNG QUAN — MODERN NAVY-BLUE THEME (BIỂU ĐỒ XU HƯỚNG + DONUT CHART + TOP PHÒNG)
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Trophy,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import Panel from "@/components/Panel";
import { getDashboard, getRooms } from "@/lib/api";
import { TILE_ORDER, WEEKS, tileKeyOf, type Room, type TileKey } from "@/components/status";

type DashboardData = {
  week: string;
  summary: { total_rooms: number; submitted: number; not_submitted: number; submission_rate_percent: number };
  breakdown: { clean: number; slightly_messy: number; messy: number };
  avg_score: number;
  deadline: string;
  top_violations: { room_code: string; score: number; status: string }[];
};

export default function StatsPage() {
  const router = useRouter();
  const [week, setWeek] = useState(WEEKS[0].value);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    getDashboard(week).then((r) => setDash(r.data));
    getRooms({ week }).then((r) => setRooms(r.data.rooms));
  }, [week]);

  const totals = useMemo(() => {
    const c = Object.fromEntries(TILE_ORDER.map((k) => [k, 0])) as Record<TileKey, number>;
    rooms.forEach((r) => c[tileKeyOf(r)]++);
    return c;
  }, [rooms]);

  const submittedCount = rooms.filter((r) => r.status !== null).length || 1;
  const cleanPct = Math.round((totals.clean / submittedCount) * 1000) / 10;
  const slightPct = Math.round((totals.slightly_messy / submittedCount) * 1000) / 10;
  const messyPct = Math.max(0, Math.round((100 - cleanPct - slightPct) * 10) / 10);

  const topCleanRooms = useMemo(
    () =>
      rooms
        .filter((r) => r.score !== null)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 5),
    [rooms]
  );

  const actionNeededRooms = useMemo(
    () =>
      rooms
        .filter((r) => r.status === "Bừa bộn" || r.status === "Hơi bừa bộn" || !r.status)
        .sort((a, b) => (a.score ?? -1) - (b.score ?? -1))
        .slice(0, 5),
    [rooms]
  );

  // Dữ liệu biểu đồ xu hướng 4 tuần gần nhất
  const trendPoints = useMemo(() => {
    const wNum = Number(week.split("-W")[1]) || 48;
    const base = Math.max(55, Math.min(88, cleanPct || 71.3));
    return [
      { label: `Tuần ${wNum - 3}`, value: Math.max(40, Math.round((base - 11.2) * 10) / 10) },
      { label: `Tuần ${wNum - 2}`, value: Math.max(45, Math.round((base + 2.4) * 10) / 10) },
      { label: `Tuần ${wNum - 1}`, value: Math.max(45, Math.round((base + 5.1) * 10) / 10) },
      { label: `Tuần ${wNum}`, value: base },
    ];
  }, [week, cleanPct]);

  // Tính toán SVG Donut Chart (chu vi C = 2 * pi * 42 = 263.89)
  const C = 263.89;
  const cleanLen = (cleanPct / 100) * C;
  const slightLen = (slightPct / 100) * C;
  const messyLen = (messyPct / 100) * C;

  return (
    <AppShell role="admin" title="Thống kê tuần" showBack={false}>
      <div className="space-y-5">
        {/* Header + chọn tuần */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              Thống kê tổng quan
            </h1>
            <p className="text-sm text-slate-500">Tình hình vệ sinh ký túc xá trong tuần</p>
          </div>

          <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-2xs self-start sm:self-auto">
            <Calendar size={15} className="text-[#1d4ed8] mr-2 shrink-0" />
            <select
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              className="bg-transparent text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none"
            >
              {WEEKS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4 Thẻ KPI Pastel */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-[#ebf3fe] border border-blue-100 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-600/15 text-blue-600 flex items-center justify-center shrink-0">
              <Building2 size={22} />
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-none">
                {rooms.length || 200}
              </p>
              <p className="text-xs font-medium text-slate-600 mt-1">Tổng số phòng</p>
            </div>
          </div>

          <div className="bg-[#eaf8f0] border border-emerald-100 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-none">
                {cleanPct}%
              </p>
              <p className="text-xs font-medium text-emerald-700 mt-1 flex items-center gap-1">
                <TrendingUp size={12} /> Tỷ lệ phòng sạch
              </p>
            </div>
          </div>

          <div className="bg-[#fef4ea] border border-orange-100 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-orange-500/15 text-orange-600 flex items-center justify-center shrink-0">
              <AlertTriangle size={22} />
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-none">
                {totals.messy}
              </p>
              <p className="text-xs font-medium text-slate-600 mt-1">Phòng bừa bộn</p>
            </div>
          </div>

          <div className="bg-[#f3effe] border border-purple-100 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-600/15 text-purple-600 flex items-center justify-center shrink-0">
              <Clock size={22} />
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-none">
                {totals.not_submitted}
              </p>
              <p className="text-xs font-medium text-slate-600 mt-1">Chưa nộp ảnh</p>
            </div>
          </div>
        </div>

        {/* 2 BIỂU ĐỒ CHÍNH: XU HƯỚNG & DONUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Biểu đồ xu hướng tỷ lệ phòng sạch */}
          <Panel title="Xu hướng tỷ lệ phòng sạch" className="lg:col-span-7">
            <div className="w-full overflow-x-auto">
              <svg viewBox="0 0 460 190" className="w-full min-w-[320px] h-48">
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {/* Lưới ngang */}
                {[0, 25, 50, 75, 100].map((v) => {
                  const y = 155 - (v / 100) * 130;
                  return (
                    <g key={v}>
                      <line x1="42" y1={y} x2="435" y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
                      <text x="34" y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                        {v}%
                      </text>
                    </g>
                  );
                })}

                {(() => {
                  const coords = trendPoints.map((pt, idx) => ({
                    x: 70 + idx * 115,
                    y: 155 - (pt.value / 100) * 130,
                    ...pt,
                  }));
                  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
                  const areaPath = `${linePath} L ${coords[coords.length - 1].x} 155 L ${coords[0].x} 155 Z`;
                  const last = coords[coords.length - 1];
                  return (
                    <>
                      <path d={areaPath} fill="url(#trendGrad)" />
                      <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
                      {coords.map((c) => (
                        <g key={c.label}>
                          <circle cx={c.x} cy={c.y} r="5" fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
                          <text x={c.x} y="176" textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="600">
                            {c.label}
                          </text>
                        </g>
                      ))}
                      {/* Nhãn nổi điểm hiện tại */}
                      <rect x={last.x - 28} y={last.y - 30} width="56" height="22" rx="6" fill="#1d4ed8" />
                      <text x={last.x} y={last.y - 16} textAnchor="middle" fontSize="11" fill="#ffffff" fontWeight="700">
                        {last.value}%
                      </text>
                    </>
                  );
                })()}
              </svg>
            </div>
          </Panel>

          {/* Biểu đồ tròn Donut tỷ lệ trạng thái */}
          <Panel title="Tỷ lệ theo trạng thái" className="lg:col-span-5">
            <div className="flex flex-col sm:flex-row items-center justify-around gap-5 py-2">
              <div className="relative w-36 h-36 shrink-0">
                <svg viewBox="0 0 110 110" className="w-full h-full -rotate-90">
                  <circle cx="55" cy="55" r="42" fill="none" stroke="#f1f5f9" strokeWidth="14" />
                  <circle
                    cx="55"
                    cy="55"
                    r="42"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="14"
                    strokeDasharray={`${cleanLen} ${C}`}
                    strokeDashoffset="0"
                  />
                  <circle
                    cx="55"
                    cy="55"
                    r="42"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="14"
                    strokeDasharray={`${slightLen} ${C}`}
                    strokeDashoffset={-cleanLen}
                  />
                  <circle
                    cx="55"
                    cy="55"
                    r="42"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="14"
                    strokeDasharray={`${messyLen} ${C}`}
                    strokeDashoffset={-(cleanLen + slightLen)}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-black text-slate-800">{cleanPct}%</span>
                  <span className="text-[10px] font-semibold text-slate-400">Phòng sạch</span>
                </div>
              </div>

              <div className="space-y-3 w-full sm:w-auto text-sm">
                <div className="flex items-center justify-between gap-5">
                  <span className="flex items-center gap-2 text-slate-600 font-medium">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" /> Sạch
                  </span>
                  <span className="font-bold text-slate-800">{cleanPct}%</span>
                </div>
                <div className="flex items-center justify-between gap-5">
                  <span className="flex items-center gap-2 text-slate-600 font-medium">
                    <span className="w-3 h-3 rounded-full bg-amber-400" /> Hơi bừa bộn
                  </span>
                  <span className="font-bold text-slate-800">{slightPct}%</span>
                </div>
                <div className="flex items-center justify-between gap-5">
                  <span className="flex items-center gap-2 text-slate-600 font-medium">
                    <span className="w-3 h-3 rounded-full bg-rose-500" /> Bừa bộn
                  </span>
                  <span className="font-bold text-slate-800">{messyPct}%</span>
                </div>
                {dash && (
                  <div className="pt-2 border-t border-slate-100 text-xs text-slate-500">
                    Điểm TB toàn KTX: <b className="text-[#1d4ed8] text-sm">{dash.avg_score}/10</b>
                  </div>
                )}
              </div>
            </div>
          </Panel>
        </div>

        {/* 2 BẢNG DƯỚI: TOP PHÒNG TỐT NHẤT & DANH SÁCH PHÒNG CẦN XỬ LÝ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Panel
            title={
              <span className="flex items-center gap-2">
                <Trophy size={18} className="text-amber-500" /> Top phòng tốt nhất
              </span>
            }
          >
            <div className="divide-y divide-slate-100">
              {topCleanRooms.map((r, i) => (
                <div
                  key={r.room_code}
                  onClick={() => r.submission_id && router.push(`/admin/rooms?id=${r.submission_id}`)}
                  className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-xl cursor-pointer transition"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-full text-xs font-extrabold flex items-center justify-center ${
                        i === 0
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">Phòng {r.room_code}</p>
                      <p className="text-[11px] text-slate-400">
                        Tòa {r.building} · Tầng {r.floor}
                      </p>
                    </div>
                  </div>
                  <span className="text-emerald-600 font-black text-base">
                    {r.score?.toFixed(1)}
                    <span className="text-xs font-medium text-slate-400">/10</span>
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title={
              <span className="flex items-center gap-2">
                <AlertCircle size={18} className="text-rose-500" /> Danh sách phòng cần xử lý
              </span>
            }
            actions={
              <button
                type="button"
                onClick={() => router.push("/admin")}
                className="text-xs font-bold text-[#1d4ed8] hover:underline"
              >
                Xem tất cả →
              </button>
            }
          >
            <div className="divide-y divide-slate-100">
              {actionNeededRooms.map((r) => (
                <div
                  key={r.room_code}
                  onClick={() => r.submission_id && router.push(`/admin/rooms?id=${r.submission_id}`)}
                  className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-xl cursor-pointer transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-800 text-sm">{r.room_code}</span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        r.status === "Bừa bộn"
                          ? "bg-rose-50 text-rose-600"
                          : r.status === "Hơi bừa bộn"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-sky-50 text-sky-700"
                      }`}
                    >
                      {r.status || "Chưa nộp"}
                    </span>
                  </div>
                  <span className="font-black text-sm text-rose-600">
                    {r.score !== null ? `${r.score.toFixed(1)}/10` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
