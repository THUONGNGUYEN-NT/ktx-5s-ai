"use client";
// Khung giao diện chung: menu tối bên trái + thanh tiêu đề + nút Quay lại + chân trang
// Tự động đồng bộ Họ tên & Avatar của Sinh viên / Cán bộ theo thời gian thực
import { ReactNode, useCallback, useEffect, useState, type ElementType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  ArrowLeft,
  Bell,
  LogOut,
  LayoutGrid,
  BarChart3,
  Camera,
  ClipboardCheck,
  History,
  Home,
  ChevronRight,
  UserCog,
  UserCheck,
} from "lucide-react";
import { getSession, clearSession, type Session, type UserRole } from "@/lib/session";
import { findAccountByUsername, getAllAccounts, type UserAccount } from "@/lib/user-store";

type MenuItem = { href: string; label: string; icon: ElementType };

const MENUS: Record<UserRole, MenuItem[]> = {
  admin: [
    { href: "/admin", label: "Quản lý phòng", icon: LayoutGrid },
    { href: "/admin/stats", label: "Thống kê tuần", icon: BarChart3 },
    { href: "/admin/profile", label: "Hồ sơ & Đổi mật khẩu", icon: UserCog },
  ],
  student: [
    { href: "/student", label: "Trang chủ", icon: Home },
    { href: "/student/camera", label: "Nộp ảnh phòng", icon: Camera },
    { href: "/student/history", label: "Lịch sử đánh giá", icon: History },
    { href: "/student/profile", label: "Hồ sơ & Đổi mật khẩu", icon: UserCheck },
  ],
};

