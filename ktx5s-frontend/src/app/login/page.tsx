"use client";
// TRANG ĐĂNG NHẬP — MODERN NAVY-BLUE THEME (KTX 5S AI · ĐHQG-HCM)
// Tích hợp đầy đủ: Đăng nhập Cán bộ & Sinh viên, Nhớ tài khoản trên thiết bị, Quên mật khẩu qua OTP 3 bước
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Lock,
  ShieldCheck,
  Bot,
  Camera,
  BarChart3,
  LogIn,
  X,
  KeyRound,
  Phone,
  Mail,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building2,
  Eye,
  EyeOff,
  MapPin,
} from "lucide-react";
import { saveSession, type UserRole } from "@/lib/session";
import {
  authenticateUser,
  requestPasswordResetOtp,
  checkOtpValid,
  verifyOtpAndResetPassword,
  findAccountByIdentifier,
  getAllAccounts,
  getActiveOtpCode,
} from "@/lib/user-store";

type SavedAccount = {
  role: UserRole;
  username: string;
  password: string;
  label: string;
};

const SAVED_ACCOUNTS_KEY = "ktx5s_remembered_accounts_v3";

function loadSavedAccounts(): SavedAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function rememberAccount(acc: SavedAccount) {
  if (typeof window === "undefined") return;
  try {
    const list = loadSavedAccounts().filter(
      (a) => !(a.role === acc.role && a.username.toLowerCase() === acc.username.toLowerCase())
    );
    list.unshift(acc);
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(list.slice(0, 5)));
  } catch {}
}

