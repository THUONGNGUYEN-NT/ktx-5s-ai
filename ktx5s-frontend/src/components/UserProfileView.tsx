"use client";
// TRANG HỒ SƠ CÁ NHÂN & BẢO MẬT — MODERN NAVY-BLUE THEME (KTX 5S AI)
// Thiết kế đồng bộ Desktop & Mobile theo bản phác thảo: Banner Avatar (1 nút máy ảnh duy nhất) + 2 cột Thông tin cá nhân & Bảo mật tài khoản + Lần đăng nhập gần nhất
import { useState, useEffect, useRef } from "react";
import {
  User,
  Mail,
  Phone,
  Building2,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Save,
  Calendar,
  Camera,
  Upload,
  Trash2,
  ZoomIn,
  Palette,
  BadgeCheck,
  X,
  Eye,
  EyeOff,
  Pencil,
  Clock,
  Monitor,
} from "lucide-react";
import { getSession, saveSession, type UserRole } from "@/lib/session";
import {
  findAccountByUsername,
  getAllAccounts,
  updateUserProfile,
  changeUserPassword,
  type UserAccount,
} from "@/lib/user-store";

const AVATAR_COLORS = [
  { hex: "#2563eb", label: "Xanh KTX" },
  { hex: "#059669", label: "Xanh 5S" },
  { hex: "#4f46e5", label: "Chàm Quản trị" },
  { hex: "#0d9488", label: "Xanh Ngọc" },
  { hex: "#ea580c", label: "Cam Năng động" },
  { hex: "#e11d48", label: "Đỏ Hồng" },
];

function makeSvgAvatar(bg1: string, bg2: string, emoji: string, badge: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg1}"/>
        <stop offset="100%" stop-color="${bg2}"/>
      </linearGradient>
    </defs>
    <rect width="160" height="160" rx="80" fill="url(#g)"/>
    <circle cx="80" cy="64" r="28" fill="rgba(255,255,255,0.22)"/>
    <text x="80" y="96" font-size="72" text-anchor="middle" dominant-baseline="central">${emoji}</text>
    <rect x="34" y="122" width="92" height="22" rx="11" fill="rgba(0,0,0,0.28)"/>
    <text x="80" y="133" font-family="sans-serif" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${badge}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const PRESET_AVATARS = [
  { id: "sv-nam", label: "Nam SV", url: makeSvgAvatar("#2563eb", "#06b6d4", "👨‍🎓", "SINH VIÊN") },
  { id: "sv-nu", label: "Nữ SV", url: makeSvgAvatar("#db2777", "#f43f5e", "👩‍🎓", "SINH VIÊN") },
  { id: "sv-it", label: "SV Công nghệ", url: makeSvgAvatar("#0d9488", "#10b981", "🧑‍💻", "KTX 5S") },
  { id: "cb-nam", label: "Cán bộ KTX", url: makeSvgAvatar("#1e3a8a", "#2563eb", "👮‍♂️", "CÁN BỘ") },
  { id: "cb-nu", label: "Quản lý Tòa", url: makeSvgAvatar("#4f46e5", "#7c3aed", "👩‍💼", "QUẢN LÝ") },
  { id: "ai-bot", label: "Trợ lý 5S AI", url: makeSvgAvatar("#0f172a", "#334155", "🤖", "5S AI") },
];

async function renderCroppedAvatar(srcUrl: string, zoom = 1): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const SIZE = 256;
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas error"));
        const minSide = Math.min(img.width, img.height);
        const cropSide = minSide / Math.max(1, zoom);
        const sx = (img.width - cropSide) / 2;
        const sy = (img.height - cropSide) / 2;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.drawImage(img, sx, sy, cropSide, cropSide, 0, 0, SIZE, SIZE);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("Không thể đọc file ảnh"));
    img.src = srcUrl;
  });
}

