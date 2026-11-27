"use client";
// TRANG THÔNG BÁO & NHẬT KÝ HOẠT ĐỘNG CÁN BỘ — MODERN NAVY-BLUE THEME
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Bell, CheckCircle2, CheckCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import Panel from "@/components/Panel";

type NotifType = "warning" | "reminder" | "info";
type NotifItem = {
  id: string;
  type: NotifType;
  badge: string;
  title: string;
  desc: string;
  time: string;
  read: boolean;
  roomId?: string;
};

const INITIAL_NOTIFS: NotifItem[] = [
  {
    id: "n1",
    type: "warning",
    badge: "Cảnh báo",
    title: "Phòng A1-104 có kết quả vệ sinh dưới 5 điểm",
    desc: "Vui lòng kiểm tra hình ảnh giường tầng và nhắc nhở sinh viên khắc phục sớm.",
    time: "10:24 · 27/11",
    read: false,
    roomId: "sub_2026-W48_A1-104",
  },
  {
    id: "n2",
    type: "reminder",
    badge: "Nhắc nhở",
    title: "Phòng B1-102 chưa nộp ảnh tuần này",
    desc: "Hạn nộp ảnh định kỳ: 21:00 Chủ nhật (29/11/2026).",
    time: "09:17 · 27/11",
    read: false,
  },
  {
    id: "n3",
    type: "info",
    badge: "Thông tin",
    title: "Phòng A3-301 đã hoàn tất nộp ảnh kiểm tra 5S",
    desc: "Hệ thống AI chấm đạt 9.8/10 (Sạch) và đã đồng bộ ảnh lên Cloudinary.",
    time: "13:21 · 25/11",
    read: true,
    roomId: "sub_2026-W48_A3-301",
  },
];

const ACTIVITY_LOGS = [
  { time: "27/11/2026 08:45", actor: "Quản trị viên Hệ thống", action: "Duyệt kết quả", detail: "Phòng A3-301" },
  { time: "26/11/2026 16:47", actor: "Nguyễn Văn An", action: "Gửi nhắc nhở", detail: "Phòng B1-102" },
  { time: "25/11/2026 13:21", actor: "Hệ thống AI 5S", action: "Chấm điểm tự động", detail: "Phòng A3-301 (9.8/10)" },
];

const NOTIFS_STORAGE_KEY = "ktx5s_admin_notifications";


export default function AdminNotificationsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | NotifType>("all");
  const [items, setItems] = useState<NotifItem[]>(INITIAL_NOTIFS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(NOTIFS_STORAGE_KEY);
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  const visible = filter === "all" ? items : items.filter((n) => n.type === filter);

  const markAllRead = () => {
    const updated = items.map((n) => ({ ...n, read: true }));
    setItems(updated);
    try {
      localStorage.setItem(NOTIFS_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event("ktx5s-notifications-updated"));
    } catch {
      // ignore
    }
  };


  return (
    <AppShell role="admin" title="Thông báo" showBack={false}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Thông báo</h1>
            <p className="text-sm text-slate-500">Cập nhật mới nhất từ hệ thống kiểm tra 5S</p>
          </div>
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold shadow-2xs transition"
          >
            <CheckCheck size={15} className="text-[#1d4ed8]" /> Đánh dấu đã đọc tất cả
          </button>
        </div>

        {/* Bộ lọc Pill */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", `Tất cả (${items.length})`],
              ["warning", `Cảnh báo (${items.filter((i) => i.type === "warning").length})`],
              ["reminder", `Nhắc nhở (${items.filter((i) => i.type === "reminder").length})`],
              ["info", `Thông tin (${items.filter((i) => i.type === "info").length})`],
            ] as const
          ).map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
                filter === k
                  ? "bg-[#1d4ed8] text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        {/* Danh sách thông báo */}
        <div className="space-y-3">
          {visible.map((n) => {
            const Icon =
              n.type === "warning" ? AlertCircle : n.type === "reminder" ? Bell : CheckCircle2;
            const colorCls =
              n.type === "warning"
                ? "bg-rose-500 text-white"
                : n.type === "reminder"
                ? "bg-blue-500 text-white"
                : "bg-emerald-500 text-white";
            const badgeCls =
              n.type === "warning"
                ? "bg-rose-50 text-rose-600"
                : n.type === "reminder"
                ? "bg-blue-50 text-blue-600"
                : "bg-emerald-50 text-emerald-700";

            return (
              <div
                key={n.id}
                onClick={() => n.roomId && router.push(`/admin/rooms?id=${n.roomId}`)}
                className={`bg-white rounded-2xl border p-4 flex items-start gap-3.5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] transition ${
                  n.read ? "border-slate-200/80" : "border-blue-200 bg-blue-50/20"
                } ${n.roomId ? "cursor-pointer hover:border-blue-300" : ""}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${colorCls}`}>
                  <Icon size={19} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${badgeCls}`}>
                        {n.badge}
                      </span>
                      <h3 className="font-bold text-slate-800 text-sm">{n.title}</h3>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{n.time}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">{n.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Nhật ký hoạt động */}
        <Panel title="Nhật ký hoạt động">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="pb-2.5 font-semibold">Thời gian</th>
                  <th className="pb-2.5 font-semibold">Người thực hiện</th>
                  <th className="pb-2.5 font-semibold">Hành động</th>
                  <th className="pb-2.5 font-semibold">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ACTIVITY_LOGS.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-3 text-slate-500 whitespace-nowrap">{row.time}</td>
                    <td className="py-3 font-semibold text-slate-800 whitespace-nowrap">{row.actor}</td>
                    <td className="py-3 text-slate-600">{row.action}</td>
                    <td className="py-3 font-semibold text-[#1d4ed8]">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
