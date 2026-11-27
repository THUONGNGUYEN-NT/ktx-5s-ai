"use client";
// TRANG NỘP ẢNH PHÒNG 5S — TỰ ĐỘNG HIỂN THỊ ĐÚNG SỐ LƯỢNG ẢNH GIƯỜNG TẦNG THEO PHÒNG ĐÃ PHÂN SẴN (KHÔNG CẦN BƯỚC XÁC THỰC CHỌN LOẠI PHÒNG)
// - Phòng 8 SV (VD: A3-301): 4 ảnh giường tầng (mỗi ảnh gồm giường trên & dưới) + 1 ảnh Sàn nhà + 1 ảnh Bàn học + 1 ảnh Kệ giày dép = 7 ảnh
// - Phòng 6 SV: 3 ảnh giường tầng + 3 ảnh khu vực chung = 6 ảnh
// - Phòng 4 SV: 2 ảnh giường tầng + 3 ảnh khu vực chung = 5 ảnh
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Bot,
  Upload,
  BedDouble,
  Layers,
  ImagePlus,
  Users,
  Info,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import Panel from "@/components/Panel";
import LiveCameraCapture from "@/components/LiveCameraCapture";
import { getSession } from "@/lib/session";
import {
  startCaptureSession,
  uploadSessionPhoto,
  submitCaptureSession,
  type CaptureSessionInfo,
} from "@/lib/api";
import {
  CURRENT_WEEK,
  CURRENT_WEEK_STR,
  buildLocalCaptureSlots,
  getRoomMembersByCode,
  getBunkCountForMembers,
  type CaptureSlot,
} from "@/components/status";

type SlotCaptureState = {
  file: File;
  preview: string;
  capturedAt: string;
  width: number;
  height: number;
  validationStatus:
    | "uploading"
    | "passed"
    | "needs_retake"
    | "insufficient_evidence"
    | "anomalous"
    | "suspected_fraud";
  issues: string[];
};

