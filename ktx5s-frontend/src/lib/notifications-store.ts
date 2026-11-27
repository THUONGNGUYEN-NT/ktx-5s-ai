// Quản lý trạng thái Thông báo Cán bộ (lưu localStorage + đồng bộ tức thì badge đỏ trên Sidebar/Header/Mobile)
export type NotifType = "warning" | "reminder" | "info";

export type NotifItem = {
  id: string;
  type: NotifType;
  badge: string;
  title: string;
  desc: string;
  time: string;
  read: boolean;
  roomId?: string;
};

const NOTIF_STORAGE_KEY = "ktx5s_admin_notifs_v1";

export const DEFAULT_ADMIN_NOTIFS: NotifItem[] = [
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
    read: false,
    roomId: "sub_2026-W48_A3-301",
  },
];

function emitNotifsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("ktx5s-notifs-updated"));
  }
}

export function loadAdminNotifs(): NotifItem[] {
  if (typeof window === "undefined") return DEFAULT_ADMIN_NOTIFS;
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    if (!raw) return DEFAULT_ADMIN_NOTIFS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ADMIN_NOTIFS;
  } catch {
    return DEFAULT_ADMIN_NOTIFS;
  }
}

export function saveAdminNotifs(items: NotifItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(items));
    emitNotifsUpdated();
  } catch {}
}

export function markAllAdminNotifsRead(): NotifItem[] {
  const updated = loadAdminNotifs().map((n) => ({ ...n, read: true }));
  saveAdminNotifs(updated);
  return updated;
}

export function markOneAdminNotifRead(id: string): NotifItem[] {
  const updated = loadAdminNotifs().map((n) => (n.id === id ? { ...n, read: true } : n));
  saveAdminNotifs(updated);
  return updated;
}

export function deleteAdminNotif(id: string): NotifItem[] {
  const updated = loadAdminNotifs().filter((n) => n.id !== id);
  saveAdminNotifs(updated);
  return updated;
}

export function clearAllAdminNotifs(): NotifItem[] {
  saveAdminNotifs([]);
  return [];
}

export function resetDefaultAdminNotifs(): NotifItem[] {
  saveAdminNotifs(DEFAULT_ADMIN_NOTIFS);
  return DEFAULT_ADMIN_NOTIFS;
}

export function getUnreadAdminNotifCount(): number {
  return loadAdminNotifs().filter((n) => !n.read).length;
}
