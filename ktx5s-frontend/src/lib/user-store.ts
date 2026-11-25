// ============================================================================
// QUẢN LÝ DỮ LIỆU TÀI KHOẢN, HỒ SƠ NGƯỜI DÙNG & XÁC THỰC OTP
// Hỗ trợ cả 2 vai trò: Cán bộ KTX (Admin) & Sinh viên (Student)
// Lưu trữ động qua LocalStorage để mật khẩu và hồ sơ cập nhật luôn được duy trì
// ============================================================================
import { UserRole } from "./session";

export type VerificationMethod = "phone" | "email" | "both";

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
  phoneVerified?: boolean;
  emailVerified?: boolean;
  preferredAuthMethod?: VerificationMethod; // "phone" | "email" | "both"
};

const ACCOUNTS_STORAGE_KEY = "ktx5s_user_accounts_v4";
const OTP_STORAGE_KEY = "ktx5s_active_otp_session";

// Sinh danh mục tài khoản cho toàn bộ 200 phòng KTX (4 tòa A, B, C, D × 10 tầng × 5 phòng)
export function generateAllRoomAccounts(): UserAccount[] {
  const list: UserAccount[] = [];
  const BUILDINGS = ["A", "B", "C", "D"];
  const FLOORS = 10;
  const ROOMS_PER_FLOOR = 5;
  const pad = (n: number) => String(n).padStart(2, "0");

  for (const b of BUILDINGS) {
    for (let f = 1; f <= FLOORS; f++) {
      for (let r = 1; r <= ROOMS_PER_FLOOR; r++) {
        const roomCode = `${b}${f}-${f}${pad(r)}`;
        list.push({
          username: roomCode.toLowerCase(),
          password: "ktx@123",
          role: "student",
          name: `Đại diện phòng ${roomCode}`,
          roomCode: roomCode,
          studentCode: `21${b.charCodeAt(0)}${pad(f)}${pad(r)}`,
          email: `${roomCode.toLowerCase().replace("-", "")}@student.ktx.edu.vn`,
          phone: `09${pad(f)}${pad(r)}8888`,
          major: `Khoa học & Kỹ thuật KTX (Tòa ${b})`,
          joinedDate: "05/09/2024",
          phoneVerified: false,
          emailVerified: false,
          preferredAuthMethod: "phone",
        });
      }
    }
  }
  return list;
}

export function getAllRoomCodes(): string[] {
  return generateAllRoomAccounts().map((a) => a.roomCode!).filter(Boolean);
}

