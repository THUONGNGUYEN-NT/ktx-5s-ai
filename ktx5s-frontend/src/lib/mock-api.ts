// =====================================================
// MOCK DATA — theo đúng cấu trúc API_SPEC_KTX5S.md
// Dùng khi Sinh viên A chưa xong API thật (USE_MOCK = true)
// =====================================================
import {
  BUILDINGS,
  FLOORS,
  ROOMS_PER_FLOOR,
  CURRENT_WEEK,
  weekMonday,
  type AreaKey,
  type Room,
  type RoomStatus,
} from "@/components/status";

export type AIResult = {
  status: NonNullable<RoomStatus>;
  score: number;
  is_valid_room_photo: boolean;
  checklist: { bed_tidy: boolean; floor_clean: boolean; desk_organized: boolean; shoes_arranged: boolean };
  issues_detected: string[];
  positive_notes: string[];
  recommendations: string;
};

export function buildMockAiResult(status: NonNullable<RoomStatus>, score: number): AIResult {
  if (status === "Không hợp lệ (Gian lận)" || status === "Không hợp lệ") {
    return {
      status,
      score: 0.0,
      is_valid_room_photo: false,
      checklist: { bed_tidy: false, floor_clean: false, desk_organized: false, shoes_arranged: false },
      issues_detected: [
        "Phát hiện ảnh gian lận, ghép ảnh từ nhiều phòng khác nhau hoặc trùng lặp không gian",
      ],
      positive_notes: [],
      recommendations: "Ảnh nộp vi phạm quy chế (gian lận/không hợp lệ). Sinh viên cần chụp ảnh thực tế phòng mình để nộp lại.",
    };
  }
  if (status === "Sạch") {
    return {
      status, score, is_valid_room_photo: true,
      checklist: { bed_tidy: true, floor_clean: true, desk_organized: true, shoes_arranged: true },
      issues_detected: [],
      positive_notes: ["Chăn màn gấp gọn gàng", "Sàn nhà sạch, không có rác", "Bàn học ngăn nắp", "Giày dép xếp đúng kệ"],
      recommendations: "Phòng rất sạch sẽ, hãy tiếp tục duy trì nhé!",
    };
  }
  if (status === "Hơi bừa bộn") {
    return {
      status, score, is_valid_room_photo: true,
      checklist: { bed_tidy: false, floor_clean: true, desk_organized: true, shoes_arranged: false },
      issues_detected: ["Chăn chưa được gấp gọn", "Giày dép để lộn xộn trước cửa"],
      positive_notes: ["Sàn nhà sạch sẽ, không có rác", "Bàn học ngăn nắp"],
      recommendations: "Hãy gấp chăn và xếp giày lên kệ để đạt điểm Sạch tuần sau nhé!",
    };
  }
  return {
    status, score, is_valid_room_photo: true,
    checklist: { bed_tidy: false, floor_clean: false, desk_organized: false, shoes_arranged: false },
    issues_detected: ["Rác thải vứt trên sàn nhà", "Quần áo bẩn vứt lộn xộn trên giường", "Thức ăn thừa trên bàn học"],
    positive_notes: [],
    recommendations: "Phòng cần được dọn dẹp toàn bộ trước khi nộp lại.",
  };
}

export const mockSubmissionResult = {
  success: true,
  data: {
    submission_id: "mock_001",
    room_code: "A3-301",
    submitted_at: new Date().toISOString(),
    image_url: "https://placehold.co/800x500/e2e8f0/64748b?text=Anh+phong+KTX",
    ai_result: buildMockAiResult("Hơi bừa bộn", 6.5),
  },
  message: "Nộp ảnh thành công! AI đã chấm điểm xong.",
};

export const mockHistory = {
  success: true,
  data: {
    room_code: "A3-301",
    total_submissions: 4,
    history: [
      { submission_id: "h1", week: "2026-W47", submitted_at: "2026-11-17T08:00:00+07:00", image_url: "https://placehold.co/600x400?text=Tuan+47", status: "Hơi bừa bộn" as RoomStatus, score: 6.5, is_overridden: false, override_note: null as string | null },
      { submission_id: "h2", week: "2026-W46", submitted_at: "2026-11-10T20:30:00+07:00", image_url: "https://placehold.co/600x400?text=Tuan+46", status: "Sạch" as RoomStatus, score: 9.0, is_overridden: true, override_note: "Cán bộ xác nhận: Phòng sạch hơn AI đánh giá" as string | null },
      { submission_id: "h3", week: "2026-W45", submitted_at: "2026-11-03T19:00:00+07:00", image_url: "https://placehold.co/600x400?text=Tuan+45", status: "Bừa bộn" as RoomStatus, score: 2.1, is_overridden: false, override_note: null as string | null },
      { submission_id: "h4", week: "2026-W44", submitted_at: "2026-10-27T18:15:00+07:00", image_url: "https://placehold.co/600x400?text=Tuan+44", status: "Sạch" as RoomStatus, score: 8.4, is_overridden: false, override_note: null as string | null },
    ],
  },
  message: "OK",
};

