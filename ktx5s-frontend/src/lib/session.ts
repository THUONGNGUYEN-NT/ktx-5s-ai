// Quản lý phiên đăng nhập (Session) bằng sessionStorage + phát sự kiện đồng bộ giao diện tức thì

export type UserRole = "student" | "admin";

export type Session = {
  role: UserRole;
  username?: string;
  roomCode?: string;     // chỉ có khi role = "student"
  studentId?: string;    // chỉ có khi role = "student"
  name?: string;         // tên hiển thị
  phone?: string;
  email?: string;
  avatarUrl?: string;    // ảnh đại diện tải lên hoặc avatar mẫu (data URL)
  avatarColor?: string;  // màu nền chữ cái đại diện
};

const SESSION_KEY = "ktx5s_session";

export function saveSession(session: Session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("ktx5s-profile-updated"));
  }
}

export function getSession(): Session | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function requireRole(role: UserRole): Session | null {
  const session = getSession();
  if (!session || session.role !== role) return null;
  return session;
}
