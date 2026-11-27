"use client";
// COMPONENT CAMERA TRỰC TIẾP (LỚP 1 CHỐNG GIAN LẬN)
// Bắt buộc chụp trực tiếp từ WebRTC Camera trong ứng dụng — KHÔNG cho phép tải ảnh từ thư viện.
import { useEffect, useRef, useState } from "react";
import { Camera, SwitchCamera, X, ShieldAlert, CheckCircle2, Sparkles } from "lucide-react";

type LiveCameraCaptureProps = {
  open: boolean;
  slotCode: string;
  slotLabel: string;
  angleHint: string;
  roomCode: string;
  onClose: () => void;
  onCapture: (file: File, previewUrl: string, resolution: { width: number; height: number }) => void;
};

export default function LiveCameraCapture({
  open,
  slotCode,
  slotLabel,
  angleHint,
  roomCode,
  onClose,
  onCapture,
}: LiveCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [resolution, setResolution] = useState<{ width: number; height: number } | null>(null);
  const [capturing, setCapturing] = useState(false);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) {
      stopStream();
      return;
    }

    let cancelled = false;
    setCameraError(null);

    async function startCamera() {
      stopStream();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Trình duyệt hoặc kết nối hiện tại chưa hỗ trợ camera trực tiếp (cần HTTPS hoặc localhost).");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setResolution({
            width: videoRef.current.videoWidth || 1280,
            height: videoRef.current.videoHeight || 720,
          });
        }
      } catch {
        // Thử fallback cấu hình mặc định nếu thiết bị không có camera đạt 1280x720
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facingMode } },
            audio: false,
          });
          if (cancelled) {
            fallbackStream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = fallbackStream;
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            await videoRef.current.play();
            setResolution({
              width: videoRef.current.videoWidth || 1280,
              height: videoRef.current.videoHeight || 720,
            });
          }
        } catch {
          setCameraError(
            "Không thể mở camera trực tiếp. Vui lòng cấp quyền Camera cho trình duyệt (hệ thống không cho phép tải ảnh từ thư viện)."
          );
        }
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, facingMode]);

  if (!open) return null;

  const handleTakePhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    setCapturing(true);
    try {
      const targetW = Math.max(video.videoWidth, 1280);
      const scale = targetW / video.videoWidth;
      const w = video.videoWidth >= 1280 || video.videoHeight >= 1280 ? video.videoWidth : Math.round(video.videoWidth * scale);
      const h = video.videoWidth >= 1280 || video.videoHeight >= 1280 ? video.videoHeight : Math.round(video.videoHeight * scale);
      const targetScale = Math.min(1, 1280 / Math.max(w, h));
      const compressionScale = Math.min(w, h) * targetScale >= 720 ? targetScale : 1;
      const outputWidth = Math.round(w * compressionScale);
      const outputHeight = Math.round(h * compressionScale);

      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, outputWidth, outputHeight);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
      if (!blob) return;

      const file = new File([blob], `${roomCode}_${slotCode}_${Date.now()}.jpg`, { type: "image/jpeg" });
      const previewUrl = URL.createObjectURL(blob);
      onCapture(file, previewUrl, { width: outputWidth, height: outputHeight });
      onClose();
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col justify-between p-3 sm:p-5 text-white">
      {/* Header hướng dẫn góc chụp */}
      <div className="flex items-start justify-between gap-3 bg-white/10 backdrop-blur-sm rounded-sm p-3 border border-white/15">
        <div>
          <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold">
            <Sparkles size={14} /> CAMERA TRỰC TIẾP · KTX 5S AI
          </div>
          <h3 className="text-base font-bold mt-0.5">{slotLabel}</h3>
          <p className="text-xs text-gray-200 mt-1">{angleHint}</p>
          <p className="text-[11px] text-amber-300 mt-1">
            Quyền riêng tư: Không chụp mặt người, giấy tờ cá nhân hoặc màn hình điện thoại.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-sm bg-white/15 hover:bg-white/25 transition shrink-0"
          aria-label="Đóng camera"
        >
          <X size={18} />
        </button>
      </div>

      {/* Khung hình camera + lưới căn góc */}
      <div className="relative flex-1 my-3 rounded-sm overflow-hidden bg-black flex items-center justify-center border border-white/20">
        {cameraError ? (
          <div className="max-w-md text-center p-6 bg-red-950/60 border border-red-400/40 rounded-sm">
            <ShieldAlert size={40} className="mx-auto text-red-400 mb-3" />
            <p className="text-sm font-semibold text-red-200">{cameraError}</p>
            <p className="text-xs text-gray-300 mt-2">
              Theo quy định KTX 5S AI, ảnh phải được chụp trực tiếp bằng camera tại thời điểm kiểm tra.
            </p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-contain"
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  setResolution({
                    width: videoRef.current.videoWidth,
                    height: videoRef.current.videoHeight,
                  });
                }
              }}
            />
            {/* Khung ngắm hướng dẫn 30-45 độ */}
            <div className="pointer-events-none absolute inset-4 sm:inset-8 border-2 border-dashed border-emerald-400/60 rounded-sm flex flex-col justify-between p-2">
              <div className="flex justify-between text-[11px] bg-black/50 px-2 py-1 rounded-sm">
                <span>Phòng {roomCode} · {slotCode}</span>
                <span>
                  {resolution ? `${resolution.width}×${resolution.height} px` : "Đang khởi động..."}
                </span>
              </div>
              <div className="text-center text-[11px] bg-black/50 px-2 py-1 rounded-sm self-center">
                Giữ máy chắc tay · Đủ sáng · Không che khuất vật thể
              </div>
            </div>
          </>
        )}
      </div>

      {/* Thanh điều khiển */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setFacingMode((m) => (m === "environment" ? "user" : "environment"))}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-sm bg-white/15 hover:bg-white/25 text-xs font-semibold"
        >
          <SwitchCamera size={16} /> Đổi camera
        </button>

        <button
          type="button"
          disabled={Boolean(cameraError) || capturing}
          onClick={handleTakePhoto}
          className="flex items-center gap-2 px-7 py-3 rounded-full bg-[#00a65a] hover:bg-[#008d4c] disabled:opacity-40 text-sm font-bold shadow-lg"
        >
          {capturing ? <CheckCircle2 size={18} /> : <Camera size={18} />}
          {capturing ? "Đang xử lý..." : "Chụp ngay"}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 rounded-sm bg-white/15 hover:bg-white/25 text-xs font-semibold"
        >
          Hủy
        </button>
      </div>
    </div>
  );
}
