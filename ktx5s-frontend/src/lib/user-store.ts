// ============================================================================
// QUẢN LÝ DỮ LIỆU TÀI KHOẢN, HỒ SƠ NGƯỜI DÙNG & XÁC THỰC OTP
// Hỗ trợ cả 2 vai trò: Cán bộ KTX (Admin) & Sinh viên (Student)
// Lưu trữ động qua LocalStorage để mật khẩu và hồ sơ cập nhật luôn được duy trì
// ============================================================================
import { UserRole } from "./session";

export type UserAccount = {
  username: string;
  password: string;
  role: UserRole;
  name: string;
  email: string;
  phone: string;
  roomCode?: string;     // Dành cho sinh viên
  studentCode?: string;  // Mã sinh viên
  unit?: string;         // Đơn vị/Tòa nhà phụ trách (dành cho cán bộ)
  major?: string;        // Khoa / Ngành học (dành cho sinh viên)
  joinedDate?: string;
  avatarUrl?: string;    // Ảnh đại diện cá nhân (base64 / SVG data URL)
  avatarColor?: string;  // Màu nền avatar mặc định
};

const ACCOUNTS_STORAGE_KEY = "ktx5s_user_accounts_v1";
const OTP_STORAGE_KEY = "ktx5s_active_otp_session";

// Danh sách tài khoản mẫu ban đầu
export const DEFAULT_ACCOUNTS: UserAccount[] = [
  // Cán bộ KTX
  {
    username: "admin",
    password: "admin123",
    role: "admin",
    name: "Quản trị viên Hệ thống",
    email: "admin.ktx@vnuhcm.edu.vn",
    phone: "0901234567",
    unit: "Ban Giám đốc & Quản trị Hệ thống KTX",
    joinedDate: "15/08/2022",
  },
  {
    username: "canbo01",
    password: "ktx@2026",
    role: "admin",
    name: "Nguyễn Văn An",
    email: "an.nv@ktx.vnuhcm.edu.vn",
    phone: "0912345678",
    unit: "Ban Quản lý Cụm Nhà B (B2, B3, B5)",
    joinedDate: "01/02/2023",
  },
  {
    username: "canbo_demo",
    password: "bE-pQGCDcpmd3sUlokX3",
    role: "admin",
    name: "Trần Cán Bộ Demo",
    email: "canbo.demo@ktx.edu.vn",
    phone: "0987654321",
    unit: "Tổ Giám sát Vệ sinh & 5S KTX Khu A",
    joinedDate: "10/05/2024",
  },
  // Sinh viên
  {
    username: "sinhvien01",
    password: "Ktx#9482",
    role: "student",
    name: "Nguyễn Minh Tuấn",
    roomCode: "A3-301",
    studentCode: "2112001",
    email: "tuan.nm21@student.edu.vn",
    phone: "0934567890",
    major: "Khoa học Máy tính - K21 (ĐH Bách Khoa)",
    joinedDate: "05/09/2023",
  },
  {
    username: "sinhvien02",
    password: "Phong@7159",
    role: "student",
    name: "Trần Thị Lan",
    roomCode: "B2-201",
    studentCode: "2112002",
    email: "lan.tt21@student.edu.vn",
    phone: "0945678901",
    major: "Công nghệ Thông tin - K21 (ĐH KHTN)",
    joinedDate: "05/09/2023",
  },
  {
    username: "sv_demo_101",
    password: "T8Izn0AWLJETqNqf7SLz",
    role: "student",
    name: "Lê Quốc Huy",
    roomCode: "A1-101",
    studentCode: "2112101",
    email: "huy.lq21@student.edu.vn",
    phone: "0967890123",
    major: "Kỹ thuật Phần mềm - K22 (ĐH CNTT)",
    joinedDate: "12/09/2024",
  },
  {
    username: "sv_demo_102",
    password: "OPJf0Ou__BDNaN2N49c-",
    role: "student",
    name: "Phạm Hoàng Nam",
    roomCode: "A1-102",
    studentCode: "2112102",
    email: "nam.ph21@student.edu.vn",
    phone: "0978901234",
    major: "Hệ thống Thông tin - K22 (ĐH Kinh tế - Luật)",
    joinedDate: "12/09/2024",
  },
];

