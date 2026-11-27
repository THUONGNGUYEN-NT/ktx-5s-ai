"use client";
// Trang CHI TIẾT LƯỢT NỘP (4 ẢNH KHU VỰC) + DUYỆT ĐÈ (Human-in-the-loop)
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Save } from "lucide-react";
import AppShell from "@/components/AppShell";
import Panel from "@/components/Panel";
import { getSubmissionDetail, overrideSubmission, type SubmissionDetail } from "@/lib/api";
import { AREAS, TILE_STYLES, statusToKey, formatDateTime, type AreaKey } from "@/components/status";

export default function SubmissionDetailPage() {
  return (
    <Suspense fallback={null}>
      <Detail />
    </Suspense>
  );
}

function Detail() {
  const id = useSearchParams().get("id") ?? "";
  const [data, setData] = useState<SubmissionDetail | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ new_status: "Sạch", new_score: "8.0", note: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getSubmissionDetail(id).then((res) => {
      setData(res.data);
      if (res.data) {
        setForm((f) => ({
          ...f,
          new_status: res.data!.ai_result.status,
          new_score: res.data!.ai_result.score.toFixed(1),
        }));
      }
      setLoading(false);
    });
  }, [id]);

  const save = async () => {
    if (!form.note.trim()) return setMessage("⚠️ Vui lòng nhập lý do chỉnh sửa.");
    const score = Number(form.new_score);
    if (isNaN(score) || score < 0 || score > 10) return setMessage("⚠️ Điểm phải từ 0 đến 10.");
    setSaving(true);
    const res = await overrideSubmission(id, {
      new_status: form.new_status,
      new_score: score,
      note: form.note.trim(),
    });
    setSaving(false);
    setMessage(res.success ? "✅ " + res.message : "❌ " + res.message);
  };

  return (
    <AppShell role="admin" title="Chi tiết lượt nộp & Duyệt kết quả 5S">
      {loading ? (
        <p className="text-center text-gray-400 py-16">Đang tải...</p>
      ) : !data ? (
        <Panel title="Không tìm thấy">Lượt nộp không tồn tại hoặc phòng chưa nộp ảnh.</Panel>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Cột trái: Toàn bộ ảnh đã nộp của phòng */}
          {(() => {
            const photoList =
              data.photos && data.photos.length > 0
                ? data.photos.map((p) => {
                    const ck = p.checklist_key as keyof typeof data.ai_result.checklist | undefined;
                    const ok =
                      ck && ck in data.ai_result.checklist
                        ? Boolean(data.ai_result.checklist[ck])
                        : true;
                    return {
                      key: p.slot_code,
                      label: p.slot_label,
                      url: p.image_url || data.image_url,
                      ok,
                    };
                  })
                : AREAS.map((a) => ({
                    key: a.key,
                    label: `${a.emoji} ${a.label}`,
                    url: data.area_images?.[a.key] ?? data.image_url,
                    ok: data.ai_result.checklist[a.checklistKey],
                  }));
            const currentPhoto = photoList[activeIndex] ?? photoList[0];

            return (
              <Panel title={`Bộ ${photoList.length} ảnh đã nộp — Phòng ${data.room_code}`} className="lg:col-span-3">
                {/* Ảnh đang chọn phóng to */}
                <div className="relative rounded-sm overflow-hidden border border-gray-200 bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentPhoto?.url ?? data.image_url}
                    alt={`Phòng ${data.room_code}`}
                    className="w-full aspect-video object-contain bg-slate-900"
                  />
                  <span className="absolute top-2.5 left-2.5 bg-black/70 text-white text-xs px-3 py-1 rounded-sm font-semibold">
                    {currentPhoto?.label}
                  </span>
                </div>

                {/* Lưới tất cả ảnh thu nhỏ để chuyển nhanh */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
                  {photoList.map((p, idx) => {
                    const isSelected = idx === activeIndex;
                    return (
                      <button
                        key={`${p.key}_${idx}`}
                        type="button"
                        onClick={() => setActiveIndex(idx)}
                        className={`border rounded-sm overflow-hidden text-left transition ${
                          isSelected ? "ring-2 ring-[#3c8dbc] border-[#3c8dbc]" : "border-gray-200 hover:opacity-90"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt={p.label}
                          className="w-full aspect-video object-contain bg-slate-900"
                        />
                        <div className="px-2 py-1.5 flex items-center justify-between gap-1 text-xs bg-white">
                          <span className="font-semibold truncate" title={p.label}>
                            {p.label}
                          </span>
                          <span className={p.ok ? "text-[#00a65a] font-bold shrink-0" : "text-[#dd4b39] font-bold shrink-0"}>
                            {p.ok ? "✓ Đạt" : "✗ Lỗi"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-between text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
                  <span>
                    Mã lượt nộp: <b>{data.submission_id}</b>
                  </span>
                  <span>
                    Nộp lúc: <b>{formatDateTime(data.submitted_at)}</b>
                  </span>
                </div>
              </Panel>
            );
          })()}

          {/* Cột phải: Kết quả AI + Form duyệt đè */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            <Panel title="Kết quả AI chấm">
              <div className="flex items-center gap-4">
                <div
                  className={`${
                    TILE_STYLES[statusToKey(data.ai_result.status)].bg
                  } text-white rounded-sm w-24 h-24 flex flex-col items-center justify-center shrink-0`}
                >
                  <span className="text-3xl font-black">{data.ai_result.score.toFixed(1)}</span>
                  <span className="text-[11px]">/ 10 điểm</span>
                </div>
                <div>
                  <p className={`text-lg font-bold ${TILE_STYLES[statusToKey(data.ai_result.status)].text}`}>
                    {data.ai_result.status}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{data.ai_result.recommendations}</p>
                </div>
              </div>

              <table className="w-full mt-4 text-[13px]">
                <tbody>
                  {AREAS.map((a) => (
                    <tr key={a.key} className="border-t border-gray-100">
                      <td className="py-2">
                        {a.emoji} {a.label}
                      </td>
                      <td className="py-2 text-right">
                        {data.ai_result.checklist[a.checklistKey] ? (
                          <span className="inline-flex items-center gap-1 text-[#00a65a] font-semibold">
                            <CheckCircle2 size={14} /> Đạt
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#dd4b39] font-semibold">
                            <XCircle size={14} /> Chưa đạt
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(data.ai_result.issues_detected?.length ?? 0) > 0 && (
                <div className="mt-3 bg-red-50 border-l-4 border-[#dd4b39] p-3">
                  <p className="font-semibold text-[#dd4b39] mb-1">Lỗi phát hiện</p>
                  <ul className="list-disc list-inside text-gray-600">
                    {(data.ai_result.issues_detected ?? []).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>

            <Panel title="Cán bộ duyệt lại kết quả">
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3">
                  <span className="w-24 font-semibold">Trạng thái</span>
                  <select
                    value={form.new_status}
                    onChange={(e) => setForm({ ...form, new_status: e.target.value })}
                    className="flex-1 border border-gray-300 rounded-sm px-2 py-1.5 bg-white"
                  >
                    <option>Sạch</option>
                    <option>Hơi bừa bộn</option>
                    <option>Bừa bộn</option>
                  </select>
                </label>
                <label className="flex items-center gap-3">
                  <span className="w-24 font-semibold">Điểm mới</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={form.new_score}
                    onChange={(e) => setForm({ ...form, new_score: e.target.value })}
                    className="flex-1 border border-gray-300 rounded-sm px-2 py-1.5"
                  />
                </label>
                <label className="flex gap-3">
                  <span className="w-24 font-semibold pt-1.5">Lý do</span>
                  <textarea
                    rows={3}
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="VD: Ánh sáng kém khiến AI nhầm..."
                    className="flex-1 border border-gray-300 rounded-sm px-2 py-1.5"
                  />
                </label>
                <div className="flex items-center gap-3 pl-[108px]">
                  <button
                    onClick={save}
                    disabled={saving}
                    className="flex items-center gap-1.5 bg-[#605ca8] hover:bg-[#555299] text-white px-4 py-1.5 rounded-sm disabled:opacity-60"
                  >
                    <Save size={14} /> {saving ? "Đang lưu..." : "Lưu kết quả duyệt"}
                  </button>
                </div>
                {message && <p className="text-sm">{message}</p>}
              </div>
            </Panel>
          </div>
        </div>
      )}
    </AppShell>
  );
}
