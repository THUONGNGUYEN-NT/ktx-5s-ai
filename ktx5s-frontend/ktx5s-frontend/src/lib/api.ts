import axios from "axios";
import { BASE_URL, USE_MOCK } from "./config";
import {
  mockSubmissionResult,
  mockHistory,
  mockDashboard,
  mockRooms,
} from "./mock-api";

const api = axios.create({ baseURL: BASE_URL });

// ---- SINH VIÊN: Nộp ảnh ----
export async function submitPhoto(roomCode: string, imageFile: File) {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 2000)); // giả lập chờ AI 2s
    return mockSubmissionResult;
  }
  const form = new FormData();
  form.append("room_code", roomCode);
  form.append("image", imageFile);
  form.append("captured_at", new Date().toISOString());
  const res = await api.post("/submissions", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

// ---- SINH VIÊN: Xem lịch sử ----
export async function getRoomHistory(roomCode: string) {
  if (USE_MOCK) return mockHistory;
  const res = await api.get(`/rooms/${roomCode}/history`);
  return res.data;
}

// ---- CÁN BỘ: Dashboard ----
export async function getDashboard(week?: string) {
  if (USE_MOCK) return mockDashboard;
  const res = await api.get("/admin/dashboard", { params: { week } });
  return res.data;
}

// ---- CÁN BỘ: Danh sách phòng ----
export async function getRooms(params?: {
  week?: string;
  status?: string;
  building?: string;
  floor?: number;
  page?: number;
  limit?: number;
}) {
  if (USE_MOCK) return mockRooms;
  const res = await api.get("/admin/rooms", { params });
  return res.data;
}

// ---- CÁN BỘ: Duyệt đè kết quả ----
export async function overrideSubmission(
  submissionId: string,
  payload: { new_status: string; new_score: number; note: string }
) {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 500));
    return { success: true, message: "Đã cập nhật kết quả thành công." };
  }
  const res = await api.patch(
    `/admin/submissions/${submissionId}/override`,
    payload
  );
  return res.data;
}