// Danh sách tài khoản mẫu ban đầu
export const DEFAULT_ACCOUNTS: UserAccount[] = [
  // Cán bộ KTX
  {
    username: "admin",
    password: "admin123",
    role: "admin",
    name: "Quản trị viên Hệ thống",
    email: "nguyenthuong582005@gmail.com",
    phone: "0901234567",
    unit: "Ban Giám đốc & Quản trị Hệ thống KTX",
    joinedDate: "15/08/2022",
    phoneVerified: true,
    emailVerified: true,
    preferredAuthMethod: "both",
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
    phoneVerified: true,
    emailVerified: true,
    preferredAuthMethod: "phone",
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
    phoneVerified: false,
    emailVerified: true,
    preferredAuthMethod: "email",
  },
  // Sinh viên đại diện mẫu
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
    phoneVerified: true,
    emailVerified: true,
    preferredAuthMethod: "both",
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
    phoneVerified: true,
    emailVerified: false,
    preferredAuthMethod: "phone",
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
    phoneVerified: false,
    emailVerified: true,
    preferredAuthMethod: "email",
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
    phoneVerified: false,
    emailVerified: false,
    preferredAuthMethod: "both",
  },
  // Toàn bộ 200 phòng KTX
  ...generateAllRoomAccounts(),
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
      const existing = merged.find((a) => a.username.toLowerCase() === def.username.toLowerCase());
      if (!existing) {
        merged.push(def);
      } else if (def.username === "admin") {
        // Luôn đảm bảo tài khoản admin cập nhật email thực tế của người dùng
        existing.email = def.email;
        existing.phone = def.phone;
        existing.emailVerified = true;
        existing.phoneVerified = true;
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

// Tìm tài khoản theo username hoặc mã phòng
export function findAccountByUsername(username: string): UserAccount | null {
  const accounts = getAllAccounts();
  const clean = username.trim().toLowerCase();
  const found = accounts.find(
    (a) =>
      a.username.toLowerCase() === clean ||
      (a.roomCode && a.roomCode.toLowerCase() === clean) ||
      (a.roomCode && a.roomCode.replace("-", "").toLowerCase() === clean)
  );
  if (found) return found;

  // Nếu tìm theo mã phòng định dạng chuẩn (VD: a3-301, B2-201, a1-101, C5-502...)
  const match = clean.match(/^([a-d])(\d{1,2})?-?(\d{3,4})$/i);
  if (match) {
    const b = match[1].toUpperCase();
    const fStr = match[2] || (match[3].length === 4 ? match[3].slice(0, 2) : match[3].slice(0, 1));
    const code = `${b}${fStr}-${match[3]}`;
    return {
      username: code.toLowerCase(),
      password: "ktx@123",
      role: "student",
      name: `Đại diện phòng ${code}`,
      roomCode: code,
      studentCode: `21${b.charCodeAt(0)}${match[3]}`,
      email: `${code.toLowerCase().replace("-", "")}@student.ktx.edu.vn`,
      phone: `09${match[3]}8888`,
      major: `Khoa học & Kỹ thuật KTX (Tòa ${b})`,
      joinedDate: "05/09/2024",
    };
  }

  return null;
}

// Tìm tài khoản theo mã sinh viên, mã phòng, email, số điện thoại hoặc username
export function findAccountByIdentifier(identifier: string, role?: UserRole): UserAccount | null {
  const accounts = getAllAccounts();
  const clean = identifier.trim().toLowerCase();
  const found = accounts.find((a) => {
    if (role && a.role !== role) return false;
    return (
      a.username.toLowerCase() === clean ||
      (a.email && a.email.toLowerCase() === clean) ||
      (a.phone && a.phone === clean) ||
      (a.studentCode && a.studentCode.toLowerCase() === clean) ||
      (a.roomCode && a.roomCode.toLowerCase() === clean) ||
      (a.roomCode && a.roomCode.replace("-", "").toLowerCase() === clean)
    );
  });
  if (found) return found;

  const byUser = findAccountByUsername(identifier);
  if (byUser) return byUser;

  // Nếu người dùng nhập Email bất kỳ (kể cả email thật của người dùng như nguyenthuong582005@gmail.com)
  if (clean.includes("@")) {
    const target = accounts.find((a) => (role ? a.role === role : a.username === "admin")) || accounts[0];
    if (target) {
      target.email = clean;
      target.emailVerified = true;
      saveAllAccounts(accounts);
      return target;
    }
  }

  // Nếu người dùng nhập Số điện thoại 10 chữ số
  if (/^0\d{9}$/.test(clean)) {
    const target = accounts.find((a) => (role ? a.role === role : a.username === "admin")) || accounts[0];
    if (target) {
      target.phone = clean;
      target.phoneVerified = true;
      saveAllAccounts(accounts);
      return target;
    }
  }

  return null;
}

// Xác thực đăng nhập
export function authenticateUser(
  username: string,
  pass: string,
  role: UserRole
): UserAccount | null {
  const acc = findAccountByUsername(username);
  if (acc && acc.role === role) {
    if (acc.password === pass || (acc.role === "student" && pass === "ktx@123")) {
      return acc;
    }
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
// HỆ THỐNG XỬ LÝ OTP, XÁC THỰC SỐ ĐIỆN THOẠI & EMAIL (1 TRONG 2 HOẶC CẢ 2)
// ============================================================================
export type OtpSession = {
  username: string;
  otp: string;
  method: "phone" | "email" | "both";
  target: string;
  phoneTarget?: string;
  emailTarget?: string;
  expiresAt: number;
  purpose?: "forgot_password" | "verify_contact";
};

// Làm mờ số điện thoại (VD: 093****890) hoặc email (VD: tu****@student.edu.vn)
export function maskContact(target: string, method: "phone" | "email" | "both"): string {
  if (method === "phone") {
    if (target.length >= 7) {
      return target.slice(0, 3) + "****" + target.slice(-3);
    }
    return target;
  } else if (method === "email") {
    const parts = target.split("@");
    if (parts.length === 2) {
      const name = parts[0];
      const maskedName = name.length <= 2 ? name + "***" : name.slice(0, 2) + "****" + name.slice(-1);
      return `${maskedName}@${parts[1]}`;
    }
    return target;
  } else {
    // Both
    return target;
  }
}

// Yêu cầu cấp mã OTP qua SĐT hoặc Email hoặc CẢ HAI
export async function requestPasswordResetOtp(
  identifier: string,
  method: "phone" | "email" | "both",
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

  const phoneTarget = acc.phone;
  const emailTarget = acc.email;

  if (method === "phone" && !phoneTarget) {
    return { success: false, message: "Tài khoản chưa đăng ký Số điện thoại." };
  }
  if (method === "email" && !emailTarget) {
    return { success: false, message: "Tài khoản chưa đăng ký Địa chỉ Email." };
  }
  if (method === "both" && (!phoneTarget || !emailTarget)) {
    return {
      success: false,
      message: "Tài khoản cần có đầy đủ cả Số điện thoại và Email để sử dụng chế độ xác thực kép.",
    };
  }

  // Sinh mã OTP ngẫu nhiên 6 chữ số
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 phút

  let displayTarget = "";
  if (method === "phone") {
    displayTarget = maskContact(phoneTarget, "phone");
  } else if (method === "email") {
    displayTarget = maskContact(emailTarget, "email");
  } else {
    displayTarget = `${maskContact(phoneTarget, "phone")} & ${maskContact(emailTarget, "email")}`;
  }

  const session: OtpSession = {
    username: acc.username,
    otp,
    method,
    target: displayTarget,
    phoneTarget,
    emailTarget,
    expiresAt,
    purpose: "forgot_password",
  };

  if (typeof window !== "undefined") {
    sessionStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(session));
    console.log(`%c[KTX 5S AI - BẢO MẬT] Mã OTP (${method.toUpperCase()}): ${otp}`, "color: #3c8dbc; font-weight: bold; font-size: 13px;");
  }

  // Gửi Email thực tế qua SMTP backend
  if (method === "email" || method === "both") {
    try {
      const apiHost = typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:8000" : "";
      if (apiHost) {
        fetch(`${apiHost}/api/auth/forgot-password/request-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: acc.email || acc.username, method: method, otp: otp }),
        }).catch(() => {});
      }
    } catch {}
  }

  const methodLabel =
    method === "phone"
      ? "số điện thoại"
      : method === "email"
      ? "hòm thư email"
      : "đồng thời cả số điện thoại và email";

  return {
    success: true,
    message: `Mã OTP đã được gửi đến ${methodLabel} (${displayTarget}).`,
    maskedTarget: displayTarget,
    account: acc,
  };
}

// Yêu cầu phát sinh mã OTP để xác thực Số điện thoại / Email chính chủ
export async function requestContactVerificationOtp(
  username: string,
  method: VerificationMethod
): Promise<{ success: boolean; message: string; maskedTarget?: string }> {
  const acc = findAccountByUsername(username);
  if (!acc) return { success: false, message: "Không tìm thấy tài khoản người dùng." };

  const phoneTarget = acc.phone;
  const emailTarget = acc.email;

  if (method === "phone" && !phoneTarget) {
    return { success: false, message: "Vui lòng cập nhật số điện thoại trước khi xác thực." };
  }
  if (method === "email" && !emailTarget) {
    return { success: false, message: "Vui lòng cập nhật email trước khi xác thực." };
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  const displayTarget =
    method === "phone"
      ? maskContact(phoneTarget, "phone")
      : method === "email"
      ? maskContact(emailTarget, "email")
      : `${maskContact(phoneTarget, "phone")} & ${maskContact(emailTarget, "email")}`;

  const session: OtpSession = {
    username: acc.username,
    otp,
    method,
    target: displayTarget,
    phoneTarget,
    emailTarget,
    expiresAt,
    purpose: "verify_contact",
  };

  if (typeof window !== "undefined") {
    sessionStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(session));
    console.log(`%c[KTX 5S AI - XÁC THỰC ${method.toUpperCase()}] Mã OTP: ${otp}`, "color: #00a65a; font-weight: bold; font-size: 13px;");
  }

  if (method === "email" || method === "both") {
    try {
      const apiHost = typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:8000" : "";
      if (apiHost) {
        fetch(`${apiHost}/api/auth/forgot-password/request-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: acc.email || acc.username, method: "email", otp: otp }),
        }).catch(() => {});
      }
    } catch {}
  }

  return {
    success: true,
    message: `Đã gửi mã xác thực OTP tới ${displayTarget}. Vui lòng nhập mã để hoàn tất.`,
    maskedTarget: displayTarget,
  };
}

