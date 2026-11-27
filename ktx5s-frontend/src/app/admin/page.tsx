"use client";
// Trang QUẢN LÝ PHÒNG của cán bộ — 4 tòa × 10 tầng = 200 phòng, 12 tuần lịch sử
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, Clock, Search, RotateCcw, FileDown, Eye, Send, Users } from "lucide-react";
import AppShell from "@/components/AppShell";
import Panel from "@/components/Panel";
import { getRooms } from "@/lib/api";
import {
  TILE_ORDER,
  TILE_STYLES,
  FLOORS,
  WEEKS,
  tileKeyOf,
  formatDateTime,
  getRequiredPhotoCount,
  type Room,
  type TileKey,
} from "@/components/status";

type Filters = { floor: string; status: TileKey | "all"; members: string; search: string };
const EMPTY_FILTERS: Filters = { floor: "all", status: "all", members: "all", search: "" };
const FLOOR_LIST = Array.from({ length: FLOORS }, (_, i) => i + 1);

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
    roomsInTab.forEach((r) => c[tileKeyOf(r)]++);
    return c;
  }, [roomsInTab]);

  const visible = roomsInTab.filter(
    (r) =>
      (applied.floor === "all" || r.floor === Number(applied.floor)) &&
      (applied.status === "all" || tileKeyOf(r) === applied.status) &&
      (applied.members === "all" || r.members === Number(applied.members)) &&
      (!applied.search || r.room_code.includes(applied.search.trim().toUpperCase()))
  );

  // Gom nhóm phòng theo tầng (Tầng 1 -> Tầng 10)
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
    setTimeout(() => setToast(""), 2500);
  };

  const pickStatus = (k: TileKey) => {
    const next = applied.status === k ? "all" : k;
    setDraft((d) => ({ ...d, status: next }));
    setApplied((a) => ({ ...a, status: next }));
  };

  const exportCsv = () => {
    const header = "Ma phong,Toa,Tang,Tuan,Trang thai,Diem,Thoi gian nop,Da duyet lai\n";
    const lines = rooms
      .map((r) =>
        [
          r.room_code,
          r.building,
          r.floor,
          r.week,
          r.status ?? "Chua nop",
          r.score ?? "",
          r.submitted_at ?? "",
          r.is_overridden ? "Co" : "",
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
      <Panel
        title={`Quản lý phòng (${roomsInTab.length} phòng · 10 tầng)`}
        actions={
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 bg-[#3c8dbc] hover:bg-[#367fa9] text-white px-3 py-1.5 rounded-sm text-xs font-medium"
          >
            <FileDown size={14} /> Xuất báo cáo tuần
          </button>
        }
      >
        {/* ===== KHUNG LỌC ===== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3 max-w-5xl mx-auto">
          <label className="flex items-center gap-3">
            <span className="w-24 text-right font-semibold">Tuần</span>
            <select
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              className="flex-1 border border-gray-300 rounded-sm px-2 py-1.5 bg-white"
            >
              {WEEKS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3">
            <span className="w-24 text-right font-semibold">Mã phòng</span>
            <input
              value={draft.search}
              onChange={(e) => setDraft({ ...draft, search: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && setApplied(draft)}
              placeholder="VD: A1-101, B10-1003"
              className="flex-1 border border-gray-300 rounded-sm px-2 py-1.5 uppercase"
            />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-24 text-right font-semibold">Tầng</span>
            <select
              value={draft.floor}
              onChange={(e) => setDraft({ ...draft, floor: e.target.value })}
              className="flex-1 border border-gray-300 rounded-sm px-2 py-1.5 bg-white"
            >
              <option value="all">-- Tất cả 10 tầng --</option>
              {FLOOR_LIST.map((f) => (
                <option key={f} value={f}>
                  Tầng {f}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3">
            <span className="w-24 text-right font-semibold">Trạng thái</span>
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as Filters["status"] })}
              className="flex-1 border border-gray-300 rounded-sm px-2 py-1.5 bg-white"
            >
              <option value="all">-- Tất cả --</option>
              {TILE_ORDER.map((k) => (
                <option key={k} value={k}>
                  {TILE_STYLES[k].label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3">
            <span className="w-24 text-right font-semibold">Loại phòng</span>
            <select
              value={draft.members}
              onChange={(e) => setDraft({ ...draft, members: e.target.value })}
              className="flex-1 border border-gray-300 rounded-sm px-2 py-1.5 bg-white"
            >
              <option value="all">-- Tất cả (4, 6, 8 SV) --</option>
              <option value="4">Phòng 4 sinh viên</option>
              <option value="6">Phòng 6 sinh viên</option>
              <option value="8">Phòng 8 sinh viên</option>
            </select>
          </label>
          <div className="flex items-center gap-2 md:pl-[108px]">
            <button
              onClick={() => setApplied(draft)}
              className="flex items-center gap-1.5 bg-[#3c8dbc] hover:bg-[#367fa9] text-white px-4 py-1.5 rounded-sm"
            >
              <Search size={14} /> Tra cứu
            </button>
            <button
              onClick={() => {
                setDraft(EMPTY_FILTERS);
                setApplied(EMPTY_FILTERS);
              }}
              className="flex items-center gap-1.5 border border-gray-300 hover:bg-gray-100 px-4 py-1.5 rounded-sm"
            >
              <RotateCcw size={14} /> Đặt lại
            </button>
          </div>
        </div>

        {/* ===== CHÚ THÍCH MÀU + SỐ ĐẾM ===== */}
        <div className="flex flex-wrap gap-x-8 gap-y-3 mt-6 pt-4 border-t border-gray-100">
          {TILE_ORDER.map((k) => (
            <button
              key={k}
              onClick={() => pickStatus(k)}
              className={`flex items-center gap-2 rounded-sm pr-2 transition ${
                applied.status === k ? "ring-2 ring-offset-2 ring-gray-400" : "hover:opacity-80"
              }`}
              title="Bấm để lọc nhanh"
            >
              <span
                className={`${TILE_STYLES[k].bg} text-white font-bold min-w-[38px] h-8 px-2 flex items-center justify-center rounded-sm`}
              >
                {counts[k]}
              </span>
              <span>: {TILE_STYLES[k].label}</span>
            </button>
          ))}
        </div>

        {/* ===== TAB THEO TÒA NHÀ ===== */}
        <div className="flex gap-1 mt-5 border-b border-gray-200 overflow-x-auto">
          {[
            { key: "all", label: "Tất cả các tòa" },
            ...buildings.map((b) => ({ key: b, label: `Tòa ${b}` })),
          ].map((t) => {
            const list = t.key === "all" ? rooms : rooms.filter((r) => r.building === t.key);
            const messy = list.filter((r) => tileKeyOf(r) === "messy").length;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 -mb-px border-b-2 whitespace-nowrap ${
                  active
                    ? "border-[#3c8dbc] text-gray-800 font-semibold"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                <BedDouble size={14} /> {t.label} ({list.length})
                <span
                  className="bg-[#dd4b39] text-white text-[10px] font-bold rounded-full px-1.5 py-0.5"
                  title="Số phòng bừa bộn"
                >
                  {messy}
                </span>
              </button>
            );
          })}
        </div>

        {/* ===== LƯỚI Ô PHÒNG CHIA THEO TẦNG ===== */}
        {loading ? (
          <p className="text-center text-gray-400 py-16">Đang tải danh sách phòng...</p>
        ) : visible.length === 0 ? (
          <p className="text-center text-gray-400 py-16">Không có phòng nào phù hợp bộ lọc.</p>
        ) : (
          <div className="flex flex-col gap-6 mt-4">
            {groupedByFloor.map(([floorNum, floorRooms]) => (
              <div key={floorNum}>
                <div className="flex items-center justify-between bg-gray-100 px-3 py-1.5 rounded-sm mb-2.5 border-l-4 border-[#3c8dbc]">
                  <span className="font-semibold text-gray-700">
                    Tầng {floorNum} ({floorRooms.length} phòng)
                  </span>
                  <span className="text-xs text-gray-500">
                    Sạch: {floorRooms.filter((r) => r.status === "Sạch").length} · Hơi bừa:{" "}
                    {floorRooms.filter((r) => r.status === "Hơi bừa bộn").length} · Bừa bộn:{" "}
                    {floorRooms.filter((r) => r.status === "Bừa bộn").length} · Chưa nộp:{" "}
                    {floorRooms.filter((r) => !r.status).length}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {floorRooms.map((room) => {
                    const key = tileKeyOf(room);
                    const style = TILE_STYLES[key];
                    return (
                      <div
                        key={room.room_code}
                        className={`${style.bg} text-white rounded-sm shadow-sm flex flex-col min-h-[150px]`}
                      >
                        <div className="flex items-center justify-between px-2 pt-2 text-white/80 text-[11px]">
                          <BedDouble size={15} />
                          <span className="flex items-center gap-1">
                            <Users size={11} /> {room.members} SV · {getRequiredPhotoCount(room.members)} ảnh
                          </span>
                        </div>
                        <div className="text-center px-2 pt-1 pb-2">
                          <p className="text-[15px] font-semibold">Phòng {room.room_code}</p>
                          <p className="text-xs font-medium mt-0.5">
                            {key === "overridden" ? `${room.status} (đã duyệt)` : style.label}
                          </p>
                          {room.score !== null && (
                            <p className="text-xl font-black leading-tight mt-1">
                              {room.score.toFixed(1)}
                              <span className="text-xs font-normal">/10</span>
                            </p>
                          )}
                          <p className="text-[11px] mt-1 opacity-90 flex items-center justify-center gap-1">
                            <Clock size={11} />{" "}
                            {room.submitted_at ? formatDateTime(room.submitted_at) : "Chưa nộp tuần này"}
                          </p>
                        </div>
                        <div className="mt-auto flex justify-center gap-1 pb-2">
                          {room.submission_id ? (
                            <button
                              onClick={() => router.push(`/admin/rooms?id=${room.submission_id}`)}
                              className="flex items-center gap-1 bg-black/30 hover:bg-black/50 px-2 py-1 rounded-sm text-[11px] font-medium"
                            >
                              <Eye size={12} /> Chi tiết {getRequiredPhotoCount(room.members)} ảnh / Duyệt
                            </button>
                          ) : (
                            <button
                              onClick={() => showToast(`Đã gửi nhắc nhở nộp ${getRequiredPhotoCount(room.members)} ảnh tới phòng ${room.room_code}`)}
                              className="flex items-center gap-1 bg-black/30 hover:bg-black/50 px-2 py-1 rounded-sm text-[11px] font-medium"
                            >
                              <Send size={12} /> Nhắc nhở
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {toast && (
        <div className="fixed bottom-14 right-6 bg-[#00a65a] text-white px-4 py-2.5 rounded shadow-lg text-sm">
          {toast}
        </div>
      )}
    </AppShell>
  );
}
