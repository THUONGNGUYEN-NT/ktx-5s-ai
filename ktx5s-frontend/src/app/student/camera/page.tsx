"use client";
// TRANG NỘP ẢNH — Bắt buộc chụp đủ 4 khu vực: Giường ngủ, Sàn nhà, Kệ giày dép, Bàn học
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, RefreshCw, Upload, Bot, Info, CheckCircle2, AlertCircle } from "lucide-react";
import imageCompression from "browser-image-compression";
import AppShell from "@/components/AppShell";
import Panel from "@/components/Panel";
import { getSession } from "@/lib/session";
import { submitPhotos } from "@/lib/api";
import { AREAS, CURRENT_WEEK, type AreaKey } from "@/components/status";

type AreaCapture = {
  file: File;
  preview: string;
  capturedAt: string;
};

export default function CameraPage() {
  const router = useRouter();
  const fileRefs = useRef<Record<AreaKey, HTMLInputElement | null>>({
    bed: null,
    floor: null,
    shoes: null,
    desk: null,
  });

  const [room, setRoom] = useState("");
  const [captures, setCaptures] = useState<Partial<Record<AreaKey, AreaCapture>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setRoom(getSession()?.roomCode ?? ""), []);

  const handleCapture = async (area: AreaKey, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const compressed = await imageCompression(f, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    });
    const namedFile = new File([compressed], f.name, {
      type: compressed.type || f.type || "image/jpeg",
    });
    const preview = URL.createObjectURL(namedFile);
    const capturedAt = new Date().toLocaleString("vi-VN");
    setCaptures((prev) => ({
      ...prev,
      [area]: { file: namedFile, preview, capturedAt },
    }));
    setError(null);
  };

  const completedCount = AREAS.filter((a) => Boolean(captures[a.key])).length;
  const allCaptured = completedCount === AREAS.length;

  const handleSubmit = async () => {
    if (!room) return;
    if (!allCaptured) {
      const missing = AREAS.filter((a) => !captures[a.key]).map((a) => a.label).join(", ");
      setError(`Bạn cần chụp đủ 4 ảnh bắt buộc. Còn thiếu: ${missing}.`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const files = {
        bed: captures.bed!.file,
        floor: captures.floor!.file,
        shoes: captures.shoes!.file,
        desk: captures.desk!.file,
      };
      const res = await submitPhotos(room, files);
      if (!res.success) throw new Error(res.message);

      sessionStorage.setItem("ai_result", JSON.stringify(res.data.ai_result));
      sessionStorage.setItem("submitted_at", res.data.submitted_at);
      sessionStorage.setItem(
        "preview_urls",
        JSON.stringify({
          bed: captures.bed!.preview,
          floor: captures.floor!.preview,
          shoes: captures.shoes!.preview,
          desk: captures.desk!.preview,
        })
      );
      router.push("/student/result");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell role="student" title="Nộp ảnh phòng (4 khu vực bắt buộc)">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel
          title={`Chụp 4 khu vực phòng ${room} — Tuần ${CURRENT_WEEK}`}
          actions={
            <span
              className={`px-2.5 py-1 rounded-sm text-xs font-semibold ${
                allCaptured ? "bg-[#00a65a] text-white" : "bg-[#f39c12] text-white"
              }`}
            >
              Đã chụp {completedCount} / {AREAS.length} ảnh bắt buộc
            </span>
          }
          className="lg:col-span-2"
        >
          {/* Thanh tiến độ */}
          <div className="mb-4">
            <div className="h-2.5 bg-gray-100 rounded-sm overflow-hidden">
              <div
                className={`h-full transition-all ${allCaptured ? "bg-[#00a65a]" : "bg-[#3c8dbc]"}`}
                style={{ width: `${(completedCount / AREAS.length) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              Vui lòng chụp đầy đủ <b>4 ảnh</b> tương ứng với <b>Giường ngủ, Sàn nhà, Kệ giày dép</b> và <b>Bàn học</b> để nút nộp ảnh được kích hoạt.
            </p>
          </div>

          {/* Lưới 4 ô chụp ảnh */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative">
            {AREAS.map((area, idx) => {
              const cap = captures[area.key];
              return (
                <div
                  key={area.key}
                  className={`border rounded-sm p-3 flex flex-col gap-2.5 transition ${
                    cap ? "border-[#00a65a] bg-green-50/20" : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#3c8dbc] text-white text-xs flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      {area.emoji} {area.label}
                    </span>
                    {cap ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#00a65a]">
                        <CheckCircle2 size={14} /> Đã chụp
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#dd4b39]">
                        <AlertCircle size={14} /> Bắt buộc
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-500">{area.hint}</p>

                  <div
                    onClick={() => fileRefs.current[area.key]?.click()}
                    className="relative w-full aspect-video bg-gray-100 border-2 border-dashed border-gray-300 hover:border-[#3c8dbc] rounded-sm overflow-hidden flex items-center justify-center cursor-pointer"
                  >
                    {cap ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={cap.preview} alt={area.label} className="w-full h-full object-cover" />
                        <span className="absolute bottom-1.5 left-1.5 bg-black/65 text-white text-[10px] px-2 py-0.5 rounded-sm">
                          {room} · {area.label} · {cap.capturedAt}
                        </span>
                      </>
                    ) : (
                      <div className="text-center text-gray-400 px-3">
                        <Camera size={32} className="mx-auto mb-1" />
                        <p className="text-xs">Bấm để chụp <b>{area.label}</b></p>
                      </div>
                    )}
                  </div>

                  <input
                    ref={(el) => {
                      fileRefs.current[area.key] = el;
                    }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleCapture(area.key, e)}
                  />

                  <button
                    type="button"
                    onClick={() => fileRefs.current[area.key]?.click()}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-sm text-xs font-semibold transition ${
                      cap
                        ? "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                        : "bg-[#3c8dbc] hover:bg-[#367fa9] text-white"
                    }`}
                  >
                    {cap ? <RefreshCw size={13} /> : <Camera size={13} />}
                    {cap ? `Chụp lại ${area.label}` : `Chụp ảnh ${area.label}`}
                  </button>
                </div>
              );
            })}

            {loading && (
              <div className="absolute inset-0 bg-[#222d32]/85 text-white flex flex-col items-center justify-center gap-3 rounded-sm z-10">
                <Bot size={48} className="animate-bounce" />
                <p className="text-base font-semibold">AI đang đối chiếu cả 4 khu vực phòng...</p>
                <p className="text-xs opacity-80">Giường ngủ · Sàn nhà · Kệ giày dép · Bàn học</p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border-l-4 border-[#dd4b39] text-[#dd4b39] px-3 py-2 text-xs font-medium">
              ⚠️ {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              {allCaptured
                ? "✅ Đã đủ 4 ảnh. Bạn có thể gửi cho AI chấm điểm ngay!"
                : `⚠️ Còn thiếu ${AREAS.length - completedCount} ảnh khu vực nữa.`}
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!allCaptured || loading}
              className="flex items-center gap-2 bg-[#00a65a] hover:bg-[#008d4c] text-white px-6 py-2.5 rounded-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow"
            >
              <Upload size={16} />
              {loading ? "Đang gửi 4 ảnh..." : "Nộp đủ 4 ảnh cho AI chấm"}
            </button>
          </div>
        </Panel>

        <Panel title="Quy định chụp 4 góc bắt buộc">
          <ul className="flex flex-col gap-3 text-gray-600">
            <li>🛏️ <b>Ảnh 1 — Giường ngủ:</b> Chăn màn gấp vuông vức, gối đặt ngay ngắn, không vứt quần áo bẩn trên giường.</li>
            <li>🧹 <b>Ảnh 2 — Sàn nhà:</b> Chụp dọc lối đi chính và gầm giường, đảm bảo sạch rác và không đọng nước.</li>
            <li>👟 <b>Ảnh 3 — Kệ giày dép:</b> Giày dép xếp thẳng hàng trên kệ, không để tràn ra cửa phòng.</li>
            <li>📚 <b>Ảnh 4 — Bàn học:</b> Sách vở, laptop xếp gọn, không để bát đũa hay đồ ăn thừa.</li>
          </ul>
          <div className="mt-4 bg-[#3c8dbc]/10 text-[#367fa9] p-3 rounded-sm flex gap-2 text-xs">
            <Info size={16} className="shrink-0" />
            Trên máy tính, trình duyệt sẽ mở hộp thoại chọn ảnh. Khi mở trên điện thoại, từng ô sẽ bật camera trực tiếp.
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