export const mockDashboard = {
  success: true,
  data: {
    week: "2026-W47",
    summary: { total_rooms: 60, submitted: 51, not_submitted: 9, submission_rate_percent: 85.0 },
    breakdown: { clean: 30, slightly_messy: 13, messy: 8 },
    avg_score: 7.1,
    deadline: "2026-11-22T21:00:00+07:00",
    top_violations: [
      { room_code: "B2-201", score: 2.1, status: "Bừa bộn" },
      { room_code: "C1-104", score: 3.5, status: "Bừa bộn" },
      { room_code: "D3-302", score: 4.0, status: "Bừa bộn" },
    ],
  },
};

// Ảnh mẫu cho 4 khu vực của 1 phòng
export function mockAreaImages(code: string): Record<AreaKey, string> {
  const img = (t: string) => `https://placehold.co/800x600/e2e8f0/64748b?text=${encodeURIComponent(t)}+${code}`;
  return { bed: img("Giuong"), floor: img("San+nha"), shoes: img("Ke+giay"), desk: img("Ban+hoc") };
}

// Sinh danh sách 200 phòng: 4 tòa (A–D) × 10 tầng × 5 phòng — kết quả khác nhau theo từng tuần
// Mã phòng: <Tòa><Tầng>-<Tầng><Số phòng>  VD: A3-301, B10-1005
const pad = (n: number) => String(n).padStart(2, "0");

export function generateRooms(week = `2026-W${CURRENT_WEEK}`): Room[] {
  const weekNum = Number(week.split("-W")[1]) || CURRENT_WEEK;
  const isCurrent = weekNum === CURRENT_WEEK;
  const monDate = weekMonday(weekNum);
  const monY = monDate.getUTCFullYear();
  const monM = pad(monDate.getUTCMonth() + 1);
  const monD = pad(monDate.getUTCDate());

  // Mốc bắt đầu tuần (07:00 sáng Thứ Hai giờ Việt Nam +07:00)
  const weekStartMs = new Date(`${monY}-${monM}-${monD}T07:00:00+07:00`).getTime();
  // Mốc kết thúc tuần (21:00 tối Chủ Nhật giờ Việt Nam +07:00)
  const weekEndMs = weekStartMs + 6 * 86400000 + 14 * 3600000;
  // Chặn trên bởi thời gian thực hiện tại (lùi 3 phút so với đồng hồ thực) để không bao giờ sinh ngày/giờ ở tương lai
  const nowCapMs = Date.now() - 3 * 60 * 1000;
  const maxAllowedMs = Math.max(weekStartMs + 60 * 1000, Math.min(weekEndMs, nowCapMs));
  const spanMs = Math.max(60 * 1000, maxAllowedMs - weekStartMs);

  const rooms: Room[] = [];
  let i = 0;
  for (const b of BUILDINGS) {
    for (let f = 1; f <= FLOORS; f++) {
      for (let r = 1; r <= ROOMS_PER_FLOOR; r++) {
        const h = ((i + 1) * 7919 + weekNum * 104729 + f * 131 + r * 17) % 1000;
        // Tuần hiện tại còn nhiều phòng chưa nộp; tuần cũ hầu như đã nộp đủ
        const notSubmittedFrom = isCurrent ? 820 : 960;
        const status: RoomStatus = h < 560 ? "Sạch" : h < 740 ? "Hơi bừa bộn" : h < notSubmittedFrom ? "Bừa bộn" : null;

        let score: number | null = null;
        if (status === "Sạch") score = 8 + (h % 21) / 10;
        if (status === "Hơi bừa bộn") score = 5 + (h % 30) / 10;
        if (status === "Bừa bộn") score = 1 + (h % 39) / 10;

        const code = `${b}${f}-${f}${pad(r)}`;
        // Phân bổ thời gian nộp ảnh nằm nghiêm ngặt trong khoảng [07:00 Thứ Hai .. Thời điểm thực tế hiện tại]
        let ts = weekStartMs + Math.floor(((h % 997) / 997) * spanMs);
        ts = Math.min(ts, maxAllowedMs);
        const submittedAt = new Date(ts).toISOString();

        rooms.push({
          submission_id: status ? `sub_${week}_${code}` : null,
          room_code: code,
          building: b,
          floor: f,
          week,
          status,
          score: score !== null ? Math.round(score * 10) / 10 : null,
          submitted_at: status ? submittedAt : null,
          image_url: status ? mockAreaImages(code).bed : null,
          is_overridden: status !== null && h % 29 === 0,
          members: 4 + ((i + f + r) % 3) * 2,
        });
        i++;
      }
    }
  }
  return rooms;
}