function removeSavedAccount(index: number) {
  if (typeof window === "undefined") return [];
  try {
    const list = loadSavedAccounts();
    list.splice(index, 1);
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(list));
    return list;
  } catch {
    return [];
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<UserRole>("admin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [savedList, setSavedList] = useState<SavedAccount[]>([]);
  const [error, setError] = useState("");
  const [successToast, setSuccessToast] = useState("");

  // Modal Quên mật khẩu OTP
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotMethod, setForgotMethod] = useState<"phone" | "email" | "both">("phone");
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotOtp, setForgotOtp] = useState("");
  const [maskedTarget, setMaskedTarget] = useState("");
  const [forgotNewPass, setForgotNewPass] = useState("");
  const [forgotConfirmPass, setForgotConfirmPass] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    getAllAccounts();
    const all = loadSavedAccounts();
    setSavedList(all);
    const lastForRole = all.find((a) => a.role === mode);
    if (lastForRole) {
      setUsername(lastForRole.username);
      setPassword(lastForRole.password);
    }
  }, [mode]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const switchMode = (m: UserRole) => {
    setMode(m);
    setError("");
    const lastForRole = savedList.find((a) => a.role === m);
    if (lastForRole) {
      setUsername(lastForRole.username);
      setPassword(lastForRole.password);
    } else {
      setUsername("");
      setPassword("");
    }
  };

  const applySaved = (acc: SavedAccount) => {
    setUsername(acc.username);
    setPassword(acc.password);
    setError("");
  };

  const handleRemoveSaved = (idx: number) => {
    const updated = removeSavedAccount(idx);
    setSavedList(updated);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const userClean = username.trim();
    if (!userClean) return setError("Vui lòng nhập tên đăng nhập.");
    if (!password) return setError("Vui lòng nhập mật khẩu.");

    const acc = authenticateUser(userClean, password, mode);
    if (!acc) {
      return setError("Tên đăng nhập hoặc mật khẩu không chính xác.");
    }

    if (remember) {
      rememberAccount({
        role: acc.role,
        username: acc.username,
        password: acc.password,
        label:
          acc.role === "admin"
            ? `${acc.name} (${acc.username})`
            : `${acc.username} (Phòng ${acc.roomCode ?? ""})`,
      });
    }

    if (acc.role === "admin") {
      saveSession({
        role: "admin",
        username: acc.username,
        name: acc.name,
        phone: acc.phone,
        email: acc.email,
        avatarUrl: acc.avatarUrl,
        avatarColor: acc.avatarColor,
      });
      router.push("/admin");
    } else {
      saveSession({
        role: "student",
        username: acc.username,
        roomCode: acc.roomCode,
        studentId: acc.studentCode ?? acc.username,
        name: acc.name,
        phone: acc.phone,
        email: acc.email,
        avatarUrl: acc.avatarUrl,
        avatarColor: acc.avatarColor,
      });
      sessionStorage.removeItem("ai_result");
      router.push("/student");
    }
  };

  const handleOpenForgot = () => {
    setShowForgotModal(true);
    setForgotStep(1);
    const cleanUser = username.trim() || "";
    setForgotIdentifier(cleanUser);
    if (cleanUser) {
      const acc = findAccountByIdentifier(cleanUser);
      if (acc?.preferredAuthMethod) {
        setForgotMethod(acc.preferredAuthMethod);
      }
    }
    setForgotOtp("");
    setForgotNewPass("");
    setForgotConfirmPass("");
    setForgotError("");
    setForgotSuccess("");
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    const clean = forgotIdentifier.trim();
    if (!clean) {
      setForgotError("Vui lòng nhập Tên đăng nhập, Email hoặc Số điện thoại.");
      return;
    }

    const res = await requestPasswordResetOtp(clean, forgotMethod);
    if (!res.success) {
      setForgotError(res.message);
      return;
    }

    setMaskedTarget(res.maskedTarget || "");
    setForgotStep(2);
    setCountdown(60);
    getActiveOtpCode();
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    const cleanOtp = forgotOtp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setForgotError("Mã OTP phải có đúng 6 chữ số.");
      return;
    }
    const check = checkOtpValid(cleanOtp);
    if (!check.valid) {
      setForgotError(check.message);
      return;
    }
    setForgotStep(3);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    if (!forgotNewPass || forgotNewPass.length < 6) {
      setForgotError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    if (forgotNewPass !== forgotConfirmPass) {
      setForgotError("Mật khẩu xác nhận không khớp.");
      return;
    }
    const res = verifyOtpAndResetPassword(forgotOtp, forgotNewPass);
    if (!res.success) {
      setForgotError(res.message);
      return;
    }
    setForgotSuccess(res.message);
    if (res.username) {
      setUsername(res.username);
      setPassword(forgotNewPass);
    }
    setSuccessToast("Đã khôi phục mật khẩu thành công! Bạn có thể đăng nhập ngay.");
    setTimeout(() => setShowForgotModal(false), 1800);
  };

  const roleSaved = savedList
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => item.role === mode);

  return (
    <main className="min-h-dvh bg-gradient-to-br from-[#e8f0fb] via-[#f4f7fb] to-[#e2ecf9] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-[0_20px_60px_rgba(15,34,61,0.12)] border border-slate-200/70 overflow-hidden grid md:grid-cols-12">
        {/* ===== CỘT TRÁI: NHẬN DIỆN NAVY-BLUE KTX 5S AI ===== */}
        <section className="md:col-span-5 relative bg-gradient-to-b from-[#1a345a] via-[#172e50] to-[#0f223d] text-white p-7 sm:p-9 flex flex-col justify-between overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shadow-inner">
                <Building2 size={24} className="text-sky-300" />
              </div>
              <span className="text-2xl font-extrabold tracking-tight">
                KTX 5S <span className="text-sky-300">AI</span>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold mt-7 leading-snug">
              Hệ thống đánh giá vệ sinh phòng KTX tự động bằng AI
            </h1>
            <p className="text-xs sm:text-sm text-sky-100/75 mt-2 leading-relaxed">
              Quản lý chuẩn 5S thông minh, minh bạch và đồng bộ thời gian thực trên cả máy tính lẫn điện thoại.
            </p>

            <ul className="mt-7 space-y-3.5 text-sm text-sky-50/90 hidden md:flex md:flex-col">
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Camera size={16} className="text-sky-300" />
                </span>
                <span>Chụp ảnh giường tầng &amp; khu vực chung nhanh chóng</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Bot size={16} className="text-sky-300" />
                </span>
                <span>AI phân tích, chống gian lận và chấm điểm 5S tự động</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <BarChart3 size={16} className="text-sky-300" />
                </span>
                <span>Giám sát tập trung 200 phòng theo từng tòa &amp; tầng</span>
              </li>
            </ul>
          </div>

          <div className="relative z-10 mt-6 md:mt-10 pt-4 border-t border-white/10 flex items-center gap-2 text-xs text-sky-200/80">
            <MapPin size={15} className="text-sky-300 shrink-0" />
            <span>Trung tâm Quản lý Ký túc xá ĐHQG-HCM</span>
          </div>

          {/* Đồ họa tòa nhà KTX mờ phía dưới */}
          <svg
            viewBox="0 0 300 100"
            className="absolute bottom-0 inset-x-0 w-full h-28 opacity-15 pointer-events-none select-none"
            preserveAspectRatio="none"
          >
            <rect x="10" y="38" width="52" height="62" rx="2" fill="#93c5fd" />
            <rect x="70" y="16" width="74" height="84" rx="2" fill="#bfdbfe" />
            <rect x="152" y="28" width="66" height="72" rx="2" fill="#93c5fd" />
            <rect x="226" y="46" width="62" height="54" rx="2" fill="#60a5fa" />
          </svg>
        </section>

        {/* ===== CỘT PHẢI: FORM ĐĂNG NHẬP ===== */}
        <section className="md:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800">Đăng nhập hệ thống</h2>
            <p className="text-sm text-slate-500 mt-1">
              Chọn vai trò của bạn để truy cập bảng điều khiển
            </p>
          </div>

          {/* Tab chọn vai trò dạng Pill hiện đại */}
          <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-2xl mt-6">
            {(
              [
                ["admin", "Cán bộ KTX"],
                ["student", "Sinh viên"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => switchMode(key)}
                className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                  mode === key
                    ? "bg-white text-[#1d4ed8] shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Gợi ý tài khoản đã lưu trên thiết bị */}
          {roleSaved.length > 0 && (
            <div className="mt-4 bg-blue-50/70 border border-blue-200/70 rounded-xl p-3">
              <p className="text-[11px] font-bold text-[#1d4ed8] mb-2">
                Tài khoản đã lưu trên thiết bị:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {roleSaved.map(({ item, idx }) => (
                  <div
                    key={idx}
                    className="inline-flex items-center bg-white border border-blue-200/80 rounded-lg text-xs overflow-hidden shadow-2xs"
                  >
                    <button
                      type="button"
                      onClick={() => applySaved(item)}
                      className="px-2.5 py-1.5 hover:bg-blue-50 text-slate-700 font-semibold"
                    >
                      {item.label}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveSaved(idx)}
                      title="Xóa"
                      className="px-1.5 py-1.5 text-slate-400 hover:text-rose-500 border-l border-blue-100"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {successToast && (
            <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-medium flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{successToast}</span>
            </div>
          )}

          <form onSubmit={submit} className="flex flex-col gap-4 mt-5" autoComplete="on">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                Tên đăng nhập
              </label>
              <div className="relative">
                <User size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={
                    mode === "admin"
                      ? "Nhập tài khoản cán bộ..."
                      : "Nhập mã phòng hoặc tài khoản SV (VD: sinhvien01)..."
                  }
                  className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Mật khẩu</label>
              <div className="relative">
                <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPass ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  className="w-full border border-slate-200 rounded-xl pl-10 pr-10 py-3 text-sm text-slate-800 focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 focus:outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 text-slate-600 cursor-pointer select-none font-medium">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-slate-300 text-[#1d4ed8] focus:ring-[#1d4ed8]"
                />
                Lưu tài khoản
              </label>

              <button
                type="button"
                onClick={handleOpenForgot}
                className="text-[#1d4ed8] hover:text-[#1e40af] font-semibold hover:underline flex items-center gap-1"
              >
                <KeyRound size={13} />
                Quên mật khẩu?
              </button>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="mt-1 flex items-center justify-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] active:scale-[0.99] text-white py-3.5 rounded-xl font-bold text-sm shadow-md shadow-blue-900/15 transition"
            >
              <LogIn size={18} /> Đăng nhập ngay
            </button>
          </form>
        </section>
      </div>

      {/* ===== MODAL QUÊN MẬT KHẨU QUA OTP ===== */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-[#1b365d] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-sky-300">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Khôi phục mật khẩu</h3>
                  <p className="text-[11px] text-sky-200/80">Xác thực mã OTP qua SMS hoặc Email</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex border-b border-slate-100 bg-slate-50 text-[11px]">
              {[
                [1, "1. Định danh"],
                [2, "2. Xác thực OTP"],
                [3, "3. Mật khẩu mới"],
              ].map(([step, label]) => (
                <div
                  key={step}
                  className={`flex-1 py-2.5 text-center border-b-2 font-semibold ${
                    forgotStep === step
                      ? "border-[#1d4ed8] text-[#1d4ed8] bg-white"
                      : forgotStep > Number(step)
                      ? "border-emerald-500 text-emerald-600"
                      : "border-transparent text-slate-400"
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="p-5">
              {forgotError && (
                <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{forgotError}</span>
                </div>
              )}

              {forgotSuccess && (
                <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>{forgotSuccess}</span>
                </div>
              )}

              {forgotStep === 1 && (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Chọn kênh nhận mã OTP:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          ["phone", "Qua SMS", Phone],
                          ["email", "Qua Email", Mail],
                          ["both", "Cả hai kênh", ShieldCheck],
                        ] as const
                      ).map(([m, lbl, Icon]) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setForgotMethod(m)}
                          className={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl border text-[11px] font-semibold transition ${
                            forgotMethod === m
                              ? "border-[#1d4ed8] bg-blue-50 text-[#1d4ed8]"
                              : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <Icon size={15} /> {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Tên đăng nhập, Email hoặc Số điện thoại:
                    </label>
                    <input
                      type="text"
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      placeholder="Nhập thông tin tài khoản..."
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:border-[#2563eb] focus:outline-none"
                      autoFocus
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-bold rounded-xl shadow-xs"
                    >
                      Gửi mã OTP <ArrowRight size={14} />
                    </button>
                  </div>
                </form>
              )}

              {forgotStep === 2 && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-slate-700">
                    <p className="font-bold text-[#1d4ed8]">
                      Mã OTP đã gửi tới: {maskedTarget}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Nhập mã 6 chữ số nhận được trong hộp thư hoặc tin nhắn (hiệu lực 5 phút).
                    </p>
                  </div>

                  <input
                    type="text"
                    maxLength={6}
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-center text-xl font-mono font-bold tracking-[0.35em] focus:border-[#2563eb] focus:outline-none"
                    autoFocus
                  />

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      {countdown > 0 ? (
                        `Gửi lại sau ${countdown}s`
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleSendOtp(e)}
                          className="text-[#1d4ed8] hover:underline font-semibold flex items-center gap-1"
                        >
                          <RefreshCw size={12} /> Gửi lại mã
                        </button>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      className="text-slate-500 hover:text-slate-800"
                    >
                      Đổi kênh nhận
                    </button>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl"
                    >
                      Xác nhận OTP <ArrowRight size={14} />
                    </button>
                  </div>
                </form>
              )}

              {forgotStep === 3 && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 font-medium">
                    ✅ Xác thực thành công! Thiết lập mật khẩu mới bên dưới.
                  </div>

                  <input
                    type="password"
                    value={forgotNewPass}
                    onChange={(e) => setForgotNewPass(e.target.value)}
                    placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:border-[#2563eb] focus:outline-none"
                    autoFocus
                  />
                  <input
                    type="password"
                    value={forgotConfirmPass}
                    onChange={(e) => setForgotConfirmPass(e.target.value)}
                    placeholder="Xác nhận mật khẩu mới"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:border-[#2563eb] focus:outline-none"
                  />

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-bold rounded-xl"
                    >
                      <CheckCircle2 size={14} /> Lưu mật khẩu mới
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
