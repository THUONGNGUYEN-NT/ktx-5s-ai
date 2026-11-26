// Định nghĩa kiểu dữ liệu phòng + bảng màu trạng thái dùng chung toàn hệ thống
// Màu theo phong cách trang quản trị (AdminLTE)

export type RoomStatus = "Sạch" | "Hơi bừa bộn" | "Bừa bộn" | "Không hợp lệ (Gian lận)" | "Không hợp lệ" | null;

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

export type TileKey = "clean" | "slightly_messy" | "messy" | "fraud" | "overridden" | "not_submitted";

export const TILE_ORDER: TileKey[] = ["clean", "slightly_messy", "messy", "fraud", "overridden", "not_submitted"];

export const TILE_STYLES: Record<TileKey, { label: string; bg: string; text: string }> = {
  clean:          { label: "Sạch",                    bg: "bg-[#00a65a]", text: "text-[#00a65a]" },
  slightly_messy: { label: "Hơi bừa bộn",             bg: "bg-[#f39c12]", text: "text-[#f39c12]" },
  messy:          { label: "Bừa bộn",                 bg: "bg-[#dd4b39]", text: "text-[#dd4b39]" },
  fraud:          { label: "Không hợp lệ (Gian lận)", bg: "bg-[#d81b60]", text: "text-[#d81b60]" },
  overridden:     { label: "Cán bộ đã duyệt lại",     bg: "bg-[#605ca8]", text: "text-[#605ca8]" },
  not_submitted:  { label: "Chưa nộp ảnh",            bg: "bg-[#3c8dbc]", text: "text-[#3c8dbc]" },
};

