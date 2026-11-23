"use client";
// Khung giao diện chung: menu tối bên trái + thanh tiêu đề + nút Quay lại + chân trang
// Đồng thời kiểm tra đăng nhập và phân quyền (sai vai trò -> đưa về /login)
import { ReactNode, useEffect, useState, type ElementType } from "react";
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

type MenuItem = { href: string; label: string; icon: ElementType };

const MENUS: Record<UserRole, MenuItem[]> = {
  admin: [
    { href: "/admin", label: "Quản lý phòng", icon: LayoutGrid },
    { href: "/admin/stats", label: "Thống kê tuần", icon: BarChart3 },
    { href: "/admin/profile", label: "Thông tin & Đổi mật khẩu", icon: UserCog },
  ],
  student: [
    { href: "/student", label: "Trang chủ", icon: Home },
    { href: "/student/camera", label: "Nộp ảnh phòng", icon: Camera },
    { href: "/student/result", label: "Kết quả gần nhất", icon: ClipboardCheck },
    { href: "/student/history", label: "Lịch sử đánh giá", icon: History },
    { href: "/student/profile", label: "Thông tin & Đổi mật khẩu", icon: UserCheck },
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
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== role) {
      router.replace("/login");
      return;
    }
    setSession(s);
  }, [role, router]);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ecf0f5] text-gray-500 text-sm">
        Đang kiểm tra đăng nhập...
      </div>
    );
  }

  const displayName =
    session.role === "admin" ? session.name ?? "admin" : `Phòng ${session.roomCode ?? ""}`;
  const subtitle = session.role === "admin" ? "Cán bộ KTX" : "Tài khoản phòng SV";
  const initial = displayName.charAt(0).toUpperCase();

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

        {!collapsed && (
          <div className="flex items-center gap-3 px-4 py-4">
            <Link
              href={role === "admin" ? "/admin/profile" : "/student/profile"}
              title="Xem thông tin tài khoản & Đổi mật khẩu"
              className="w-11 h-11 rounded-full bg-[#3c8dbc] text-white flex items-center justify-center text-lg font-bold shrink-0 hover:ring-2 hover:ring-teal-400 transition-all"
            >
              {initial}
            </Link>
            <div className="min-w-0">
              <Link
                href={role === "admin" ? "/admin/profile" : "/student/profile"}
                className="text-white font-semibold truncate hover:text-teal-300 block"
              >
                {displayName}
              </Link>
              <p className="text-[11px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#00a65a]" /> {subtitle}
              </p>
            </div>
          </div>
        )}

        {!collapsed && (
          <p className="px-4 py-2 text-[11px] uppercase tracking-wider bg-[#1a2226] text-[#4b646f]">Menu chính</p>
        )}

        <nav className="flex-1 overflow-y-auto">
          {MENUS[role].map((item) => {
            const active = pathname === item.href;
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

          <div className="ml-auto flex items-center gap-4">
            <button className="relative p-2 rounded hover:bg-white/10" title="Thông báo">
              <Bell size={17} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#dd4b39]" />
            </button>
            <Link
              href={role === "admin" ? "/admin/profile" : "/student/profile"}
              title="Xem thông tin tài khoản & đổi mật khẩu"
              className="flex items-center gap-2 hover:opacity-85 transition-opacity"
            >
              <div className="w-8 h-8 rounded-full bg-[#3c8dbc] flex items-center justify-center font-bold text-white shadow-xs">
                {initial}
              </div>
              <span className="hidden md:inline">
                Xin chào: <b>{displayName}</b>
              </span>
            </Link>
            <button
              onClick={logout}
              title="Đăng xuất"
              className="p-2 rounded hover:bg-white/10"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5">{children}</main>

        <footer className="h-10 bg-white border-t border-gray-200 px-5 flex items-center justify-between text-xs text-gray-500 shrink-0">
          <span>
            <b>KTX 5S AI</b> © 2026 — Trung tâm Quản lý Ký túc xá và Khu đô thị ĐHQG-HCM
          </span>
          <span>Phiên bản 1.0</span>
        </footer>
      </div>
    </div>
  );
}
