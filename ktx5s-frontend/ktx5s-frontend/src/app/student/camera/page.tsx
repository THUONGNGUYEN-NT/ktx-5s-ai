"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitPhoto } from "@/lib/api";
import imageCompression from "browser-image-compression";

type AIResult = {
  status: string;
  score: number;
  issues_detected: string[];
  positive_notes: string[];
  recommendations: string;
  checklist: { bed_tidy: boolean; floor_clean: boolean; desk_organized: boolean; shoes_arranged: boolean };
};

export default function CameraPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // Nén ảnh về <= 1MB
    const compressed = await imageCompression(f, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
    setFile(compressed as unknown as File);
    setPreview(URL.createObjectURL(compressed));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!file) return;
    const roomCode = sessionStorage.getItem("room_code");
    if (!roomCode) { router.push("/student"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await submitPhoto(roomCode, file);
      if (!res.success) throw new Error(res.message);
      // Lưu kết quả để trang result đọc
      sessionStorage.setItem("ai_result", JSON.stringify(res.data.ai_result));
      sessionStorage.setItem("submitted_at", res.data.submitted_at);
      router.push("/student/result");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center min-h-screen p-6 gap-4 max-w-sm mx-auto">
      <div className="w-full">
        <h1 className="text-2xl font-bold text-gray-800">📸 Chụp ảnh phòng</h1>
        <p className="text-sm text-gray-500 mt-1">
          Chụp từ <strong>góc cửa phòng</strong> để thấy toàn bộ: giường, bàn học và sàn nhà.
        </p>
      </div>

      {/* Khung hướng dẫn chụp ảnh */}
      {!preview && (
        <div className="w-full aspect-video bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 text-gray-400">
          <span className="text-5xl">🏠</span>
          <p className="text-sm text-center px-4">Bấm nút bên dưới để mở camera và chụp ảnh phòng của bạn</p>
        </div>
      )}

      {/* Preview ảnh sau khi chụp */}
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Ảnh phòng" className="w-full aspect-video object-cover rounded-2xl shadow" />
      )}

      {/* Input camera — ẩn, chỉ nhận camera trực tiếp */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapture}
      />

      {error && (
        <div className="w-full bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          ⚠️ {error}
        </div>
      )}

      <div className="w-full flex flex-col gap-3 mt-auto">
        <button
          onClick={() => fileRef.current?.click()}
          className="bg-blue-600 text-white py-3 rounded-xl text-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          {preview ? "📷 Chụp lại" : "📷 Mở camera"}
        </button>

        {preview && (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-green-600 text-white py-3 rounded-xl text-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "🤖 AI đang phân tích..." : "✅ Nộp ảnh"}
          </button>
        )}
      </div>
    </main>
  );
}
