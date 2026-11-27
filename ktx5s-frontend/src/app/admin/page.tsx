"use client";
// TRANG QUẢN LÝ PHÒNG CÁN BỘ — MODERN NAVY-BLUE THEME (DESKTOP & MOBILE)
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  RotateCcw,
  FileDown,
  Send,
  Users,
  Calendar,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { getRooms } from "@/lib/api";
import {
  TILE_ORDER,
  TILE_STYLES,
  FLOORS,
  WEEKS,
  tileKeyOf,
  getRequiredPhotoCount,
  type Room,
  type TileKey,
} from "@/components/status";

type Filters = { floor: string; status: TileKey | "all"; members: string; search: string };
const EMPTY_FILTERS: Filters = { floor: "all", status: "all", members: "all", search: "" };
const FLOOR_LIST = Array.from({ length: FLOORS }, (_, i) => i + 1);

const CARD_ACCENT: Record<
  TileKey,
  { border: string; badgeBg: string; badgeText: string; scoreText: string; shortLabel: string }
> = {
  clean: {
    border: "border-l-emerald-500",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    scoreText: "text-emerald-600",
    shortLabel: "Sạch",
  },
  slightly_messy: {
    border: "border-l-amber-400",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700",
    scoreText: "text-amber-600",
    shortLabel: "Hơi bừa",
  },
  messy: {
    border: "border-l-rose-500",
    badgeBg: "bg-rose-50",
    badgeText: "text-rose-700",
    scoreText: "text-rose-600",
    shortLabel: "Bừa bộn",
  },
  fraud: {
    border: "border-l-pink-600",
    badgeBg: "bg-pink-50",
    badgeText: "text-pink-700",
    scoreText: "text-pink-600",
    shortLabel: "Gian lận",
  },
  overridden: {
    border: "border-l-indigo-500",
    badgeBg: "bg-indigo-50",
    badgeText: "text-indigo-700",
    scoreText: "text-indigo-600",
    shortLabel: "Đã duyệt",
  },
  not_submitted: {
    border: "border-l-sky-500",
    badgeBg: "bg-sky-50",
    badgeText: "text-sky-700",
    scoreText: "text-slate-400",
    shortLabel: "Chưa nộp",
  },
};

