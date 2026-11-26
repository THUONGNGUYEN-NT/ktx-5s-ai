"use client";
// TRANG KIỂM TRA PHÒNG 5S — QUY TRÌNH 7 BƯỚC & CÔNG THỨC N = P + 4
// Chụp trực tiếp qua WebRTC Camera (không cho tải ảnh từ thư viện)
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Bot,
  Lock,
  Upload,
  BedDouble,
  Layers,
  Sparkles,
  ImagePlus,
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
import { CURRENT_WEEK, ROOM_BED_PRESETS, type CaptureSlot } from "@/components/status";

type SlotCaptureState = {
  file: File;
  preview: string;
  capturedAt: string;
  width: number;
  height: number;
  validationStatus: "uploading" | "passed" | "needs_retake" | "insufficient_evidence" | "anomalous" | "suspected_fraud";
  issues: string[];
};

export default function CameraPage() {
  const router = useRouter();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [isDesktop, setIsDesktop] = useState(false);
  const [room, setRoom] = useState("");
  const [bedCount, setBedCount] = useState<number>(4);
  const [qrInput, setQrInput] = useState("");
  const [session, setSession] = useState<CaptureSessionInfo | null>(null);
  const [captures, setCaptures] = useState<Record<string, SlotCaptureState>>({});
  const [activeSlot, setActiveSlot] = useState<CaptureSlot | null>(null);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retakeBanner, setRetakeBanner] = useState<{
    category?: string;
    requests: Array<{ slot_code: string; slot_label: string; reason: string }>;
  } | null>(null);

  useEffect(() => {
    const s = getSession();
    if (s?.roomCode) {
      setRoom(s.roomCode);
      setQrInput(s.roomCode);
    }
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    setIsDesktop(!mobile);
  }, []);

  const handleStartSession = async () => {
    if (!room) {
      setError("Không xác định được mã phòng từ tài khoản sinh viên.");
      return;
    }
    setStarting(true);
    setError(null);
    setRetakeBanner(null);
    try {
      const info = await startCaptureSession(room, bedCount, qrInput);
      setSession(info);
      setCaptures({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể khởi tạo phiên chụp.");
    } finally {
      setStarting(false);
    }
  };

  const handleCameraCaptured = async (
    slot: CaptureSlot,
    file: File,
    previewUrl: string,
    resolution: { width: number; height: number },
    captureSource: "camera" | "desktop_test" = "camera"
  ) => {
    if (!session) return;
    const capturedAt = new Date().toLocaleTimeString("vi-VN");
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
            : (check.data.validation_status as SlotCaptureState["validationStatus"]) || "needs_retake",
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
          validationStatus: "needs_retake",
          issues: [err instanceof Error ? err.message : "Không thể kiểm tra ảnh, vui lòng chụp lại."],
        },
      }));
    }
  };

  const handleDesktopFilePick = async (slot: CaptureSlot, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    const dims = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth || 1280, height: img.naturalHeight || 720 });
      img.onerror = () => resolve({ width: 1280, height: 720 });
      img.src = previewUrl;
    });
    await handleCameraCaptured(slot, file, previewUrl, dims, "desktop_test");
  };

  const slots = session?.slots ?? [];
  const passedCount = slots.filter((s) => captures[s.slot_code]?.validationStatus === "passed").length;
  const allReady = slots.length > 0 && passedCount === slots.length;

  const bedSlots = slots.filter((s) => s.slot_group === "bed");
  const commonSlots = slots.filter((s) => s.slot_group === "common");
  const challengeSlots = slots.filter((s) => s.slot_group === "challenge");

  const handleSubmit = async () => {
    if (!session || !allReady) return;
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

  const renderSlotCard = (slot: CaptureSlot) => {
    const cap = captures[slot.slot_code];
    const isPassed = cap?.validationStatus === "passed";
    const isError =
      cap &&
      cap.validationStatus !== "passed" &&
      cap.validationStatus !== "uploading";

    return (
      <div
        key={slot.slot_code}
        className={`border rounded-sm p-3 flex flex-col gap-2 transition ${
          isPassed
            ? "border-[#00a65a] bg-green-50/20"
            : isError
            ? "border-[#dd4b39] bg-red-50/30"
            : "border-gray-200 bg-white"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-gray-800 text-xs sm:text-sm">
            {slot.slot_label}
          </span>
          {isPassed ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#00a65a] shrink-0">
              <CheckCircle2 size={13} /> Đạt chuẩn
            </span>
          ) : isError ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#dd4b39] shrink-0">
              <AlertTriangle size={13} /> Cần chụp lại
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-[#f39c12] shrink-0">Bắt buộc</span>
          )}
        </div>

        <p className="text-[11px] text-gray-500 leading-relaxed">{slot.angle_hint}</p>

        <div
          onClick={() => setActiveSlot(slot)}
          className="relative w-full aspect-video bg-gray-100 border-2 border-dashed border-gray-300 hover:border-[#3c8dbc] rounded-sm overflow-hidden flex items-center justify-center cursor-pointer"
        >
          {cap ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cap.preview} alt={slot.slot_label} className="w-full h-full object-contain bg-slate-900/10" />
              <span className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-sm">
                {room} · {slot.slot_code} · {cap.width}×{cap.height} · {cap.capturedAt}
              </span>
            </>
          ) : (
            <div className="text-center text-gray-400 px-3">
              <Camera size={28} className="mx-auto mb-1" />
              <p className="text-xs">Mở camera chụp <b>{slot.slot_code}</b></p>
            </div>
          )}
        </div>

        {cap?.issues?.length ? (
          <div className="text-[11px] text-[#dd4b39] bg-red-50 px-2 py-1 rounded-sm">
            {cap.issues.join(" · ")}
          </div>
        ) : null}

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSlot(slot)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-sm text-xs font-semibold transition ${
              cap
                ? "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                : "bg-[#3c8dbc] hover:bg-[#367fa9] text-white"
            }`}
          >
            {cap ? <RefreshCw size={13} /> : <Camera size={13} />}
            {cap ? "Chụp lại" : "Camera"}
          </button>

          {isDesktop && (
            <>
              <input
                ref={(el) => {
                  fileInputRefs.current[slot.slot_code] = el;
                }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleDesktopFilePick(slot, e)}
              />
              <button
                type="button"
                onClick={() => fileInputRefs.current[slot.slot_code]?.click()}
                className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-sm text-xs font-semibold border border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100 transition"
                title="Chế độ thử nghiệm trên máy tính"
              >
                <ImagePlus size={13} /> Chọn ảnh
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <AppShell role="student" title="Kiểm tra phòng 5S (N = P + 4 · Camera trực tiếp)">
      {!session ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Panel title={`Bước 1 & 2 · Xác thực phòng ${room} — Tuần ${CURRENT_WEEK}`} className="lg:col-span-2">
            <div className="flex flex-col gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-sm p-3 text-xs text-blue-900 flex items-start gap-2">
                <Lock size={16} className="shrink-0 mt-0.5 text-[#3c8dbc]" />
                <div>
                  <b>Cơ chế chống gian lận 7 lớp:</b> Hệ thống chỉ cho phép chụp trực tiếp bằng camera trong ứng dụng, ghi nhận thời gian trên máy chủ và yêu cầu chụp đủ <b>N = P + 4</b> ảnh (từng vị trí ngủ kể cả tầng trên/dưới + 4 khu vực chung + 1 góc thử thách ngẫu nhiên).
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Chọn loại phòng thực tế (số vị trí ngủ P)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {ROOM_BED_PRESETS.map((preset) => (
                    <button
                      key={preset.bedCount}
                      type="button"
                      onClick={() => setBedCount(preset.bedCount)}
                      className={`p-3 rounded-sm border text-left transition ${
                        bedCount === preset.bedCount
                          ? "border-[#3c8dbc] bg-[#3c8dbc]/10 ring-1 ring-[#3c8dbc]"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="font-bold text-sm text-gray-800">{preset.label}</div>
                      <div className="text-xs font-semibold text-[#00a65a] mt-0.5">
                        {preset.totalPhotos} ảnh tối thiểu
                      </div>
                      <div className="text-[11px] text-gray-500 mt-1">{preset.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Mã QR định danh dán tại phòng (Lớp 3)
                </label>
                <div className="flex items-center gap-2">
                  <QrCode size={18} className="text-gray-400 shrink-0" />
                  <input
                    type="text"
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    placeholder={`Nhập hoặc quét mã QR phòng ${room}`}
                    className="flex-1 border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#3c8dbc]"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border-l-4 border-[#dd4b39] text-[#dd4b39] px-3 py-2 text-xs">
                  {error}
                </div>
              )}

              <button
                type="button"
                disabled={starting}
                onClick={handleStartSession}
                className="self-start flex items-center gap-2 bg-[#00a65a] hover:bg-[#008d4c] text-white px-6 py-2.5 rounded-sm font-semibold text-sm shadow disabled:opacity-50"
              >
                <ShieldCheck size={17} />
                {starting ? "Đang khởi tạo phiên..." : `Khởi tạo phiên chụp (${Math.ceil(bedCount / 2) + 4} ảnh + 1 thử thách)`}
              </button>
            </div>
          </Panel>

          <Panel title="Quy định chất lượng & riêng tư">
            <ul className="flex flex-col gap-2.5 text-xs text-gray-600">
              <li>• <b>Công thức:</b> N = P + 4 (mỗi vị trí ngủ có mã định danh B01, B02...).</li>
              <li>• <b>Giường tầng:</b> Tầng trên và tầng dưới phải có ảnh riêng, đứng cạnh giường chụp an toàn.</li>
              <li>• <b>Độ phân giải:</b> Tối thiểu 1280×720 px, đủ sáng, không rung nhòe.</li>
              <li>• <b>Quyền riêng tư:</b> Không chụp mặt người, giấy tờ cá nhân hoặc màn hình điện thoại.</li>
            </ul>
          </Panel>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <Panel
            title={`Phiên chụp phòng ${session.room_code} · ${passedCount}/${slots.length} ảnh đạt chuẩn`}
            actions={
              <div className="flex items-center gap-2">
                {session.qr_verified && (
                  <span className="px-2 py-1 rounded-sm text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                    ✓ Đã xác thực QR
                  </span>
                )}
                {session.audit_required && (
                  <span className="px-2 py-1 rounded-sm text-[11px] font-semibold bg-purple-100 text-purple-800">
                    Lớp 7: Kiểm tra ngẫu nhiên
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSession(null)}
                  className="px-2.5 py-1 rounded-sm text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium"
                >
                  Đổi cấu hình
                </button>
              </div>
            }
          >
            <div className="mb-4">
              <div className="h-2.5 bg-gray-100 rounded-sm overflow-hidden">
                <div
                  className={`h-full transition-all ${allReady ? "bg-[#00a65a]" : "bg-[#3c8dbc]"}`}
                  style={{ width: `${slots.length ? (passedCount / slots.length) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                Phiên #{session.session_id.slice(0, 8)} · Thời gian máy chủ: {new Date(session.server_timestamp).toLocaleTimeString("vi-VN")}
              </p>
            </div>

            {retakeBanner && (
              <div className="mb-4 bg-amber-50 border-l-4 border-[#f39c12] p-3 text-xs text-amber-900">
                <div className="font-bold mb-1">
                  AI yêu cầu chụp bổ sung ({retakeBanner.category || "Cần chụp lại"}):
                </div>
                <ul className="list-disc pl-4 space-y-0.5">
                  {retakeBanner.requests.map((r, i) => (
                    <li key={i}>
                      <b>{r.slot_label}:</b> {r.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Nhóm 1: Vị trí ngủ B01..BP */}
            <div className="mb-6">
              <h4 className="text-sm font-bold text-gray-800 mb-2.5 flex items-center gap-1.5">
                <BedDouble size={16} className="text-[#3c8dbc]" />
                Bước 3 · Chụp {bedSlots.length} giường tầng (cả tầng trên & dưới)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {bedSlots.map(renderSlotCard)}
              </div>
            </div>

            {/* Nhóm 2: 4 khu vực chung */}
            <div className="mb-6">
              <h4 className="text-sm font-bold text-gray-800 mb-2.5 flex items-center gap-1.5">
                <Layers size={16} className="text-[#00a65a]" />
                Bước 4 · Chụp 4 khu vực chung bắt buộc
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {commonSlots.map(renderSlotCard)}
              </div>
            </div>

            {/* Nhóm 3: Thử thách ngẫu nhiên */}
            {challengeSlots.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-bold text-gray-800 mb-2.5 flex items-center gap-1.5">
                  <Sparkles size={16} className="text-[#605ca8]" />
                  Lớp 4 · Thử thách góc chụp ngẫu nhiên theo phiên
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {challengeSlots.map(renderSlotCard)}
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 bg-red-50 border-l-4 border-[#dd4b39] text-[#dd4b39] px-3 py-2 text-xs whitespace-pre-line">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                {allReady
                  ? "✅ Đã đủ toàn bộ ảnh đạt chuẩn. Sẵn sàng gửi AI tổng hợp L1–L4!"
                  : `Còn ${slots.length - passedCount} góc chụp chưa hoàn tất hoặc cần chụp lại.`}
              </span>
              <button
                type="button"
                disabled={!allReady || submitting}
                onClick={handleSubmit}
                className="flex items-center gap-2 bg-[#00a65a] hover:bg-[#008d4c] text-white px-6 py-2.5 rounded-sm font-semibold text-sm shadow disabled:opacity-50"
              >
                {submitting ? <Bot size={17} className="animate-spin" /> : <Upload size={17} />}
                {submitting ? "AI đang phân tích & đối chiếu..." : "Hoàn tất & Chấm điểm 5S"}
              </button>
            </div>
          </Panel>
        </div>
      )}

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
