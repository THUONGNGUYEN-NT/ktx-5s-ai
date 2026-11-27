"use client";
// Khung giao diện chung tối ưu hóa cho cả Điện thoại (Mobile-First) và Máy tính (Desktop):
// - Trên điện thoại: Ẩn thanh sidebar cố định bên trái để màn hình rộng 100%, dùng Drawer trượt mượt + Thanh điều hướng đáy (Bottom Navigation Bar) với chữ & icon rõ nét, dễ bấm bằng 1 tay.
// - Trên máy tính: Giữ nguyên phong cách AdminLTE chuyên nghiệp với Sidebar bên trái có thể thu gọn.
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
  History,
  Home,
  ChevronRight,
  UserCog,
  UserCheck,
  X,
} from "lucide-react";
import { getSession, clearSession, type Session, type UserRole } from "@/lib/session";
import { findAccountByUsername, getAllAccounts, type UserAccount } from "@/lib/user-store";
import { getRoomMembersByCode } from "@/components/status";

type MenuItem = { href: string; label: string; shortLabel: string; icon: ElementType };

const MENUS: Record<UserRole, MenuItem[]> = {
  admin: [
    { href: "/admin", label: "Quản lý phòng", shortLabel: "Phòng", icon: LayoutGrid },
    { href: "/admin/stats", label: "Thống kê tuần", shortLabel: "Thống kê", icon: BarChart3 },
    { href: "/admin/profile", label: "Hồ sơ & Đổi mật khẩu", shortLabel: "Hồ sơ", icon: UserCog },
  ],
  student: [
    { href: "/student", label: "Trang chủ", shortLabel: "Trang chủ", icon: Home },
    { href: "/student/camera", label: "Nộp ảnh phòng", shortLabel: "Chụp 5S", icon: Camera },
    { href: "/student/history", label: "Lịch sử đánh giá", shortLabel: "Lịch sử", icon: History },
    { href: "/student/profile", label: "Hồ sơ & Đổi mật khẩu", shortLabel: "Hồ sơ", icon: UserCheck },
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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
  const roomMembers = roomCode ? getRoomMembersByCode(roomCode) : 8;
  const subtitle =
    session.role === "admin"
      ? account?.unit || "Cán bộ Quản lý KTX"
      : `Phòng ${roomCode} (${roomMembers} SV)`;

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
    <div className="flex h-dvh overflow-hidden bg-[#ecf0f5] text-[14px] md:text-[13px] text-gray-700">
      {/* ===== OVERLAY & MENU NGĂN KÉO TRÊN ĐIỆN THOẠI (MOBILE DRAWER) ===== */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] md:hidden animate-in fade-in duration-150"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#222d32] text-[#b8c7ce] flex flex-col shrink-0 transition-transform duration-200 md:static md:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        } ${collapsed ? "md:w-16" : "md:w-60"}`}
      >
        {/* Logo Header */}
        <div className="h-14 bg-white flex items-center justify-between md:justify-center px-4 border-b border-gray-200 shrink-0">
          {collapsed ? (
            <span className="hidden md:inline text-[#3c8dbc] font-black text-lg">5S</span>
          ) : null}
          <span className={`text-2xl tracking-tight ${collapsed ? "md:hidden" : ""}`}>
            <span className="italic text-teal-500 font-semibold">ktx</span>
            <span className="font-black text-[#3c8dbc]">5S AI</span>
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Đóng menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Thông tin người dùng trên Sidebar */}
        <div
          className={`flex items-center gap-3 px-4 py-3.5 border-b border-[#1a2226] ${
            collapsed ? "md:justify-center md:px-2" : ""
          }`}
        >
          <Link
            href={profileHref}
            title="Bấm để chỉnh sửa hồ sơ & đổi Avatar"
            className="relative w-11 h-11 md:w-10 md:h-10 rounded-full text-white flex items-center justify-center text-base font-bold shrink-0 overflow-hidden ring-2 ring-white/20 hover:ring-teal-400 transition-all group"
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
          <div className={`min-w-0 flex-1 ${collapsed ? "md:hidden" : ""}`}>
            <Link
              href={profileHref}
              className="text-white font-semibold truncate hover:text-teal-300 block leading-snug text-sm"
            >
              {fullName}
            </Link>
            <p className="text-xs text-[#9fb2ba] flex items-center gap-1.5 truncate mt-0.5">
              <span className="w-2 h-2 rounded-full bg-[#00a65a] shrink-0" />
              <span className="truncate">{subtitle}</span>
            </p>
          </div>
        </div>

        <p
          className={`px-4 py-2 text-[11px] uppercase tracking-wider bg-[#1a2226] text-[#6b8591] font-semibold ${
            collapsed ? "md:hidden" : ""
          }`}
        >
          Menu chính
        </p>

        <nav className="flex-1 overflow-y-auto py-1">
          {MENUS[role].map((item) => {
            const active = pathname === item.href || pathname === `${item.href}/`;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex items-center gap-3.5 px-4 py-3.5 md:py-3 border-l-[3px] text-[14px] md:text-[13px] transition-colors ${
                  active
                    ? "bg-[#1e282c] text-white border-[#3c8dbc] font-semibold"
                    : "border-transparent hover:bg-[#1e282c] hover:text-white"
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span className={`flex-1 ${collapsed ? "md:hidden" : ""}`}>{item.label}</span>
                <ChevronRight size={15} className={`opacity-40 ${collapsed ? "md:hidden" : ""}`} />
              </Link>
            );
          })}
        </nav>

        <button
          onClick={logout}
          className="flex items-center gap-3.5 px-4 py-3.5 border-t border-[#1a2226] hover:bg-[#1e282c] hover:text-white text-[14px] md:text-[13px]"
        >
          <LogOut size={18} />
          <span className={collapsed ? "md:hidden" : ""}>Đăng xuất</span>
        </button>
      </aside>

      {/* ===== NỘI DUNG BÊN PHẢI ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Thanh Header trên cùng */}
        <header className="h-14 bg-[#2c3b41] text-white flex items-center gap-2 sm:gap-3 px-3 sm:px-4 shrink-0 shadow-md z-20">
          {/* Nút mở menu trên điện thoại */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            title="Mở menu"
            className="md:hidden p-2 -ml-1 rounded-sm hover:bg-white/10 active:bg-white/20"
          >
            <Menu size={22} />
          </button>

          {/* Nút thu gọn sidebar trên máy tính */}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            title="Thu gọn / mở rộng menu"
            className="hidden md:inline-flex p-2 rounded hover:bg-white/10"
          >
            <Menu size={18} />
          </button>

          {showBack && (
            <button
              type="button"
              onClick={() => router.back()}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-white/15 hover:bg-white/25 text-xs sm:text-[13px] font-medium shrink-0"
            >
              <ArrowLeft size={15} />
              <span className="hidden xs:inline sm:inline">Quay lại</span>
            </button>
          )}

          <h1 className="text-[15px] sm:text-base font-bold truncate">{title}</h1>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-3 shrink-0">
            {role === "student" && roomCode && (
              <span className="md:hidden bg-[#3c8dbc] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {roomCode}
              </span>
            )}

            <button className="relative p-2 rounded hover:bg-white/10" title="Thông báo">
              <Bell size={19} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#dd4b39]" />
            </button>

            <Link
              href={profileHref}
              title="Hồ sơ cá nhân & Đổi Avatar"
              className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-white/10 transition-colors"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-xs overflow-hidden ring-2 ring-white/25 shrink-0 text-sm"
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

            <button
              onClick={logout}
              title="Đăng xuất"
              className="hidden sm:inline-flex p-2 rounded hover:bg-white/10"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Vùng nội dung chính — chừa khoảng trống dưới đáy trên điện thoại cho thanh điều hướng */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5 pb-20 md:pb-5">{children}</main>

        {/* Thanh điều hướng đáy cố định trên điện thoại (Bottom Navigation Bar) giúp sinh viên thao tác 1 chạm dễ dàng */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] flex items-center justify-around px-1">
          {MENUS[role].map((item) => {
            const active = pathname === item.href || pathname === `${item.href}/`;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-md transition-colors ${
                  active ? "text-[#3c8dbc] font-bold" : "text-gray-500 hover:text-gray-800 font-medium"
                }`}
              >
                <div
                  className={`p-1 rounded-full ${
                    active ? "bg-[#3c8dbc]/15 text-[#3c8dbc]" : ""
                  }`}
                >
                  <Icon size={21} strokeWidth={active ? 2.4 : 2} />
                </div>
                <span className="text-[11px] leading-tight mt-0.5 truncate">{item.shortLabel}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer chỉ hiển thị trên máy tính để tiết kiệm diện tích màn hình điện thoại */}
        <footer className="hidden md:flex h-9 bg-white border-t border-gray-200 px-5 items-center justify-between text-xs text-gray-500 shrink-0">
          <span>
            <b>KTX 5S AI</b> © 2026 — Trung tâm Quản lý Ký túc xá và Khu đô thị ĐHQG-HCM
          </span>
          <span>Phiên bản 1.0</span>
        </footer>
      </div>
    </div>
  );
}
