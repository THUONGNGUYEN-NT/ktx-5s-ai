"use client";
// TRANG ĐĂNG NHẬP — Cả Cán bộ và Sinh viên đều đăng nhập bằng: Tên đăng nhập + Mật khẩu riêng
// Tích hợp: Quên mật khẩu qua mã OTP (SMS Số điện thoại hoặc Email)
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
} from "lucide-react";
import { saveSession, type UserRole } from "@/lib/session";
import {
  authenticateUser,
  requestPasswordResetOtp,
  checkOtpValid,
  verifyOtpAndResetPassword,
  findAccountByIdentifier,
  getAllAccounts,
  getAllRoomCodes,
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
  const [remember, setRemember] = useState(true);
  const [savedList, setSavedList] = useState<SavedAccount[]>([]);
  const [error, setError] = useState("");
  const [successToast, setSuccessToast] = useState("");

  // State cho Modal "Quên mật khẩu / Khôi phục qua OTP"
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotMethod, setForgotMethod] = useState<"phone" | "email">("phone");
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1); // 1: Nhập định danh, 2: Nhập OTP, 3: Đặt mật khẩu mới
  const [forgotOtp, setForgotOtp] = useState("");
  const [maskedTarget, setMaskedTarget] = useState("");
  const [forgotNewPass, setForgotNewPass] = useState("");
  const [forgotConfirmPass, setForgotConfirmPass] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [countdown, setCountdown] = useState(0);

  // Khởi động dữ liệu mẫu
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

  // Bộ đếm ngược gửi lại OTP
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
        label: acc.role === "admin" ? `${acc.name} (${acc.username})` : `${acc.username} (Phòng ${acc.roomCode ?? ""})`,
      });
    }

    if (acc.role === "admin") {
      saveSession({
        role: "admin",
        username: acc.username,
        name: acc.name,
        phone: acc.phone,
        email: acc.email,
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
      });
      sessionStorage.removeItem("ai_result");
      router.push("/student");
    }
  };

  // Mở modal quên mật khẩu
  const handleOpenForgot = () => {
    setShowForgotModal(true);
    setForgotStep(1);
    setForgotIdentifier(username.trim() || "");
    setForgotOtp("");
    setForgotNewPass("");
    setForgotConfirmPass("");
    setForgotError("");
    setForgotSuccess("");
  };

  // Bước 1: Gửi mã OTP
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
  };

  // Bước 2: Xác nhận OTP
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    const cleanOtp = forgotOtp.trim();
    if (!cleanOtp) {
      setForgotError("Vui lòng nhập mã OTP gồm 6 chữ số.");
      return;
    }
    if (cleanOtp.length !== 6) {
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

  // Bước 3: Đặt mật khẩu mới
  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");

    if (!forgotNewPass || forgotNewPass.length < 6) {
      setForgotError("Mật khẩu mới phải có độ dài ít nhất 6 ký tự.");
      return;
    }
    if (forgotNewPass !== forgotConfirmPass) {
      setForgotError("Mật khẩu xác nhận không khớp. Vui lòng nhập lại.");
      return;
    }

    const res = verifyOtpAndResetPassword(forgotOtp, forgotNewPass);
    if (!res.success) {
      setForgotError(res.message);
      return;
    }

    // Thành công
    setForgotSuccess(res.message);
    if (res.username) {
      setUsername(res.username);
      setPassword(forgotNewPass);
    }
    setSuccessToast("Đã khôi phục mật khẩu thành công! Bạn có thể đăng nhập ngay bằng mật khẩu mới.");

    setTimeout(() => {
      setShowForgotModal(false);
    }, 1800);
  };

  const roleSaved = savedList
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => item.role === mode);

  return (
    <main className="min-h-screen bg-[#d2d6de] flex items-center justify-center p-6 text-[13px]">
      <div className="w-full max-w-4xl bg-white rounded shadow-2xl overflow-hidden grid md:grid-cols-2">
        {/* ===== CỘT TRÁI: GIỚI THIỆU ===== */}
        <section className="bg-gradient-to-br from-[#222d32] via-[#2c3b41] to-[#3c8dbc] text-white p-10 flex flex-col">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded bg-white flex items-center justify-center shadow">
              <ShieldCheck className="text-[#3c8dbc]" size={28} />
            </div>
            <span className="text-3xl tracking-tight">
              <span className="italic text-teal-300 font-semibold">ktx</span>
              <span className="font-black">5S AI</span>
            </span>
          </div>
          <h1 className="text-xl font-semibold mt-8 leading-snug">
            Hệ thống đánh giá vệ sinh phòng ở ký túc xá bằng trí tuệ nhân tạo
          </h1>
          <ul className="mt-8 flex flex-col gap-4 text-white/90">
            <li className="flex items-center gap-3">
              <Camera size={18} className="text-teal-300 shrink-0" /> Nộp ảnh đánh giá vệ sinh định kỳ hằng tuần
            </li>
            <li className="flex items-center gap-3">
              <Bot size={18} className="text-teal-300 shrink-0" /> Tự động hóa quy trình chấm điểm 5S bằng AI
            </li>
            <li className="flex items-center gap-3">
              <BarChart3 size={18} className="text-teal-300 shrink-0" /> Hỗ trợ ban quản lý giám sát tập trung toàn KTX
            </li>
          </ul>
          <p className="mt-auto pt-10 text-xs text-white/60">
            © 2026 Trung tâm Quản lý Ký túc xá và Khu đô thị ĐHQG-HCM
          </p>
        </section>

        {/* ===== CỘT PHẢI: FORM ĐĂNG NHẬP ===== */}
        <section className="p-10 flex flex-col justify-center relative">
          <h2 className="text-xl font-semibold text-gray-800">Đăng nhập hệ thống</h2>
          <p className="text-gray-500 mt-1">Chọn vai trò của bạn để tiếp tục</p>

          <div className="grid grid-cols-2 mt-6 border-b border-gray-200">
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
                className={`py-2.5 -mb-px border-b-2 font-semibold ${
                  mode === key
                    ? "border-[#3c8dbc] text-[#3c8dbc]"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Gợi ý tài khoản đã lưu */}
          {roleSaved.length > 0 && (
            <div className="mt-4 bg-blue-50/70 border border-blue-200 rounded-sm p-2.5">
              <p className="text-[11px] font-semibold text-[#3c8dbc] mb-1.5">
                Đã lưu trên thiết bị — chạm để điền nhanh:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {roleSaved.map(({ item, idx }) => (
                  <div
                    key={idx}
                    className="inline-flex items-center bg-white border border-blue-200 rounded-sm text-xs overflow-hidden shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => applySaved(item)}
                      className="px-2.5 py-1 hover:bg-blue-50 text-gray-700 font-medium"
                    >
                      {item.label}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveSaved(idx)}
                      title="Xóa tài khoản đã lưu này"
                      className="px-1.5 py-1 text-gray-400 hover:text-red-500 border-l border-blue-100"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {successToast && (
            <div className="mt-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 p-2.5 text-xs flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{successToast}</span>
            </div>
          )}

          <form onSubmit={submit} className="flex flex-col gap-4 mt-5" autoComplete="on">
            {mode === "student" && (
              <div className="bg-blue-50/80 border border-blue-200 rounded p-2.5 text-xs text-gray-700">
                <label className="block font-semibold text-[#3c8dbc] mb-1.5 flex items-center justify-between">
                  <span>🏢 Chọn nhanh phòng của bạn (200 phòng KTX):</span>
                  <span className="text-[10px] text-gray-500 font-normal">Tòa A, B, C, D · 10 Tầng</span>
                </label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      setUsername(e.target.value);
                      setPassword("ktx@123");
                      setError("");
                    }
                  }}
                  value={getAllRoomCodes().includes(username.toUpperCase()) ? username.toUpperCase() : ""}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-[#3c8dbc]"
                >
                  <option value="">-- Bấm để chọn phòng (hoặc tự nhập bên dưới) --</option>
                  {getAllRoomCodes().map((r) => (
                    <option key={r} value={r}>
                      Phòng {r} (Tòa {r[0]} · Tầng {r.split("-")[1]?.[0] || "1"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={
                  mode === "student"
                    ? "Nhập mã phòng (VD: A3-301, B2-201, A1-101...) hoặc tên đăng nhập"
                    : "Tên đăng nhập cán bộ (VD: admin, canbo01)"
                }
                className="w-full border border-gray-300 rounded-sm pl-9 pr-3 py-2.5 focus:border-[#3c8dbc] focus:outline-none uppercase"
              />
            </div>

            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                className="w-full border border-gray-300 rounded-sm pl-9 pr-3 py-2.5 focus:border-[#3c8dbc] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-gray-300 text-[#3c8dbc] focus:ring-[#3c8dbc]"
                />
                Lưu tài khoản
              </label>

              {/* NÚT QUÊN MẬT KHẨU */}
              <button
                type="button"
                onClick={handleOpenForgot}
                className="text-[#3c8dbc] hover:text-[#286090] font-medium hover:underline flex items-center gap-1"
              >
                <KeyRound size={13} />
                Quên mật khẩu?
              </button>
            </div>

            {error && (
              <p className="bg-red-50 border-l-4 border-[#dd4b39] text-[#dd4b39] px-3 py-2 text-xs">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="flex items-center justify-center gap-2 bg-[#3c8dbc] hover:bg-[#367fa9] text-white py-2.5 rounded-sm font-semibold transition-colors"
            >
              <LogIn size={16} /> Đăng nhập
            </button>
          </form>

          {/* Hộp gợi ý tài khoản */}
          <div className="mt-5 pt-4 border-t border-gray-100 text-[11px] text-gray-500">
            <p className="font-semibold text-gray-700 mb-1">🔑 Tài khoản đăng nhập hệ thống:</p>
            <p>
              • <b>Cán bộ KTX:</b> <code className="bg-gray-100 px-1 py-0.5 rounded">admin</code> (mk: <code>admin123</code>) |{" "}
              <code className="bg-gray-100 px-1 py-0.5 rounded">canbo01</code> (mk: <code>ktx@2026</code>)
            </p>
            <p className="mt-1 leading-relaxed">
              • <b>Sinh viên:</b> Đăng nhập bằng <b>Mã phòng bất kỳ</b> trong 200 phòng KTX (VD: <code className="bg-gray-100 px-1 py-0.5 rounded">A3-301</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">B2-201</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">A1-101</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">B3-301</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">C2-203</code>... mk: <code>ktx@123</code>) hoặc tài khoản mẫu <code className="bg-gray-100 px-1 py-0.5 rounded">sinhvien01</code> (mk: <code>Ktx#9482</code>), <code className="bg-gray-100 px-1 py-0.5 rounded">sinhvien02</code> (mk: <code>Phong@7159</code>).
            </p>
          </div>
        </section>
      </div>

      {/* ===================================================================== */}
      {/* MODAL: KHÔI PHỤC MẬT KHẨU QUA MÃ OTP (SỐ ĐIỆN THOẠI HOẶC EMAIL)       */}
      {/* ===================================================================== */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header modal */}
            <div className="bg-[#222d32] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#3c8dbc] flex items-center justify-center text-white">
                  <KeyRound size={17} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Khôi phục mật khẩu</h3>
                  <p className="text-[11px] text-gray-300">Nhận mã OTP qua SMS hoặc Email</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quy trình các bước */}
            <div className="flex border-b border-gray-200 bg-gray-50 text-[11px]">
              <div
                className={`flex-1 py-2 text-center border-b-2 font-medium ${
                  forgotStep === 1
                    ? "border-[#3c8dbc] text-[#3c8dbc] font-bold bg-white"
                    : forgotStep > 1
                    ? "border-emerald-500 text-emerald-600"
                    : "border-transparent text-gray-400"
                }`}
              >
                1. Nhập định danh
              </div>
              <div
                className={`flex-1 py-2 text-center border-b-2 font-medium ${
                  forgotStep === 2
                    ? "border-[#3c8dbc] text-[#3c8dbc] font-bold bg-white"
                    : forgotStep > 2
                    ? "border-emerald-500 text-emerald-600"
                    : "border-transparent text-gray-400"
                }`}
              >
                2. Xác thực OTP
              </div>
              <div
                className={`flex-1 py-2 text-center border-b-2 font-medium ${
                  forgotStep === 3
                    ? "border-[#3c8dbc] text-[#3c8dbc] font-bold bg-white"
                    : "border-transparent text-gray-400"
                }`}
              >
                3. Đặt mật khẩu mới
              </div>
            </div>

            <div className="p-5">
              {forgotError && (
                <div className="mb-4 bg-red-50 border-l-4 border-red-500 text-red-700 p-2.5 text-xs flex items-start gap-2">
                  <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <span>{forgotError}</span>
                </div>
              )}

              {forgotSuccess && (
                <div className="mb-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 p-2.5 text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{forgotSuccess}</span>
                </div>
              )}

              {/* BƯỚC 1: NHẬP ĐỊNH DANH & CHỌN PHƯƠNG THỨC */}
              {forgotStep === 1 && (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Chọn kênh nhận mã xác thực OTP:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setForgotMethod("phone")}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded border text-xs font-medium transition-all ${
                          forgotMethod === "phone"
                            ? "border-[#3c8dbc] bg-blue-50 text-[#3c8dbc] ring-1 ring-[#3c8dbc]"
                            : "border-gray-300 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <Phone size={15} /> Qua SMS Điện thoại
                      </button>
                      <button
                        type="button"
                        onClick={() => setForgotMethod("email")}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded border text-xs font-medium transition-all ${
                          forgotMethod === "email"
                            ? "border-[#3c8dbc] bg-blue-50 text-[#3c8dbc] ring-1 ring-[#3c8dbc]"
                            : "border-gray-300 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <Mail size={15} /> Qua Hòm thư Email
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Tên đăng nhập, Email hoặc Số điện thoại:
                    </label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={forgotIdentifier}
                        onChange={(e) => setForgotIdentifier(e.target.value)}
                        placeholder="VD: admin, sinhvien01, 0934567890..."
                        className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-xs focus:border-[#3c8dbc] focus:outline-none"
                        autoFocus
                      />
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Hệ thống sẽ tra cứu số điện thoại hoặc email liên kết của tài khoản để phát sinh mã OTP.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="px-3.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#3c8dbc] hover:bg-[#367fa9] text-white text-xs font-semibold rounded shadow-sm"
                    >
                      Gửi mã OTP <ArrowRight size={14} />
                    </button>
                  </div>
                </form>
              )}

              {/* BƯỚC 2: NHẬP VÀ XÁC THỰC MÃ OTP */}
              {forgotStep === 2 && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="bg-sky-50 border border-sky-200 rounded p-3 text-xs text-sky-900 leading-relaxed">
                    <p className="font-semibold flex items-center gap-1.5 text-[#3c8dbc]">
                      {forgotMethod === "phone" ? <Phone size={14} /> : <Mail size={14} />}
                      Mã xác thực đã được gửi tới: <span className="font-bold">{maskedTarget}</span>
                    </p>
                    <p className="text-[11px] text-sky-700 mt-1">
                      Vui lòng kiểm tra tin nhắn trên điện thoại hoặc hộp thư Email của bạn (bao gồm cả mục Thư rác/Spam) và nhập mã 6 số vào ô bên dưới. Mã có hiệu lực trong 5 phút.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Nhập mã OTP (6 số):
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="VD: 123456"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-center text-lg font-mono font-bold tracking-widest focus:border-[#3c8dbc] focus:outline-none"
                      autoFocus
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-gray-500">
                      {countdown > 0 ? (
                        `Gửi lại sau ${countdown}s`
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleSendOtp(e)}
                          className="text-[#3c8dbc] hover:underline font-medium flex items-center gap-1"
                        >
                          <RefreshCw size={12} /> Gửi lại mã OTP mới
                        </button>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      className="text-gray-500 hover:text-gray-700 text-xs"
                    >
                      Đổi số/email khác
                    </button>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="px-3.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-sm"
                    >
                      Xác nhận OTP <ArrowRight size={14} />
                    </button>
                  </div>
                </form>
              )}

              {/* BƯỚC 3: ĐẶT MẬT KHẨU MỚI */}
              {forgotStep === 3 && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded p-2.5 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>Xác thực OTP thành công! Mời bạn thiết lập mật khẩu đăng nhập mới.</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Mật khẩu mới:
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="password"
                        value={forgotNewPass}
                        onChange={(e) => setForgotNewPass(e.target.value)}
                        placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                        className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-xs focus:border-[#3c8dbc] focus:outline-none"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Xác nhận lại mật khẩu mới:
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="password"
                        value={forgotConfirmPass}
                        onChange={(e) => setForgotConfirmPass(e.target.value)}
                        placeholder="Nhập lại mật khẩu mới"
                        className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-xs focus:border-[#3c8dbc] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="px-3.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#3c8dbc] hover:bg-[#367fa9] text-white text-xs font-semibold rounded shadow-sm"
                    >
                      <CheckCircle2 size={14} /> Hoàn tất đổi mật khẩu
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
