import axios, { AxiosError } from "axios";
import { BASE_URL, USE_MOCK } from "./config";
import {
  mockHistory,
  generateRooms,
  buildMockAiResult,
  mockAreaImages,
  type AIResult,
} from "./mock-api";
import { analyzeFourRoomPhotos, analyzeMultiSlotPhotos } from "./vision-analyzer";
import {
  CURRENT_WEEK,
  CURRENT_WEEK_STR,
  buildLocalCaptureSlots,
  getRoomMembersByCode,
  pickRandomChallenge,
  type AreaKey,
  type CaptureSlot,
  type Room,
  type RoomStatus,
} from "@/components/status";
import {
  uploadAllFourAreasToCloudinary,
  fetchCloudLiveRecords,
  pushCloudLiveRecords,
} from "./cloudinary";

const api = axios.create({ baseURL: BASE_URL });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BACKEND_ORIGIN = BASE_URL.replace(/\/api\/?$/, "");

function resolveImageUrl(url: string): string {
  if (!url) return "";
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  ) {
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

// Lưu các lượt nộp thật & duyệt đè trong trình duyệt + đồng bộ lên Cloudinary để mọi thiết bị (Điện thoại <-> Laptop) thấy ngay
export type SubmittedPhotoItem = {
  slot_code: string;
  slot_label: string;
  image_url: string;
  checklist_key?: string;
};

export type LiveRecord = {
  submission_id: string;
  room_code: string;
  week: string;
  submitted_at: string;
  area_images: Record<AreaKey, string>;
  photos?: SubmittedPhotoItem[];
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

function writeLocalLiveRecords(all: Record<string, LiveRecord>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LIVE_KEY, JSON.stringify(all));
  } catch {
    // ignore storage quota errors
  }
}

function normalizeAiResult(raw: any): AIResult {
  const c = raw?.checklist || {};
  return {
    status: raw?.status || "Sạch",
    score: typeof raw?.score === "number" ? raw.score : 8.5,
    is_valid_room_photo: raw?.is_valid_room_photo ?? true,
    checklist: {
      bed_tidy: Boolean(c.bed_tidy ?? c.giuong_gon ?? c.giuong_gon_gang ?? true),
      floor_clean: Boolean(c.floor_clean ?? c.san_sach ?? c.san_nha_sach_se ?? true),
      shoes_arranged: Boolean(c.shoes_arranged ?? c.ke_giay_ngan_nap ?? c.giay_dep_ngan_nap ?? true),
      desk_organized: Boolean(c.desk_organized ?? c.ban_hoc_gon ?? c.ban_hoc_gon_gang ?? true),
    },
    issues_detected: Array.isArray(raw?.issues_detected)
      ? raw.issues_detected
      : Array.isArray(raw?.detected_issues)
      ? raw.detected_issues
      : [],
    positive_notes: Array.isArray(raw?.positive_notes) ? raw.positive_notes : [],
    recommendations:
      raw?.recommendations ||
      "Cả 4 khu vực trong phòng đều rất gọn gàng, sạch sẽ. Hãy tiếp tục duy trì chuẩn 5S!",
  };
}

/**
 * Tải & hợp nhất dữ liệu nộp ảnh giữa LocalStorage của máy hiện tại và Cloudinary Cloud
 */
async function syncLiveRecordsFromCloud(): Promise<Record<string, LiveRecord>> {
  const local = loadLiveRecords();
  for (const k of Object.keys(local)) {
    if (local[k]?.ai_result) {
      local[k].ai_result = normalizeAiResult(local[k].ai_result);
    }
  }
  try {
    const remote = await fetchCloudLiveRecords<Record<string, LiveRecord>>();
    if (remote && typeof remote === "object") {
      const merged: Record<string, LiveRecord> = {};
      for (const [k, rec] of Object.entries(remote)) {
        if (rec && rec.room_code) {
          merged[k] = {
            ...rec,
            ai_result: normalizeAiResult(rec.ai_result),
          };
        }
      }
      for (const [key, localRec] of Object.entries(local)) {
        const remoteRec = merged[key];
        if (!remoteRec) {
          merged[key] = localRec;
        } else {
          const localTime = new Date(localRec.submitted_at || 0).getTime();
          const remoteTime = new Date(remoteRec.submitted_at || 0).getTime();
          if (localTime > remoteTime || (localRec.is_overridden && !remoteRec.is_overridden)) {
            merged[key] = localRec;
          }
        }
      }
      writeLocalLiveRecords(merged);
      return merged;
    }
  } catch {
    // fallback local
  }
  writeLocalLiveRecords(local);
  return local;
}

