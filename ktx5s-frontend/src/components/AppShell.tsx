"use client";
// KHUNG GIAO DIỆN CHUNG — MODERN NAVY-BLUE THEME (KTX 5S AI · ĐHQG-HCM)
// - Desktop: Sidebar Navy-Blue (#173052 -> #102442) kèm minh họa tòa nhà KTX ở đáy + Header trắng sạch sẽ.
// - Mobile: Header xanh Navy (#1b365d) + Drawer trượt mượt + Thanh điều hướng đáy 4 tab (Bottom Navigation Bar).
import { ReactNode, useCallback, useEffect, useState, type ElementType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  ArrowLeft,
  Bell,
  LogOut,
  Building2,
  BarChart3,
  Camera,
  History,
  Home,
  UserCog,
  UserCheck,
  MapPin,
  X,
  ChevronDown,
} from "lucide-react";
import { getSession, clearSession, type Session, type UserRole } from "@/lib/session";
import { findAccountByUsername, getAllAccounts, type UserAccount } from "@/lib/user-store";
import { getRoomMembersByCode } from "@/components/status";

type MenuItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: ElementType;
  badge?: number;
};

const MENUS: Record<UserRole, MenuItem[]> = {
  admin: [
    { href: "/admin", label: "Quản lý phòng", shortLabel: "Phòng", icon: Home },
    { href: "/admin/stats", label: "Thống kê tuần", shortLabel: "Thống kê", icon: BarChart3 },
    { href: "/admin/profile", label: "Hồ sơ & Đổi mật khẩu", shortLabel: "Cá nhân", icon: UserCog },
    { href: "/admin/notifications", label: "Thông báo", shortLabel: "Thông báo", icon: Bell, badge: 3 },
  ],
  student: [
    { href: "/student", label: "Trang chủ", shortLabel: "Trang chủ", icon: Home },
    { href: "/student/camera", label: "Nộp ảnh phòng", shortLabel: "Chụp 5S", icon: Camera },
    { href: "/student/history", label: "Lịch sử đánh giá", shortLabel: "Lịch sử", icon: History },
    { href: "/student/profile", label: "Hồ sơ & Đổi mật khẩu", shortLabel: "Hồ sơ", icon: UserCheck },
  ],
};

// Thứ tự tab trên thanh Bottom Navigation Bar của Mobile
const MOBILE_BOTTOM_MENUS: Record<UserRole, MenuItem[]> = {
  admin: [
    { href: "/admin", label: "Quản lý phòng", shortLabel: "Phòng", icon: Home },
    { href: "/admin/stats", label: "Thống kê tuần", shortLabel: "Thống kê", icon: BarChart3 },
    { href: "/admin/notifications", label: "Thông báo", shortLabel: "Thông báo", icon: Bell, badge: 3 },
    { href: "/admin/profile", label: "Hồ sơ cá nhân", shortLabel: "Cá nhân", icon: UserCog },
  ],
  student: MENUS.student,
};

