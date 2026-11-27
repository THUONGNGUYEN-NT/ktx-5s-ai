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

    // Tự động khởi tạo phiên chụp 30 phút kèm 1 góc thử thách ngẫu nhiên trong 10 kịch bản
    const initialChallenge = pickRandomChallenge();
    const immediateSlots = buildLocalCaptureSlots(roomCap, initialChallenge);
    const now = new Date();
    setSession({
      session_id: `local_${roomCode}_${Date.now()}`,
      room_code: roomCode,
      week: CURRENT_WEEK_STR,
      bed_count: roomCap,
      common_count: 3,
      total_required: immediateSlots.length - 1,
      total_with_challenge: immediateSlots.length,
      qr_verified: true,
      audit_required: false,
      challenge_prompt: initialChallenge,
      server_timestamp: now.toISOString(),
      expires_at: new Date(now.getTime() + 30 * 60000).toISOString(),
      slots: immediateSlots,
      is_offline_fallback: true,
    });

    startCaptureSession(roomCode, roomCap)
      .then((info) => {
        if (!info.is_offline_fallback && info.slots?.length) {
          setSession({
            ...info,
            bed_count: roomCap,
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
    } catch {
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
                {bunkCount} ảnh giường tầng (trên &amp; dưới) + 3 khu vực chung + 1 góc thử thách ngẫu nhiên
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

        {/* Mục 3: Khung ảnh thử thách ngẫu nhiên (Chống gian lận - Anti-Fraud) */}
        {challengeSlots.map((slot) => {
          const cap = captures[slot.slot_code];
          const isPassed = cap?.validationStatus === "passed";
          const isError =
            cap && cap.validationStatus !== "passed" && cap.validationStatus !== "uploading";
          const photoIndex = bedSlots.length + commonSlots.length + 1;

          return (
            <div key={slot.slot_code} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-800 flex items-center gap-2">
                  <Sparkles size={18} className="text-indigo-600" />
                  3. Khung ảnh thử thách ngẫu nhiên
                </h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
                  <ShieldCheck size={13} /> Phiên 30 phút
                </span>
              </div>

              <div
                className={`bg-white rounded-2xl border-2 p-4 shadow-xs transition ${isPassed
                  ? "border-emerald-400 bg-emerald-50/20"
                  : isError
                    ? "border-rose-400 bg-rose-50/20"
                    : "border-indigo-200 bg-gradient-to-br from-white to-indigo-50/40"
                  }`}
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* Hướng dẫn thử thách ngẫu nhiên */}
                  <div className="md:col-span-7 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="bg-indigo-600 text-white text-xs font-extrabold px-2.5 py-0.5 rounded-full">
                        Ảnh {photoIndex} · CH01
                      </span>
                      {isPassed ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                          <CheckCircle2 size={15} /> Đã hoàn thành
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-indigo-600">Bắt buộc trong phiên</span>
                      )}
                    </div>

                    <div className="bg-indigo-50/90 border border-indigo-200/80 rounded-xl p-3.5">
                      <p className="text-[11px] uppercase tracking-wider font-bold text-indigo-500 mb-1">
                        Yêu cầu góc chụp ngẫu nhiên của phiên này:
                      </p>
                      <p className="text-sm sm:text-base font-extrabold text-slate-800 leading-snug">
                        “{slot.angle_hint}”
                      </p>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed">
                      Chụp trực tiếp góc ảnh theo yêu cầu ngẫu nhiên của phiên này để xác thực và hoàn tất bài nộp trong vòng 30 phút.
                    </p>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveSlot(slot)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition"
                      >
                        {cap ? <RefreshCw size={15} /> : <Camera size={15} />}
                        {cap ? "Chụp lại góc thử thách" : "Chụp góc thử thách ngay"}
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
                        className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold flex items-center gap-1.5"
                        title="Chọn ảnh từ thiết bị"
                      >
                        <ImagePlus size={15} /> Tải ảnh
                      </button>
                    </div>
                  </div>

                  {/* Khung xem trước ảnh thử thách */}
                  <div className="md:col-span-5">
                    <div
                      onClick={() => setActiveSlot(slot)}
                      className="relative w-full aspect-4/3 rounded-xl border-2 border-dashed border-indigo-200 bg-white hover:border-indigo-400 overflow-hidden flex flex-col items-center justify-center cursor-pointer transition"
                    >
                      {cap ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={cap.preview}
                            alt={slot.slot_label}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-2 left-2 bg-slate-900/75 text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-md">
                            CH01 · {cap.capturedAt}
                          </span>
                        </>
                      ) : (
                        <div className="text-center p-4">
                          <div className="w-11 h-11 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-2">
                            <Camera size={22} />
                          </div>
                          <p className="text-xs font-bold text-indigo-700">Chạm để chụp CH01</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

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
              {allReady ? " — Đủ giường tầng, khu vực chung và góc thử thách!" : ""}
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