export function statusToKey(status: any): TileKey {
  if (!status) return "not_submitted";
  const s = String(status).toLowerCase();
  if (s.includes("gian lận") || s.includes("không hợp lệ") || s.includes("fraud") || s.includes("invalid")) return "fraud";
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

// ===== 4 KHU VỰC BẮT BUỘC CHỤP (KHU VỰC CHUNG) & GIƯỜNG TẦNG =====
export type AreaKey = "bed" | "floor" | "shoes" | "desk";
export type ChecklistKey = "bed_tidy" | "floor_clean" | "shoes_arranged" | "desk_organized";

export const AREAS: { key: AreaKey; label: string; emoji: string; hint: string; checklistKey: ChecklistKey }[] = [
  { key: "bed",   label: "L1 · Giường ngủ (B01..BP)",       emoji: "🛏️", hint: "Chụp từng vị trí ngủ (tầng trên & dưới riêng), thấy rõ chăn, ga, gối", checklistKey: "bed_tidy" },
  { key: "floor", label: "L2 · Sàn nhà & lối đi",           emoji: "🧹", hint: "Chụp chếch 30–45°, thấy rõ mặt sàn và các lối di chuyển",               checklistKey: "floor_clean" },
  { key: "desk",  label: "L3 · Bàn học & khu vực học tập",  emoji: "📚", hint: "Chụp chính diện hoặc chếch 30°, thấy rõ mặt bàn và sách vở",             checklistKey: "desk_organized" },
  { key: "shoes", label: "L4 · Kệ giày dép & đồ đạc",       emoji: "👟", hint: "Chụp chính diện kệ giày dép, móc treo quần áo và khu vực để đồ",         checklistKey: "shoes_arranged" },
];

export type RoomBedPreset = {
  bedCount: number;
  label: string;
  totalPhotos: number;
  description: string;
};

export const ROOM_BED_PRESETS: RoomBedPreset[] = [
  { bedCount: 2, label: "Phòng 2 người", totalPhotos: 4, description: "1 ảnh giường tầng (trên & dưới) + 3 khu vực chung" },
  { bedCount: 4, label: "Phòng 4 người", totalPhotos: 5, description: "2 ảnh giường tầng (trên & dưới) + 3 khu vực chung" },
  { bedCount: 6, label: "Phòng 6 người", totalPhotos: 6, description: "3 ảnh giường tầng (trên & dưới) + 3 khu vực chung" },
  { bedCount: 8, label: "Phòng 8 người", totalPhotos: 7, description: "4 ảnh giường tầng (trên & dưới) + 3 khu vực chung" },
];

export const CHALLENGE_PROMPTS: string[] = [
  "Chụp chếch từ góc cuối phòng hướng về phía cửa ra vào.",
  "Chụp từ cửa ra vào hướng chéo vào góc tường đối diện.",
  "Chụp lại khu vực bàn học từ hướng ngược lại (thấy rõ mặt bàn và gầm bàn).",
  "Chụp góc nối giữa lối đi chính và chân giường tầng phía trong.",
  "Chụp cận cảnh khu vực móc treo đồ, tủ cá nhân và khoảng trống cạnh kệ giày.",
  "Chụp dọc theo mép tường bên trái từ đầu phòng đến cuối phòng.",
  "Chụp góc cửa sổ / ban công và khoảng trống sát giường tầng gần cửa sổ.",
  "Chụp chếch từ giữa phòng hướng về phía cửa ra vào và giá phơi/kệ dép.",
  "Chụp gầm giường tầng đầu tiên và khu vực sàn tiếp giáp.",
  "Chụp toàn bộ dãy tủ đồ / giá sách nhìn nghiêng 45 độ.",
];

export function pickRandomChallenge(): string {
  return CHALLENGE_PROMPTS[Math.floor(Math.random() * CHALLENGE_PROMPTS.length)];
}

export type CaptureSlot = {
  slot_code: string;
  slot_group: "bed" | "common" | "challenge";
  slot_label: string;
  angle_hint: string;
  checklist_key: string;
  required: boolean;
};

export function buildLocalCaptureSlots(bedCount: number, challengePrompt?: string): CaptureSlot[] {
  const p = Math.min(12, Math.max(1, bedCount || 4));
  const bunkCount = Math.max(1, Math.ceil(p / 2));
  const slots: CaptureSlot[] = [];
  for (let i = 1; i <= bunkCount; i++) {
    const code = `B${String(i).padStart(2, "0")}`;
    slots.push({
      slot_code: code,
      slot_group: "bed",
      slot_label: `${code} · Giường tầng ${i} (Tầng trên & dưới)`,
      angle_hint: `Chụp chính diện hoặc chếch 30–45° giường tầng ${i}, thấy rõ cả tầng trên và tầng dưới trong cùng 1 ảnh.`,
      checklist_key: "bed_tidy",
      required: true,
    });
  }
  slots.push(
    {
      slot_code: "C02_FLOOR",
      slot_group: "common",
      slot_label: "Sàn nhà và lối đi",
      angle_hint: "Chụp chếch xuống 30–45°, thấy rõ mặt sàn và các lối di chuyển trong phòng.",
      checklist_key: "floor_clean",
      required: true,
    },
    {
      slot_code: "C03_DESK",
      slot_group: "common",
      slot_label: "Bàn học và khu vực học tập",
      angle_hint: "Chụp chính diện hoặc chếch 30°, thấy rõ mặt bàn, sách vở và vật dụng.",
      checklist_key: "desk_organized",
      required: true,
    },
    {
      slot_code: "C04_SHOES",
      slot_group: "common",
      slot_label: "Kệ giày dép và khu vực để đồ",
      angle_hint: "Chụp chính diện kệ giày dép và khu vực treo móc đồ cá nhân xung quanh.",
      checklist_key: "shoes_arranged",
      required: true,
    }
  );
  if (challengePrompt) {
    slots.push({
      slot_code: "CH01",
      slot_group: "challenge",
      slot_label: "Góc chụp thử thách ngẫu nhiên",
      angle_hint: challengePrompt,
      checklist_key: "challenge",
      required: true,
    });
  }
  return slots;
}

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
  const parsed = new Date(iso).getTime();
  const safeMs = Number.isNaN(parsed) ? Date.now() : Math.min(parsed, Date.now());
  return new Date(safeMs).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
