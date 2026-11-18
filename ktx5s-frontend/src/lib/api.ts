import axios from "axios";
import { BASE_URL, USE_MOCK } from "./config";
import {
  mockSubmissionResult,
  mockHistory,
  generateRooms,
  buildMockAiResult,
  mockAreaImages,
  type AIResult,
} from "./mock-api";
import { CURRENT_WEEK, type AreaKey, type Room } from "@/components/status";

const api = axios.create({ baseURL: BASE_URL });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- SINH VIÊN: Nộp đủ 4 ảnh khu vực ----  POST /submissions
export async function submitPhotos(roomCode: string, files: Record<AreaKey, File>) {
  if (USE_MOCK) {
    await wait(2000); // giả lập AI chấm 2 giây
    return {
      ...mockSubmissionResult,
      data: {
        ...mockSubmissionResult.data,
        room_code: roomCode,
        submitted_at: new Date().toISOString(),
      },
    };
  }
  const form = new FormData();
  form.append("room_code", roomCode);
  form.append("image", files.bed); // tương thích trường chính trong API spec
  form.append("image_bed", files.bed);
  form.append("image_floor", files.floor);
  form.append("image_shoes", files.shoes);
  form.append("image_desk", files.desk);
  form.append("captured_at", new Date().toISOString());
  const res = await api.post("/submissions", form, { headers: { "Content-Type": "multipart/form-data" } });
  return res.data;
}

// ---- SINH VIÊN: Lịch sử ----  GET /rooms/{room_code}/history
export async function getRoomHistory(roomCode: string) {
  if (USE_MOCK) return { ...mockHistory, data: { ...mockHistory.data, room_code: roomCode } };
  const res = await api.get(`/rooms/${roomCode}/history`);
  return res.data;
}

// ---- CÁN BỘ: Dashboard tổng hợp 200 phòng theo tuần ----  GET /admin/dashboard
export async function getDashboard(week = `2026-W${CURRENT_WEEK}`) {
  if (USE_MOCK) {
    const rooms = generateRooms(week);
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
        deadline: "2026-11-22T21:00:00+07:00",
        top_violations,
      },
    };
  }
  const res = await api.get("/admin/dashboard", { params: { week } });
  return res.data;
}

// ---- CÁN BỘ: Danh sách phòng ----  GET /admin/rooms
export async function getRooms(params?: { week?: string; status?: string; building?: string; floor?: number }): Promise<{
  success: boolean;
  data: { rooms: Room[] };
}> {
  if (USE_MOCK) {
    await wait(250);
    return { success: true, data: { rooms: generateRooms(params?.week) } };
  }
  const res = await api.get("/admin/rooms", { params: { ...params, limit: 500 } });
  return res.data;
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

export async function getSubmissionDetail(submissionId: string): Promise<{ success: boolean; data: SubmissionDetail | null }> {
  if (USE_MOCK) {
    await wait(250);
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
  const res = await api.get(`/admin/submissions/${submissionId}`);
  return res.data;
}

// ---- CÁN BỘ: Duyệt đè ----  PATCH /admin/submissions/{id}/override
export async function overrideSubmission(submissionId: string, payload: { new_status: string; new_score: number; note: string }) {
  if (USE_MOCK) {
    await wait(400);
    return { success: true, message: "Đã cập nhật kết quả thành công." };
  }
  const res = await api.patch(`/admin/submissions/${submissionId}/override`, payload);
  return res.data;
}
