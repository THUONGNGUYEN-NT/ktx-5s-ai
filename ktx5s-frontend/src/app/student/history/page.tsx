"use client";
// TRANG LỊCH SỬ ĐÁNH GIÁ & KẾT QUẢ TUẦN SINH VIÊN — MODERN NAVY-BLUE THEME
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  Info,
  Maximize2,
  X,
  Camera,
  UserCheck,
  ArrowRight,
  Lightbulb,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import Panel from "@/components/Panel";
import { getSession } from "@/lib/session";
import { getRoomHistory, type HistorySubmission } from "@/lib/api";
import {
  AREAS,
  statusToKey,
  formatDateTime,
} from "@/components/status";
import type { AIResult } from "@/lib/mock-api";

export default function HistoryPage() {
  const [room, setRoom] = useState("");
  const [history, setHistory] = useState<HistorySubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<HistorySubmission | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    const code = getSession()?.roomCode ?? "A3-301";
    setRoom(code);
    getRoomHistory(code).then((res) => {
      const list = res.data.history as HistorySubmission[];
      setHistory(list);
      if (list.length > 0) setSelectedSubmission(list[0]);
      setLoading(false);
    });
  }, []);

  const filtered =
    statusFilter === "all" ? history : history.filter((h) => h.status === statusFilter);

  const badgeOf = (st: HistorySubmission["status"]) => {
    const k = statusToKey(st);
    if (k === "clean") return { badge: "bg-emerald-50 text-emerald-700", score: "text-emerald-600" };
    if (k === "slightly_messy") return { badge: "bg-amber-50 text-amber-700", score: "text-amber-600" };
    return { badge: "bg-rose-50 text-rose-600", score: "text-rose-600" };
  };

  return (
    <AppShell role="student" title="Lịch sử đánh giá" showBack={false}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              Lịch sử đánh giá
            </h1>
            <p className="text-sm text-slate-500">
              Xem kết quả chấm điểm 5S và hình ảnh đã nộp của phòng {room}
            </p>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 focus:border-[#2563eb] focus:outline-none"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="Sạch">Sạch</option>
            <option value="Hơi bừa bộn">Hơi bừa bộn</option>
            <option value="Bừa bộn">Bừa bộn</option>
          </select>
        </div>

        {/* ===== BẢNG LỊCH SỬ ===== */}
        <Panel title={`Danh sách lượt nộp (${filtered.length})`}>
          {loading ? (
            <p className="text-center text-slate-400 py-10">Đang tải lịch sử...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Camera size={36} className="mx-auto mb-2 opacity-50" />
              <p>Chưa có lượt nộp ảnh nào.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="pb-3 font-semibold">Tuần</th>
                    <th className="pb-3 font-semibold">Ngày nộp</th>
                    <th className="pb-3 font-semibold text-center">Điểm số</th>
                    <th className="pb-3 font-semibold">Trạng thái</th>
                    <th className="pb-3 font-semibold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((h) => {
                    const st = badgeOf(h.status);
                    const active = selectedSubmission?.submission_id === h.submission_id;
                    return (
                      <tr
                        key={h.submission_id}
                        onClick={() => setSelectedSubmission(h)}
                        className={`cursor-pointer transition ${
                          active ? "bg-blue-50/70" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="py-3.5 font-bold text-slate-800 whitespace-nowrap">
                          Tuần {h.week.split("-W")[1]}
                        </td>
                        <td className="py-3.5 text-slate-500 whitespace-nowrap">
                          {formatDateTime(h.submitted_at)}
                        </td>
                        <td className={`py-3.5 text-center font-black ${st.score}`}>
                          {h.score.toFixed(1)}
                          <span className="text-xs font-medium text-slate-400">/10</span>
                        </td>
                        <td className="py-3.5">
                          <span className={`${st.badge} text-xs font-bold px-3 py-1 rounded-full`}>
                            {h.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSubmission(h);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#1d4ed8] hover:underline"
                          >
                            {active ? "Đang xem" : "Xem chi tiết"} <ArrowRight size={13} />
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

        {/* ===== KẾT QUẢ ĐÁNH GIÁ TUẦN CHI TIẾT ===== */}
        {selectedSubmission && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* CỘT TRÁI: Hình ảnh đã nộp */}
              <Panel
                title={`Hình ảnh bạn đã nộp (${selectedSubmission.photos?.length || AREAS.length} ảnh)`}
                subtitle={`Tuần ${selectedSubmission.week.split("-W")[1]} · Nộp lúc ${formatDateTime(
                  selectedSubmission.submitted_at
                )}`}
                className="lg:col-span-7"
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {selectedSubmission.photos && selectedSubmission.photos.length > 0
                    ? selectedSubmission.photos.map((p, idx) => (
                        <div
                          key={`${p.slot_code}_${idx}`}
                          onClick={() =>
                            setZoomedImage({
                              url: p.image_url,
                              title: `${p.slot_label} — Phòng ${room}`,
                            })
                          }
                          className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 cursor-pointer"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.image_url}
                            alt={p.slot_label}
                            className="w-full aspect-4/3 object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                            <span className="bg-black/65 text-white text-[11px] px-2 py-1 rounded-lg flex items-center gap-1">
                              <Maximize2 size={12} /> Phóng to
                            </span>
                          </div>
                          <div className="bg-white px-2 py-1.5 text-[11px] font-bold text-slate-700 truncate">
                            {p.slot_label}
                          </div>
                        </div>
                      ))
                    : AREAS.map((a) => {
                        const imgUrl =
                          selectedSubmission.area_images?.[a.key] || selectedSubmission.image_url;
                        return (
                          <div
                            key={a.key}
                            onClick={() =>
                              setZoomedImage({ url: imgUrl, title: `${a.label} — Phòng ${room}` })
                            }
                            className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 cursor-pointer"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imgUrl}
                              alt={a.label}
                              className="w-full aspect-4/3 object-cover"
                            />
                            <div className="bg-white px-2 py-1.5 text-[11px] font-bold text-slate-700 truncate">
                              {a.label}
                            </div>
                          </div>
                        );
                      })}
                </div>
              </Panel>

              {/* CỘT PHẢI: Điểm số & Chi tiết theo khu vực */}
              <Panel title="Kết quả đánh giá tuần" className="lg:col-span-5">
                <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
                  <div>
                    <p
                      className={`text-4xl font-black leading-none ${
                        badgeOf(selectedSubmission.status).score
                      }`}
                    >
                      {selectedSubmission.score.toFixed(1)}
                      <span className="text-base font-semibold text-slate-400 ml-1">/10</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1.5">
                      Kết quả được đánh giá bởi hệ thống AI
                    </p>
                  </div>
                  <span
                    className={`${
                      badgeOf(selectedSubmission.status).badge
                    } text-xs font-extrabold px-3.5 py-1.5 rounded-full`}
                  >
                    {selectedSubmission.status}
                  </span>
                </div>

                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                  Chi tiết theo khu vực
                </p>
                <div className="space-y-2">
                  {AREAS.map((a) => {
                    const ok =
                      selectedSubmission.ai_result?.checklist?.[
                        a.checklistKey as keyof AIResult["checklist"]
                      ] ?? true;
                    return (
                      <div
                        key={a.key}
                        className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 text-xs sm:text-sm"
                      >
                        <span className="font-semibold text-slate-700">{a.label}</span>
                        {ok ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                            <CheckCircle2 size={15} /> Đạt
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                            <XCircle size={15} /> Chưa đạt
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {selectedSubmission.is_overridden && selectedSubmission.override_note && (
                  <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-900">
                    <p className="font-bold flex items-center gap-1.5 mb-0.5">
                      <UserCheck size={14} /> Ghi chú từ Cán bộ KTX:
                    </p>
                    <p>{selectedSubmission.override_note}</p>
                  </div>
                )}
              </Panel>
            </div>

            {/* 2 Thẻ Pastel Nhận xét & Gợi ý cải thiện giống Mockup 3 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#eff6ff] border border-blue-100 rounded-2xl p-4 sm:p-5">
                <h3 className="text-sm font-extrabold text-[#1d4ed8] flex items-center gap-2 mb-2">
                  <Info size={17} /> Nhận xét từ hệ thống
                </h3>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {selectedSubmission.ai_result?.recommendations ||
                    "Phòng giữ gìn vệ sinh theo tiêu chuẩn 5S KTX."}
                </p>
              </div>

              <div className="bg-[#fef9e7] border border-amber-100 rounded-2xl p-4 sm:p-5">
                <h3 className="text-sm font-extrabold text-amber-700 flex items-center gap-2 mb-2">
                  <Lightbulb size={17} /> Gợi ý cải thiện
                </h3>
                {(selectedSubmission.ai_result?.issues_detected?.length ?? 0) > 0 ? (
                  <ul className="space-y-1 text-xs sm:text-sm text-slate-700">
                    {selectedSubmission.ai_result.issues_detected.map((iss, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-amber-600 font-bold">•</span>
                        <span>{iss}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs sm:text-sm text-slate-700 flex items-center gap-1.5">
                    <Sparkles size={15} className="text-emerald-600 shrink-0" />
                    Các khu vực giường tầng và khu vực chung đều đạt chuẩn 5S. Hãy tiếp tục duy trì!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox phóng to ảnh */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-3xl w-full"
          >
            <div className="bg-[#1b365d] text-white px-4 py-3 flex items-center justify-between text-xs sm:text-sm">
              <span className="font-bold truncate">{zoomedImage.title}</span>
              <button
                type="button"
                onClick={() => setZoomedImage(null)}
                className="p-1 rounded-lg hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <div className="bg-black p-2 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoomedImage.url}
                alt={zoomedImage.title}
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