export default function AppShell({
  role,
  title,
  showBack = false,
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
      <div className="min-h-screen flex items-center justify-center bg-[#f4f7fb] text-slate-500 text-sm">
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
  const avatarUrl = account?.avatarUrl || session.avatarUrl || "";
  const avatarColor = account?.avatarColor || session.avatarColor || "#2563eb";

  // Lấy 2 chữ cái viết tắt giống mockup (VD: Trần Thị Thanh -> TT)
  const initials = (() => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (fullName.trim().charAt(0) || "U").toUpperCase();
  })();

  const profileHref = role === "admin" ? "/admin/profile" : "/student/profile";
  const notifHref = role === "admin" ? "/admin/notifications" : "/student/history";

  const logout = () => {
    clearSession();
    sessionStorage.removeItem("ai_result");
    router.replace("/login");
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-[#f4f7fb] text-[14px] text-slate-700">
      {/* ===== OVERLAY NGĂN KÉO TRÊN ĐIỆN THOẠI ===== */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[2px] md:hidden"
        />
      )}

      {/* ===== SIDEBAR NAVY-BLUE (DESKTOP + MOBILE DRAWER) ===== */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-[#1a345a] via-[#172e50] to-[#0f223d] text-slate-200 flex flex-col shrink-0 transition-all duration-200 md:static md:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        } ${collapsed ? "md:w-[76px]" : "md:w-64"}`}
      >
        {/* Logo KTX 5S AI */}
        <div className="h-16 flex items-center justify-between px-4 shrink-0 border-b border-white/10">
          <Link
            href={role === "admin" ? "/admin" : "/student"}
            className={`flex items-center gap-2.5 ${collapsed ? "md:mx-auto" : ""}`}
          >
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white shadow-inner shrink-0">
              <Building2 size={20} />
            </div>
            <span
              className={`text-lg font-extrabold tracking-tight text-white whitespace-nowrap ${
                collapsed ? "md:hidden" : ""
              }`}
            >
              KTX 5S <span className="text-sky-300">AI</span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-white/80 hover:bg-white/10"
            aria-label="Đóng menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Thẻ tài khoản nhỏ gọn trên Drawer mobile */}
        <div className="md:hidden px-4 py-3.5 border-b border-white/10 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm overflow-hidden ring-2 ring-white/25 shrink-0"
            style={{ backgroundColor: avatarColor }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm truncate">{fullName}</p>
            <p className="text-xs text-sky-200/80 truncate">
              {role === "admin" ? "Cán bộ kiểm tra KTX" : `Phòng ${roomCode} (${roomMembers} SV)`}
            </p>
          </div>
        </div>

        {/* Danh sách Menu */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
          {MENUS[role].map((item) => {
            const active =
              pathname === item.href ||
              pathname === `${item.href}/` ||
              (item.href === "/admin" && pathname?.startsWith("/admin/rooms"));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[14px] font-medium transition-all ${
                  active
                    ? "bg-[#2563eb] text-white shadow-md shadow-blue-950/40 font-semibold"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                } ${collapsed ? "md:justify-center md:px-0" : ""}`}
              >
                <Icon size={19} className="shrink-0" />
                <span className={`flex-1 truncate ${collapsed ? "md:hidden" : ""}`}>
                  {item.label}
                </span>
                {item.badge && !collapsed && (
                  <span className="bg-rose-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full leading-none">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Minh họa tòa nhà KTX ở chân Sidebar giống bản phác thảo */}
        <div className={`relative overflow-hidden shrink-0 ${collapsed ? "md:hidden" : ""}`}>
          <div className="px-4 pt-6 pb-3 relative z-10">
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <div className="flex items-start gap-2 text-xs text-sky-100/80">
                <MapPin size={15} className="text-sky-300 shrink-0 mt-0.5" />
                <div className="leading-tight">
                  <p className="font-semibold text-white">Ký túc xá</p>
                  <p className="text-[11px] text-sky-200/75">ĐHQG-HCM</p>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Đăng xuất"
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>

          {/* Đồ họa SVG tòa nhà KTX mờ phía sau chân sidebar */}
          <svg
            viewBox="0 0 260 95"
            className="absolute bottom-0 inset-x-0 w-full h-24 opacity-20 pointer-events-none select-none"
            preserveAspectRatio="none"
          >
            <rect x="8" y="34" width="46" height="61" rx="2" fill="#93c5fd" />
            <rect x="16" y="42" width="8" height="8" fill="#0f223d" />
            <rect x="30" y="42" width="8" height="8" fill="#0f223d" />
            <rect x="16" y="56" width="8" height="8" fill="#0f223d" />
            <rect x="30" y="56" width="8" height="8" fill="#0f223d" />
            <rect x="60" y="14" width="66" height="81" rx="2" fill="#bfdbfe" />
            <rect x="70" y="24" width="10" height="9" fill="#0f223d" />
            <rect x="86" y="24" width="10" height="9" fill="#0f223d" />
            <rect x="102" y="24" width="10" height="9" fill="#0f223d" />
            <rect x="70" y="40" width="10" height="9" fill="#0f223d" />
            <rect x="86" y="40" width="10" height="9" fill="#0f223d" />
            <rect x="102" y="40" width="10" height="9" fill="#0f223d" />
            <rect x="70" y="56" width="10" height="9" fill="#0f223d" />
            <rect x="86" y="56" width="10" height="9" fill="#0f223d" />
            <rect x="102" y="56" width="10" height="9" fill="#0f223d" />
            <rect x="134" y="26" width="58" height="69" rx="2" fill="#93c5fd" />
            <rect x="144" y="36" width="9" height="8" fill="#0f223d" />
            <rect x="160" y="36" width="9" height="8" fill="#0f223d" />
            <rect x="176" y="36" width="9" height="8" fill="#0f223d" />
            <rect x="144" y="52" width="9" height="8" fill="#0f223d" />
            <rect x="160" y="52" width="9" height="8" fill="#0f223d" />
            <rect x="176" y="52" width="9" height="8" fill="#0f223d" />
            <rect x="198" y="42" width="54" height="53" rx="2" fill="#60a5fa" />
          </svg>
        </div>

        {/* Nút đăng xuất khi sidebar thu gọn trên Desktop */}
        {collapsed && (
          <button
            type="button"
            onClick={logout}
            title="Đăng xuất"
            className="hidden md:flex items-center justify-center py-4 border-t border-white/10 text-slate-300 hover:text-white hover:bg-white/10"
          >
            <LogOut size={18} />
          </button>
        )}
      </aside>

      {/* ===== KHU VỰC NỘI DUNG BÊN PHẢI ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* HEADER: Xanh Navy trên Mobile (#1b365d), Trắng tinh tế trên Desktop */}
        <header className="h-14 md:h-16 bg-[#1b365d] md:bg-white text-white md:text-slate-700 border-b border-slate-200/80 flex items-center justify-between px-3.5 sm:px-5 shrink-0 z-20 shadow-xs md:shadow-none">
          {/* Cụm bên trái */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {showBack ? (
              <button
                type="button"
                onClick={() => router.back()}
                className="p-2 -ml-1 rounded-xl hover:bg-white/10 md:hover:bg-slate-100 transition flex items-center gap-1.5 text-sm font-medium"
                aria-label="Quay lại"
              >
                <ArrowLeft size={20} />
                <span className="hidden md:inline text-slate-600">Quay lại</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="md:hidden p-2 -ml-1 rounded-xl hover:bg-white/10 transition"
                  aria-label="Mở menu"
                >
                  <Menu size={22} />
                </button>
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => !c)}
                  className="hidden md:inline-flex p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                  title="Thu gọn / mở rộng menu"
                >
                  <Menu size={20} />
                </button>
              </>
            )}

            {/* Breadcrumb / tiêu đề nhẹ trên Desktop */}
            <div className="hidden md:flex items-center gap-2 text-sm text-slate-500 truncate">
              <span className="font-semibold text-slate-800 truncate">{title}</span>
            </div>
          </div>

          {/* Logo giữa màn hình trên Mobile giống bản phác thảo */}
          <div className="md:hidden flex items-center gap-1.5 font-extrabold text-base tracking-tight text-white truncate">
            {showBack ? (
              <span className="truncate">{title}</span>
            ) : (
              <>
                <Building2 size={18} className="text-sky-300 shrink-0" />
                <span>KTX 5S AI</span>
              </>
            )}
          </div>

          {/* Cụm bên phải: Thông báo + Tài khoản */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href={notifHref}
              className="relative p-2 rounded-xl hover:bg-white/10 md:hover:bg-slate-100 transition"
              title="Thông báo"
            >
              <Bell size={20} className="text-white md:text-slate-600" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-[#1b365d] md:ring-white" />
            </Link>

            <Link
              href={profileHref}
              title="Hồ sơ cá nhân & Đổi Avatar"
              className="hidden md:flex items-center gap-2.5 pl-1.5 pr-2.5 py-1 rounded-full border border-slate-200/80 hover:border-blue-300 hover:bg-slate-50 transition"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs overflow-hidden shrink-0"
                style={{ backgroundColor: avatarColor }}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <span className="text-[13px] font-semibold text-slate-700 max-w-[160px] truncate">
                {fullName}
              </span>
              <ChevronDown size={14} className="text-slate-400" />
            </Link>
          </div>
        </header>

        {/* Vùng nội dung chính */}
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-6 pb-24 md:pb-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>

        {/* THANH ĐIỀU HƯỚNG ĐÁY MOBILE (BOTTOM NAVIGATION BAR) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] flex items-center justify-around px-2">
          {MOBILE_BOTTOM_MENUS[role].map((item) => {
            const active =
              pathname === item.href ||
              pathname === `${item.href}/` ||
              (item.href === "/admin" && pathname?.startsWith("/admin/rooms"));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-colors ${
                  active ? "text-[#1d4ed8] font-bold" : "text-slate-500 hover:text-slate-800 font-medium"
                }`}
              >
                <div className="relative">
                  <Icon size={21} strokeWidth={active ? 2.4 : 1.9} />
                  {item.badge && (
                    <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full leading-tight">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] mt-1 leading-none truncate">{item.shortLabel}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