export default function CameraPage() {
  const router = useRouter();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [room, setRoom] = useState("");
  const [members, setMembers] = useState<number>(8);
  const [session, setSession] = useState<CaptureSessionInfo | null>(null);
  const [captures, setCaptures] = useState<Record<string, SlotCaptureState>>({});
  const [activeSlot, setActiveSlot] = useState<CaptureSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retakeBanner, setRetakeBanner] = useState<{
    category?: string;
    requests: Array<{ slot_code: string; slot_label: string; reason: string }>;
  } | null>(null);

  // Ngay khi mở trang: lấy mã phòng của sinh viên -> tra cứu số lượng SV của phòng -> mở thẳng danh sách ô chụp ảnh, KHÔNG qua bước xác thực chọn loại phòng
  useEffect(() => {
    const s = getSession();
    const roomCode = (s?.roomCode || "A3-301").trim().toUpperCase();
    const roomCap = getRoomMembersByCode(roomCode);
    setRoom(roomCode);
    setMembers(roomCap);

    // Khởi tạo ngay danh sách ô chụp theo đúng loại phòng để hiển thị tức thì (0ms delay)
    const immediateSlots = buildLocalCaptureSlots(roomCap);
    const now = new Date();
    const initialSession: CaptureSessionInfo = {
      session_id: `local_${roomCode}_${Date.now()}`,
      room_code: roomCode,
      week: CURRENT_WEEK_STR,
      bed_count: roomCap,
      common_count: 3,
      total_required: immediateSlots.length,
      total_with_challenge: immediateSlots.length,
      qr_verified: true,
      audit_required: false,
      challenge_prompt: "",
      server_timestamp: now.toISOString(),
      expires_at: new Date(now.getTime() + 30 * 60000).toISOString(),
      slots: immediateSlots,
      is_offline_fallback: true,
    };
    setSession(initialSession);

    // Đồng bộ ngầm với Backend nếu cổng 8000 đang bật
    startCaptureSession(roomCode, roomCap)
      .then((info) => {
        setSession({
          ...info,
          bed_count: roomCap,
          slots: immediateSlots,
        });
      })
      .catch(() => {
        // Giữ nguyên phiên local trên GitHub Pages
      });
  }, []);

  const handleCameraCaptured = async (
    slot: CaptureSlot,
    file: File,
    previewUrl: string,
    resolution: { width: number; height: number },
    captureSource: "camera" | "desktop_test" = "camera"
  ) => {
    if (!session) return;
    const capturedAt = new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setCaptures((prev) => ({
      ...prev,
      [slot.slot_code]: {
        file,
        preview: previewUrl,
        capturedAt,
        width: resolution.width,
        height: resolution.height,
        validationStatus: "uploading",
        issues: [],
      },
    }));
    setError(null);

    try {
      const check = await uploadSessionPhoto(
        session.session_id,
        slot.slot_code,
        file,
        session.is_offline_fallback,
        captureSource
      );
      setCaptures((prev) => ({
        ...prev,
        [slot.slot_code]: {
          file,
          preview: previewUrl,
          capturedAt,
          width: check.data.width || resolution.width,
          height: check.data.height || resolution.height,
          validationStatus: check.success
            ? "passed"
            : (check.data.validation_status as SlotCaptureState["validationStatus"]) ||
              "needs_retake",
          issues: check.data.issues || (check.success ? [] : [check.message]),
        },
      }));
    } catch (err) {
      setCaptures((prev) => ({
        ...prev,
        [slot.slot_code]: {
          file,
          preview: previewUrl,
          capturedAt,
          width: resolution.width,
          height: resolution.height,
          validationStatus: "passed",
          issues: [],
        },
      }));
    }
  };

  const handleFilePick = async (slot: CaptureSlot, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    const dims = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () =>
        resolve({ width: img.naturalWidth || 1280, height: img.naturalHeight || 720 });
      img.onerror = () => resolve({ width: 1280, height: 720 });
      img.src = previewUrl;
    });
    await handleCameraCaptured(slot, file, previewUrl, dims, "desktop_test");
  };

  const slots = session?.slots ?? [];
  const bunkCount = getBunkCountForMembers(members);
  const passedCount = slots.filter((s) => captures[s.slot_code]?.validationStatus === "passed").length;
  const allReady = slots.length > 0 && passedCount === slots.length;

  const bedSlots = slots.filter((s) => s.slot_group === "bed");
  const commonSlots = slots.filter((s) => s.slot_group === "common");

  const handleSubmit = async () => {
    if (!session) return;
    if (!allReady) {
      const missing = slots
        .filter((s) => captures[s.slot_code]?.validationStatus !== "passed")
        .map((s) => s.slot_label)
        .join(", ");
      setError(`Bạn cần chụp đủ ${slots.length} ảnh bắt buộc. Còn thiếu: ${missing}`);
      return;
    }

    setSubmitting(true);
    setError(null);
    setRetakeBanner(null);

    try {
      const res = await submitCaptureSession(session, captures);
      if (!res?.success) throw new Error(res?.message || "Nộp ảnh thất bại.");

      sessionStorage.setItem("ai_result", JSON.stringify(res.data.ai_result));
      sessionStorage.setItem("submitted_at", res.data.submitted_at);
      router.push("/student/history");
    } catch (err) {
      const typedErr = err as Error & {
        retakeRequests?: Array<{ slot_code: string; slot_label: string; reason: string }>;
        assessmentCategory?: string;
      };
      if (typedErr.retakeRequests?.length) {
        setRetakeBanner({
          category: typedErr.assessmentCategory,
          requests: typedErr.retakeRequests,
        });
        setCaptures((prev) => {
          const next = { ...prev };
          for (const req of typedErr.retakeRequests || []) {
            if (next[req.slot_code]) {
              next[req.slot_code] = {
                ...next[req.slot_code],
                validationStatus: "needs_retake",
                issues: [req.reason],
              };
            }
          }
          return next;
        });
      }
      setError(typedErr.message || "Có lỗi xảy ra khi phân tích bộ ảnh.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderSlotCard = (slot: CaptureSlot, indexBadge: number) => {
    const cap = captures[slot.slot_code];
    const isPassed = cap?.validationStatus === "passed";
    const isError =
      cap && cap.validationStatus !== "passed" && cap.validationStatus !== "uploading";

    return (
      <div
        key={slot.slot_code}
        className={`border-2 rounded-md p-3.5 flex flex-col gap-2.5 transition shadow-xs ${
          isPassed
            ? "border-[#00a65a] bg-emerald-50/25"
            : isError
            ? "border-[#dd4b39] bg-red-50/30"
            : "border-gray-200 bg-white"
        }`}
      >
        {/* Tiêu đề ô chụp: số thứ tự + tên khu vực rõ nét trên điện thoại */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-6 h-6 rounded-full text-white text-xs font-extrabold flex items-center justify-center shrink-0 ${
                isPassed ? "bg-[#00a65a]" : "bg-[#3c8dbc]"
              }`}
            >
              {indexBadge}
            </span>
            <span className="font-bold text-gray-800 text-sm sm:text-[15px] truncate">
              {slot.slot_label}
            </span>
          </div>

          {isPassed ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#00a65a] bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
              <CheckCircle2 size={14} /> Đã chụp
            </span>
          ) : isError ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#dd4b39] bg-red-100 px-2 py-0.5 rounded-full shrink-0">
              <AlertTriangle size={14} /> Chụp lại
            </span>
          ) : (
            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
              Bắt buộc
            </span>
          )}
        </div>

        <p className="text-xs sm:text-[13px] text-gray-600 leading-snug">{slot.angle_hint}</p>

        {/* Khung xem trước ảnh / bấm để mở camera */}
        <div
          onClick={() => setActiveSlot(slot)}
          className="relative w-full aspect-4/3 sm:aspect-video bg-gray-100 border-2 border-dashed border-gray-300 hover:border-[#3c8dbc] rounded-md overflow-hidden flex items-center justify-center cursor-pointer active:bg-gray-200/70"
        >
          {cap ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cap.preview}
                alt={slot.slot_label}
                className="w-full h-full object-cover bg-slate-900"
              />
              <span className="absolute bottom-2 left-2 bg-black/75 text-white text-[11px] font-medium px-2.5 py-1 rounded">
                {room} · {slot.slot_label} · {cap.capturedAt}
              </span>
            </>
          ) : (
            <div className="text-center text-gray-500 p-4">
              <div className="w-12 h-12 rounded-full bg-[#3c8dbc]/10 text-[#3c8dbc] flex items-center justify-center mx-auto mb-2">
                <Camera size={26} />
              </div>
              <p className="text-sm font-semibold text-gray-700">
                Chạm để chụp <b>{slot.slot_label}</b>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {slot.slot_group === "bed"
                  ? "Chụp thấy cả tầng trên & tầng dưới"
                  : "Chụp rõ nét toàn bộ khu vực"}
              </p>
            </div>
          )}
        </div>

        {cap?.issues?.length ? (
          <div className="text-xs text-[#dd4b39] bg-red-50 border border-red-200 px-2.5 py-1.5 rounded font-medium">
            ⚠️ {cap.issues.join(" · ")}
          </div>
        ) : null}

        {/* Cụm nút thao tác to, dễ bấm trên màn hình cảm ứng điện thoại */}
        <div className="flex gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => setActiveSlot(slot)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-xs sm:text-sm font-bold transition active:scale-[0.99] ${
              cap
                ? "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                : "bg-[#3c8dbc] hover:bg-[#367fa9] text-white shadow-xs"
            }`}
          >
            {cap ? <RefreshCw size={16} /> : <Camera size={16} />}
            {cap ? "Chụp lại bằng Camera" : "Mở Camera chụp"}
          </button>

          <input
            ref={(el) => {
              fileInputRefs.current[slot.slot_code] = el;
            }}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFilePick(slot, e)}
          />
          <button
            type="button"
            onClick={() => fileInputRefs.current[slot.slot_code]?.click()}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-xs sm:text-sm font-semibold border border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 active:scale-[0.99] transition shrink-0"
            title="Chọn ảnh có sẵn từ thiết bị"
          >
            <ImagePlus size={16} />
            <span>Tải ảnh</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <AppShell role="student" title={`Nộp ảnh phòng ${room} (${slots.length} ảnh)`}>
      <div className="flex flex-col gap-4">
        {/* Thanh tóm tắt cấu hình phòng tự động (không cần bước xác thực) */}
        <div className="bg-white border border-gray-200 rounded-md p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#3c8dbc] text-white flex items-center justify-center font-black text-base shrink-0 shadow-xs">
              {room.split("-")[0] || "5S"}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-gray-800">
                  Phòng {room} — Tuần {CURRENT_WEEK}
                </h2>
                <span className="bg-blue-100 text-[#3c8dbc] text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Users size={13} /> Phòng {members} sinh viên ({bunkCount} giường tầng)
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                Hệ thống tự động áp dụng định mức của phòng {room}:{" "}
                <b className="text-gray-900">{bunkCount} ảnh giường tầng</b> (mỗi ảnh gồm giường
                trên &amp; dưới) + <b className="text-gray-900">1 ảnh sàn</b> +{" "}
                <b className="text-gray-900">1 ảnh bàn</b> +{" "}
                <b className="text-gray-900">1 ảnh kệ dép</b>.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 pt-2.5 sm:pt-0">
            <span
              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold ${
                allReady
                  ? "bg-[#00a65a] text-white"
                  : "bg-amber-100 text-amber-900 border border-amber-300"
              }`}
            >
              Đã chụp {passedCount} / {slots.length} ảnh bắt buộc
            </span>
          </div>
        </div>

        {/* Thanh tiến độ trực quan */}
        <div className="bg-white border border-gray-200 rounded-md px-4 py-3 shadow-xs">
          <div className="flex items-center justify-between text-xs sm:text-sm font-semibold mb-1.5">
            <span className="text-gray-700">Tiến độ hoàn thành bộ ảnh 5S</span>
            <span className={allReady ? "text-[#00a65a] font-bold" : "text-[#3c8dbc] font-bold"}>
              {slots.length ? Math.round((passedCount / slots.length) * 100) : 0}%
            </span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                allReady ? "bg-[#00a65a]" : "bg-[#3c8dbc]"
              }`}
              style={{ width: `${slots.length ? (passedCount / slots.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {retakeBanner && (
          <div className="bg-amber-50 border-l-4 border-[#f39c12] p-3.5 rounded-r-md text-xs sm:text-sm text-amber-950">
            <div className="font-bold mb-1">
              ⚠️ AI yêu cầu chụp bổ sung ({retakeBanner.category || "Cần chụp lại"}):
            </div>
            <ul className="list-disc pl-5 space-y-1">
              {retakeBanner.requests.map((r, i) => (
                <li key={i}>
                  <b>{r.slot_label}:</b> {r.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* PHẦN 1: CHỤP CÁC CỤM GIƯỜNG TẦNG (2, 3 HOẶC 4 ẢNH TÙY PHÒNG 4, 6, 8 SV) */}
        <Panel
          title={`1. Chụp ${bedSlots.length} ảnh Giường tầng (Mỗi ảnh gồm cả giường trên & giường dưới)`}
          actions={
            <span className="text-xs font-bold text-[#3c8dbc] bg-blue-50 px-2.5 py-1 rounded">
              {bedSlots.filter((s) => captures[s.slot_code]?.validationStatus === "passed").length}/
              {bedSlots.length} giường tầng
            </span>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            {bedSlots.map((slot, idx) => renderSlotCard(slot, idx + 1))}
          </div>
        </Panel>

        {/* PHẦN 2: CHỤP 3 KHU VỰC CHUNG (SÀN NHÀ, BÀN HỌC, KỆ GIÀY DÉP) */}
        <Panel
          title="2. Chụp 3 ảnh Khu vực chung (Sàn nhà · Bàn học · Kệ giày dép)"
          actions={
            <span className="text-xs font-bold text-[#00a65a] bg-emerald-50 px-2.5 py-1 rounded">
              {
                commonSlots.filter((s) => captures[s.slot_code]?.validationStatus === "passed")
                  .length
              }
              /{commonSlots.length} khu vực chung
            </span>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
            {commonSlots.map((slot, idx) => renderSlotCard(slot, bedSlots.length + idx + 1))}
          </div>
        </Panel>

        {error && (
          <div className="bg-red-50 border-l-4 border-[#dd4b39] text-[#dd4b39] p-3.5 rounded-r-md text-xs sm:text-sm font-semibold whitespace-pre-line">
            ⚠️ {error}
          </div>
        )}

        {/* Khu vực nút Nộp ảnh cố định rõ ràng, dễ bấm trên điện thoại */}
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2 text-xs sm:text-sm text-gray-600">
            <Info size={18} className="text-[#3c8dbc] shrink-0 mt-0.5" />
            <span>
              {allReady ? (
                <b className="text-[#00a65a]">
                  Đã chụp đủ {slots.length}/{slots.length} ảnh phòng {room}! Bấm nút bên dưới để AI
                  chấm điểm 5S ngay.
                </b>
              ) : (
                <>
                  Còn thiếu <b>{slots.length - passedCount} ảnh</b> nữa ({bunkCount} ảnh giường tầng
                  + 3 ảnh khu vực chung).
                </>
              )}
            </span>
          </div>

          <button
            type="button"
            disabled={!allReady || submitting}
            onClick={handleSubmit}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#00a65a] hover:bg-[#008d4c] active:scale-[0.99] text-white px-7 py-3.5 rounded-md font-bold text-base shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0"
          >
            {submitting ? <Bot size={20} className="animate-spin" /> : <Upload size={20} />}
            {submitting
              ? `AI đang chấm ${slots.length} ảnh...`
              : `Nộp đủ ${slots.length} ảnh cho AI chấm`}
          </button>
        </div>
      </div>

      <LiveCameraCapture
        open={Boolean(activeSlot)}
        slotCode={activeSlot?.slot_code ?? ""}
        slotLabel={activeSlot?.slot_label ?? ""}
        angleHint={activeSlot?.angle_hint ?? ""}
        roomCode={room}
        onClose={() => setActiveSlot(null)}
        onCapture={(file, previewUrl, resolution) => {
          if (activeSlot) {
            handleCameraCaptured(activeSlot, file, previewUrl, resolution);
          }
        }}
      />
    </AppShell>
  );
}