// Lấy danh sách tài khoản hiện tại từ LocalStorage
export function getAllAccounts(): UserAccount[] {
  if (typeof window === "undefined") return DEFAULT_ACCOUNTS;
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(DEFAULT_ACCOUNTS));
      return DEFAULT_ACCOUNTS;
    }
    const parsed = JSON.parse(raw) as UserAccount[];
    // Hợp nhất nếu có tài khoản mặc định mới chưa có trong storage
    const merged = [...parsed];
    for (const def of DEFAULT_ACCOUNTS) {
      if (!merged.some((a) => a.username.toLowerCase() === def.username.toLowerCase())) {
        merged.push(def);
      }
    }
    return merged;
  } catch {
    return DEFAULT_ACCOUNTS;
  }
}

// Lưu danh sách tài khoản
function saveAllAccounts(accounts: UserAccount[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch {}
}

// Tìm tài khoản theo username
export function findAccountByUsername(username: string): UserAccount | null {
  const accounts = getAllAccounts();
  const clean = username.trim().toLowerCase();
  return accounts.find((a) => a.username.toLowerCase() === clean) || null;
}

// Tìm tài khoản theo mã sinh viên, email, số điện thoại hoặc username
export function findAccountByIdentifier(identifier: string, role?: UserRole): UserAccount | null {
  const accounts = getAllAccounts();
  const clean = identifier.trim().toLowerCase();
  return (
    accounts.find((a) => {
      if (role && a.role !== role) return false;
      return (
        a.username.toLowerCase() === clean ||
        a.email.toLowerCase() === clean ||
        a.phone === clean ||
        (a.studentCode && a.studentCode.toLowerCase() === clean)
      );
    }) || null
  );
}

// Xác thực đăng nhập
export function authenticateUser(
  username: string,
  pass: string,
  role: UserRole
): UserAccount | null {
  const acc = findAccountByUsername(username);
  if (acc && acc.role === role && acc.password === pass) {
    return acc;
  }
  return null;
}

// Cập nhật thông tin hồ sơ
export function updateUserProfile(
  username: string,
  updates: Partial<Omit<UserAccount, "username" | "role">>
): { success: boolean; message: string; updated?: UserAccount } {
  const accounts = getAllAccounts();
  const idx = accounts.findIndex((a) => a.username.toLowerCase() === username.toLowerCase());
  if (idx === -1) {
    return { success: false, message: "Không tìm thấy tài khoản người dùng." };
  }

  accounts[idx] = {
    ...accounts[idx],
    ...updates,
  };
  saveAllAccounts(accounts);
  return { success: true, message: "Cập nhật thông tin thành công!", updated: accounts[idx] };
}

// Đổi mật khẩu tài khoản
export function changeUserPassword(
  username: string,
  oldPass: string,
  newPass: string
): { success: boolean; message: string } {
  const accounts = getAllAccounts();
  const idx = accounts.findIndex((a) => a.username.toLowerCase() === username.toLowerCase());
  if (idx === -1) {
    return { success: false, message: "Không tìm thấy tài khoản." };
  }

  if (accounts[idx].password !== oldPass) {
    return { success: false, message: "Mật khẩu hiện tại không chính xác!" };
  }

  if (!newPass || newPass.length < 6) {
    return { success: false, message: "Mật khẩu mới phải có ít nhất 6 ký tự." };
  }

  accounts[idx].password = newPass;
  saveAllAccounts(accounts);
  return { success: true, message: "Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới." };
}

// ============================================================================
// HỆ THỐNG XỬ LÝ OTP QUÊN MẬT KHẨU (QUA SMS HOẶC EMAIL)
// ============================================================================
export type OtpSession = {
  username: string;
  otp: string;
  method: "phone" | "email";
  target: string;
  expiresAt: number;
};

// Làm mờ số điện thoại (VD: 093****890) hoặc email (VD: tu****@student.edu.vn)
export function maskContact(target: string, method: "phone" | "email"): string {
  if (method === "phone") {
    if (target.length >= 7) {
      return target.slice(0, 3) + "****" + target.slice(-3);
    }
    return target;
  } else {
    const parts = target.split("@");
    if (parts.length === 2) {
      const name = parts[0];
      const maskedName = name.length <= 2 ? name + "***" : name.slice(0, 2) + "****" + name.slice(-1);
      return `${maskedName}@${parts[1]}`;
    }
    return target;
  }
}

// Yêu cầu cấp mã OTP qua SĐT hoặc Email
export async function requestPasswordResetOtp(
  identifier: string,
  method: "phone" | "email",
  role?: UserRole
): Promise<{
  success: boolean;
  message: string;
  maskedTarget?: string;
  account?: UserAccount;
}> {
  const acc = findAccountByIdentifier(identifier, role);
  if (!acc) {
    return {
      success: false,
      message: `Không tìm thấy tài khoản phù hợp với thông tin "${identifier}". Vui lòng kiểm tra lại.`,
    };
  }

  const target = method === "phone" ? acc.phone : acc.email;
  if (!target) {
    return {
      success: false,
      message: `Tài khoản chưa đăng ký ${method === "phone" ? "Số điện thoại" : "Địa chỉ Email"}. Hãy chọn phương thức khác.`,
    };
  }

  // Sinh mã OTP ngẫu nhiên 6 chữ số
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // Có hiệu lực trong 5 phút

  const session: OtpSession = {
    username: acc.username,
    otp,
    method,
    target,
    expiresAt,
  };

  if (typeof window !== "undefined") {
    sessionStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(session));
    // Log mã xác thực vào Console trình duyệt (F12) để hỗ trợ kiểm thử thực tế
    console.log(`%c[KTX 5S AI - BẢO MẬT] Mã OTP gửi tới ${target}: ${otp}`, "color: #3c8dbc; font-weight: bold; font-size: 13px;");
  }

  // Đồng thời gọi API Backend gửi Email thực tế qua SMTP (nếu backend đang chạy)
  try {
    const apiHost = typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:8000" : "";
    if (apiHost) {
      fetch(`${apiHost}/api/auth/forgot-password/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: acc.username, method }),
      }).catch(() => {});
    }
  } catch {}

  return {
    success: true,
    message: `Mã OTP đã được gửi đến ${method === "phone" ? "số điện thoại" : "hòm thư email"} ${maskContact(target, method)}.`,
    maskedTarget: maskContact(target, method),
    account: acc,
  };
}

// Kiểm tra tính hợp lệ của mã OTP
export function checkOtpValid(otpInput: string): { valid: boolean; message: string } {
  if (typeof window === "undefined") {
    return { valid: false, message: "Lỗi môi trường duyệt web." };
  }
  const raw = sessionStorage.getItem(OTP_STORAGE_KEY);
  if (!raw) {
    return { valid: false, message: "Yêu cầu khôi phục mật khẩu không tồn tại hoặc đã hết hạn." };
  }

  try {
    const s: OtpSession = JSON.parse(raw);
    if (Date.now() > s.expiresAt) {
      return { valid: false, message: "Mã OTP đã hết hiệu lực (quá 5 phút). Vui lòng yêu cầu gửi lại mã mới." };
    }
    if (s.otp !== otpInput.trim()) {
      return { valid: false, message: "Mã OTP không chính xác. Vui lòng kiểm tra lại tin nhắn hoặc email của bạn." };
    }
    return { valid: true, message: "Mã OTP hợp lệ." };
  } catch {
    return { valid: false, message: "Dữ liệu phiên OTP không hợp lệ." };
  }
}

// Kiểm tra mã OTP & Đặt lại mật khẩu mới
export function verifyOtpAndResetPassword(
  otpInput: string,
  newPassword: string
): { success: boolean; message: string; username?: string } {
  if (typeof window === "undefined") {
    return { success: false, message: "Lỗi môi trường duyệt web." };
  }

  const raw = sessionStorage.getItem(OTP_STORAGE_KEY);
  if (!raw) {
    return { success: false, message: "Yêu cầu khôi phục mật khẩu không tồn tại hoặc đã hết hạn." };
  }

  let session: OtpSession;
  try {
    session = JSON.parse(raw);
  } catch {
    return { success: false, message: "Dữ liệu phiên OTP không hợp lệ." };
  }

  if (Date.now() > session.expiresAt) {
    sessionStorage.removeItem(OTP_STORAGE_KEY);
    return { success: false, message: "Mã OTP đã hết hiệu lực (quá 5 phút). Vui lòng yêu cầu gửi lại mã." };
  }

  if (session.otp !== otpInput.trim()) {
    return { success: false, message: "Mã OTP không chính xác. Vui lòng kiểm tra lại!" };
  }

  if (!newPassword || newPassword.length < 6) {
    return { success: false, message: "Mật khẩu mới phải có ít nhất 6 ký tự." };
  }

  // Cập nhật mật khẩu trong cơ sở tài khoản
  const accounts = getAllAccounts();
  const idx = accounts.findIndex((a) => a.username.toLowerCase() === session.username.toLowerCase());
  if (idx === -1) {
    return { success: false, message: "Không tìm thấy tài khoản để cập nhật." };
  }

  accounts[idx].password = newPassword;
  saveAllAccounts(accounts);
  sessionStorage.removeItem(OTP_STORAGE_KEY);

  return {
    success: true,
    message: `Đặt lại mật khẩu cho tài khoản "${accounts[idx].username}" thành công! Bạn có thể đăng nhập ngay.`,
    username: accounts[idx].username,
  };
}
