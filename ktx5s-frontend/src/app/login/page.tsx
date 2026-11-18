"use client";
// TRANG ĐĂNG NHẬP — Cả Cán bộ và Sinh viên đều đăng nhập bằng: Tên đăng nhập + Mật khẩu riêng
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, ShieldCheck, Bot, Camera, BarChart3, LogIn, X } from "lucide-react";
import { saveSession, type UserRole } from "@/lib/session";

// Danh sách tài khoản Cán bộ KTX (mật khẩu riêng)
const ADMIN_ACCOUNTS = [
  { username: "admin", password: "admin123", name: "admin" },
  { username: "canbo01", password: "ktx@2026", name: "Nguyễn Văn A" },
  { username: "canbo_demo", password: "bE-pQGCDcpmd3sUlokX3", name: "Cán bộ Demo" },
];

// Danh sách tài khoản Sinh viên cố định (mật khẩu ngẫu nhiên riêng, gắn chặt với đúng 1 phòng)
const STUDENT_ACCOUNTS = [
  { username: "sinhvien01", password: "Ktx#9482", roomCode: "A3-301", name: "Nguyễn Minh Tuấn" },
  { username: "sinhvien02", password: "Phong@7159", roomCode: "B2-201", name: "Trần Thị Lan" },
  { username: "sv_demo_101", password: "T8Izn0AWLJETqNqf7SLz", roomCode: "A1-101", name: "SV Demo 101" },
  { username: "sv_demo_102", password: "OPJf0Ou__BDNaN2N49c-", roomCode: "A1-102", name: "SV Demo 102" },
];

// Lưu tài khoản đã đăng nhập thành công trên thiết bị để lần sau gợi ý 1 chạm
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
  } catch {
    // ignore
  }
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

  useEffect(() => {
    const all = loadSavedAccounts();
    setSavedList(all);
    const lastForRole = all.find((a) => a.role === mode);
    if (lastForRole) {
      setUsername(lastForRole.username);
      setPassword(lastForRole.password);
    }
  }, [mode]);

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

    if (mode === "admin") {
      const acc = ADMIN_ACCOUNTS.find(
        (a) => a.username.toLowerCase() === userClean.toLowerCase() && a.password === password
      );
      if (!acc) return setError("Tên đăng nhập hoặc mật khẩu không chính xác.");

      if (remember) {
        rememberAccount({
          role: "admin",
          username: acc.username,
          password,
          label: `${acc.name} (${acc.username})`,
        });
      }
      saveSession({ role: "admin", name: acc.name });
      router.push("/admin");
    } else {
      const acc = STUDENT_ACCOUNTS.find(
        (s) => s.username.toLowerCase() === userClean.toLowerCase() && s.password === password
      );
      if (!acc) return setError("Tên đăng nhập hoặc mật khẩu không chính xác.");

      if (remember) {
        rememberAccount({
          role: "student",
          username: acc.username,
          password,
          label: `${acc.username} (Phòng ${acc.roomCode})`,
        });
      }
      saveSession({
        role: "student",
        roomCode: acc.roomCode,
        studentId: acc.username,
        name: acc.name,
      });
      sessionStorage.removeItem("ai_result");
      router.push("/student");
    }
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

        {/* ===== CỘT PHẢI: FORM ĐĂNG NHẬP (TÊN ĐĂNG NHẬP + MẬT KHẨU) ===== */}
        <section className="p-10 flex flex-col justify-center">
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

          {/* Gợi ý tài khoản đã lưu từ lần đăng nhập trước */}
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

          <form onSubmit={submit} className="flex flex-col gap-4 mt-5" autoComplete="on">
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Tên đăng nhập"
                className="w-full border border-gray-300 rounded-sm pl-9 pr-3 py-2.5 focus:border-[#3c8dbc] focus:outline-none"
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

            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded border-gray-300 text-[#3c8dbc] focus:ring-[#3c8dbc]"
              />
              Lưu tài khoản & mật khẩu cho lần đăng nhập sau
            </label>

            {error && (
              <p className="bg-red-50 border-l-4 border-[#dd4b39] text-[#dd4b39] px-3 py-2 text-xs">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="flex items-center justify-center gap-2 bg-[#3c8dbc] hover:bg-[#367fa9] text-white py-2.5 rounded-sm font-semibold"
            >
              <LogIn size={16} /> Đăng nhập
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
