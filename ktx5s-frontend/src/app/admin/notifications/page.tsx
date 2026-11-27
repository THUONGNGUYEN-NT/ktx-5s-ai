"use client";
// TRANG THÔNG BÁO & NHẬT KÝ HOẠT ĐỘNG CÁN BỘ — MODERN NAVY-BLUE THEME
// Đồng bộ trạng thái đã đọc / chưa đọc với badge thông báo trên Sidebar, Header và Mobile Bottom Nav
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Bell, CheckCircle2, CheckCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import Panel from "@/components/Panel";
import {
  loadAdminNotifs,
  markAllAdminNotifsRead,
  markOneAdminNotifRead,
  type NotifItem,
  type NotifType,
} from "@/lib/notifications-store";

const ACTIVITY_LOGS = [
  { time: "27/11/2026 08:45", actor: "Quản trị viên Hệ thống", action: "Duyệt kết quả", detail: "Phòng A3-301" },
  { time: "26/11/2026 16:47", actor: "Nguyễn Văn An", action: "Gửi nhắc nhở", detail: "Phòng B1-102" },
  { time: "25/11/2026 13:21", actor: "Hệ thống AI 5S", action: "Chấm điểm tự động", detail: "Phòng A3-301 (9.8/10)" },
];

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | NotifType>("all");
  const [items, setItems] = useState<NotifItem[]>([]);
  const [toast, setToast] = useState("");

  useEffect(() => {
    setItems(loadAdminNotifs());
  }, []);

  const visible = filter === "all" ? items : items.filter((n) => n.type === filter);
  const unreadCount = items.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    const updated = markAllAdminNotifsRead();
    setItems(updated);
    setToast("Đã đánh dấu tất cả thông báo là đã đọc!");
    setTimeout(() => setToast(""), 2500);
  };

  const handleClickNotif = (n: NotifItem) => {
    if (!n.read) {
      setItems(markOneAdminNotifRead(n.id));
    }
    if (n.roomId) {
      router.push(`/admin/rooms?id=${n.roomId}`);
    }
  };

  return (
    <AppShell role="admin" title="Thông báo" showBack={false}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2.5">
              Thông báo
              {unreadCount > 0 && (
                <span className="text-xs font-bold bg-rose-100 text-rose-600 px-2.5 py-0.5 rounded-full">
                  {unreadCount} chưa đọc
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-500">Cập nhật mới nhất từ hệ thống kiểm tra 5S</p>
          </div>

          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            className={`inline-flex items-center gap-1.5 border px-4 py-2 rounded-xl text-xs font-bold shadow-2xs transition ${
              unreadCount === 0
                ? "bg-slate-50 border-slate-200 text-slate-400 cursor-default"
                : "bg-white hover:bg-blue-50 border-blue-200 text-[#1d4ed8] cursor-pointer active:scale-[0.98]"
            }`}
          >
            <CheckCheck size={15} />
            {unreadCount === 0 ? "Đã đọc tất cả" : "Đánh dấu đã đọc tất cả"}
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
                onClick={() => handleClickNotif(n)}
                className={`rounded-2xl border p-4 flex items-start gap-3.5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] cursor-pointer transition ${
                  n.read
                    ? "bg-white border-slate-200/80 opacity-80 hover:opacity-100"
                    : "bg-[#f4f8ff] border-blue-200 hover:border-blue-300"
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${colorCls}`}>
                  <Icon size={19} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {!n.read && (
                        <span className="w-2.5 h-2.5 rounded-full bg-[#1d4ed8] shrink-0" title="Chưa đọc" />
                      )}
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${badgeCls}`}>
                        {n.badge}
                      </span>
                      <h3
                        className={`text-sm ${
                          n.read ? "font-semibold text-slate-700" : "font-extrabold text-slate-900"
                        }`}
                      >
                        {n.title}
                      </h3>
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

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 bg-[#1b365d] text-white px-4 py-3 rounded-xl shadow-xl text-xs sm:text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 size={17} className="text-emerald-400 shrink-0" />
          {toast}
        </div>
      )}
    </AppShell>
  );
}
