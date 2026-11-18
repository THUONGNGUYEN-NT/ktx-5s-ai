// Quản lý phiên đăng nhập (Session) đơn giản bằng sessionStorage
// Sinh viên A sẽ thay thế bằng JWT thật sau

export type UserRole = "student" | "admin";

export type Session = {
  role: UserRole;
  roomCode?: string;   // chỉ có khi role = "student"
  studentId?: string;  // chỉ có khi role = "student"
  name?: string;       // tên hiển thị
};

const SESSION_KEY = "ktx5s_session";

export function saveSession(session: Session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession(): Session | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as Session; } catch { return null; }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function requireRole(role: UserRole): Session | null {
  const session = getSession();
  if (!session || session.role !== role) return null;
  return session;
}