export default function AdminRoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState(WEEKS[0].value);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [tab, setTab] = useState("all");
  const [toast, setToast] = useState("");

  useEffect(() => {
    setLoading(true);
    getRooms({ week }).then((res) => {
      setRooms(res.data.rooms);
      setLoading(false);
    });
  }, [week]);

  const buildings = useMemo(() => Array.from(new Set(rooms.map((r) => r.building))).sort(), [rooms]);
  const roomsInTab = tab === "all" ? rooms : rooms.filter((r) => r.building === tab);

  const counts = useMemo(() => {
    const c = Object.fromEntries(TILE_ORDER.map((k) => [k, 0])) as Record<TileKey, number>;
    rooms.forEach((r) => c[tileKeyOf(r)]++);
    return c;
  }, [rooms]);

  const visible = roomsInTab.filter(
    (r) =>
      (applied.floor === "all" || r.floor === Number(applied.floor)) &&
      (applied.status === "all" || tileKeyOf(r) === applied.status) &&
      (applied.members === "all" || r.members === Number(applied.members)) &&
      (!applied.search || r.room_code.includes(applied.search.trim().toUpperCase()))
  );

  const groupedByFloor = useMemo(() => {
    const map = new Map<number, Room[]>();
    for (const r of visible) {
      const list = map.get(r.floor) ?? [];
      list.push(r);
      map.set(r.floor, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [visible]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  const quickFilterStatus = (k: TileKey | "all") => {
    const next = applied.status === k ? "all" : k;
    setDraft((d) => ({ ...d, status: next }));
    setApplied((a) => ({ ...a, status: next }));
  };

  const exportCsv = () => {
    const header = "Ma phong,Toa,Tang,Loai phong,Tuan,Trang thai,Diem,Thoi gian nop\n";
    const lines = rooms
      .map((r) =>
        [
          r.room_code,
          r.building,
          r.floor,
          `${r.members ?? 8} SV`,
          r.week,
          r.status ?? "Chua nop",
          r.score ?? "",
          r.submitted_at ?? "",
        ].join(",")
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + lines], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bao-cao-ve-sinh-${week}.csv`;
    a.click();
  };

  return (
    <AppShell role="admin" title="Quản lý phòng" showBack={false}>
      <div className="space-y-5">
        {/* ===== HEADER TIÊU ĐỀ + CHỌN TUẦN ===== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Quản lý phòng</h1>
            <p className="text-sm text-slate-500">Theo dõi tình trạng vệ sinh ký túc xá</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-2xs">
              <Calendar size={15} className="text-[#1d4ed8] mr-2 shrink-0" />
              <select
                value={week}
                onChange={(e) => setWeek(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none pr-1"
              >
                {WEEKS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={exportCsv}
              className="hidden sm:inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-2xs transition"
            >
              <FileDown size={15} className="text-[#1d4ed8]" /> Xuất báo cáo
            </button>
          </div>
        </div>

        {/* ===== 4 THẺ KPI PASTEL (2x2 MOBILE, 4 CỘT DESKTOP) ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => quickFilterStatus("all")}
            className="text-left bg-[#ebf3fe] hover:bg-[#e1edfd] border border-blue-100 rounded-2xl p-4 flex items-center gap-3.5 transition"
          >
            <div className="w-11 h-11 rounded-xl bg-blue-600/15 text-blue-600 flex items-center justify-center shrink-0">
              <Building2 size={22} />
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-none">
                {rooms.length}
              </p>
              <p className="text-xs font-medium text-slate-600 mt-1">Tổng số phòng</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => quickFilterStatus("clean")}
            className={`text-left bg-[#eaf8f0] hover:bg-[#dff4e8] border rounded-2xl p-4 flex items-center gap-3.5 transition ${
              applied.status === "clean" ? "border-emerald-500 ring-2 ring-emerald-200" : "border-emerald-100"
            }`}
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-none">
                {counts.clean}
              </p>
              <p className="text-xs font-medium text-slate-600 mt-1">Phòng sạch</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => quickFilterStatus("messy")}
            className={`text-left bg-[#fef4ea] hover:bg-[#fdebd9] border rounded-2xl p-4 flex items-center gap-3.5 transition ${
              applied.status === "messy" ? "border-orange-500 ring-2 ring-orange-200" : "border-orange-100"
            }`}
          >
            <div className="w-11 h-11 rounded-xl bg-orange-500/15 text-orange-600 flex items-center justify-center shrink-0">
              <AlertTriangle size={22} />
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-none">
                {counts.messy}
              </p>
              <p className="text-xs font-medium text-slate-600 mt-1">Phòng bừa bộn</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => quickFilterStatus("not_submitted")}
            className={`text-left bg-[#f3effe] hover:bg-[#eae3fd] border rounded-2xl p-4 flex items-center gap-3.5 transition ${
              applied.status === "not_submitted" ? "border-purple-500 ring-2 ring-purple-200" : "border-purple-100"
            }`}
          >
            <div className="w-11 h-11 rounded-xl bg-purple-600/15 text-purple-600 flex items-center justify-center shrink-0">
              <Clock size={22} />
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-none">
                {counts.not_submitted}
              </p>
              <p className="text-xs font-medium text-slate-600 mt-1">Chưa nộp ảnh</p>
            </div>
          </button>
        </div>

        {/* ===== BỘ LỌC TÌM KIẾM ===== */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_10px_rgba(15,23,42,0.03)] p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 mb-3">
            <SlidersHorizontal size={14} className="text-[#1d4ed8]" /> Bộ lọc tìm kiếm
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">
            <select
              value={draft.floor}
              onChange={(e) => {
                const next = { ...draft, floor: e.target.value };
                setDraft(next);
                setApplied(next);
              }}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm bg-slate-50/70 text-slate-700 font-medium focus:border-[#2563eb] focus:outline-none"
            >
              <option value="all">Tất cả các tầng</option>
              {FLOOR_LIST.map((f) => (
                <option key={f} value={f}>
                  Tầng {f}
                </option>
              ))}
            </select>

            <select
              value={draft.status}
              onChange={(e) => {
                const next = { ...draft, status: e.target.value as Filters["status"] };
                setDraft(next);
                setApplied(next);
              }}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm bg-slate-50/70 text-slate-700 font-medium focus:border-[#2563eb] focus:outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              {TILE_ORDER.map((k) => (
                <option key={k} value={k}>
                  {TILE_STYLES[k].label}
                </option>
              ))}
            </select>

            <select
              value={draft.members}
              onChange={(e) => {
                const next = { ...draft, members: e.target.value };
                setDraft(next);
                setApplied(next);
              }}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm bg-slate-50/70 text-slate-700 font-medium focus:border-[#2563eb] focus:outline-none"
            >
              <option value="all">Tất cả loại phòng</option>
              <option value="4">Phòng 4 SV (5 ảnh)</option>
              <option value="6">Phòng 6 SV (6 ảnh)</option>
              <option value="8">Phòng 8 SV (7 ảnh)</option>
            </select>

            <div className="relative col-span-2 md:col-span-2">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={draft.search}
                onChange={(e) => {
                  const next = { ...draft, search: e.target.value };
                  setDraft(next);
                  setApplied(next);
                }}
                placeholder="Tìm mã phòng (VD: A3-301)..."
                className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50/70 uppercase placeholder:normal-case focus:bg-white focus:border-[#2563eb] focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setDraft(EMPTY_FILTERS);
                setApplied(EMPTY_FILTERS);
              }}
              className="col-span-2 md:col-span-1 flex items-center justify-center gap-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl px-3 py-2 text-xs font-semibold transition"
            >
              <RotateCcw size={14} /> Đặt lại
            </button>
          </div>
        </div>

        {/* ===== TAB TÒA NHÀ DẠNG PILL ===== */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { key: "all", label: `Tất cả (${rooms.length})` },
            ...buildings.map((b) => ({
              key: b,
              label: `Tòa ${b} (${rooms.filter((r) => r.building === b).length})`,
            })),
          ].map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition ${
                  active
                    ? "bg-[#1d4ed8] text-white shadow-sm shadow-blue-900/15"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ===== DANH SÁCH PHÒNG GOM NHÓM THEO TẦNG ===== */}
        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200/80">
            Đang tải danh sách phòng...
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200/80">
            Không có phòng nào phù hợp bộ lọc hiện tại.
          </div>
        ) : (
          <div className="space-y-6">
            {groupedByFloor.map(([floorNum, floorRooms]) => (
              <div key={floorNum} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-800 flex items-center gap-2">
                    <span className="w-1.5 h-5 rounded-full bg-[#1d4ed8]" />
                    Tầng {floorNum}{" "}
                    <span className="text-xs font-semibold text-slate-400">
                      ({floorRooms.length} phòng)
                    </span>
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] font-semibold">
                    <span className="text-emerald-600">
                      Sạch: {floorRooms.filter((r) => r.status === "Sạch").length}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-amber-600">
                      Hơi bừa: {floorRooms.filter((r) => r.status === "Hơi bừa bộn").length}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-rose-600">
                      Bừa bộn: {floorRooms.filter((r) => r.status === "Bừa bộn").length}
                    </span>
                  </div>
                </div>

                {/* LƯỚI CARD PHÒNG: Desktop 4 cột thẻ trắng viền màu trái; Mobile 1 cột card ngang có ảnh giống mockup */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {floorRooms.map((room) => {
                    const key = tileKeyOf(room);
                    const acc = CARD_ACCENT[key];
                    const photoReq = getRequiredPhotoCount(room.members);

                    return (
                      <div
                        key={room.room_code}
                        onClick={() =>
                          room.submission_id && router.push(`/admin/rooms?id=${room.submission_id}`)
                        }
                        className={`bg-white rounded-2xl border border-slate-200/80 border-l-4 ${acc.border} shadow-[0_2px_10px_rgba(15,23,42,0.03)] hover:shadow-md transition p-3.5 sm:p-4 flex sm:flex-col gap-3 ${
                          room.submission_id ? "cursor-pointer" : ""
                        }`}
                      >
                        {/* Thumbnail ảnh phòng hiển thị trên Mobile giống bản phác thảo */}
                        <div className="sm:hidden w-20 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200/70">
                          {room.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={room.image_url}
                              alt={room.room_code}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <Building2 size={24} />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-base font-extrabold text-slate-800 leading-tight">
                                {room.room_code}
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                                <Users size={11} /> {room.members} SV · {photoReq} ảnh
                              </p>
                            </div>
                            <span
                              className={`${acc.badgeBg} ${acc.badgeText} text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0`}
                            >
                              {acc.shortLabel}
                            </span>
                          </div>

                          <div className="mt-2.5 flex items-end justify-between gap-2">
                            <div>
                              {room.score !== null ? (
                                <p className={`text-2xl font-black leading-none ${acc.scoreText}`}>
                                  {room.score.toFixed(1)}
                                  <span className="text-xs font-semibold text-slate-400 ml-0.5">
                                    /10
                                  </span>
                                </p>
                              ) : (
                                <p className="text-xl font-bold text-slate-300 leading-none">—/10</p>
                              )}
                            </div>

                            {room.submission_id ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/admin/rooms?id=${room.submission_id}`);
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-[#1d4ed8] text-[#1d4ed8] hover:text-white text-xs font-bold transition"
                              >
                                Chi tiết <ArrowRight size={13} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showToast(
                                    `Đã gửi nhắc nhở nộp ${photoReq} ảnh tới phòng ${room.room_code}`
                                  );
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                              >
                                <Send size={12} /> Nhắc nhở
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 bg-[#1b365d] text-white px-4 py-3 rounded-xl shadow-xl text-xs sm:text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 size={17} className="text-emerald-400 shrink-0" />
          {toast}
        </div>
      )}
    </AppShell>
  );
}