export default function UserProfileView({ role }: { role: UserRole }) {
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [isEditingInfo, setIsEditingInfo] = useState(false);

  // Thông tin cá nhân
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [unit, setUnit] = useState("");
  const [major, setMajor] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarColor, setAvatarColor] = useState("#2563eb");
  const [infoMessage, setInfoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal Avatar
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [rawUploadUrl, setRawUploadUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [draftAvatarUrl, setDraftAvatarUrl] = useState("");
  const [draftAvatarColor, setDraftAvatarColor] = useState("#2563eb");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bảo mật / Đổi mật khẩu
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrPass, setShowCurrPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfPass, setShowConfPass] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [lastLoginStr, setLastLoginStr] = useState("");

  useEffect(() => {
    const session = getSession();
    let acc: UserAccount | null = null;
    if (session?.username) {
      acc = findAccountByUsername(session.username);
    } else if (role === "student" && session?.roomCode) {
      acc = getAllAccounts().find((a) => a.role === "student" && a.roomCode === session.roomCode) || null;
    }
    if (!acc) {
      const defaultUser = role === "admin" ? "admin" : "sinhvien01";
      acc = findAccountByUsername(defaultUser);
    }
    if (acc) {
      setAccount(acc);
      setFullName(acc.name);
      setPhone(acc.phone);
      setEmail(acc.email);
      setUnit(acc.unit || "Ký túc xá ĐHQG-HCM");
      setMajor(acc.major || "ĐHQG-HCM");
      setAvatarUrl(acc.avatarUrl || "");
      setAvatarColor(acc.avatarColor || "#2563eb");
    }

    const now = new Date();
    setLastLoginStr(
      now.toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    );
  }, [role]);

  const openAvatarEditor = () => {
    setDraftAvatarUrl(avatarUrl);
    setDraftAvatarColor(avatarColor);
    setRawUploadUrl(null);
    setZoom(1);
    setShowAvatarModal(true);
  };

  const handleSelectAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objUrl = URL.createObjectURL(file);
    setRawUploadUrl(objUrl);
    setZoom(1);
    try {
      const cropped = await renderCroppedAvatar(objUrl, 1);
      setDraftAvatarUrl(cropped);
    } catch {
      setInfoMessage({ type: "error", text: "Ảnh không hợp lệ, vui lòng chọn ảnh JPG hoặc PNG." });
    }
  };

  const handleZoomChange = async (newZoom: number) => {
    setZoom(newZoom);
    if (!rawUploadUrl) return;
    try {
      const cropped = await renderCroppedAvatar(rawUploadUrl, newZoom);
      setDraftAvatarUrl(cropped);
    } catch {}
  };

  const handleApplyAvatar = () => {
    if (!account) return;
    const res = updateUserProfile(account.username, {
      avatarUrl: draftAvatarUrl,
      avatarColor: draftAvatarColor,
    });
    if (res.success && res.updated) {
      setAccount(res.updated);
      setAvatarUrl(draftAvatarUrl);
      setAvatarColor(draftAvatarColor);
      const currentSession = getSession();
      if (currentSession) {
        saveSession({
          ...currentSession,
          username: res.updated.username,
          name: res.updated.name,
          avatarUrl: draftAvatarUrl,
          avatarColor: draftAvatarColor,
        });
      }
      setInfoMessage({ type: "success", text: "Đã cập nhật ảnh đại diện thành công!" });
    }
    setShowAvatarModal(false);
  };

  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    setInfoMessage(null);
    if (!account) return;

    if (!fullName.trim()) {
      setInfoMessage({ type: "error", text: "Vui lòng nhập Họ và tên." });
      return;
    }
    if (!phone.trim()) {
      setInfoMessage({ type: "error", text: "Vui lòng nhập Số điện thoại." });
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setInfoMessage({ type: "error", text: "Vui lòng nhập địa chỉ Email hợp lệ." });
      return;
    }

    const res = updateUserProfile(account.username, {
      name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      unit: unit.trim(),
      major: major.trim(),
      avatarUrl,
      avatarColor,
    });

    if (res.success && res.updated) {
      setAccount(res.updated);
      setIsEditingInfo(false);
      setInfoMessage({ type: "success", text: "Cập nhật thông tin cá nhân thành công!" });

      const currentSession = getSession();
      if (currentSession) {
        saveSession({
          ...currentSession,
          username: res.updated.username,
          name: res.updated.name,
          phone: res.updated.phone,
          email: res.updated.email,
          avatarUrl: res.updated.avatarUrl,
          avatarColor: res.updated.avatarColor,
        });
      }
    } else {
      setInfoMessage({ type: "error", text: res.message });
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    if (!account) return;

    if (!currentPassword) {
      setPasswordMessage({ type: "error", text: "Vui lòng nhập mật khẩu hiện tại." });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordMessage({ type: "error", text: "Mật khẩu mới phải có ít nhất 6 ký tự." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Xác nhận mật khẩu mới không khớp." });
      return;
    }

    const res = changeUserPassword(account.username, currentPassword, newPassword);
    if (res.success) {
      setPasswordMessage({ type: "success", text: res.message });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setPasswordMessage({ type: "error", text: res.message });
    }
  };

  if (!account) {
    return <div className="p-10 text-center text-slate-400">Đang tải thông tin cá nhân...</div>;
  }

  const isStudent = role === "student";
  const initials = (() => {
    const parts = (fullName || account.name || "U").trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0]?.[0] || "U").toUpperCase();
  })();

  const roleSubtitle = isStudent
    ? `Sinh viên Phòng ${account.roomCode || "A3-301"}`
    : "Cán bộ kiểm tra KTX";

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Tiêu đề trang */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Thông tin cá nhân</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Quản lý thông tin và bảo mật tài khoản của bạn
        </p>
      </div>

      {/* ===== CARD 1: BANNER AVATAR (CHỈ 1 NÚT MÁY ẢNH DUY NHẤT) ===== */}
      <div className="relative bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.04)] p-5 sm:p-6 overflow-hidden">
        {/* Mảng trang trí chéo màu xanh nhạt bên phải giống bản phác thảo */}
        <div className="pointer-events-none absolute -right-12 -top-10 w-64 h-64 bg-gradient-to-br from-blue-50 to-sky-100/70 rounded-full blur-2xl opacity-80" />

        <div className="relative flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-6 text-center sm:text-left">
          <div className="relative group shrink-0">
            <button
              type="button"
              onClick={openAvatarEditor}
              title="Bấm để thay đổi ảnh đại diện"
              className="w-24 h-24 rounded-full text-white flex items-center justify-center text-3xl font-extrabold shadow-lg shadow-blue-900/15 overflow-hidden ring-4 ring-blue-50 transition-transform group-hover:scale-[1.02]"
              style={{ backgroundColor: avatarColor }}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
              <span className="absolute inset-0 bg-slate-900/45 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[11px] font-semibold transition-opacity">
                <Camera size={18} className="mb-0.5" />
                Đổi ảnh
              </span>
            </button>

            <button
              type="button"
              onClick={openAvatarEditor}
              title="Thay đổi ảnh đại diện"
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#1d4ed8] hover:bg-[#1e40af] text-white border-2 border-white shadow-md flex items-center justify-center"
            >
              <Camera size={14} />
            </button>
          </div>

          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800">
              {fullName || account.name}
            </h2>
            <p className="text-sm font-medium text-slate-500">{roleSubtitle}</p>
            <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-xs font-semibold px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Đang hoạt động
              </span>
              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs font-medium px-3 py-1 rounded-full">
                Tài khoản: <b className="font-mono text-slate-800">{account.username}</b>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 2 CỘT CHÍNH: THÔNG TIN CÁ NHÂN & BẢO MẬT TÀI KHOẢN ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* CỘT TRÁI: THÔNG TIN CÁ NHÂN */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.04)] p-5 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-blue-50 text-[#1d4ed8] flex items-center justify-center">
                <User size={18} />
              </span>
              Thông tin cá nhân
            </h3>
            {isEditingInfo && (
              <button
                type="button"
                onClick={() => setIsEditingInfo(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Hủy
              </button>
            )}
          </div>

          {infoMessage && (
            <div
              className={`mb-4 p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                infoMessage.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border border-rose-200 text-rose-800"
              }`}
            >
              {infoMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{infoMessage.text}</span>
            </div>
          )}

          {!isEditingInfo ? (
            <div className="flex-1 flex flex-col">
              <div className="divide-y divide-slate-100 text-sm">
                <div className="py-3 flex items-center justify-between gap-3">
                  <span className="text-slate-500 flex items-center gap-2.5 shrink-0">
                    <User size={16} className="text-slate-400" /> Họ và tên
                  </span>
                  <span className="font-semibold text-slate-800 text-right">{fullName}</span>
                </div>

                <div className="py-3 flex items-center justify-between gap-3">
                  <span className="text-slate-500 flex items-center gap-2.5 shrink-0">
                    <BadgeCheck size={16} className="text-slate-400" />{" "}
                    {isStudent ? "Mã số sinh viên" : "Mã cán bộ"}
                  </span>
                  <span className="font-semibold font-mono text-slate-800 text-right">
                    {isStudent ? account.studentCode || "2112001" : "CB-1024"}
                  </span>
                </div>

                <div className="py-3 flex items-center justify-between gap-3">
                  <span className="text-slate-500 flex items-center gap-2.5 shrink-0">
                    <Mail size={16} className="text-slate-400" /> Email
                  </span>
                  <span className="font-semibold text-slate-800 text-right truncate max-w-[220px]">
                    {email}
                  </span>
                </div>

                <div className="py-3 flex items-center justify-between gap-3">
                  <span className="text-slate-500 flex items-center gap-2.5 shrink-0">
                    <Phone size={16} className="text-slate-400" /> Số điện thoại
                  </span>
                  <span className="font-semibold text-slate-800 text-right">{phone}</span>
                </div>

                <div className="py-3 flex items-center justify-between gap-3">
                  <span className="text-slate-500 flex items-center gap-2.5 shrink-0">
                    {isStudent ? (
                      <GraduationCap size={16} className="text-slate-400" />
                    ) : (
                      <Building2 size={16} className="text-slate-400" />
                    )}
                    {isStudent ? "Phòng / Khoa" : "Đơn vị công tác"}
                  </span>
                  <span className="font-semibold text-slate-800 text-right">
                    {isStudent ? `Phòng ${account.roomCode} · ${major}` : unit}
                  </span>
                </div>

                <div className="py-3 flex items-center justify-between gap-3">
                  <span className="text-slate-500 flex items-center gap-2.5 shrink-0">
                    <ShieldCheck size={16} className="text-slate-400" /> Vai trò
                  </span>
                  <span className="font-semibold text-slate-800 text-right">
                    {isStudent ? "Sinh viên nội trú" : "Cán bộ kiểm tra"}
                  </span>
                </div>

                <div className="py-3 flex items-center justify-between gap-3">
                  <span className="text-slate-500 flex items-center gap-2.5 shrink-0">
                    <Calendar size={16} className="text-slate-400" /> Ngày tham gia
                  </span>
                  <span className="font-semibold text-slate-800 text-right">
                    {account.joinedDate || "01/09/2025"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsEditingInfo(true);
                  setInfoMessage(null);
                }}
                className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-semibold text-sm shadow-sm transition"
              >
                <Pencil size={16} /> Chỉnh sửa thông tin
              </button>
            </div>
          ) : (
            <form onSubmit={handleSaveInfo} className="space-y-3.5 text-sm flex-1 flex flex-col">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Họ và tên</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Số điện thoại</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {isStudent ? "Khoa / Trường" : "Đơn vị công tác"}
                </label>
                <input
                  type="text"
                  value={isStudent ? major : unit}
                  onChange={(e) => (isStudent ? setMajor(e.target.value) : setUnit(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="mt-auto w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-semibold text-sm shadow-sm transition"
              >
                <Save size={16} /> Lưu thông tin cá nhân
              </button>
            </form>
          )}
        </div>

        {/* CỘT PHẢI: BẢO MẬT TÀI KHOẢN / ĐỔI MẬT KHẨU */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.04)] p-5 sm:p-6 flex flex-col">
          <div className="pb-4 mb-4 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-blue-50 text-[#1d4ed8] flex items-center justify-center">
                <ShieldCheck size={18} />
              </span>
              Bảo mật tài khoản
            </h3>
          </div>

          {passwordMessage && (
            <div
              className={`mb-4 p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                passwordMessage.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border border-rose-200 text-rose-800"
              }`}
            >
              {passwordMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{passwordMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 flex-1 flex flex-col">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Lock size={14} className="text-slate-400" /> Mật khẩu hiện tại
              </label>
              <div className="relative">
                <input
                  type={showCurrPass ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại"
                  className="w-full border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-slate-800 focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showCurrPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Lock size={14} className="text-slate-400" /> Mật khẩu mới
              </label>
              <div className="relative">
                <input
                  type={showNewPass ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                  className="w-full border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-slate-800 focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNewPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Lock size={14} className="text-slate-400" /> Xác nhận mật khẩu mới
              </label>
              <div className="relative">
                <input
                  type={showConfPass ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-slate-800 focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="mt-auto w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-semibold text-sm shadow-sm transition"
            >
              <Lock size={16} /> Đổi mật khẩu
            </button>
          </form>
        </div>
      </div>

      {/* ===== THANH LẦN ĐĂNG NHẬP GẦN NHẤT ===== */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_10px_rgba(15,23,42,0.03)] px-5 py-3.5 flex items-center gap-3.5 text-xs sm:text-sm text-slate-600">
        <div className="flex items-center gap-2 text-[#1d4ed8] shrink-0">
          <Clock size={18} />
          <Monitor size={18} />
        </div>
        <div>
          <p className="font-bold text-slate-800">Lần đăng nhập gần nhất</p>
          <p className="text-slate-500 text-xs">
            {lastLoginStr || "Hôm nay"} · Hệ thống KTX 5S AI ĐHQG-HCM
          </p>
        </div>
      </div>

      {/* ===== MODAL CHỈNH SỬA AVATAR ===== */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-[#1b365d] text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Camera size={17} className="text-sky-300" /> Chỉnh sửa ảnh đại diện
              </h3>
              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                className="p-1 rounded-lg hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-28 h-28 rounded-full border-4 border-blue-50 shadow-lg flex items-center justify-center text-4xl font-extrabold text-white overflow-hidden"
                  style={{ backgroundColor: draftAvatarColor }}
                >
                  {draftAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draftAvatarUrl} alt="Avatar preview" className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <p className="text-slate-500 text-[11px]">Xem trước ảnh đại diện</p>
              </div>

              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleSelectAvatarFile}
                />
                <div className="flex gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-semibold rounded-xl shadow-xs"
                  >
                    <Upload size={14} /> Tải ảnh từ máy
                  </button>
                  {draftAvatarUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftAvatarUrl("");
                        setRawUploadUrl(null);
                      }}
                      className="flex items-center gap-1 px-3.5 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold rounded-xl"
                    >
                      <Trash2 size={14} /> Dùng chữ cái
                    </button>
                  )}
                </div>

                {rawUploadUrl && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center gap-3 mt-1">
                    <ZoomIn size={15} className="text-[#1d4ed8] shrink-0" />
                    <span className="text-slate-600 font-medium shrink-0">Phóng to:</span>
                    <input
                      type="range"
                      min={1}
                      max={2.5}
                      step={0.05}
                      value={zoom}
                      onChange={(e) => handleZoomChange(Number(e.target.value))}
                      className="flex-1 accent-[#1d4ed8]"
                    />
                    <span className="font-mono text-slate-700 w-10 text-right">{Math.round(zoom * 100)}%</span>
                  </div>
                )}
              </div>

              <div>
                <p className="font-semibold text-slate-700 mb-2">Chọn nhanh Avatar mẫu:</p>
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_AVATARS.map((preset) => {
                    const selected = draftAvatarUrl === preset.url;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setDraftAvatarUrl(preset.url);
                          setRawUploadUrl(null);
                        }}
                        title={preset.label}
                        className={`flex flex-col items-center gap-1 p-1 rounded-xl border transition ${
                          selected
                            ? "border-[#1d4ed8] ring-2 ring-blue-200 bg-blue-50/50"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preset.url} alt={preset.label} className="w-10 h-10 rounded-full" />
                        <span className="text-[10px] text-slate-600 truncate w-full text-center">
                          {preset.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Palette size={13} className="text-[#1d4ed8]" /> Màu nền chữ cái:
                </p>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => {
                        setDraftAvatarColor(c.hex);
                        setDraftAvatarUrl("");
                        setRawUploadUrl(null);
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition ${
                        !draftAvatarUrl && draftAvatarColor === c.hex
                          ? "border-slate-800 ring-2 ring-slate-200 font-bold"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ backgroundColor: c.hex }} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAvatarModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleApplyAvatar}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl font-semibold shadow-xs"
                >
                  <CheckCircle2 size={14} /> Áp dụng Avatar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
