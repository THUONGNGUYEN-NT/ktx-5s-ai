"use client";
import { useState, useEffect, useRef } from "react";
import {
  User,
  Mail,
  Phone,
  Building2,
  Lock,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Save,
  Send,
  Calendar,
  Sparkles,
  Camera,
  Upload,
  Trash2,
  ZoomIn,
  Palette,
  BadgeCheck,
  IdCard,
  X,
} from "lucide-react";
import { getSession, saveSession, type UserRole } from "@/lib/session";
import {
  findAccountByUsername,
  getAllAccounts,
  updateUserProfile,
  changeUserPassword,
  requestPasswordResetOtp,
  type UserAccount,
} from "@/lib/user-store";

// Bảng màu nền Avatar chữ cái
const AVATAR_COLORS = [
  { hex: "#3c8dbc", label: "Xanh KTX" },
  { hex: "#00a65a", label: "Xanh 5S" },
  { hex: "#605ca8", label: "Tím Quản trị" },
  { hex: "#0d9488", label: "Xanh Ngọc" },
  { hex: "#e67e22", label: "Cam Năng động" },
  { hex: "#d81b60", label: "Đỏ Hồng" },
];

// Bộ Avatar minh họa SVG tích hợp sẵn (không cần tải file ngoài)
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
  { id: "cb-nam", label: "Cán bộ KTX", url: makeSvgAvatar("#1e3a8a", "#3c8dbc", "👮‍♂️", "CÁN BỘ") },
  { id: "cb-nu", label: "Quản lý Tòa", url: makeSvgAvatar("#5b21b6", "#7c3aed", "👩‍💼", "QUẢN LÝ") },
  { id: "ai-bot", label: "Trợ lý 5S AI", url: makeSvgAvatar("#0f172a", "#334155", "🤖", "5S AI") },
];

