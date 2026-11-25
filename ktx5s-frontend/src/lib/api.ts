import axios, { AxiosError } from "axios";
import { BASE_URL, USE_MOCK } from "./config";
import {
  mockHistory,
  generateRooms,
  buildMockAiResult,
  mockAreaImages,
  type AIResult,
} from "./mock-api";
import { analyzeFourRoomPhotos } from "./vision-analyzer";
import { CURRENT_WEEK, type AreaKey, type Room, type RoomStatus } from "@/components/status";
import { uploadAllFourAreasToCloudinary } from "./cloudinary";

const api = axios.create({ baseURL: BASE_URL });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BACKEND_ORIGIN = BASE_URL.replace(/\/api\/?$/, "");

function resolveImageUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }
  return `${BACKEND_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

// Lưu các lượt nộp thật & duyệt đè trong trình duyệt để đồng bộ ngay lên bảng 10 tầng / 200 phòng
type LiveRecord = {
  submission_id: string;
  room_code: string;
  week: string;
  submitted_at: string;
  area_images: Record<AreaKey, string>;
  ai_result: AIResult;
  is_overridden: boolean;
  override_note: string | null;
};

const LIVE_KEY = "ktx5s_live_submissions_v1";

function loadLiveRecords(): Record<string, LiveRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LIVE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLiveRecord(rec: LiveRecord) {
  if (typeof window === "undefined") return;
  try {
    const all = loadLiveRecords();
    all[`${rec.week}_${rec.room_code}`] = rec;
    localStorage.setItem(LIVE_KEY, JSON.stringify(all));
  } catch {
    // ignore storage quota errors
  }
}

function mergeRoomsWithLive(week: string, baseRooms: Room[]): Room[] {
  const all = loadLiveRecords();
  return baseRooms.map((r) => {
    const live = all[`${week}_${r.room_code}`];
    if (!live) return r;
    return {
      ...r,
      submission_id: live.submission_id,
      status: live.ai_result.status as RoomStatus,
      score: live.ai_result.score,
      submitted_at: live.submitted_at,
      image_url: live.area_images.bed,
      is_overridden: live.is_overridden,
    };
  });
}

// ---- SINH VIÊN: Nộp đủ 4 ảnh khu vực -> Gọi thẳng API AI của Sinh viên A ----
export async function submitPhotos(roomCode: string, files: Record<AreaKey, File>) {
  const cleanCode = roomCode.trim().toUpperCase();
  const week = `2026-W${CURRENT_WEEK}`;

  // Chuẩn bị FormData chứa đúng 4 ảnh theo thứ tự: Giường, Sàn nhà, Kệ giày dép, Bàn học
  const form = new FormData();
  form.append("room_code", cleanCode);
  form.append("captured_at", new Date().toISOString());
  form.append("image", files.bed);
  form.append("image", files.floor);
  form.append("image", files.shoes);
  form.append("image", files.desk);

  try {
    // Ưu tiên gọi thẳng API AI Gemini Vision của Sinh viên A tại Backend (:8000)
    const res = await api.post("/ai/evaluate", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const payload = res.data;
    if (payload?.success && payload?.data) {
      const urls: string[] = (payload.data.image_urls ?? []).map(resolveImageUrl);
      const areaImages: Record<AreaKey, string> = {
        bed: urls[0] || (await fileToDataUrl(files.bed)),
        floor: urls[1] || (await fileToDataUrl(files.floor)),
        shoes: urls[2] || (await fileToDataUrl(files.shoes)),
        desk: urls[3] || (await fileToDataUrl(files.desk)),
      };
      saveLiveRecord({
        submission_id: payload.data.submission_id || `sub_${week}_${cleanCode}`,
        room_code: cleanCode,
        week,
        submitted_at: payload.data.submitted_at || new Date().toISOString(),
        area_images: areaImages,
        ai_result: payload.data.ai_result,
        is_overridden: false,
        override_note: null,
      });
    }
    return payload;
  } catch (err) {
    const axErr = err as AxiosError<{ message?: string; detail?: string }>;
    // Nếu Backend (:8000) đang bật và trả lỗi từ AI (VD: ảnh mờ/tối hoặc thiếu GEMINI_API_KEY) -> báo đúng lỗi đó
    if (axErr.response?.data) {
      const msg =
        axErr.response.data.message ||
        axErr.response.data.detail ||
        "AI không thể phân tích bộ ảnh này. Vui lòng chụp lại.";
      throw new Error(msg);
    }

    // Nếu chạy trên GitHub Pages hoặc khi cổng 8000 chưa bật -> Chạy bộ phân tích điểm ảnh 5S trực tiếp trên 4 ảnh
    if (USE_MOCK) {
      // Tự động upload song song 4 ảnh lên Cloudinary vào thư mục của phòng: ktx5s/{cleanCode}/
      const cloudUploadPromise = uploadAllFourAreasToCloudinary(files, cleanCode);
      const analysisPromise = analyzeFourRoomPhotos(files);

      const [cloudUrls, analysis] = await Promise.all([cloudUploadPromise, analysisPromise]);

      if (!analysis.isValid) {
        throw new Error(
          analysis.invalidMessage || "Ảnh quá tối hoặc không hợp lệ. Vui lòng chụp lại!"
        );
      }

      const areaImages: Record<AreaKey, string> = {
        bed: cloudUrls.bed || (await fileToDataUrl(files.bed)),
        floor: cloudUrls.floor || (await fileToDataUrl(files.floor)),
        shoes: cloudUrls.shoes || (await fileToDataUrl(files.shoes)),
        desk: cloudUrls.desk || (await fileToDataUrl(files.desk)),
      };
      const submittedAt = new Date().toISOString();
      const subId = `sub_${week}_${cleanCode}`;
      saveLiveRecord({
        submission_id: subId,
        room_code: cleanCode,
        week,
        submitted_at: submittedAt,
        area_images: areaImages,
        ai_result: analysis.aiResult,
        is_overridden: false,
        override_note: null,
      });
      return {
        success: true,
        data: {
          submission_id: subId,
          room_code: cleanCode,
          submitted_at: submittedAt,
          image_url: areaImages.bed,
          ai_result: analysis.aiResult,
        },
        message: "Nộp 4 ảnh thành công! AI đã phân tích xong.",
      };
    }

    throw new Error(
      "Không kết nối được tới Server AI (cổng 8000). Hãy bật Backend của bạn A trước!"
    );
  }
}

export type HistorySubmission = {
  submission_id: string;
  week: string;
  submitted_at: string;
  image_url: string;
  area_images: Record<AreaKey, string>;
  ai_result: AIResult;
  status: RoomStatus;
  score: number;
  is_overridden: boolean;
  override_note: string | null;
};

// ---- SINH VIÊN: Lịch sử ----  GET /rooms/{room_code}/history
export async function getRoomHistory(roomCode: string) {
  const cleanCode = roomCode.trim().toUpperCase();
  const week = `2026-W${CURRENT_WEEK}`;
  const live = loadLiveRecords()[`${week}_${cleanCode}`];

  const baseHistory: HistorySubmission[] = mockHistory.data.history
    .filter((h) => h.week !== week || !live)
    .map((h) => ({
      ...h,
      area_images: mockAreaImages(cleanCode),
      ai_result: buildMockAiResult(h.status || "Sạch", h.score),
    }));

  const history: HistorySubmission[] = live
    ? [
        {
          submission_id: live.submission_id,
          week: live.week,
          submitted_at: live.submitted_at,
          image_url: live.area_images.bed,
          area_images: live.area_images,
          ai_result: live.ai_result,
          status: live.ai_result.status,
          score: live.ai_result.score,
          is_overridden: live.is_overridden,
          override_note: live.override_note,
        },
        ...baseHistory,
      ]
    : baseHistory;

  return {
    success: true,
    data: {
      room_code: cleanCode,
      total_submissions: history.length,
      history,
    },
    message: "OK",
  };
}

// ---- CÁN BỘ: Dashboard tổng hợp 200 phòng theo tuần ----  GET /admin/dashboard
export async function getDashboard(week = `2026-W${CURRENT_WEEK}`) {
  try {
    const res = await api.get("/admin/dashboard", { params: { week } });
    if (res.data?.success && res.data?.data) {
      const d = res.data.data;
      if (!Array.isArray(d.top_violations)) {
        d.top_violations = [];
      }
      return res.data;
    }
  } catch {
    // Backend chưa bật hoặc offline -> tính toán cục bộ
  }

  const roomsRes = await getRooms({ week });
  const rooms = roomsRes.data.rooms;
  const total_rooms = rooms.length;
  const submittedRooms = rooms.filter((r) => r.status !== null);
  const submitted = submittedRooms.length;
  const not_submitted = total_rooms - submitted;
  const clean = rooms.filter((r) => r.status === "Sạch").length;
  const slightly_messy = rooms.filter((r) => r.status === "Hơi bừa bộn").length;
  const messy = rooms.filter((r) => r.status === "Bừa bộn").length;
  const avg_score = submitted
    ? Math.round((submittedRooms.reduce((s, r) => s + (r.score ?? 0), 0) / submitted) * 10) / 10
    : 0;
  const top_violations = rooms
    .filter((r) => r.status === "Bừa bộn" && r.score !== null)
    .sort((a, b) => (a.score ?? 10) - (b.score ?? 10))
    .slice(0, 6)
    .map((r) => ({ room_code: r.room_code, score: r.score!, status: "Bừa bộn" as const }));

  return {
    success: true,
    data: {
      week,
      summary: {
        total_rooms,
        submitted,
        not_submitted,
        submission_rate_percent: Math.round((submitted / total_rooms) * 1000) / 10,
      },
      breakdown: { clean, slightly_messy, messy },
      avg_score,
      deadline: "Chủ Nhật hàng tuần lúc 21:00",
      top_violations,
    },
  };
}

// ---- CÁN BỘ: Danh sách phòng (10 tầng / 200 phòng + cập nhật trực tiếp từ AI & CSDL) ----
export async function getRooms(params?: {
  week?: string;
  status?: string;
  building?: string;
  floor?: number;
}): Promise<{
  success: boolean;
  data: { rooms: Room[] };
}> {
  const week = params?.week ?? `2026-W${CURRENT_WEEK}`;
  const baseRooms = generateRooms(week);

  // 1. Thử gọi API Backend thật từ cổng 8000
  try {
    const res = await api.get("/admin/rooms", {
      params: { week, limit: 500 },
    });
    if (res.data?.success && Array.isArray(res.data.data?.rooms)) {
      const serverRoomsList = res.data.data.rooms;
      const serverMap = new Map<string, any>();
      for (const sr of serverRoomsList) {
        if (sr.room_code) {
          serverMap.set(sr.room_code.toUpperCase(), sr);
        }
      }

      // Hợp nhất các phòng nộp thật trên CSDL vào danh sách 200 phòng
      const merged = baseRooms.map((base) => {
        const sr = serverMap.get(base.room_code.toUpperCase());
        if (!sr) return base;
        const hasSub = sr.submission_id || (sr.status && sr.status !== "not_submitted" && sr.status !== "Chưa nộp ảnh");
        return {
          ...base,
          submission_id: sr.submission_id ?? base.submission_id,
          status: hasSub ? (sr.status as RoomStatus) : base.status,
          score: hasSub && sr.score != null ? Number(sr.score) : base.score,
          submitted_at: sr.submitted_at ?? base.submitted_at,
          image_url: sr.image_url ? resolveImageUrl(sr.image_url) : base.image_url,
          is_overridden: Boolean(sr.is_overridden),
        };
      });

      // Nếu có phòng mới trên server không nằm trong baseRooms
      serverMap.forEach((sr, code) => {
        if (!merged.some((m) => m.room_code.toUpperCase() === code)) {
          merged.push({
            submission_id: sr.submission_id ?? null,
            room_code: sr.room_code,
            building: sr.building || code[0] || "A",
            floor: Number(sr.floor) || 1,
            week: sr.week || week,
            status: (sr.status === "Chưa nộp ảnh" || sr.status === "not_submitted" ? null : sr.status) as RoomStatus,
            score: sr.score != null ? Number(sr.score) : null,
            submitted_at: sr.submitted_at ?? null,
            image_url: sr.image_url ? resolveImageUrl(sr.image_url) : null,
            is_overridden: Boolean(sr.is_overridden),
            members: 4,
          });
        }
      });

      return { success: true, data: { rooms: mergeRoomsWithLive(week, merged) } };
    }
  } catch {
    // Backend chưa bật hoặc offline -> dùng mock data
  }

  await wait(150);
  const rooms = mergeRoomsWithLive(week, baseRooms);
  return { success: true, data: { rooms } };
}

// ---- CÁN BỘ: Chi tiết 1 lượt nộp ----  GET /admin/submissions/{id}
export type SubmissionDetail = {
  submission_id: string;
  room_code: string;
  submitted_at: string;
  image_url: string;
  area_images: Record<AreaKey, string>;
  ai_result: AIResult;
  override: null | { new_status: string; new_score: number; note: string };
};

export async function getSubmissionDetail(
  submissionId: string
): Promise<{ success: boolean; data: SubmissionDetail | null }> {
  // 1. Thử gọi API Backend thật từ CSDL
  try {
    const res = await api.get(`/admin/submissions/${submissionId}`);
    if (res.data?.success && res.data?.data) {
      const d = res.data.data;
      const rawUrls: string[] = d.image_urls && d.image_urls.length ? d.image_urls : [d.image_url];
      const urls = rawUrls.map(resolveImageUrl);
      return {
        success: true,
        data: {
          submission_id: d.submission_id,
          room_code: d.room_code,
          submitted_at: d.submitted_at,
          image_url: resolveImageUrl(d.image_url),
          area_images: {
            bed: urls[0] || resolveImageUrl(d.image_url),
            floor: urls[1] || urls[0] || resolveImageUrl(d.image_url),
            shoes: urls[2] || urls[0] || resolveImageUrl(d.image_url),
            desk: urls[3] || urls[0] || resolveImageUrl(d.image_url),
          },
          ai_result: d.ai_result,
          override: d.override_info?.is_overridden
            ? {
                new_status: d.override_info.final_status,
                new_score: d.override_info.final_score,
                note: d.override_info.override_note ?? "",
              }
            : null,
        },
      };
    }
  } catch {
    // Tiếp tục kiểm tra live storage
  }

  // 2. Thử trong localStorage live records
  await wait(150);
  const allLive = Object.values(loadLiveRecords());
  const live = allLive.find((r) => r.submission_id === submissionId);
  if (live) {
    return {
      success: true,
      data: {
        submission_id: live.submission_id,
        room_code: live.room_code,
        submitted_at: live.submitted_at,
        image_url: live.area_images.bed,
        area_images: live.area_images,
        ai_result: live.ai_result,
        override: live.is_overridden
          ? {
              new_status: live.ai_result.status,
              new_score: live.ai_result.score,
              note: live.override_note ?? "",
            }
          : null,
      },
    };
  }

  // 3. Fallback mock data
  const parts = submissionId.split("_"); // sub_2026-W47_A1-101
  const week = parts.length >= 3 ? parts[1] : `2026-W${CURRENT_WEEK}`;
  const room = generateRooms(week).find((r) => r.submission_id === submissionId);
  if (!room || !room.status || room.score === null) return { success: false, data: null };
  return {
    success: true,
    data: {
      submission_id: submissionId,
      room_code: room.room_code,
      submitted_at: room.submitted_at!,
      image_url: room.image_url!,
      area_images: mockAreaImages(room.room_code),
      ai_result: buildMockAiResult(room.status, room.score),
      override: null,
    },
  };
}

// ---- CÁN BỘ: Duyệt đè ----  PATCH /admin/submissions/{id}/override
export async function overrideSubmission(
  submissionId: string,
  payload: { new_status: string; new_score: number; note: string }
) {
  try {
    await api.patch(`/admin/submissions/${submissionId}/override`, {
      status: payload.new_status,
      score: payload.new_score,
      override_note: payload.note,
    });
  } catch {
    // Không chặn nếu chạy offline
  }

  await wait(200);
  const parts = submissionId.split("_");
  const week = parts.length >= 3 ? parts[1] : `2026-W${CURRENT_WEEK}`;
  const roomCode = parts.length >= 3 ? parts.slice(2).join("_") : "";
  const all = loadLiveRecords();
  const key = `${week}_${roomCode}`;
  const existing = all[key];

  if (existing) {
    existing.ai_result = {
      ...existing.ai_result,
      status: payload.new_status as AIResult["status"],
      score: payload.new_score,
    };
    existing.is_overridden = true;
    existing.override_note = payload.note;
    saveLiveRecord(existing);
  } else if (roomCode) {
    const room = generateRooms(week).find((r) => r.room_code === roomCode);
    const baseAi = buildMockAiResult(
      payload.new_status as AIResult["status"],
      payload.new_score
    );
    saveLiveRecord({
      submission_id: submissionId,
      room_code: roomCode,
      week,
      submitted_at: room?.submitted_at ?? new Date().toISOString(),
      area_images: mockAreaImages(roomCode),
      ai_result: baseAi,
      is_overridden: true,
      override_note: payload.note,
    });
  }

  return { success: true, message: "Đã cập nhật kết quả duyệt lại thành công!" };
}