export default function AppShell({
  role,
  title,
  showBack = true,
  children,
}: {
  role: UserRole;
  title: string;
  showBack?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const syncUserState = useCallback(() => {
    const s = getSession();
    if (!s || s.role !== role) {
      router.replace("/login");
      return;
    }
    setSession(s);

    let acc: UserAccount | null = null;
    if (s.username) {
      acc = findAccountByUsername(s.username);
    } else if (s.role === "student" && s.roomCode) {
      acc = getAllAccounts().find((a) => a.role === "student" && a.roomCode === s.roomCode) || null;
    } else if (s.role === "admin") {
      acc = findAccountByUsername("admin");
    }
    setAccount(acc);
  }, [role, router]);

  useEffect(() => {
    syncUserState();
    window.addEventListener("ktx5s-profile-updated", syncUserState);
    return () => window.removeEventListener("ktx5s-profile-updated", syncUserState);
  }, [syncUserState]);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ecf0f5] text-gray-500 text-sm">
        Đang kiểm tra đăng nhập...
      </div>
    );
  }

  const fullName =
    account?.name ||
    session.name ||
    (session.role === "admin" ? "Quản trị viên Hệ thống" : `Phòng ${session.roomCode ?? ""}`);

  const roomCode = account?.roomCode || session.roomCode || "";
  const studentCode = account?.studentCode || "";
  const subtitle =
    session.role === "admin"
      ? account?.unit || "Cán bộ Quản lý KTX"
      : `Phòng ${roomCode}${studentCode ? ` · MSSV ${studentCode}` : ""}`;

  const headerGreeting =
    session.role === "admin" ? fullName : `${fullName}${roomCode ? ` (${roomCode})` : ""}`;

  const avatarUrl = account?.avatarUrl || session.avatarUrl || "";
  const avatarColor = account?.avatarColor || session.avatarColor || "#3c8dbc";
  const initial = fullName.trim().charAt(0).toUpperCase() || "U";
  const profileHref = role === "admin" ? "/admin/profile" : "/student/profile";

  const logout = () => {
    clearSession();
    sessionStorage.removeItem("ai_result");
    router.replace("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#ecf0f5] text-[13px] text-gray-700">
      {/* ===== MENU BÊN TRÁI ===== */}
      <aside
        className={`${collapsed ? "w-16" : "w-60"} bg-[#222d32] text-[#b8c7ce] flex flex-col shrink-0 transition-all duration-200`}
      >
        <div className="h-14 bg-white flex items-center justify-center border-b border-gray-200 shrink-0">
          {collapsed ? (
            <span className="text-[#3c8dbc] font-black text-lg">5S</span>
          ) : (
            <span className="text-2xl tracking-tight">
              <span className="italic text-teal-500 font-semibold">ktx</span>
              <span className="font-black text-[#3c8dbc]">5S AI</span>
            </span>
          )}
        </div>

        {!collapsed ? (
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#1a2226]">
            <Link
              href={profileHref}
              title="Bấm để chỉnh sửa hồ sơ & đổi Avatar"
              className="relative w-11 h-11 rounded-full text-white flex items-center justify-center text-base font-bold shrink-0 overflow-hidden ring-2 ring-white/20 hover:ring-teal-400 transition-all group"
              style={{ backgroundColor: avatarColor }}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
              ) : (
                initial
              )}
              <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera size={14} className="text-white" />
              </span>
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                href={profileHref}
                className="text-white font-semibold truncate hover:text-teal-300 block leading-snug"
              >
                {fullName}
              </Link>
              <p className="text-[11px] text-[#9fb2ba] flex items-center gap-1.5 truncate mt-0.5">
                <span className="w-2 h-2 rounded-full bg-[#00a65a] shrink-0" />
                <span className="truncate">{subtitle}</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="py-3 flex justify-center border-b border-[#1a2226]">
            <Link
              href={profileHref}
              title={fullName}
              className="w-9 h-9 rounded-full text-white flex items-center justify-center text-sm font-bold overflow-hidden ring-2 ring-white/20 hover:ring-teal-400"
              style={{ backgroundColor: avatarColor }}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
              ) : (
                initial
              )}
            </Link>
          </div>
        )}

        {!collapsed && (
          <p className="px-4 py-2 text-[11px] uppercase tracking-wider bg-[#1a2226] text-[#4b646f]">
            Menu chính
          </p>
        )}

        <nav className="flex-1 overflow-y-auto">
          {MENUS[role].map((item) => {
            const active = pathname === item.href || pathname === `${item.href}/`;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex items-center gap-3 px-4 py-3 border-l-[3px] transition-colors ${
                  active
                    ? "bg-[#1e282c] text-white border-[#3c8dbc]"
                    : "border-transparent hover:bg-[#1e282c] hover:text-white"
                }`}
              >
                <Icon size={16} className="shrink-0" />
                {!collapsed && <span className="flex-1">{item.label}</span>}
                {!collapsed && <ChevronRight size={14} className="opacity-40" />}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 border-t border-[#1a2226] hover:bg-[#1e282c] hover:text-white"
        >
          <LogOut size={16} />
          {!collapsed && "Đăng xuất"}
        </button>
      </aside>

      {/* ===== NỘI DUNG BÊN PHẢI ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-[#2c3b41] text-white flex items-center gap-3 px-4 shrink-0 shadow">
          <button
            onClick={() => setCollapsed((c) => !c)}
            title="Thu gọn / mở rộng menu"
            className="p-2 rounded hover:bg-white/10"
          >
            <Menu size={18} />
          </button>
          {showBack && (
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-[13px]"
            >
              <ArrowLeft size={15} /> Quay lại
            </button>
          )}
          <h1 className="text-[15px] font-medium truncate">{title}</h1>

          <div className="ml-auto flex items-center gap-3">
            <button className="relative p-2 rounded hover:bg-white/10" title="Thông báo">
              <Bell size={17} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#dd4b39]" />
            </button>
            <Link
              href={profileHref}
              title="Hồ sơ cá nhân & Đổi Avatar"
              className="flex items-center gap-2.5 px-2 py-1 rounded hover:bg-white/10 transition-colors"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-xs overflow-hidden ring-2 ring-white/25 shrink-0"
                style={{ backgroundColor: avatarColor }}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                ) : (
                  initial
                )}
              </div>
              <span className="hidden md:inline text-xs">
                Xin chào: <b className="text-white">{headerGreeting}</b>
              </span>
            </Link>
            <button onClick={logout} title="Đăng xuất" className="p-2 rounded hover:bg-white/10">
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-5">{children}</main>

        <footer className="h-9 bg-white border-t border-gray-200 px-5 flex items-center justify-between text-xs text-gray-500 shrink-0">
          <span>
            <b>KTX 5S AI</b> © 2026 — Trung tâm Quản lý Ký túc xá và Khu đô thị ĐHQG-HCM
          </span>
          <span>Phiên bản 1.0</span>
        </footer>
      </div>
    </div>
  );
}