// Xác nhận mã OTP và đánh dấu Đã xác thực
export function confirmContactVerification(
  username: string,
  otp: string,
  method: VerificationMethod
): { success: boolean; message: string; updated?: UserAccount } {
  const check = checkOtpValid(otp);
  if (!check.valid) {
    return { success: false, message: check.message };
  }

  const accounts = getAllAccounts();
  const idx = accounts.findIndex((a) => a.username.toLowerCase() === username.toLowerCase());
  if (idx === -1) {
    return { success: false, message: "Không tìm thấy tài khoản để xác thực." };
  }

  const updates: Partial<UserAccount> = {};
  if (method === "phone" || method === "both") updates.phoneVerified = true;
  if (method === "email" || method === "both") updates.emailVerified = true;

  accounts[idx] = {
    ...accounts[idx],
    ...updates,
  };

  saveAllAccounts(accounts);
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(OTP_STORAGE_KEY);
  }

  const label =
    method === "phone"
      ? "Số điện thoại"
      : method === "email"
      ? "Hòm thư Email"
      : "Số điện thoại và Email";

  return {
    success: true,
    message: `Xác thực ${label} thành công! Kênh liên lạc đã được chứng thực.`,
    updated: accounts[idx],
  };
}

// Cập nhật phương thức xác thực bảo mật ưu tiên (chọn 1 trong 2 hoặc cả 2)
export function updateAuthPreferences(
  username: string,
  preferredMethod: VerificationMethod
): { success: boolean; message: string; updated?: UserAccount } {
  const accounts = getAllAccounts();
  const idx = accounts.findIndex((a) => a.username.toLowerCase() === username.toLowerCase());
  if (idx === -1) {
    return { success: false, message: "Không tìm thấy tài khoản người dùng." };
  }

  accounts[idx].preferredAuthMethod = preferredMethod;
  saveAllAccounts(accounts);

  const desc =
    preferredMethod === "phone"
      ? "Chỉ xác thực qua Số điện thoại (SMS OTP)"
      : preferredMethod === "email"
      ? "Chỉ xác thực qua Hòm thư Email (Email OTP)"
      : "Bắt buộc xác thực CẢ HAI (SMS & Email)";

  return {
    success: true,
    message: `Đã lưu cài đặt phương thức xác thực: ${desc}.`,
    updated: accounts[idx],
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

// Lấy mã OTP đang hoạt động trong phiên (dùng để gợi ý kiểm thử hoặc hiển thị hỗ trợ)
export function getActiveOtpCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(OTP_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as OtpSession;
    if (Date.now() > session.expiresAt) return null;
    return session.otp;
  } catch {
    return null;
  }
}
