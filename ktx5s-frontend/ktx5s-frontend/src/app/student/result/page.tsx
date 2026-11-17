"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";

type Checklist = { bed_tidy: boolean; floor_clean: boolean; desk_organized: boolean; shoes_arranged: boolean };
type AIResult = {
  status: "Sạch" | "Hơi bừa bộn" | "Bừa bộn";
  score: number;
  checklist: Checklist;
  issues_detected: string[];
  positive_notes: string[];
  recommendations: string;
};

const checklistLabels: Record<keyof Checklist, string> = {
  bed_tidy: "🛏️ Giường gọn gàng",
  floor_clean: "🧹 Sàn sạch sẽ",
  desk_organized: "📚 Bàn học ngăn nắp",
  shoes_arranged: "👟 Giày dép đúng chỗ",
};

export default function ResultPage() {
  const [result, setResult] = useState<AIResult | null>(null);
  const router = useRouter();

  useEffect(() => {
    const raw = sessionStorage.getItem("ai_result");
    if (!raw) { router.push("/student"); return; }
    setResult(JSON.parse(raw));
  }, [router]);

  if (!result) return <div className="flex items-center justify-center min-h-screen">Đang tải...</div>;

  const scoreColor =
    result.score >= 8 ? "text-green-600" : result.score >= 5 ? "text-yellow-600" : "text-red-600";

  return (
    <main className="flex flex-col gap-5 p-6 max-w-sm mx-auto pb-20">
      <h1 className="text-2xl font-bold text-gray-800">🤖 Kết quả AI chấm</h1>

      {/* Điểm số lớn */}
      <div className="bg-white rounded-2xl p-6 shadow flex flex-col items-center gap-3">
        <span className={`text-6xl font-black ${scoreColor}`}>{result.score.toFixed(1)}</span>
        <span className="text-gray-400 text-sm">/ 10 điểm</span>
        <StatusBadge status={result.status} />
      </div>

      {/* Checklist */}
      <div className="bg-white rounded-2xl p-5 shadow">
        <h2 className="font-semibold text-gray-700 mb-3">📋 Checklist 5S</h2>
        <div className="flex flex-col gap-2">
          {(Object.keys(checklistLabels) as (keyof Checklist)[]).map((key) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{checklistLabels[key]}</span>
              <span className={`font-bold ${result.checklist[key] ? "text-green-500" : "text-red-400"}`}>
                {result.checklist[key] ? "✓ Đạt" : "✗ Chưa đạt"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Lỗi phát hiện */}
      {result.issues_detected.length > 0 && (
        <div className="bg-red-50 rounded-2xl p-5 border border-red-100">
          <h2 className="font-semibold text-red-700 mb-2">❌ Điểm cần khắc phục</h2>
          <ul className="list-disc list-inside text-sm text-red-600 flex flex-col gap-1">
            {result.issues_detected.map((issue, i) => <li key={i}>{issue}</li>)}
          </ul>
        </div>
      )}

      {/* Điểm tích cực */}
      {result.positive_notes.length > 0 && (
        <div className="bg-green-50 rounded-2xl p-5 border border-green-100">
          <h2 className="font-semibold text-green-700 mb-2">✅ Điểm làm tốt</h2>
          <ul className="list-disc list-inside text-sm text-green-600 flex flex-col gap-1">
            {result.positive_notes.map((note, i) => <li key={i}>{note}</li>)}
          </ul>
        </div>
      )}

      {/* Gợi ý */}
      <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
        <h2 className="font-semibold text-blue-700 mb-1">💡 Gợi ý từ AI</h2>
        <p className="text-sm text-blue-600">{result.recommendations}</p>
      </div>

      <div className="flex flex-col gap-3">
        <button onClick={() => router.push("/student/history")} className="bg-gray-700 text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition-colors">
          📅 Xem lịch sử các tuần
        </button>
        <button onClick={() => router.push("/student")} className="text-blue-500 py-2 text-sm hover:underline">
          ← Về trang chủ
        </button>
      </div>
    </main>
  );
}
