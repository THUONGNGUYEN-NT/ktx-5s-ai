"use client";
// TRANG KẾT QUẢ AI CHẤM — Hiển thị điểm tổng + 4 ảnh khu vực đã nộp
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Lightbulb, Camera, History } from "lucide-react";
import AppShell from "@/components/AppShell";
import Panel from "@/components/Panel";
import { AREAS, TILE_STYLES, statusToKey, formatDateTime, type AreaKey } from "@/components/status";
import type { AIResult } from "@/lib/mock-api";

export default function ResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<AIResult | null>(null);
  const [submittedAt, setSubmittedAt] = useState("");
  const [previews, setPreviews] = useState<Partial<Record<AreaKey, string>>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("ai_result");
    if (raw) setResult(JSON.parse(raw));
    setSubmittedAt(sessionStorage.getItem("submitted_at") ?? "");
    const rawUrls = sessionStorage.getItem("preview_urls");
    if (rawUrls) {
      try {
        setPreviews(JSON.parse(rawUrls));
      } catch {
        setPreviews({});
      }
    }
    setReady(true);
  }, []);

  if (ready && !result) {
    return (
      <AppShell role="student" title="Kết quả gần nhất">
        <Panel title="Chưa có kết quả">
          <p className="text-gray-500">Bạn chưa nộp bộ 4 ảnh phòng trong phiên này.</p>
          <button
            onClick={() => router.push("/student/camera")}
            className="mt-4 flex items-center gap-2 bg-[#00a65a] text-white px-5 py-2.5 rounded-sm font-semibold"
          >
            <Camera size={16} /> Chụp 4 ảnh phòng ngay
          </button>
        </Panel>
      </AppShell>
    );
  }

  const style = result ? TILE_STYLES[statusToKey(result.status)] : null;

  return (
    <AppShell role="student" title="Kết quả AI chấm">
      {result && style && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Cột trái: Điểm tổng & 4 ảnh đã nộp */}
          <div className="flex flex-col gap-5">
            <div className={`${style.bg} text-white rounded-sm shadow-sm p-6 text-center`}>
              <p className="text-6xl font-black">{result.score.toFixed(1)}</p>
              <p className="text-sm opacity-90">/ 10 điểm</p>
              <p className="text-xl font-bold mt-2">{result.status}</p>
              {submittedAt && <p className="text-xs opacity-80 mt-2">Nộp lúc {formatDateTime(submittedAt)}</p>}
            </div>

            <Panel title="4 ảnh khu vực đã nộp">
              <div className="grid grid-cols-2 gap-2.5">
                {AREAS.map((a) => {
                  const passed = result.checklist[a.checklistKey];
                  const url = previews[a.key];
                  return (
                    <div key={a.key} className="border border-gray-200 rounded-sm overflow-hidden bg-gray-50">
                      <div className="aspect-video bg-gray-200 flex items-center justify-center">
                        {url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt={a.label} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl">{a.emoji}</span>
                        )}
                      </div>
                      <div className="px-2 py-1.5 flex items-center justify-between text-xs">
                        <span className="font-semibold truncate">{a.label}</span>
                        <span className={passed ? "text-[#00a65a] font-bold" : "text-[#dd4b39] font-bold"}>
                          {passed ? "✓ Đạt" : "✗ Lỗi"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>

          {/* Cột phải: Checklist 5S & Nhận xét */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            <Panel title="Đánh giá chi tiết 4 khu vực 5S">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {AREAS.map((a) => {
                  const ok = result.checklist[a.checklistKey];
                  return (
                    <div
                      key={a.key}
                      className={`flex items-center justify-between border rounded-sm px-3 py-2.5 ${
                        ok ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                      }`}
                    >
                      <span>
                        {a.emoji} {a.label}
                      </span>
                      {ok ? (
                        <span className="flex items-center gap-1 text-[#00a65a] font-semibold">
                          <CheckCircle2 size={15} /> Đạt
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[#dd4b39] font-semibold">
                          <XCircle size={15} /> Chưa đạt
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Panel title="❌ Điểm cần khắc phục">
                {result.issues_detected.length ? (
                  <ul className="list-disc list-inside text-[#dd4b39] flex flex-col gap-1">
                    {result.issues_detected.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-400">Không có lỗi nào 🎉</p>
                )}
              </Panel>
              <Panel title="✅ Điểm làm tốt">
                {result.positive_notes.length ? (
                  <ul className="list-disc list-inside text-[#00a65a] flex flex-col gap-1">
                    {result.positive_notes.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-400">Chưa có điểm nổi bật.</p>
                )}
              </Panel>
            </div>

            <div className="bg-white border-l-4 border-[#3c8dbc] shadow-sm p-4 flex gap-3">
              <Lightbulb className="text-[#f39c12] shrink-0" />
              <div>
                <p className="font-semibold">Gợi ý từ AI</p>
                <p className="text-gray-600">{result.recommendations}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => router.push("/student/camera")}
                className="flex items-center gap-2 bg-[#3c8dbc] hover:bg-[#367fa9] text-white px-5 py-2.5 rounded-sm font-semibold"
              >
                <Camera size={16} /> Dọn xong — chụp lại 4 ảnh
              </button>
              <button
                onClick={() => router.push("/student/history")}
                className="flex items-center gap-2 border border-gray-300 bg-white hover:bg-gray-50 px-5 py-2.5 rounded-sm font-semibold"
              >
                <History size={16} /> Xem lịch sử
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
