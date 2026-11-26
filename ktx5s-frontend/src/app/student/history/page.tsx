"use client";
// TRANG LỊCH SỬ ĐÁNH GIÁ CỦA PHÒNG — XEM CHI TIẾT KẾT QUẢ & 4 ẢNH CHỤP THỰC TẾ
import { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  Info,
  Maximize2,
  X,
  Eye,
  Camera,
  UserCheck,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import Panel from "@/components/Panel";
import { getSession } from "@/lib/session";
import { getRoomHistory, type HistorySubmission } from "@/lib/api";
import {
  TILE_STYLES,
  statusToKey,
  formatDateTime,
  type AreaKey,
} from "@/components/status";
import type { AIResult } from "@/lib/mock-api";

const AREAS: {
  key: AreaKey;
  label: string;
  emoji: string;
  checklistKey: keyof AIResult["checklist"];
}[] = [
  { key: "bed", label: "L1 · Giường ngủ (tổng hợp B01..BP)", emoji: "🛏️", checklistKey: "bed_tidy" },
  { key: "floor", label: "L2 · Sàn nhà và lối đi", emoji: "🧹", checklistKey: "floor_clean" },
  { key: "desk", label: "L3 · Bàn học và kệ", emoji: "📚", checklistKey: "desk_organized" },
  { key: "shoes", label: "L4 · Đồ đạc và kệ giày dép", emoji: "👟", checklistKey: "shoes_arranged" },
];

export default function HistoryPage() {
  const [room, setRoom] = useState("");
  const [history, setHistory] = useState<HistorySubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<HistorySubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    const code = getSession()?.roomCode ?? "";
    setRoom(code);
    getRoomHistory(code).then((res) => {
      const list = res.data.history as HistorySubmission[];
      setHistory(list);
      if (list.length > 0) {
        // Tự động mở xem chi tiết lượt nộp gần nhất
        setSelectedSubmission(list[0]);
      }
      setLoading(false);
    });
  }, []);

  return (
    <AppShell role="student" title="Lịch sử đánh giá 5S">
      <div className="flex flex-col gap-5">
        {/* BẢNG DANH SÁCH CÁC TUẦN ĐÃ NỘP */}
        <Panel title={`Lịch sử đánh giá phòng ${room} (${history.length} lượt nộp)`}>
          {loading ? (
            <p className="text-center text-gray-400 py-10">Đang tải lịch sử...</p>
          ) : history.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <Camera size={36} className="mx-auto text-gray-300 mb-2" />
              <p>Phòng bạn chưa có lượt nộp ảnh nào.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-gray-50 text-left border-b border-gray-200">
                    <th className="p-3">Tuần</th>
                    <th className="p-3">Thời gian nộp</th>
                    <th className="p-3 text-center">Điểm 5S</th>
                    <th className="p-3">Xếp loại</th>
                    <th className="p-3">Ghi chú cán bộ</th>
                    <th className="p-3 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => {
                    const s = TILE_STYLES[statusToKey(h.status)];
                    const isSelected = selectedSubmission?.submission_id === h.submission_id;
                    return (
                      <tr
                        key={h.submission_id}
                        onClick={() => setSelectedSubmission(h)}
                        className={`border-b border-gray-100 cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-blue-50/80 font-medium"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="p-3">
                          <span className="font-semibold text-gray-900">
                            Tuần {h.week.split("-W")[1]}
                          </span>{" "}
                          <span className="text-gray-400 text-xs">/ {h.week.split("-")[0]}</span>
                        </td>
                        <td className="p-3 text-gray-600">
                          {formatDateTime(h.submitted_at)}
                        </td>
                        <td className={`p-3 text-center font-bold text-base ${s.text}`}>
                          {h.score.toFixed(1)}
                        </td>
                        <td className="p-3">
                          <span className={`${s.bg} text-white text-[11px] font-semibold px-2.5 py-1 rounded-sm shadow-xs`}>
                            {h.status}
                          </span>
                        </td>
                        <td className="p-3 text-gray-500 text-xs">
                          {h.is_overridden && h.override_note ? (
                            <span className="text-[#605ca8] font-medium flex items-center gap-1">
                              <UserCheck size={13} /> {h.override_note}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSubmission(h);
                            }}
                            className={`px-3 py-1 text-xs rounded font-semibold flex items-center gap-1 ml-auto transition ${
                              isSelected
                                ? "bg-[#3c8dbc] text-white shadow-xs"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            <Eye size={13} /> {isSelected ? "Đang xem" : "Xem chi tiết"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* KHU VỰC XEM CHI TIẾT KẾT QUẢ & 4 ẢNH CHỤP THỰC TẾ */}
        {selectedSubmission && (
          <div className="border border-blue-200 rounded bg-white shadow-md overflow-hidden animate-in fade-in duration-200">
            {/* Header chi tiết */}
            <div className="bg-[#222d32] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Calendar size={18} className="text-[#3c8dbc]" />
                <h3 className="font-bold text-sm">
                  Chi tiết kết quả đánh giá 5S — Tuần {selectedSubmission.week.split("-W")[1]} / {selectedSubmission.week.split("-")[0]}
                </h3>
                <span className="text-xs text-gray-300">
                  (Mã: {selectedSubmission.submission_id})
                </span>
              </div>
              <span className="text-xs text-gray-300">
                Nộp lúc: <b>{formatDateTime(selectedSubmission.submitted_at)}</b>
              </span>
            </div>

            <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* CỘT TRÁI: 4 ẢNH CHỤP THỰC TẾ CỦA 4 KHU VỰC (lg:col-span-6) */}
              <div className="lg:col-span-6 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                    <Camera size={15} className="text-[#3c8dbc]" />
                    Bộ 4 ảnh chụp phòng thực tế
                  </h4>
                  <span className="text-[11px] text-gray-400">Click ảnh để phóng to</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {AREAS.map((a) => {
                    const imgUrl =
                      selectedSubmission.area_images?.[a.key] ||
                      selectedSubmission.image_url;
                    const isOk =
                      selectedSubmission.ai_result?.checklist?.[a.checklistKey] ?? true;

                    return (
                      <div
                        key={a.key}
                        onClick={() => setZoomedImage({ url: imgUrl, title: `${a.emoji} ${a.label} - Phòng ${room}` })}
                        className="group relative border border-gray-200 rounded overflow-hidden bg-slate-900 cursor-pointer shadow-xs hover:shadow-md transition-all"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imgUrl}
                          alt={a.label}
                          className="w-full aspect-4/3 object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <span className="bg-black/60 text-white text-[11px] px-2 py-1 rounded flex items-center gap-1 backdrop-blur-xs">
                            <Maximize2 size={12} /> Phóng to
                          </span>
                        </div>
                        <div className="p-2 bg-white flex items-center justify-between text-xs border-t border-gray-100">
                          <span className="font-semibold text-gray-800">
                            {a.emoji} {a.label}
                          </span>
                          <span
                            className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                              isOk
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {isOk ? "✓ Đạt" : "✗ Lỗi"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CỘT PHẢI: KẾT QUẢ CHẤM ĐIỂM, CHECKLIST, NHẬN XÉT (lg:col-span-6) */}
              <div className="lg:col-span-6 flex flex-col gap-4">
                {/* Khối Điểm số & Xếp loại */}
                <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded p-4">
                  <div
                    className={`${
                      TILE_STYLES[statusToKey(selectedSubmission.status)].bg
                    } text-white rounded w-20 h-20 flex flex-col items-center justify-center shrink-0 shadow-sm`}
                  >
                    <span className="text-3xl font-black">
                      {selectedSubmission.score.toFixed(1)}
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider">/ 10 điểm</span>
                  </div>
                  <div>
                    <span
                      className={`text-xl font-bold ${
                        TILE_STYLES[statusToKey(selectedSubmission.status)].text
                      }`}
                    >
                      {selectedSubmission.status}
                    </span>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                      {selectedSubmission.ai_result?.recommendations ||
                        "Phòng giữ gìn vệ sinh theo tiêu chuẩn 5S KTX."}
                    </p>
                  </div>
                </div>

                {/* Bảng checklist 4 tiêu chí 5S */}
                <div className="border border-gray-200 rounded overflow-hidden">
                  <div className="bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Đánh giá chi tiết 4 tiêu chuẩn 5S
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {AREAS.map((a) => {
                        const ok =
                          selectedSubmission.ai_result?.checklist?.[a.checklistKey] ?? true;
                        return (
                          <tr key={a.key} className="border-t border-gray-100">
                            <td className="p-2.5 font-medium text-gray-800">
                              {a.emoji} {a.label}
                            </td>
                            <td className="p-2.5 text-right">
                              {ok ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                                  <CheckCircle2 size={14} /> Đạt tiêu chuẩn
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                                  <XCircle size={14} /> Chưa đạt
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Lỗi phát hiện (nếu có) */}
                {selectedSubmission.ai_result?.issues_detected &&
                  selectedSubmission.ai_result.issues_detected.length > 0 && (
                    <div className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded-r text-xs">
                      <p className="font-bold text-rose-700 mb-1 flex items-center gap-1.5">
                        <AlertTriangle size={14} /> Điểm cần khắc phục:
                      </p>
                      <ul className="list-disc list-inside text-rose-900 space-y-0.5">
                        {selectedSubmission.ai_result.issues_detected.map((iss, i) => (
                          <li key={i}>{iss}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Điểm tích cực / Khen ngợi (nếu có) */}
                {selectedSubmission.ai_result?.positive_notes &&
                  selectedSubmission.ai_result.positive_notes.length > 0 && (
                    <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded-r text-xs">
                      <p className="font-bold text-emerald-700 mb-1 flex items-center gap-1.5">
                        <Sparkles size={14} /> Điểm tích cực:
                      </p>
                      <ul className="list-disc list-inside text-emerald-900 space-y-0.5">
                        {selectedSubmission.ai_result.positive_notes.map((pos, i) => (
                          <li key={i}>{pos}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Ghi chú của Cán bộ (nếu có phê duyệt lại) */}
                {selectedSubmission.is_overridden && selectedSubmission.override_note && (
                  <div className="bg-purple-50 border border-purple-200 rounded p-3 text-xs text-purple-900">
                    <p className="font-bold flex items-center gap-1 text-purple-800 mb-0.5">
                      <Info size={14} /> Ghi chú từ Cán bộ quản lý KTX:
                    </p>
                    <p>{selectedSubmission.override_note}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL PHÓNG TO ẢNH CHỤP */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg shadow-2xl overflow-hidden max-w-3xl w-full"
          >
            <div className="bg-gray-900 text-white px-4 py-2.5 flex items-center justify-between text-xs">
              <span className="font-bold">{zoomedImage.title}</span>
              <button
                type="button"
                onClick={() => setZoomedImage(null)}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>
            <div className="bg-black p-2 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoomedImage.url}
                alt={zoomedImage.title}
                className="max-h-[75vh] w-auto object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