async function saveLiveRecord(rec: LiveRecord) {
  // 1. Ghi ngay lập tức vào localStorage (đồng bộ 0ms) để trang /student/history hiển thị đúng lượt vừa chấm mà không cần F5
  const localNow = loadLiveRecords();
  localNow[`${rec.week}_${rec.room_code}`] = rec;
  writeLocalLiveRecords(localNow);

  // 2. Hợp nhất với dữ liệu các phòng khác trên Cloudinary và đẩy lên Cloud
  try {
    const current = await syncLiveRecordsFromCloud();
    current[`${rec.week}_${rec.room_code}`] = rec;
    writeLocalLiveRecords(current);
    await pushCloudLiveRecords(current);
  } catch {
    await pushCloudLiveRecords(localNow);
  }
}

function mergeRoomsWithLive(
  week: string,
  baseRooms: Room[],
  liveRecords?: Record<string, LiveRecord>
): Room[] {
  const all = liveRecords ?? loadLiveRecords();
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

// ---- SINH VIÊN: Nộp đủ 4 ảnh khu vực -> Gọi thẳng API AI của Sinh viên A hoặc chấm trên trình duyệt + đồng bộ Cloudinary ----
export async function submitPhotos(roomCode: string, files: Record<AreaKey, File>) {
  const cleanCode = roomCode.trim().toUpperCase();
  const week = CURRENT_WEEK_STR;

  const form = new FormData();
  form.append("room_code", cleanCode);
  form.append("captured_at", new Date().toISOString());
  form.append("image", files.bed);
  form.append("image", files.floor);
  form.append("image", files.shoes);
  form.append("image", files.desk);

  try {
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
      await saveLiveRecord({
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
    if (axErr.response?.data) {
      const msg =
        axErr.response.data.message ||
        axErr.response.data.detail ||
        "AI không thể phân tích bộ ảnh này. Vui lòng chụp lại.";
      throw new Error(msg);
    }

    if (USE_MOCK) {
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
      await saveLiveRecord({
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
        message: "Nộp 4 ảnh thành công! AI đã phân tích và đồng bộ lên Cloud.",
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
  photos?: SubmittedPhotoItem[];
  ai_result: AIResult;
  status: RoomStatus;
  score: number;
  is_overridden: boolean;
  override_note: string | null;
};

function buildMockPhotosForRoom(roomCode: string): SubmittedPhotoItem[] {
  const cap = getRoomMembersByCode(roomCode);
  const slots = buildLocalCaptureSlots(cap);
  return slots.map((s) => ({
    slot_code: s.slot_code,
    slot_label: s.slot_label,
    checklist_key: s.checklist_key,
    image_url: `https://placehold.co/800x600/e2e8f0/64748b?text=${encodeURIComponent(
      `${s.slot_label} (${roomCode})`
    )}`,
  }));
}

// ---- SINH VIÊN: Lịch sử ----  GET /rooms/{room_code}/history
export async function getRoomHistory(roomCode: string) {
  const cleanCode = roomCode.trim().toUpperCase();
  const week = CURRENT_WEEK_STR;
  const allLive = await syncLiveRecordsFromCloud();
  const live = allLive[`${week}_${cleanCode}`];

  const baseHistory: HistorySubmission[] = mockHistory.data.history
    .filter((h) => h.week !== week || !live)
    .map((h) => ({
      ...h,
      area_images: mockAreaImages(cleanCode),
      photos: buildMockPhotosForRoom(cleanCode),
      ai_result: buildMockAiResult(h.status || "Sạch", h.score),
    }));

  const history: HistorySubmission[] = live
    ? [
      {
        submission_id: live.submission_id,
        week: live.week,
        submitted_at: live.submitted_at,
        image_url: live.photos?.[0]?.image_url || live.area_images.bed,
        area_images: live.area_images,
        photos: live.photos,
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
export async function getDashboard(week = CURRENT_WEEK_STR) {
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
    // Backend chưa bật hoặc offline -> tính toán từ dữ liệu phòng + Cloudinary sync
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

// ---- CÁN BỘ: Danh sách phòng (10 tầng / 200 phòng + cập nhật trực tiếp từ AI, CSDL & Cloudinary) ----
export async function getRooms(params?: {
  week?: string;
  status?: string;
  building?: string;
  floor?: number;
}): Promise<{
  success: boolean;
  data: { rooms: Room[] };
}> {
  const week = params?.week ?? CURRENT_WEEK_STR;
  const baseRooms = generateRooms(week);
  const liveRecordsPromise = syncLiveRecordsFromCloud();

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

      const merged = baseRooms.map((base) => {
        const sr = serverMap.get(base.room_code.toUpperCase());
        if (!sr) return base;
        const hasSub =
          sr.submission_id ||
          (sr.status && sr.status !== "not_submitted" && sr.status !== "Chưa nộp ảnh");
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

      serverMap.forEach((sr, code) => {
        if (!merged.some((m) => m.room_code.toUpperCase() === code)) {
          merged.push({
            submission_id: sr.submission_id ?? null,
            room_code: sr.room_code,
            building: sr.building || code[0] || "A",
            floor: Number(sr.floor) || 1,
            week: sr.week || week,
            status: (
              sr.status === "Chưa nộp ảnh" || sr.status === "not_submitted" ? null : sr.status
            ) as RoomStatus,
            score: sr.score != null ? Number(sr.score) : null,
            submitted_at: sr.submitted_at ?? null,
            image_url: sr.image_url ? resolveImageUrl(sr.image_url) : null,
            is_overridden: Boolean(sr.is_overridden),
            members: 4,
          });
        }
      });

      const liveRecords = await liveRecordsPromise;
      return { success: true, data: { rooms: mergeRoomsWithLive(week, merged, liveRecords) } };
    }
  } catch {
    // Backend chưa bật hoặc offline -> dùng dữ liệu đồng bộ từ Cloudinary + mock data
  }

  const liveRecords = await liveRecordsPromise;
  const rooms = mergeRoomsWithLive(week, baseRooms, liveRecords);
  return { success: true, data: { rooms } };
}

// ---- CÁN BỘ: Chi tiết 1 lượt nộp ----  GET /admin/submissions/{id}
export type SubmissionDetail = {
  submission_id: string;
  room_code: string;
  submitted_at: string;
  image_url: string;
  area_images: Record<AreaKey, string>;
  photos?: SubmittedPhotoItem[];
  ai_result: AIResult;
  override: null | { new_status: string; new_score: number; note: string };
};

export async function getSubmissionDetail(
  submissionId: string
): Promise<{ success: boolean; data: SubmissionDetail | null }> {
  // 1. Đồng bộ từ Cloudinary + localStorage live records trước (đảm bảo hiển thị điểm đã hiệu chỉnh/duyệt mới nhất)
  const allLiveMap = await syncLiveRecordsFromCloud();
  const allLive = Object.values(allLiveMap);
  const live = allLive.find((r) => r.submission_id === submissionId);

  // 2. Thử gọi API Backend thật từ CSDL
  try {
    const res = await api.get(`/admin/submissions/${submissionId}`, { timeout: 3500 });
    if (res.data?.success && res.data?.data) {
      const d = res.data.data;
      const rawUrls: string[] = d.image_urls && d.image_urls.length ? d.image_urls : [d.image_url];
      const urls = rawUrls.map(resolveImageUrl);
      const serverPhotos: SubmittedPhotoItem[] = Array.isArray(d.photos) && d.photos.length
        ? d.photos.map((p: any, idx: number) => ({
            slot_code: p.slot_code || `PHOTO_${idx + 1}`,
            slot_label: p.slot_label || `Ảnh ${idx + 1}`,
            image_url: resolveImageUrl(p.image_url || urls[idx] || d.image_url),
          }))
        : urls.map((u, idx) => ({
            slot_code: `PHOTO_${idx + 1}`,
            slot_label: `Ảnh ${idx + 1}`,
            image_url: u,
          }));

      // Nếu Cloudinary live record đã có điểm 5S khắt khe đã hiệu chỉnh (hoặc duyệt đè), ưu tiên kết quả thực tế đó
      const effectiveAiResult =
        live && (live.is_overridden || (d.ai_result?.score >= 8.5 && live.ai_result.score < d.ai_result.score))
          ? live.ai_result
          : d.ai_result;

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
          photos: serverPhotos,
          ai_result: effectiveAiResult,
          override: d.override_info?.is_overridden
            ? {
              new_status: d.override_info.final_status,
              new_score: d.override_info.final_score,
              note: d.override_info.override_note ?? "",
            }
            : live?.is_overridden
            ? {
              new_status: live.ai_result.status,
              new_score: live.ai_result.score,
              note: live.override_note ?? "",
            }
            : null,
        },
      };
    }
  } catch {
    // Tiếp tục kiểm tra Cloudinary & localStorage
  }

  if (live) {
    return {
      success: true,
      data: {
        submission_id: live.submission_id,
        room_code: live.room_code,
        submitted_at: live.submitted_at,
        image_url: live.photos?.[0]?.image_url || live.area_images.bed,
        area_images: live.area_images,
        photos: live.photos,
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
  const parts = submissionId.split("_");
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
      photos: buildMockPhotosForRoom(room.room_code),
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

  const parts = submissionId.split("_");
  const week = parts.length >= 3 ? parts[1] : `2026-W${CURRENT_WEEK}`;
  const roomCode = parts.length >= 3 ? parts.slice(2).join("_") : "";
  const all = await syncLiveRecordsFromCloud();
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
    await saveLiveRecord(existing);
  } else if (roomCode) {
    const room = generateRooms(week).find((r) => r.room_code === roomCode);
    const baseAi = buildMockAiResult(
      payload.new_status as AIResult["status"],
      payload.new_score
    );
    await saveLiveRecord({
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

  return { success: true, message: "Đã cập nhật kết quả duyệt lại và đồng bộ lên Cloud!" };
}

// ============================================================================
// PHIÊN CHỤP 7 LỚP CHỐNG GIAN LẬN (GIƯỜNG TẦNG + 4 KHU VỰC CHUNG)
// ============================================================================
export type CaptureSessionInfo = {
  session_id: string;
  room_code: string;
  week: string;
  bed_count: number;
  common_count: number;
  total_required: number;
  total_with_challenge: number;
  qr_verified: boolean;
  audit_required: boolean;
  challenge_prompt: string;
  server_timestamp: string;
  expires_at: string;
  slots: CaptureSlot[];
  is_offline_fallback?: boolean;
};

export type SessionPhotoCheckResult = {
  success: boolean;
  data: {
    slot_code: string;
    slot_label: string;
    image_url: string;
    width: number;
    height: number;
    brightness: number;
    blur_score: number;
    validation_status: string;
    issues: string[];
  };
  message: string;
};

export async function startCaptureSession(
  roomCode: string,
  bedCount?: number,
  qrCode?: string
): Promise<CaptureSessionInfo> {
  const cleanCode = roomCode.trim().toUpperCase();
  const autoBedCount = bedCount || getRoomMembersByCode(cleanCode);
  try {
    const res = await api.post("/capture-sessions/start", {
      room_code: cleanCode,
      bed_count: autoBedCount,
      qr_code: qrCode?.trim() || undefined,
    });
    if (res.data?.success && res.data?.data) {
      const serverData = res.data.data as CaptureSessionInfo;
      const filteredSlots = (serverData.slots || []).filter(
        (s) => s.slot_group !== "challenge" && s.slot_code !== "CH01"
      );
      return {
        ...serverData,
        bed_count: autoBedCount,
        total_required: filteredSlots.length,
        total_with_challenge: filteredSlots.length,
        slots: filteredSlots,
      };
    }
    throw new Error(res.data?.message || "Không thể khởi tạo phiên chụp.");
  } catch (err) {
    const axErr = err as AxiosError<{ message?: string; detail?: string }>;
    if (axErr.response?.status === 403 || axErr.response?.status === 400) {
      throw new Error(
        axErr.response.data?.message ||
          axErr.response.data?.detail ||
          "Xác thực phòng không hợp lệ."
      );
    }
    if (!USE_MOCK) {
      throw new Error(
        axErr.response?.data?.message || "Không thể kết nối máy chủ để khởi tạo phiên chụp."
      );
    }
    const slots = buildLocalCaptureSlots(autoBedCount);
    const now = new Date();
    return {
      session_id: `local_${cleanCode}_${Date.now()}`,
      room_code: cleanCode,
      week: CURRENT_WEEK_STR,
      bed_count: autoBedCount,
      common_count: 3,
      total_required: slots.length,
      total_with_challenge: slots.length,
      qr_verified: true,
      audit_required: false,
      challenge_prompt: "",
      server_timestamp: now.toISOString(),
      expires_at: new Date(now.getTime() + 30 * 60000).toISOString(),
      slots,
      is_offline_fallback: true,
    };
  }
}

export async function uploadSessionPhoto(
  sessionId: string,
  slotCode: string,
  file: File,
  isOfflineFallback = false,
  captureSource: "camera" | "desktop_test" = "camera"
): Promise<SessionPhotoCheckResult> {
  if (isOfflineFallback) {
    return {
      success: true,
      data: {
        slot_code: slotCode,
        slot_label: slotCode,
        image_url: await fileToDataUrl(file),
        width: 1280,
        height: 720,
        brightness: 140,
        blur_score: 20,
        validation_status: "passed",
        issues: [],
      },
      message: "Ảnh đạt chuẩn chất lượng.",
    };
  }
  const form = new FormData();
  form.append("slot_code", slotCode);
  form.append("captured_via_camera", "true");
  form.append("capture_source", captureSource);
  form.append("image", file);
  const res = await api.post(`/capture-sessions/${sessionId}/photos`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data as SessionPhotoCheckResult;
}

export async function submitCaptureSession(
  session: CaptureSessionInfo,
  captures: Record<string, { file: File; preview: string }>
) {
  const orderedSlots = session.slots.filter((s) => Boolean(captures[s.slot_code]?.file));
  const filesMap: Record<string, File> = {};
  for (const s of orderedSlots) {
    filesMap[s.slot_code] = captures[s.slot_code].file;
  }

  // Luôn chạy song song bộ phân tích hình ảnh 5S khắt khe (< 250ms) + Upload Cloudinary để:
  // 1) Đảm bảo tổng thời gian trả kết quả AI luôn dưới 5 - 6 giây (< 7s) kể cả khi Render Backend bị trễ/cold-start
  // 2) Chặn triệt để lỗi AI chấm nới tay 10.0/10 cho phòng thực tế còn quần áo trên giường, chăn màn chưa gấp, tô chén trên bàn hoặc dép vứt dưới sàn.
  const localAnalysisPromise = analyzeMultiSlotPhotos(
    orderedSlots.map((s) => ({
      slot_code: s.slot_code,
      slot_label: s.slot_label,
      checklist_key: s.checklist_key,
      file: captures[s.slot_code].file,
    }))
  );
  const cloudUploadPromise = uploadAllFourAreasToCloudinary(filesMap, session.room_code);

  // Hàm đối chiếu chéo kết quả từ Server với bộ kiểm định quang học thực tế:
  const calibrateStrictAiResult = (serverAi: AIResult, strictLocalAi: AIResult): AIResult => {
    if (!serverAi || !serverAi.is_valid_room_photo) return serverAi;
    // Chỉ hiệu chỉnh khi Server chấm quá cao (>= 9.0) nhưng thực tế có từ 2 khu vực bừa bộn rõ rệt trở lên (điểm thực tế <= 7.8):
    if (serverAi.score >= 9.0 && strictLocalAi.score <= 7.8 && strictLocalAi.issues_detected.length >= 2) {
      return strictLocalAi;
    }
    if (serverAi.score - strictLocalAi.score > 1.8 && strictLocalAi.issues_detected.length >= 2) {
      return strictLocalAi;
    }
    return serverAi;
  };

  // Sử dụng trực tiếp endpoint /ai/evaluate (nhận đúng danh sách ảnh giường tầng + 3 khu vực chung, không yêu cầu CH01)
  const form = new FormData();
  form.append("room_code", session.room_code);
  form.append("captured_at", new Date().toISOString());
  form.append("bed_count", String(session.bed_count));
  form.append("slot_codes", JSON.stringify(orderedSlots.map((s) => s.slot_code)));
  form.append("slot_labels", JSON.stringify(orderedSlots.map((s) => s.slot_label)));
  for (const s of orderedSlots) {
    form.append("image", captures[s.slot_code].file);
  }

  try {
    const res = await api.post("/ai/evaluate", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 5800,
    });
    const payload = res.data;
    if (payload?.success && payload?.data) {
      const strictLocal = await localAnalysisPromise;
      payload.data.ai_result = calibrateStrictAiResult(payload.data.ai_result, strictLocal.aiResult);

      const urls: string[] = (payload.data.image_urls ?? []).map(resolveImageUrl);
      const serverPhotos = (payload.data.photos ?? []) as Array<{
        slot_code: string;
        slot_label: string;
        image_url: string;
      }>;
      const savedPhotos: SubmittedPhotoItem[] = await Promise.all(
        orderedSlots.map(async (s, idx) => ({
          slot_code: s.slot_code,
          slot_label: s.slot_label,
          checklist_key: s.checklist_key,
          image_url:
            (serverPhotos[idx]?.image_url ? resolveImageUrl(serverPhotos[idx].image_url) : "") ||
            urls[idx] ||
            (await fileToDataUrl(captures[s.slot_code].file)),
        }))
      );
      const byCode = new Map(savedPhotos.map((p) => [p.slot_code, p.image_url]));
      void saveLiveRecord({
        submission_id: payload.data.submission_id || `sub_${session.week}_${session.room_code}`,
        room_code: session.room_code,
        week: session.week,
        submitted_at: payload.data.submitted_at || new Date().toISOString(),
        area_images: {
          bed: byCode.get("B01") || savedPhotos[0]?.image_url || "",
          floor: byCode.get("C02_FLOOR") || savedPhotos[1]?.image_url || "",
          desk: byCode.get("C03_DESK") || savedPhotos[2]?.image_url || "",
          shoes: byCode.get("C04_SHOES") || savedPhotos[3]?.image_url || "",
        },
        photos: savedPhotos,
        ai_result: payload.data.ai_result,
        is_overridden: false,
        override_note: null,
      });
    }
    return payload;
  } catch (err) {
    const axErr = err as AxiosError<{ message?: string; detail?: string }>;
    if (axErr.response?.data && axErr.response.status && axErr.response.status >= 400 && axErr.response.status < 500) {
      throw new Error(
        axErr.response.data.message ||
          axErr.response.data.detail ||
          "AI không thể phân tích bộ ảnh này. Vui lòng chụp lại."
      );
    }
    // Phản hồi tức thì dưới 4 giây bằng bộ chấm 5S + Cloudinary
    const [cloudUrls, analysis] = await Promise.all([
      Promise.race([
        cloudUploadPromise,
        new Promise<Record<string, string>>((r) => setTimeout(() => r({}), 3800)),
      ]),
      localAnalysisPromise,
    ]);

    if (!analysis.isValid) {
      throw new Error(
        analysis.invalidMessage || "Bộ ảnh chưa hợp lệ hoặc có ảnh trùng lặp. Vui lòng kiểm tra và chụp lại!"
      );
    }

    const savedPhotos: SubmittedPhotoItem[] = await Promise.all(
      orderedSlots.map(async (s) => ({
        slot_code: s.slot_code,
        slot_label: s.slot_label,
        checklist_key: s.checklist_key,
        image_url:
          cloudUrls[s.slot_code] || (await fileToDataUrl(captures[s.slot_code].file)),
      }))
    );
    const byCode = new Map(savedPhotos.map((p) => [p.slot_code, p.image_url]));
    const submittedAt = new Date().toISOString();
    const subId = `sub_${session.week}_${session.room_code}`;

    void saveLiveRecord({
      submission_id: subId,
      room_code: session.room_code,
      week: session.week,
      submitted_at: submittedAt,
      area_images: {
        bed: byCode.get("B01") || savedPhotos[0]?.image_url || "",
        floor: byCode.get("C02_FLOOR") || savedPhotos[1]?.image_url || "",
        desk: byCode.get("C03_DESK") || savedPhotos[2]?.image_url || "",
        shoes: byCode.get("C04_SHOES") || savedPhotos[3]?.image_url || "",
      },
      photos: savedPhotos,
      ai_result: analysis.aiResult,
      is_overridden: false,
      override_note: null,
    });

    return {
      success: true,
      data: {
        submission_id: subId,
        room_code: session.room_code,
        submitted_at: submittedAt,
        image_url: savedPhotos[0]?.image_url || "",
        photos: savedPhotos,
        ai_result: analysis.aiResult,
      },
      message: `Nộp đủ ${savedPhotos.length} ảnh thành công! AI đã chấm điểm và đồng bộ lên Cloud.`,
    };
  }
}
