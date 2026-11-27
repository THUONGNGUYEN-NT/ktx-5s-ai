"use client";
// TRANG CHI TIẾT PHÒNG & DUYỆT KẾT QUẢ — MODERN NAVY-BLUE THEME (DESKTOP & MOBILE)
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Save,
  Building2,
  Layers,
  Users,
  Camera,
  Clock,
  Sparkles,
  Info,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import Panel from "@/components/Panel";
import { getSubmissionDetail, overrideSubmission, type SubmissionDetail } from "@/lib/api";
import {
  AREAS,
  statusToKey,
  formatDateTime,
  getRoomMembersByCode,
  type TileKey,
} from "@/components/status";

export default function SubmissionDetailPage() {
  return (
    <Suspense fallback={null}>
      <Detail />
    </Suspense>
  );
}

const SCORE_STYLE: Record<TileKey, { box: string; text: string; badge: string }> = {
  clean: { box: "bg-emerald-50 border-emerald-200", text: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700" },
  slightly_messy: { box: "bg-amber-50 border-amber-200", text: "text-amber-600", badge: "bg-amber-100 text-amber-700" },
  messy: { box: "bg-rose-50 border-rose-200", text: "text-rose-600", badge: "bg-rose-100 text-rose-700" },
  fraud: { box: "bg-pink-50 border-pink-200", text: "text-pink-600", badge: "bg-pink-100 text-pink-700" },
  overridden: { box: "bg-indigo-50 border-indigo-200", text: "text-indigo-600", badge: "bg-indigo-100 text-indigo-700" },
  not_submitted: { box: "bg-slate-50 border-slate-200", text: "text-slate-600", badge: "bg-slate-100 text-slate-600" },
};

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
    if (!form.note.trim()) return setMessage("⚠️ Vui lòng nhập lý do duyệt kết quả.");
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

  if (loading) {
    return (
      <AppShell role="admin" title="Chi tiết phòng" showBack>
        <div className="bg-white rounded-2xl p-14 text-center text-slate-400">
          Đang tải chi tiết phòng...
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell role="admin" title="Chi tiết phòng" showBack>
        <Panel title="Không tìm thấy">
          <p className="text-slate-500">Lượt nộp không tồn tại hoặc phòng chưa nộp ảnh.</p>
        </Panel>
      </AppShell>
    );
  }

  const photoList =
    data.photos && data.photos.length > 0
      ? data.photos.map((p) => {
          const ck = p.checklist_key as keyof typeof data.ai_result.checklist | undefined;
          const ok = ck && ck in data.ai_result.checklist ? Boolean(data.ai_result.checklist[ck]) : true;
          return {
            key: p.slot_code,
            label: p.slot_label,
            url: p.image_url || data.image_url,
            ok,
          };
        })
      : AREAS.map((a) => ({
          key: a.key,
          label: a.label,
          url: data.area_images?.[a.key] ?? data.image_url,
          ok: data.ai_result.checklist[a.checklistKey],
        }));

  const currentPhoto = photoList[activeIndex] ?? photoList[0];
  const stKey = statusToKey(data.ai_result.status);
  const stStyle = SCORE_STYLE[stKey];
  const members = getRoomMembersByCode(data.room_code);
  const building = data.room_code?.[0] || "A";
  const floorMatch = data.room_code?.match(/^[A-Z](\d+)/);
  const floor = floorMatch ? floorMatch[1] : "1";

  return (
    <AppShell role="admin" title={`Phòng ${data.room_code}`} showBack>
      <div className="space-y-5">
        {/* Header phòng */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-800">Phòng {data.room_code}</h1>
            <span className={`${stStyle.badge} text-xs font-bold px-3 py-1 rounded-full`}>
              {data.ai_result.status}
            </span>
          </div>
          <a
            href="#override-form"
            className="inline-flex items-center gap-1.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <CheckCircle2 size={16} /> Duyệt kết quả
          </a>
        </div>

        {/* Nội dung 2 cột */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* CỘT TRÁI: Bộ ảnh + Kết quả phân tích AI */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.04)] p-4">
              {/* Ảnh chính */}
              <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentPhoto?.url ?? data.image_url}
                  alt={currentPhoto?.label}
                  className="w-full aspect-4/3 sm:aspect-video object-contain"
                />
                <span className="absolute top-3 left-3 bg-slate-900/75 backdrop-blur-xs text-white text-xs font-semibold px-3 py-1 rounded-lg">
                  {currentPhoto?.label}
                </span>
                <span className="absolute bottom-3 right-3 bg-slate-900/75 text-white text-xs font-bold px-2.5 py-1 rounded-lg">
                  {activeIndex + 1} / {photoList.length}
                </span>
              </div>

              {/* Dãy ảnh thu nhỏ */}
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mt-3">
                {photoList.map((p, idx) => {
                  const selected = idx === activeIndex;
                  return (
                    <button
                      key={`${p.key}_${idx}`}
                      type="button"
                      onClick={() => setActiveIndex(idx)}
                      className={`relative rounded-xl overflow-hidden border-2 transition text-left ${
                        selected
                          ? "border-[#1d4ed8] ring-2 ring-blue-200"
                          : "border-transparent hover:opacity-85"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={p.label} className="w-full aspect-4/3 object-cover" />
                      <div className="bg-white px-1.5 py-1 text-[10px] font-bold text-slate-700 truncate">
                        {p.key}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Khối Kết quả phân tích AI */}
              <div className="mt-4 bg-emerald-50/70 border border-emerald-200/70 rounded-xl p-3.5 flex items-start gap-3">
                <span className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <Sparkles size={16} />
                </span>
                <div className="text-xs sm:text-sm">
                  <p className="font-bold text-slate-800">Kết quả phân tích AI</p>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">
                    {data.ai_result.recommendations}
                  </p>
                </div>
              </div>

              {(data.ai_result.issues_detected?.length ?? 0) > 0 && (
                <div className="mt-3 bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs sm:text-sm">
                  <p className="font-bold text-rose-700 mb-1">Lỗi AI phát hiện:</p>
                  <ul className="list-disc list-inside text-rose-800 space-y-0.5">
                    {(data.ai_result.issues_detected ?? []).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-3 bg-blue-50/70 border border-blue-100 rounded-xl px-3.5 py-2.5 text-xs text-slate-600 flex items-center gap-2">
                <Info size={15} className="text-[#1d4ed8] shrink-0" />
                Mã lượt nộp: <b className="font-mono text-slate-800">{data.submission_id}</b>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: Thông tin phòng + Điểm vệ sinh + Checklist + Form duyệt kết quả */}
          <div className="lg:col-span-5 space-y-4">
            <Panel title="Thông tin phòng">
              <div className="divide-y divide-slate-100 text-sm mb-4">
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Building2 size={15} className="text-slate-400" /> Tòa nhà
                  </span>
                  <span className="font-bold text-slate-800">Tòa {building}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Layers size={15} className="text-slate-400" /> Tầng
                  </span>
                  <span className="font-bold text-slate-800">Tầng {floor}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Users size={15} className="text-slate-400" /> Số lượng SV
                  </span>
                  <span className="font-bold text-slate-800">{members} sinh viên</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Camera size={15} className="text-slate-400" /> Số ảnh đã nộp
                  </span>
                  <span className="font-bold text-slate-800">{photoList.length} ảnh</span>
                </div>
              </div>

              {/* Ô Điểm vệ sinh + Thời gian kiểm tra */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className={`rounded-2xl border p-3.5 text-center ${stStyle.box}`}>
                  <p className="text-xs font-semibold text-slate-600">Điểm vệ sinh</p>
                  <p className={`text-3xl font-black mt-1 ${stStyle.text}`}>
                    {data.ai_result.score.toFixed(1)}
                    <span className="text-sm font-semibold text-slate-400">/10</span>
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 flex flex-col justify-center">
                  <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <Clock size={13} /> Thời gian nộp
                  </p>
                  <p className="text-xs sm:text-sm font-bold text-slate-800 mt-1">
                    {formatDateTime(data.submitted_at)}
                  </p>
                </div>
              </div>

              {/* Checklist 4 nhóm */}
              <div className="space-y-2">
                {AREAS.map((a) => {
                  const ok = data.ai_result.checklist[a.checklistKey];
                  return (
                    <div
                      key={a.key}
                      className="flex items-center justify-between text-xs sm:text-sm py-1.5 px-3 rounded-xl bg-slate-50"
                    >
                      <span className="font-medium text-slate-700">{a.label}</span>
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
            </Panel>

            {/* Form cán bộ duyệt lại */}
            <div id="override-form">
              <Panel title="Cán bộ duyệt kết quả">
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Trạng thái mới
                      </label>
                      <select
                        value={form.new_status}
                        onChange={(e) => setForm({ ...form, new_status: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white focus:border-[#2563eb] focus:outline-none"
                      >
                        <option>Sạch</option>
                        <option>Hơi bừa bộn</option>
                        <option>Bừa bộn</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Điểm mới</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={form.new_score}
                        onChange={(e) => setForm({ ...form, new_score: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:border-[#2563eb] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Ghi chú / Lý do duyệt
                    </label>
                    <textarea
                      rows={2}
                      value={form.note}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                      placeholder="VD: Đã kiểm tra thực tế, phòng đạt chuẩn 5S..."
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:border-[#2563eb] focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white py-2.5 rounded-xl font-bold text-sm shadow-sm disabled:opacity-50 transition"
                  >
                    <Save size={16} /> {saving ? "Đang lưu..." : "Lưu kết quả duyệt"}
                  </button>

                  {message && <p className="text-xs font-semibold text-slate-700">{message}</p>}
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