// Cắt vuông & nén ảnh đại diện theo mức Zoom trên Canvas 256x256
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
  const [activeTab, setActiveTab] = useState<"info" | "password" | "security">("info");

  // Form thông tin cá nhân
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [unit, setUnit] = useState("");
  const [major, setMajor] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarColor, setAvatarColor] = useState("#3c8dbc");
  const [infoMessage, setInfoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Studio chỉnh sửa Avatar
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [rawUploadUrl, setRawUploadUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [draftAvatarUrl, setDraftAvatarUrl] = useState("");
  const [draftAvatarColor, setDraftAvatarColor] = useState("#3c8dbc");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form đổi mật khẩu
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Kiểm tra gửi mã OTP xác thực thực tế
  const [otpTestStatus, setOtpTestStatus] = useState<string>("");

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
    if (acc) loadAccountData(acc);
  }, [role]);

  const loadAccountData = (acc: UserAccount) => {
    setAccount(acc);
    setFullName(acc.name);
    setPhone(acc.phone);
    setEmail(acc.email);
    setUnit(acc.unit || "");
    setMajor(acc.major || "");
    setAvatarUrl(acc.avatarUrl || "");
    setAvatarColor(acc.avatarColor || (acc.role === "admin" ? "#3c8dbc" : "#0d9488"));
  };

  // Mở khung chỉnh sửa Avatar
  const openAvatarEditor = () => {
    setDraftAvatarUrl(avatarUrl);
    setDraftAvatarColor(avatarColor);
    setRawUploadUrl(null);
    setZoom(1);
    setShowAvatarModal(true);
  };

  // Khi người dùng chọn file ảnh từ máy tính / điện thoại
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

  // Khi kéo thanh Zoom ảnh vừa tải lên
  const handleZoomChange = async (newZoom: number) => {
    setZoom(newZoom);
    if (!rawUploadUrl) return;
    try {
      const cropped = await renderCroppedAvatar(rawUploadUrl, newZoom);
      setDraftAvatarUrl(cropped);
    } catch {}
  };

  // Lưu Avatar ngay lập tức và đồng bộ lên Sidebar + Header
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
      setInfoMessage({ type: "success", text: "Đã cập nhật ảnh đại diện (Avatar) thành công!" });
    }
    setShowAvatarModal(false);
  };

  // Lưu thông tin cá nhân
  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    setInfoMessage(null);
    if (!account) return;

    if (!fullName.trim()) {
      setInfoMessage({ type: "error", text: "Vui lòng nhập Họ và tên." });
      return;
    }
    if (!phone.trim()) {
      setInfoMessage({ type: "error", text: "Vui lòng nhập Số điện thoại nhận OTP." });
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
      setInfoMessage({ type: "success", text: "Cập nhật hồ sơ tài khoản thành công!" });

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

  // Đổi mật khẩu
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    if (!account) return;

    if (!currentPassword) {
      setPasswordMessage({ type: "error", text: "Vui lòng nhập Mật khẩu hiện tại." });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordMessage({ type: "error", text: "Mật khẩu mới phải có tối thiểu 6 ký tự." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại." });
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

  // Kiểm tra gửi OTP thực tế
  const handleTestOtp = async (method: "phone" | "email") => {
    if (!account) return;
    setOtpTestStatus("Đang gửi mã xác thực OTP...");
    const res = await requestPasswordResetOtp(account.username, method);
    if (res.success) {
      setOtpTestStatus(
        `✅ Đã gửi mã OTP tới ${method === "phone" ? "SMS số điện thoại" : "hòm thư Email"}: ${res.maskedTarget}. Vui lòng kiểm tra hộp thư hoặc tin nhắn của bạn.`
      );
    } else {
      setOtpTestStatus(`❌ ${res.message}`);
    }
  };

  if (!account) {
    return <div className="p-8 text-center text-gray-500">Đang tải thông tin tài khoản...</div>;
  }

  const isStudent = role === "student";
  const roleBadgeText = isStudent ? `Sinh viên Phòng ${account.roomCode || ""}` : "Cán bộ Quản lý KTX";
  const initial = (fullName || account.name || "U").trim().charAt(0).toUpperCase();

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* ===== CARD 1: HEADER HỒ SƠ GỌN GÀNG, VỪA KHÍT MÀN HÌNH LAPTOP ===== */}
      <div className="bg-white rounded-sm shadow-sm border border-gray-200 overflow-hidden">
        {/* Dải màu phân biệt rõ vai trò Sinh viên (Xanh ngọc - Xanh dương) vs Cán bộ (Xanh đen - Xanh KTX) */}
        <div
          className={`h-3 ${
            isStudent
              ? "bg-gradient-to-r from-teal-500 via-[#00a65a] to-[#3c8dbc]"
              : "bg-gradient-to-r from-[#222d32] via-[#3c8dbc] to-[#605ca8]"
          }`}
        />

        <div className="p-4 md:px-6 md:py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Cụm Avatar + Thông tin chính */}
          <div className="flex items-center gap-4">
            <div className="relative group shrink-0">
              <button
                type="button"
                onClick={openAvatarEditor}
                title="Bấm để thay đổi hoặc chỉnh sửa Avatar"
                className="w-20 h-20 rounded-full border-4 border-gray-100 text-white flex items-center justify-center text-2xl font-extrabold shadow-md overflow-hidden transition-transform group-hover:scale-[1.02]"
                style={{ backgroundColor: avatarColor }}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                ) : (
                  initial
                )}
                <span className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-semibold transition-opacity">
                  <Camera size={16} className="mb-0.5" />
                  Đổi ảnh
                </span>
              </button>
              <button
                type="button"
                onClick={openAvatarEditor}
                title="Chỉnh sửa Avatar"
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#3c8dbc] hover:bg-[#367fa9] text-white border-2 border-white shadow flex items-center justify-center"
              >
                <Camera size={13} />
              </button>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg md:text-xl font-bold text-gray-800">{fullName || account.name}</h1>
                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Đang hoạt động
                </span>
                <button
                  type="button"
                  onClick={openAvatarEditor}
                  className="text-[11px] font-semibold text-[#3c8dbc] bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 transition-colors"
                >
                  <Camera size={12} /> Đổi Avatar
                </button>
              </div>

              <div className="text-gray-500 text-xs mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-[#3c8dbc] flex items-center gap-1">
                  <BadgeCheck size={14} /> {roleBadgeText}
                </span>
                <span>
                  Tài khoản:{" "}
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-bold">
                    {account.username}
                  </code>
                </span>
                <span className="flex items-center gap-1 text-gray-400">
                  <Calendar size={12} /> Tham gia: <b className="text-gray-600">{account.joinedDate || "05/09/2023"}</b>
                </span>
              </div>
            </div>
          </div>

          {/* Cụm chuyển Tab */}
          <div className="flex items-center gap-1.5 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0">
            {(
              [
                ["info", "Hồ sơ cá nhân"],
                ["password", "Đổi mật khẩu"],
                ["security", "Bảo mật & OTP"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors ${
                  activeTab === key
                    ? "bg-[#3c8dbc] text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== CARD 2: NỘI DUNG CHI TIẾT ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CỘT TRÁI: THẺ ĐỊNH DANH RIÊNG CHO SINH VIÊN HOẶC CÁN BỘ */}
        <div className="space-y-4">
          <div className="bg-white rounded-sm border border-gray-200 p-4 shadow-sm">
            <h3 className="font-bold text-gray-800 text-xs uppercase tracking-wider pb-2.5 border-b border-gray-100 flex items-center gap-2">
              {isStudent ? (
                <>
                  <IdCard size={16} className="text-teal-600" /> Thẻ định danh Sinh viên KTX
                </>
              ) : (
                <>
                  <ShieldCheck size={16} className="text-[#3c8dbc]" /> Thẻ định danh Cán bộ KTX
                </>
              )}
            </h3>

            <ul className="mt-3 space-y-2.5 text-xs">
              <li className="flex justify-between items-center text-gray-600">
                <span>Vai trò hệ thống:</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded ${
                    isStudent ? "bg-teal-50 text-teal-700" : "bg-blue-50 text-[#3c8dbc]"
                  }`}
                >
                  {isStudent ? "Sinh viên lưu trú" : "Cán bộ KTX (Admin)"}
                </span>
              </li>

              {isStudent ? (
                <>
                  <li className="flex justify-between items-center text-gray-600">
                    <span>Mã số sinh viên:</span>
                    <span className="font-mono font-bold text-gray-800">{account.studentCode || "2112001"}</span>
                  </li>
                  <li className="flex justify-between items-center text-gray-600">
                    <span>Phòng nội trú:</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      Phòng {account.roomCode}
                    </span>
                  </li>
                  <li className="flex justify-between items-start text-gray-600 gap-2">
                    <span className="shrink-0">Khoa / Trường:</span>
                    <span className="font-medium text-gray-800 text-right">{major || account.major || "ĐHQG-HCM"}</span>
                  </li>
                </>
              ) : (
                <>
                  <li className="flex justify-between items-start text-gray-600 gap-2">
                    <span className="shrink-0">Đơn vị phụ trách:</span>
                    <span className="font-semibold text-gray-800 text-right">
                      {unit || account.unit || "Toàn ký túc xá"}
                    </span>
                  </li>
                  <li className="flex justify-between items-center text-gray-600">
                    <span>Quyền giám sát:</span>
                    <span className="font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                      4 Tòa · 10 Tầng (200 phòng)
                    </span>
                  </li>
                  <li className="flex justify-between items-center text-gray-600">
                    <span>Quyền duyệt đè 5S:</span>
                    <span className="text-emerald-600 font-semibold">Được cấp phép</span>
                  </li>
                </>
              )}

              <li className="flex justify-between items-center text-gray-600 pt-1 border-t border-gray-100">
                <span>Trạng thái tài khoản:</span>
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={13} /> Bình thường
                </span>
              </li>
              <li className="flex justify-between items-center text-gray-600">
                <span>Khôi phục mật khẩu OTP:</span>
                <span className="text-[#3c8dbc] font-semibold">SMS & Email</span>
              </li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-sm p-3.5 text-xs text-blue-900 leading-relaxed shadow-sm">
            <p className="font-bold text-blue-950 flex items-center gap-1.5 mb-1">
              <Sparkles size={14} className="text-[#3c8dbc]" /> Đồng bộ hồ sơ trực tiếp:
            </p>
            <p>
              Khi bạn đổi <b>Ảnh đại diện (Avatar)</b> hoặc <b>Họ tên</b>, thông tin sẽ tự động cập nhật ngay trên thanh menu trái và góc trên bên phải màn hình.
            </p>
          </div>
        </div>

        {/* CỘT PHẢI: FORM THEO TAB */}
        <div className="lg:col-span-2">
          {/* TAB 1: THÔNG TIN CÁ NHÂN */}
          {activeTab === "info" && (
            <div className="bg-white rounded-sm border border-gray-200 p-5 shadow-sm">
              <div className="border-b border-gray-100 pb-2.5 mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-gray-800">Thông tin chi tiết tài khoản</h2>
                  <p className="text-xs text-gray-500">
                    Cập nhật họ tên, ảnh đại diện, số điện thoại và email nhận thông báo 5S
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAvatarEditor}
                  className="text-xs font-semibold text-[#3c8dbc] hover:underline flex items-center gap-1"
                >
                  <Camera size={14} /> Chỉnh sửa Avatar
                </button>
              </div>

              {infoMessage && (
                <div
                  className={`mb-3.5 p-2.5 rounded-sm text-xs flex items-center gap-2 ${
                    infoMessage.type === "success"
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                      : "bg-red-50 border border-red-200 text-red-800"
                  }`}
                >
                  {infoMessage.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  <span>{infoMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleSaveInfo} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Tên đăng nhập (Username):</label>
                    <div className="relative">
                      <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={account.username}
                        disabled
                        className="w-full bg-gray-100 border border-gray-300 rounded-sm pl-9 pr-3 py-2 text-gray-500 cursor-not-allowed font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Họ và tên hiển thị:</label>
                    <div className="relative">
                      <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Nhập họ và tên..."
                        className="w-full border border-gray-300 rounded-sm pl-9 pr-3 py-2 text-gray-800 focus:border-[#3c8dbc] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Số điện thoại (Nhận OTP SMS):</label>
                    <div className="relative">
                      <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="VD: 0934567890..."
                        className="w-full border border-gray-300 rounded-sm pl-9 pr-3 py-2 text-gray-800 focus:border-[#3c8dbc] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Địa chỉ Email (Nhận OTP & Báo cáo):</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="VD: sinhvien@student.edu.vn..."
                        className="w-full border border-gray-300 rounded-sm pl-9 pr-3 py-2 text-gray-800 focus:border-[#3c8dbc] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {isStudent ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Phòng ở KTX được phân:</label>
                      <div className="relative">
                        <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={account.roomCode || ""}
                          disabled
                          className="w-full bg-gray-100 border border-gray-300 rounded-sm pl-9 pr-3 py-2 text-gray-600 font-semibold cursor-not-allowed"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Khoa / Lớp / Trường:</label>
                      <div className="relative">
                        <GraduationCap size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={major}
                          onChange={(e) => setMajor(e.target.value)}
                          placeholder="Khoa học Máy tính - K21..."
                          className="w-full border border-gray-300 rounded-sm pl-9 pr-3 py-2 text-gray-800 focus:border-[#3c8dbc] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Đơn vị công tác / Cụm tòa quản lý:</label>
                    <div className="relative">
                      <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder="Ban Quản lý Cụm Nhà B..."
                        className="w-full border border-gray-300 rounded-sm pl-9 pr-3 py-2 text-gray-800 focus:border-[#3c8dbc] focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2.5 border-t border-gray-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={openAvatarEditor}
                    className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-sm transition-colors"
                  >
                    <Camera size={14} /> Đổi ảnh đại diện
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#3c8dbc] hover:bg-[#367fa9] text-white font-semibold rounded-sm shadow-xs transition-colors"
                  >
                    <Save size={14} /> Lưu thay đổi hồ sơ
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: ĐỔI MẬT KHẨU */}
          {activeTab === "password" && (
            <div className="bg-white rounded-sm border border-gray-200 p-5 shadow-sm">
              <div className="border-b border-gray-100 pb-2.5 mb-4">
                <h2 className="text-sm font-bold text-gray-800">Đổi mật khẩu đăng nhập</h2>
                <p className="text-xs text-gray-500">
                  Mật khẩu mới có hiệu lực ngay cho các lần đăng nhập tiếp theo
                </p>
              </div>

              {passwordMessage && (
                <div
                  className={`mb-3.5 p-2.5 rounded-sm text-xs flex items-center gap-2 ${
                    passwordMessage.type === "success"
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                      : "bg-red-50 border border-red-200 text-red-800"
                  }`}
                >
                  {passwordMessage.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  <span>{passwordMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-3.5 text-xs max-w-lg">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Mật khẩu hiện tại:</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Nhập mật khẩu hiện tại"
                      className="w-full border border-gray-300 rounded-sm pl-9 pr-3 py-2 text-gray-800 focus:border-[#3c8dbc] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Mật khẩu mới:</label>
                  <div className="relative">
                    <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                      className="w-full border border-gray-300 rounded-sm pl-9 pr-3 py-2 text-gray-800 focus:border-[#3c8dbc] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Xác nhận mật khẩu mới:</label>
                  <div className="relative">
                    <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                      className="w-full border border-gray-300 rounded-sm pl-9 pr-3 py-2 text-gray-800 focus:border-[#3c8dbc] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#00a65a] hover:bg-[#008d4c] text-white font-semibold rounded-sm shadow-xs transition-colors"
                  >
                    <Lock size={14} /> Cập nhật mật khẩu mới
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: BẢO MẬT & OTP */}
          {activeTab === "security" && (
            <div className="bg-white rounded-sm border border-gray-200 p-5 shadow-sm space-y-4">
              <div className="border-b border-gray-100 pb-2.5">
                <h2 className="text-sm font-bold text-gray-800">Cấu hình Khôi phục & Nhận mã OTP</h2>
                <p className="text-xs text-gray-500">
                  Kiểm tra kênh nhận mã OTP khi sử dụng chức năng Quên mật khẩu
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="border border-gray-200 rounded-sm p-4 bg-gray-50/70">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-800 flex items-center gap-1.5">
                      <Phone size={15} className="text-[#3c8dbc]" /> Kênh SMS Số điện thoại
                    </span>
                    <span className="text-emerald-700 bg-emerald-100 text-[10px] font-bold px-1.5 py-0.5 rounded">
                      Sẵn sàng
                    </span>
                  </div>
                  <p className="text-gray-600 mb-3">
                    Số đăng ký: <span className="font-mono font-bold text-gray-900">{account.phone}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => handleTestOtp("phone")}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold rounded-sm transition-colors"
                  >
                    <Send size={13} /> Gửi thử OTP qua SMS
                  </button>
                </div>

                <div className="border border-gray-200 rounded-sm p-4 bg-gray-50/70">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-800 flex items-center gap-1.5">
                      <Mail size={15} className="text-[#3c8dbc]" /> Kênh Hòm thư Email
                    </span>
                    <span className="text-emerald-700 bg-emerald-100 text-[10px] font-bold px-1.5 py-0.5 rounded">
                      Sẵn sàng
                    </span>
                  </div>
                  <p className="text-gray-600 mb-3 truncate">
                    Email đăng ký: <span className="font-mono font-bold text-gray-900">{account.email}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => handleTestOtp("email")}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold rounded-sm transition-colors"
                  >
                    <Send size={13} /> Gửi thử OTP qua Email
                  </button>
                </div>
              </div>

              {otpTestStatus && (
                <div className="bg-sky-50 border border-sky-200 rounded-sm p-3 text-xs text-sky-950">
                  <p className="font-semibold text-sky-900 leading-relaxed">{otpTestStatus}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== MODAL CHỈNH SỬA & THAY ĐỔI AVATAR ===== */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden">
            <div className="bg-[#2c3b41] text-white px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Camera size={16} className="text-teal-300" /> Thay đổi & Chỉnh sửa Ảnh đại diện (Avatar)
              </h3>
              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                className="p-1 rounded hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Xem trước Avatar */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-28 h-28 rounded-full border-4 border-gray-100 shadow-lg flex items-center justify-center text-4xl font-extrabold text-white overflow-hidden"
                  style={{ backgroundColor: draftAvatarColor }}
                >
                  {draftAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draftAvatarUrl} alt="Avatar preview" className="w-full h-full object-cover" />
                  ) : (
                    initial
                  )}
                </div>
                <p className="text-gray-500 text-[11px]">Xem trước ảnh đại diện hiển thị trên hệ thống</p>
              </div>

              {/* Tải ảnh từ thiết bị + Thanh Zoom cắt ảnh */}
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
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[#3c8dbc] hover:bg-[#367fa9] text-white font-semibold rounded-sm shadow-xs"
                  >
                    <Upload size={14} /> Tải ảnh từ máy lên
                  </button>
                  {draftAvatarUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftAvatarUrl("");
                        setRawUploadUrl(null);
                      }}
                      className="flex items-center gap-1 px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 font-semibold rounded-sm"
                    >
                      <Trash2 size={14} /> Dùng chữ cái
                    </button>
                  )}
                </div>

                {rawUploadUrl && (
                  <div className="bg-gray-50 border border-gray-200 rounded-sm p-2.5 flex items-center gap-3 mt-1">
                    <ZoomIn size={15} className="text-[#3c8dbc] shrink-0" />
                    <span className="text-gray-600 font-medium shrink-0">Phóng to / Cắt ảnh:</span>
                    <input
                      type="range"
                      min={1}
                      max={2.5}
                      step={0.05}
                      value={zoom}
                      onChange={(e) => handleZoomChange(Number(e.target.value))}
                      className="flex-1 accent-[#3c8dbc]"
                    />
                    <span className="font-mono text-gray-700 w-10 text-right">{Math.round(zoom * 100)}%</span>
                  </div>
                )}
              </div>

              {/* Chọn nhanh Avatar mẫu */}
              <div>
                <p className="font-semibold text-gray-700 mb-2">Hoặc chọn nhanh Avatar mẫu KTX 5S:</p>
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
                        className={`flex flex-col items-center gap-1 p-1 rounded-sm border transition ${
                          selected
                            ? "border-[#3c8dbc] ring-2 ring-[#3c8dbc]/40 bg-blue-50/40"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preset.url} alt={preset.label} className="w-11 h-11 rounded-full" />
                        <span className="text-[10px] text-gray-600 truncate w-full text-center">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chọn màu nền khi dùng chữ cái đại diện */}
              <div>
                <p className="font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                  <Palette size={13} className="text-[#3c8dbc]" /> Màu nền chữ cái đại diện:
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
                          ? "border-gray-800 ring-2 ring-gray-300 font-bold"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ backgroundColor: c.hex }} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nút lưu */}
              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAvatarModal(false)}
                  className="px-3.5 py-2 border border-gray-300 rounded-sm text-gray-600 hover:bg-gray-50 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleApplyAvatar}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#00a65a] hover:bg-[#008d4c] text-white rounded-sm font-semibold shadow-xs"
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
