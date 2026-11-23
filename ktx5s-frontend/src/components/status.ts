// Định nghĩa kiểu dữ liệu phòng + bảng màu trạng thái dùng chung toàn hệ thống
// Màu theo phong cách trang quản trị (AdminLTE)

export type RoomStatus = "Sạch" | "Hơi bừa bộn" | "Bừa bộn" | null;

export type Room = {
  submission_id: string | null;
  room_code: string;
  building: string;
  floor: number;
  week: string;
  status: RoomStatus;
  score: number | null;
  submitted_at: string | null;
  image_url: string | null;
  is_overridden: boolean;
  members?: number;
};

export type TileKey = "clean" | "slightly_messy" | "messy" | "overridden" | "not_submitted";

export const TILE_ORDER: TileKey[] = ["clean", "slightly_messy", "messy", "overridden", "not_submitted"];

export const TILE_STYLES: Record<TileKey, { label: string; bg: string; text: string }> = {
  clean:          { label: "Sạch",                bg: "bg-[#00a65a]", text: "text-[#00a65a]" },
  slightly_messy: { label: "Hơi bừa bộn",         bg: "bg-[#f39c12]", text: "text-[#f39c12]" },
  messy:          { label: "Bừa bộn",             bg: "bg-[#dd4b39]", text: "text-[#dd4b39]" },
  overridden:     { label: "Cán bộ đã duyệt lại", bg: "bg-[#605ca8]", text: "text-[#605ca8]" },
  not_submitted:  { label: "Chưa nộp ảnh",        bg: "bg-[#3c8dbc]", text: "text-[#3c8dbc]" },
};

export function statusToKey(status: RoomStatus): TileKey {
  if (status === "Sạch") return "clean";
  if (status === "Hơi bừa bộn") return "slightly_messy";
  if (status === "Bừa bộn") return "messy";
  return "not_submitted";
}

export function tileKeyOf(room: Pick<Room, "status" | "is_overridden">): TileKey {
  if (!room.status) return "not_submitted";
  if (room.is_overridden) return "overridden";
  return statusToKey(room.status);
}

// ===== 4 KHU VỰC BẮT BUỘC CHỤP =====
export type AreaKey = "bed" | "floor" | "shoes" | "desk";
export type ChecklistKey = "bed_tidy" | "floor_clean" | "shoes_arranged" | "desk_organized";

export const AREAS: { key: AreaKey; label: string; emoji: string; hint: string; checklistKey: ChecklistKey }[] = [
  { key: "bed",   label: "Giường ngủ",  emoji: "🛏️", hint: "Chụp toàn bộ giường, thấy rõ chăn, gối, màn",  checklistKey: "bed_tidy" },
  { key: "floor", label: "Sàn nhà",     emoji: "🧹", hint: "Đứng ở cửa, chụp lối đi và gầm giường",         checklistKey: "floor_clean" },
  { key: "shoes", label: "Kệ giày dép", emoji: "👟", hint: "Chụp kệ giày và khu vực cửa ra vào",            checklistKey: "shoes_arranged" },
  { key: "desk",  label: "Bàn học",     emoji: "📚", hint: "Chụp toàn bộ mặt bàn và giá sách",              checklistKey: "desk_organized" },
];

// ===== QUY MÔ KTX (dữ liệu mẫu) =====
export const BUILDINGS = ["A", "B", "C", "D"];
export const FLOORS = 10;
export const ROOMS_PER_FLOOR = 5;

// ===== DANH SÁCH TUẦN (tuần ISO năm 2026, tự động cập nhật theo thời gian thực) =====
const DAY = 86400000;
const W1_MONDAY_2026 = Date.UTC(2025, 11, 29);

// Tính tuần ISO-8601 tự động theo thời gian thực (real-time)
export function getISOWeek(date = new Date()): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7; // Thứ 2 = 0, Chủ Nhật = 6
  target.setDate(target.getDate() - dayNr + 3); // Thứ 5 của tuần này
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / (7 * 86400000));
}

export const CURRENT_WEEK = getISOWeek();

export function weekMonday(weekNum: number) {
  return new Date(W1_MONDAY_2026 + (weekNum - 1) * 7 * DAY);
}

const ddmm = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export const WEEKS = Array.from({ length: 12 }, (_, i) => {
  const w = CURRENT_WEEK - i;
  const mon = weekMonday(w);
  const sun = new Date(mon.getTime() + 6 * DAY);
  return {
    value: `2026-W${w}`,
    label: `Tuần ${w} (${ddmm(mon)} – ${ddmm(sun)}/2026)${i === 0 ? " — hiện tại" : ""}`,
  };
});

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
