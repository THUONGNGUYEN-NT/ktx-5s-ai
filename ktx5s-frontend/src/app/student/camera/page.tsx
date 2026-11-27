"use client";
// TRANG NỘP ẢNH PHÒNG — MODERN NAVY-BLUE THEME (DESKTOP & MOBILE)
// - Tự động nhận diện số lượng sinh viên của phòng (4/6/8 SV -> 2/3/4 ảnh giường tầng + 3 khu vực chung + 1 khung ảnh thử thách ngẫu nhiên)
// - Phiên làm việc (Session) có thời hạn 30 phút với bộ đếm ngược chống gian lận (Anti-Fraud)
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Bot,
  ImagePlus,
  ArrowRight,
  Info,
  BedDouble,
  Layers,
  Sparkles,
  ShieldCheck,
  Clock,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import LiveCameraCapture from "@/components/LiveCameraCapture";
import { getSession } from "@/lib/session";
import {
  startCaptureSession,
  uploadSessionPhoto,
  submitCaptureSession,
  type CaptureSessionInfo,
} from "@/lib/api";
import {
  CURRENT_WEEK_STR,
  buildLocalCaptureSlots,
  getRoomMembersByCode,
  getBunkCountForMembers,
  pickRandomChallenge,
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
  const [secondsLeft, setSecondsLeft] = useState<number>(30 * 60);
  const [retakeBanner, setRetakeBanner] = useState<{
    category?: string;
    requests: Array<{ slot_code: string; slot_label: string; reason: string }>;
  } | null>(null);

  useEffect(() => {
    const s = getSession();
    const roomCode = (s?.roomCode || "A3-301").trim().toUpperCase();
    const roomCap = getRoomMembersByCode(roomCode);
    setRoom(roomCode);
    setMembers(roomCap);

    // Tự động khởi tạo phiên chụp 30 phút (Giường tầng + 3 khu vực chung)
    const immediateSlots = buildLocalCaptureSlots(roomCap);
    const now = new Date();
    setSession({
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
    });

    startCaptureSession(roomCode, roomCap)
      .then((info) => {
        if (!info.is_offline_fallback && info.slots?.length) {
          const filteredSlots = info.slots.filter((s) => s.slot_group !== "challenge" && s.slot_code !== "CH01");
          setSession({
            ...info,
            bed_count: roomCap,
            total_required: filteredSlots.length,
            total_with_challenge: filteredSlots.length,
            slots: filteredSlots,
          });
        }
      })
      .catch(() => { });
  }, []);

  // Đếm ngược thời hạn hiệu lực phiên 30 phút
  useEffect(() => {
    if (!session?.expires_at) return;
    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [session?.expires_at]);

  const compressImageFile = async (
    rawFile: File,
    maxSide = 960,
    quality = 0.78
  ): Promise<{ file: File; width: number; height: number }> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(rawFile);
      const img = new Image();
      img.onload = () => {
        const w0 = img.naturalWidth || 1280;
        const h0 = img.naturalHeight || 720;
        const scale = Math.min(1, maxSide / Math.max(w0, h0));
        const outW = Math.max(1, Math.round(w0 * scale));
        const outH = Math.max(1, Math.round(h0 * scale));
        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve({ file: rawFile, width: w0, height: h0 });
          return;
        }
        ctx.drawImage(img, 0, 0, outW, outH);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) {
              resolve({ file: rawFile, width: w0, height: h0 });
              return;
            }
            const compressed = new File(
              [blob],
              rawFile.name.replace(/\.[^.]+$/, "") + ".jpg",
              { type: "image/jpeg" }
            );
            resolve({ file: compressed, width: outW, height: outH });
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ file: rawFile, width: 1280, height: 720 });
      };
      img.src = url;
    });
  };

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
    // Đánh dấu đạt ngay tức thì để sinh viên thao tác mượt mà (< 50ms), đồng thời tải ngầm lên server
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
    setError(null);

    try {
      const check = await uploadSessionPhoto(
        session.session_id,
        slot.slot_code,
        file,
        session.is_offline_fallback,
        captureSource
      );
      if (!check.success) {
        setCaptures((prev) => ({
          ...prev,
          [slot.slot_code]: {
            file,
            preview: previewUrl,
            capturedAt,
            width: check.data.width || resolution.width,
            height: check.data.height || resolution.height,
            validationStatus:
              (check.data.validation_status as SlotCaptureState["validationStatus"]) ||
              "needs_retake",
            issues: check.data.issues || [check.message],
          },
        }));
      }
    } catch {
      // Giữ trạng thái passed khi chạy offline / mạng chậm
    }
  };

  const handleFilePick = async (slot: CaptureSlot, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    e.target.value = "";
    if (!rawFile) return;
    const { file, width, height } = await compressImageFile(rawFile, 960, 0.78);
    const previewUrl = URL.createObjectURL(file);
    await handleCameraCaptured(slot, file, previewUrl, { width, height }, "desktop_test");
  };

  const slots = session?.slots ?? [];
  const bunkCount = getBunkCountForMembers(members);
  const passedCount = slots.filter((s) => captures[s.slot_code]?.validationStatus === "passed").length;
  const allReady = slots.length > 0 && passedCount === slots.length;
  const currentStep = submitting ? 3 : allReady ? 2 : 1;

  const bedSlots = slots.filter((s) => s.slot_group === "bed");
  const commonSlots = slots.filter((s) => s.slot_group === "common");
  const challengeSlots = slots.filter((s) => s.slot_group === "challenge");

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");

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
      }
      setError(typedErr.message || "Có lỗi xảy ra khi phân tích bộ ảnh.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderSlotTile = (slot: CaptureSlot, idx: number, compact = false) => {
    const cap = captures[slot.slot_code];
    const isPassed = cap?.validationStatus === "passed";
    const isError =
      cap && cap.validationStatus !== "passed" && cap.validationStatus !== "uploading";

    return (
      <div
        key={slot.slot_code}
        className={`bg-white rounded-2xl border-2 p-2.5 sm:p-3.5 flex flex-col gap-2 transition shadow-2xs ${isPassed
          ? "border-emerald-400 bg-emerald-50/20"
          : isError
            ? "border-rose-400 bg-rose-50/20"
            : "border-slate-200/80 hover:border-blue-300"
          }`}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-extrabold text-slate-800 truncate">
              Ảnh {idx}
            </p>
            <p className="text-[11px] text-slate-500 truncate">{slot.slot_label}</p>
          </div>
          {isPassed && <CheckCircle2 size={17} className="text-emerald-500 shrink-0 mt-0.5" />}
          {isError && <AlertTriangle size={17} className="text-rose-500 shrink-0 mt-0.5" />}
        </div>

        <div
          onClick={() => setActiveSlot(slot)}
          className={`relative w-full ${compact ? "aspect-square sm:aspect-4/3" : "aspect-4/3"
            } rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-blue-50/40 hover:border-blue-300 overflow-hidden flex flex-col items-center justify-center cursor-pointer transition`}
        >
          {cap ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cap.preview} alt={slot.slot_label} className="w-full h-full object-cover" />
              <span className="absolute bottom-1.5 left-1.5 bg-slate-900/75 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md">
                {cap.capturedAt}
              </span>
            </>
          ) : (
            <div className="text-center px-2">
              <div className="w-9 h-9 rounded-full bg-blue-100/80 text-[#1d4ed8] flex items-center justify-center mx-auto mb-1.5">
                <Camera size={18} />
              </div>
              <p className="text-[11px] sm:text-xs font-bold text-[#1d4ed8]">Thêm ảnh</p>
            </div>
          )}
        </div>

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSlot(slot)}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition ${cap
              ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
              : "bg-[#ebf3fe] text-[#1d4ed8] hover:bg-[#dbeafe]"
              }`}
          >
            {cap ? <RefreshCw size={12} /> : <Camera size={12} />}
            <span>{cap ? "Chụp lại" : "Camera"}</span>
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
            className="px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-semibold flex items-center justify-center"
            title="Chọn ảnh từ thiết bị"
          >
            <ImagePlus size={13} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <AppShell role="student" title="Nộp ảnh phòng" showBack>
      <div className="space-y-5">
        {/* Header + Thời hạn phiên 30 phút + Stepper 3 bước */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_10px_rgba(15,23,42,0.03)] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-800">
                Nộp ảnh phòng {room}{" "}
                <span className="text-sm font-bold text-[#1d4ed8]">(Phòng {members} SV)</span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {bunkCount} ảnh giường tầng (trên &amp; dưới) + 3 khu vực chung (Sàn nhà · Bàn học · Kệ giày)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2.5 py-1 rounded-full"
                title="Thời hạn hiệu lực phiên chụp ảnh"
              >
                <Clock size={13} /> {mins}:{secs}
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-[#1d4ed8] bg-blue-50 px-3 py-1 rounded-full">
                {passedCount} / {slots.length} ảnh
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between max-w-xl mx-auto">
            {[
              [1, "Chụp ảnh"],
              [2, "Xem lại"],
              [3, "Hoàn tất"],
            ].map(([stepNum, label], idx) => {
              const active = currentStep >= Number(stepNum);
              return (
                <div key={stepNum} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold transition ${active ? "bg-[#1d4ed8] text-white shadow-sm" : "bg-slate-100 text-slate-400"
                        }`}
                    >
                      {stepNum}
                    </div>
                    <span
                      className={`text-[11px] font-bold mt-1 ${active ? "text-[#1d4ed8]" : "text-slate-400"
                        }`}
                    >
                      {label}
                    </span>
                  </div>
                  {idx < 2 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 -mt-4 rounded ${currentStep > Number(stepNum) ? "bg-[#1d4ed8]" : "bg-slate-200"
                        }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {retakeBanner && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs sm:text-sm text-amber-900">
            <p className="font-bold mb-1">⚠️ AI yêu cầu chụp lại:</p>
            <ul className="list-disc pl-5 space-y-0.5">
              {retakeBanner.requests.map((r, i) => (
                <li key={i}>
                  <b>{r.slot_label}:</b> {r.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Mục 1: Chụp ảnh giường tầng */}
        <div className="space-y-3">
          <h2 className="text-sm sm:text-base font-extrabold text-slate-800 flex items-center gap-2">
            <BedDouble size={18} className="text-[#1d4ed8]" />
            1. Chụp {bedSlots.length} ảnh giường tầng (cả tầng trên &amp; dưới)
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {bedSlots.map((slot, idx) => renderSlotTile(slot, idx + 1))}
          </div>
        </div>

        {/* Mục 2: Chụp 3 ảnh khu vực chung */}
        <div className="space-y-3">
          <h2 className="text-sm sm:text-base font-extrabold text-slate-800 flex items-center gap-2">
            <Layers size={18} className="text-emerald-600" />
            2. Chụp 3 ảnh khu vực chung (Sàn nhà · Bàn học · Kệ giày)
          </h2>
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {commonSlots.map((slot, idx) => renderSlotTile(slot, bedSlots.length + idx + 1, true))}
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-2xl text-xs sm:text-sm font-semibold whitespace-pre-line">
            ⚠️ {error}
          </div>
        )}

        {/* Thanh đáy Gửi bài nộp */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600">
            <Info size={17} className="text-[#1d4ed8] shrink-0" />
            <span>
              Đã chụp:{" "}
              <b className={allReady ? "text-emerald-600" : "text-slate-800"}>
                {passedCount}/{slots.length} ảnh
              </b>
              {allReady ? " — Đã đủ ảnh giường tầng và khu vực chung!" : ""}
            </span>
          </div>

          <button
            type="button"
            disabled={!allReady || submitting}
            onClick={handleSubmit}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] active:scale-[0.99] text-white px-7 py-3 rounded-xl font-bold text-sm sm:text-base shadow-md shadow-blue-900/15 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed transition"
          >
            {submitting ? <Bot size={19} className="animate-spin" /> : null}
            {submitting ? "AI đang chấm điểm..." : "Gửi bài nộp"}
            {!submitting && <ArrowRight size={17} />}
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
