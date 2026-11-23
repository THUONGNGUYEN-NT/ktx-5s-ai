"use client";
import { useState, useEffect } from "react";
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
} from "lucide-react";
import { getSession, saveSession, type UserRole } from "@/lib/session";
import {
  findAccountByUsername,
  updateUserProfile,
  changeUserPassword,
  requestPasswordResetOtp,
  requestContactVerificationOtp,
  confirmContactVerification,
  updateAuthPreferences,
  getActiveOtpCode,
  type UserAccount,
  type VerificationMethod,
} from "@/lib/user-store";

export default function UserProfileView({ role }: { role: UserRole }) {
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "password" | "security">("info");

  // Form thông tin cá nhân
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [unit, setUnit] = useState("");
  const [major, setMajor] = useState("");
  const [infoMessage, setInfoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form đổi mật khẩu
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Lựa chọn phương thức xác thực bảo mật (1 trong 2 hoặc cả 2)
  const [preferredMethod, setPreferredMethod] = useState<VerificationMethod>("phone");
  const [prefMessage, setPrefMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Tiến trình xác thực Số điện thoại / Email qua OTP
  const [verifyingTarget, setVerifyingTarget] = useState<VerificationMethod | null>(null);
  const [verifyOtpInput, setVerifyOtpInput] = useState("");
  const [verifyStatusMessage, setVerifyStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSendingVerifyOtp, setIsSendingVerifyOtp] = useState(false);

  // Kiểm tra gửi mã OTP xác thực thực tế
  const [otpTestStatus, setOtpTestStatus] = useState<string>("");

  useEffect(() => {
    const session = getSession();
    if (!session || !session.username) {
      // Fallback
      const defaultUser = role === "admin" ? "admin" : "sinhvien01";
      const acc = findAccountByUsername(defaultUser);
      if (acc) loadAccountData(acc);
      return;
    }

    const acc = findAccountByUsername(session.username);
    if (acc) {
      loadAccountData(acc);
    }
  }, [role]);

  const loadAccountData = (acc: UserAccount) => {
    setAccount(acc);
    setFullName(acc.name);
    setPhone(acc.phone);
    setEmail(acc.email);
    setUnit(acc.unit || "");
    setMajor(acc.major || "");
    setPreferredMethod(acc.preferredAuthMethod || "phone");
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
    });

    if (res.success && res.updated) {
      setAccount(res.updated);
      setInfoMessage({ type: "success", text: "Cập nhật thông tin tài khoản thành công!" });

      // Đồng bộ vào session hiện hành
      const currentSession = getSession();
      if (currentSession) {
        saveSession({
          ...currentSession,
          name: res.updated.name,
          phone: res.updated.phone,
          email: res.updated.email,
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

  // Bắt đầu quy trình xác thực SĐT hoặc Email
  const handleStartVerify = async (method: VerificationMethod) => {
    if (!account) return;
    setVerifyStatusMessage(null);
    setVerifyOtpInput("");
    setIsSendingVerifyOtp(true);
    setVerifyingTarget(method);

    const res = await requestContactVerificationOtp(account.username, method);
    setIsSendingVerifyOtp(false);
    if (res.success) {
      setVerifyStatusMessage({
        type: "success",
        text: res.message,
      });
    } else {
      setVerifyStatusMessage({
        type: "error",
        text: res.message,
      });
      setVerifyingTarget(null);
    }
  };

  // Xác nhận mã OTP để hoàn tất xác thực
  const handleConfirmVerify = () => {
    if (!account || !verifyingTarget) return;
    setVerifyStatusMessage(null);

    const cleanOtp = verifyOtpInput.trim();
    if (!cleanOtp) {
      setVerifyStatusMessage({ type: "error", text: "Vui lòng nhập mã OTP gồm 6 chữ số." });
      return;
    }

    const res = confirmContactVerification(account.username, cleanOtp, verifyingTarget);
    if (res.success && res.updated) {
      setAccount(res.updated);
      setVerifyStatusMessage({ type: "success", text: res.message });
      setVerifyingTarget(null);
      setVerifyOtpInput("");
    } else {
      setVerifyStatusMessage({ type: "error", text: res.message });
    }
  };

  // Lưu lựa chọn phương thức xác thực bảo mật
  const handleSavePreferences = () => {
    if (!account) return;
    setPrefMessage(null);

    const res = updateAuthPreferences(account.username, preferredMethod);
    if (res.success && res.updated) {
      setAccount(res.updated);
      setPrefMessage({ type: "success", text: res.message });
    } else {
      setPrefMessage({ type: "error", text: res.message });
    }
  };

  // Kiểm tra gửi OTP thực tế
  const handleTestOtp = async (method: VerificationMethod) => {
    if (!account) return;
    setOtpTestStatus("Đang gửi mã xác thực OTP thực tế...");
    const res = await requestPasswordResetOtp(account.username, method);
    if (res.success) {
      const targetLabel =
        method === "phone"
          ? "SMS số điện thoại"
          : method === "email"
          ? "hòm thư Email"
          : "CẢ HAI kênh (SMS & Email)";
      setOtpTestStatus(`✅ Đã gửi mã OTP thực tế tới ${targetLabel}: ${res.maskedTarget}. Vui lòng kiểm tra tin nhắn/hộp thư.`);
    } else {
      setOtpTestStatus(`❌ ${res.message}`);
    }
  };

  if (!account) {
    return (
      <div className="p-8 text-center text-gray-500">
        Đang tải thông tin tài khoản...
      </div>
    );
  }

  const roleTitle = role === "admin" ? "Cán bộ Quản lý KTX" : `Sinh viên Phòng ${account.roomCode || ""}`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ===== CARD 1: BANNER TỔNG QUAN TÀI KHOẢN ===== */}
      <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-[#222d32] via-[#2c3b41] to-[#3c8dbc] h-28 relative">
          <div className="absolute bottom-3 right-4 text-white/80 text-xs flex items-center gap-1.5">
            <Calendar size={14} /> Ngày tham gia: <span className="font-semibold text-white">{account.joinedDate || "01/01/2024"}</span>
          </div>
        </div>
        <div className="px-6 pb-6 pt-0 relative flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div className="flex items-end gap-4 -mt-12">
            <div className="w-24 h-24 rounded-full border-4 border-white bg-[#3c8dbc] text-white flex items-center justify-center text-3xl font-extrabold shadow-md">
              {account.name.charAt(0).toUpperCase()}
            </div>
            <div className="mb-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-800">{account.name}</h1>
                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Đang hoạt động
                </span>
              </div>
              <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-2">
                <span className="font-medium text-[#3c8dbc]">{roleTitle}</span> •{" "}
                <span>Tên đăng nhập: <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700 font-bold">{account.username}</code></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0">
            <button
              onClick={() => setActiveTab("info")}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                activeTab === "info" ? "bg-[#3c8dbc] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Hồ sơ cá nhân
            </button>
            <button
              onClick={() => setActiveTab("password")}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                activeTab === "password" ? "bg-[#3c8dbc] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Đổi mật khẩu
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                activeTab === "security" ? "bg-[#3c8dbc] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Bảo mật & OTP
            </button>
          </div>
        </div>
      </div>

      {/* ===== CARD 2: NỘI DUNG TỪNG TAB ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CỘT TRÁI: THẺ THÔNG TIN NHANH */}
        <div className="space-y-4">
          <div className="bg-white rounded border border-gray-200 p-5 shadow-sm">
            <h3 className="font-bold text-gray-800 text-sm pb-3 border-b border-gray-100 flex items-center gap-2">
              <ShieldCheck size={17} className="text-[#3c8dbc]" />
              Quyền hạn & Định danh
            </h3>
            <ul className="mt-4 space-y-3 text-xs">
              <li className="flex justify-between items-center text-gray-600">
                <span>Vai trò hệ thống:</span>
                <span className="font-semibold text-gray-800 bg-blue-50 text-[#3c8dbc] px-2 py-0.5 rounded">
                  {role === "admin" ? "Cán bộ KTX (Admin)" : "Sinh viên lưu trú"}
                </span>
              </li>
              {role === "student" && (
                <>
                  <li className="flex justify-between items-center text-gray-600">
                    <span>Mã số sinh viên:</span>
                    <span className="font-semibold text-gray-800">{account.studentCode || "Chưa cập nhật"}</span>
                  </li>
                  <li className="flex justify-between items-center text-gray-600">
                    <span>Phòng đăng ký:</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      Phòng {account.roomCode}
                    </span>
                  </li>
                </>
              )}
              {role === "admin" && (
                <li className="flex justify-between items-center text-gray-600">
                  <span>Phạm vi giám sát:</span>
                  <span className="font-semibold text-gray-800">{account.unit || "Toàn ký túc xá"}</span>
                </li>
              )}
              <li className="flex justify-between items-center text-gray-600">
                <span>Trạng thái tài khoản:</span>
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={13} /> Bình thường
                </span>
              </li>
              <li className="flex justify-between items-center text-gray-600">
                <span>Xác thực 2 lớp OTP:</span>
                <span className="text-[#3c8dbc] font-semibold">Đã kích hoạt</span>
              </li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded p-4 text-xs text-blue-900 leading-relaxed shadow-sm">
            <p className="font-bold text-blue-950 flex items-center gap-1.5 mb-1">
              <Sparkles size={15} className="text-[#3c8dbc]" /> Bảo mật tài khoản KTX 5S:
            </p>
            <p>
              Số điện thoại và Email được sử dụng để nhận mã OTP khi bạn quên mật khẩu. Vui lòng đảm bảo thông tin luôn chính xác.
            </p>
          </div>
        </div>

        {/* CỘT PHẢI: CHI TIẾT THEO TAB ĐANG CHỌN */}
        <div className="lg:col-span-2">
          {/* TAB 1: THÔNG TIN CÁ NHÂN */}
          {activeTab === "info" && (
            <div className="bg-white rounded border border-gray-200 p-6 shadow-sm">
              <div className="border-b border-gray-200 pb-3 mb-5">
                <h2 className="text-base font-bold text-gray-800">Thông tin chi tiết tài khoản</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Cập nhật họ tên, số điện thoại và email nhận thông báo vệ sinh phòng 5S
                </p>
              </div>

              {infoMessage && (
                <div
                  className={`mb-4 p-3 rounded text-xs flex items-center gap-2 ${
                    infoMessage.type === "success"
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                      : "bg-red-50 border border-red-200 text-red-800"
                  }`}
                >
                  {infoMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{infoMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleSaveInfo} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Tên đăng nhập (Username):</label>
                    <div className="relative">
                      <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={account.username}
                        disabled
                        className="w-full bg-gray-100 border border-gray-300 rounded pl-9 pr-3 py-2 text-gray-500 cursor-not-allowed font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Họ và tên đầy đủ:</label>
                    <div className="relative">
                      <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Nhập họ và tên..."
                        className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-gray-800 focus:border-[#3c8dbc] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">
                      Số điện thoại (Nhận OTP SMS):
                    </label>
                    <div className="relative">
                      <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="VD: 0934567890..."
                        className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-gray-800 focus:border-[#3c8dbc] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">
                      Địa chỉ Email (Nhận OTP & Báo cáo):
                    </label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="VD: sinhvien@student.edu.vn..."
                        className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-gray-800 focus:border-[#3c8dbc] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {role === "student" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Phòng ở KTX:</label>
                      <div className="relative">
                        <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={account.roomCode || ""}
                          disabled
                          className="w-full bg-gray-100 border border-gray-300 rounded pl-9 pr-3 py-2 text-gray-600 font-semibold cursor-not-allowed"
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
                          className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-gray-800 focus:border-[#3c8dbc] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="pt-1">
                    <label className="block font-semibold text-gray-700 mb-1">Đơn vị công tác / Cụm tòa quản lý:</label>
                    <div className="relative">
                      <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder="Ban Quản lý Cụm Nhà B..."
                        className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-gray-800 focus:border-[#3c8dbc] focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-gray-100 flex justify-end">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#3c8dbc] hover:bg-[#367fa9] text-white font-semibold rounded shadow-sm transition-colors"
                  >
                    <Save size={15} /> Lưu thay đổi hồ sơ
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: ĐỔI MẬT KHẨU */}
          {activeTab === "password" && (
            <div className="bg-white rounded border border-gray-200 p-6 shadow-sm">
              <div className="border-b border-gray-200 pb-3 mb-5">
                <h2 className="text-base font-bold text-gray-800">Đổi mật khẩu đăng nhập</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Nên dùng mật khẩu có độ dài từ 6 ký tự trở lên bao gồm chữ hoa, chữ thường và số để tăng tính bảo mật
                </p>
              </div>

              {passwordMessage && (
                <div
                  className={`mb-4 p-3 rounded text-xs flex items-center gap-2 ${
                    passwordMessage.type === "success"
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                      : "bg-red-50 border border-red-200 text-red-800"
                  }`}
                >
                  {passwordMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{passwordMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4 text-xs max-w-lg">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Mật khẩu hiện tại:</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Nhập mật khẩu hiện tại"
                      className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-gray-800 focus:border-[#3c8dbc] focus:outline-none"
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
                      className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-gray-800 focus:border-[#3c8dbc] focus:outline-none"
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
                      className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-gray-800 focus:border-[#3c8dbc] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#00a65a] hover:bg-[#008d4c] text-white font-semibold rounded shadow-sm transition-colors"
                  >
                    <Lock size={14} /> Cập nhật mật khẩu mới
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: XÁC THỰC SỐ ĐIỆN THOẠI, EMAIL & PHƯƠNG THỨC BẢO MẬT */}
          {activeTab === "security" && (
            <div className="bg-white rounded border border-gray-200 p-6 shadow-sm space-y-6">
              <div className="border-b border-gray-200 pb-3">
                <h2 className="text-base font-bold text-gray-800">Xác thực Liên hệ & Phương thức Bảo mật OTP</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Xác thực chứng thực chính chủ Số điện thoại, Email và tùy chọn phương thức nhận mã OTP (1 trong 2 hoặc cả hai).
                </p>
              </div>

              {/* 1. TRẠNG THÁI XÁC THỰC SĐT & EMAIL */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3 flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-[#3c8dbc]" />
                  1. Trạng thái chứng thực liên hệ
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* SỐ ĐIỆN THOẠI */}
                  <div className={`border rounded p-4 transition-all ${account.phoneVerified ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-gray-800 flex items-center gap-1.5">
                        <Phone size={15} className="text-[#3c8dbc]" /> Số điện thoại
                      </span>
                      {account.phoneVerified ? (
                        <span className="text-emerald-700 bg-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={12} /> Đã xác thực
                        </span>
                      ) : (
                        <span className="text-amber-800 bg-amber-100 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertCircle size={12} /> Chưa xác thực
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 mb-3">
                      Số đăng ký: <span className="font-mono font-bold text-gray-900">{account.phone || "Chưa có"}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => handleStartVerify("phone")}
                      disabled={isSendingVerifyOtp}
                      className={`w-full py-1.5 px-3 rounded text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                        account.phoneVerified
                          ? "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                          : "bg-[#3c8dbc] hover:bg-[#367fa9] text-white border-transparent shadow-xs"
                      }`}
                    >
                      <Send size={13} /> {account.phoneVerified ? "Xác thực lại qua SMS" : "Xác thực số điện thoại ngay"}
                    </button>
                  </div>

                  {/* HÒM THƯ EMAIL */}
                  <div className={`border rounded p-4 transition-all ${account.emailVerified ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-gray-800 flex items-center gap-1.5">
                        <Mail size={15} className="text-[#3c8dbc]" /> Hòm thư Email
                      </span>
                      {account.emailVerified ? (
                        <span className="text-emerald-700 bg-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={12} /> Đã xác thực
                        </span>
                      ) : (
                        <span className="text-amber-800 bg-amber-100 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertCircle size={12} /> Chưa xác thực
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 mb-3 truncate">
                      Email đăng ký: <span className="font-mono font-bold text-gray-900">{account.email || "Chưa có"}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => handleStartVerify("email")}
                      disabled={isSendingVerifyOtp}
                      className={`w-full py-1.5 px-3 rounded text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                        account.emailVerified
                          ? "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                          : "bg-[#00a65a] hover:bg-[#008d4c] text-white border-transparent shadow-xs"
                      }`}
                    >
                      <Send size={13} /> {account.emailVerified ? "Xác thực lại qua Email" : "Xác thực Email ngay"}
                    </button>
                  </div>
                </div>

                {/* KHUNG NHẬP MÃ OTP KHI BẤM XÁC THỰC */}
                {verifyingTarget && (
                  <div className="mt-4 border-2 border-[#3c8dbc] bg-blue-50/60 rounded p-4 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                        <KeyRound size={15} className="text-[#3c8dbc]" />
                        Nhập mã OTP xác thực {verifyingTarget === "phone" ? "Số điện thoại" : verifyingTarget === "email" ? "Email" : "cả hai kênh"}
                      </h4>
                      <button
                        type="button"
                        onClick={() => setVerifyingTarget(null)}
                        className="text-gray-500 hover:text-gray-700 text-xs underline"
                      >
                        Đóng
                      </button>
                    </div>

                    <p className="text-[11px] text-gray-600 mb-3">
                      Hệ thống đã gửi mã OTP gồm 6 chữ số đến email/số điện thoại của bạn. Vui lòng kiểm tra hộp thư (bao gồm cả mục Spam/Thư rác) và nhập mã vào ô bên dưới:
                    </p>

                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        maxLength={6}
                        value={verifyOtpInput}
                        onChange={(e) => setVerifyOtpInput(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="Nhập 6 số OTP"
                        className="w-40 border border-gray-300 rounded px-3 py-1.5 text-center font-mono font-bold text-base tracking-widest bg-white focus:outline-none focus:border-[#3c8dbc]"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleConfirmVerify}
                        className="px-4 py-2 bg-[#00a65a] hover:bg-[#008d4c] text-white text-xs font-semibold rounded shadow-sm flex items-center gap-1.5"
                      >
                        <CheckCircle2 size={14} /> Hoàn tất xác thực
                      </button>
                    </div>
                  </div>
                )}

                {verifyStatusMessage && (
                  <div className={`mt-3 p-3 rounded text-xs flex items-center gap-2 ${
                    verifyStatusMessage.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-700"
                  }`}>
                    {verifyStatusMessage.type === "success" ? <CheckCircle2 size={15} className="shrink-0 text-emerald-600" /> : <AlertCircle size={15} className="shrink-0 text-red-600" />}
                    <span>{verifyStatusMessage.text}</span>
                  </div>
                )}
              </div>

              {/* 2. LỰA CHỌN PHƯƠNG THỨC XÁC THỰC BẢO MẬT (1 TRONG 2 HOẶC CẢ 2) */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-1 flex items-center gap-1.5">
                  <Sparkles size={16} className="text-[#f39c12]" />
                  2. Cài đặt Phương thức Xác thực Bảo mật & Khôi phục
                </h3>
                <p className="text-[11px] text-gray-500 mb-4">
                  Bạn có toàn quyền lựa chọn kênh nhận mã OTP khi khôi phục tài khoản, đổi mật khẩu hoặc bảo mật:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {/* OPTION 1: CHỈ QUA SỐ ĐIỆN THOẠI */}
                  <label
                    onClick={() => setPreferredMethod("phone")}
                    className={`border rounded p-3.5 cursor-pointer flex flex-col justify-between transition-all ${
                      preferredMethod === "phone"
                        ? "border-[#3c8dbc] bg-blue-50/70 ring-2 ring-[#3c8dbc]/30"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-gray-800 flex items-center gap-1.5">
                          <Phone size={15} className="text-[#3c8dbc]" /> Chỉ Số điện thoại
                        </span>
                        <input
                          type="radio"
                          name="authMethod"
                          checked={preferredMethod === "phone"}
                          onChange={() => setPreferredMethod("phone")}
                          className="text-[#3c8dbc] focus:ring-[#3c8dbc]"
                        />
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        Chỉ gửi mã OTP qua tin nhắn SMS tới số điện thoại. Tiện lợi, nhận mã nhanh chóng qua di động.
                      </p>
                    </div>
                    <span className="mt-3 text-[10px] text-gray-400 font-medium">1 trong 2 kênh</span>
                  </label>

                  {/* OPTION 2: CHỈ QUA EMAIL */}
                  <label
                    onClick={() => setPreferredMethod("email")}
                    className={`border rounded p-3.5 cursor-pointer flex flex-col justify-between transition-all ${
                      preferredMethod === "email"
                        ? "border-[#3c8dbc] bg-blue-50/70 ring-2 ring-[#3c8dbc]/30"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-gray-800 flex items-center gap-1.5">
                          <Mail size={15} className="text-[#3c8dbc]" /> Chỉ Hòm thư Email
                        </span>
                        <input
                          type="radio"
                          name="authMethod"
                          checked={preferredMethod === "email"}
                          onChange={() => setPreferredMethod("email")}
                          className="text-[#3c8dbc] focus:ring-[#3c8dbc]"
                        />
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        Chỉ gửi mã OTP qua Email. Phù hợp khi làm việc trên laptop hoặc sử dụng email trường học.
                      </p>
                    </div>
                    <span className="mt-3 text-[10px] text-gray-400 font-medium">1 trong 2 kênh</span>
                  </label>

                  {/* OPTION 3: BẮT BUỘC CẢ HAI */}
                  <label
                    onClick={() => setPreferredMethod("both")}
                    className={`border rounded p-3.5 cursor-pointer flex flex-col justify-between transition-all ${
                      preferredMethod === "both"
                        ? "border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/30"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                          <ShieldCheck size={16} className="text-emerald-600" /> Bắt buộc CẢ HAI
                        </span>
                        <input
                          type="radio"
                          name="authMethod"
                          checked={preferredMethod === "both"}
                          onChange={() => setPreferredMethod("both")}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        Bảo mật 2 lớp kép (SMS + Email): Hệ thống sẽ gửi OTP đồng thời tới cả 2 kênh để bảo vệ tối đa.
                      </p>
                    </div>
                    <span className="mt-3 text-[10px] text-emerald-700 font-bold">Khuyên dùng cho tài khoản chính</span>
                  </label>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleSavePreferences}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#3c8dbc] hover:bg-[#367fa9] text-white font-semibold rounded text-xs shadow-sm transition-colors"
                  >
                    <Save size={14} /> Lưu tùy chọn phương thức xác thực
                  </button>

                  {prefMessage && (
                    <span className={`text-xs font-semibold ${prefMessage.type === "success" ? "text-emerald-600" : "text-red-600"}`}>
                      {prefMessage.text}
                    </span>
                  )}
                </div>
              </div>

              {/* 3. THỬ NGHIỆM GỬI MÃ OTP THỰC TẾ */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-1 flex items-center gap-1.5">
                  <Send size={15} className="text-[#3c8dbc]" />
                  3. Thử nghiệm gửi mã OTP theo từng kênh
                </h3>
                <p className="text-[11px] text-gray-500 mb-3">
                  Bấm để kiểm tra tính năng gửi mã OTP thực tế theo các tùy chọn đã thiết lập:
                </p>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleTestOtp("phone")}
                    className="flex items-center gap-1.5 py-1.5 px-3 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium text-xs rounded transition-colors"
                  >
                    <Phone size={13} className="text-[#3c8dbc]" /> Gửi thử qua SMS
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTestOtp("email")}
                    className="flex items-center gap-1.5 py-1.5 px-3 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium text-xs rounded transition-colors"
                  >
                    <Mail size={13} className="text-[#3c8dbc]" /> Gửi thử qua Email
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTestOtp("both")}
                    className="flex items-center gap-1.5 py-1.5 px-3 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs rounded transition-colors"
                  >
                    <ShieldCheck size={14} className="text-emerald-600" /> Gửi thử CẢ HAI kênh (SMS + Email)
                  </button>
                </div>

                {otpTestStatus && (
                  <div className="mt-3 bg-sky-50 border border-sky-200 rounded p-3 text-xs text-sky-950">
                    <p className="font-semibold text-sky-900 leading-relaxed">{otpTestStatus}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
