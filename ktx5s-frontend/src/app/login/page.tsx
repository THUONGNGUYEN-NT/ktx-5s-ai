"use client";
// TRANG ĐĂNG NHẬP — Cán bộ (Tên đăng nhập + Mật khẩu) | Sinh viên (Mã phòng + Mật khẩu phòng)
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, DoorOpen, ShieldCheck, Bot, Camera, BarChart3, LogIn, X } from "lucide-react";
import { saveSession, type UserRole } from "@/lib/session";
import { BUILDINGS, FLOORS, ROOMS_PER_FLOOR } from "@/components/status";

// Danh sách tài khoản Cán bộ KTX
const ADMIN_ACCOUNTS = [
  { username: "admin", password: "admin123", name: "admin" },
  { username: "canbo01", password: "ktx@2026", name: "Nguyễn Văn A" },
  { username: "canbo_demo", password: "bE-pQGCDcpmd3sUlokX3", name: "Cán bộ Demo" },
];

// Kiểm tra Mã phòng + Mật khẩu riêng của từng phòng (phòng nào chỉ vào được đúng phòng đó)
function verifyRoomPassword(roomCode: string, password: string): boolean {
  const room = roomCode.trim().toUpperCase();
  const pwd = password.trim();

  // 1. Kiểm tra phòng có nằm trong 200 phòng KTX (4 tòa A-D × 10 tầng × 5 phòng) không
  const validRooms = new Set<string>();
  for (const b of BUILDINGS) {
    for (let f = 1; f <= FLOORS; f++) {
      for (let r = 1; r <= ROOMS_PER_FLOOR; r++) {
        validRooms.add(`${b}${f}-${f}${String(r).padStart(2, "0")}`);
      }
    }
  }
  if (!validRooms.has(room)) return false;

  // 2. Mỗi phòng có mật khẩu riêng gắn với đúng mã phòng đó:
  //    - Dạng 1: "<SốPhòng>123"   (VD: phòng A3-301 -> "301123", phòng A1-101 -> "101123", phòng B10-1005 -> "1005123")
  //    - Dạng 2: "<MãPhòng>@ktx"  (VD: phòng A3-301 -> "A3301@ktx" hoặc "a3301@ktx")
  const roomNum = room.split("-")[1] ?? ""; // VD: "301"
  const compact = room.replace("-", "");    // VD: "A3301"

  const allowedPasswords = new Set<string>([
    `${roomNum}123`,
    `${compact.toLowerCase()}@ktx`,
    `${compact.toUpperCase()}@ktx`,
  ]);

  // Mật khẩu demo bổ sung cho một số phòng mẫu
  if (room === "A3-301") allowedPasswords.add("sv123");
  if (room === "A1-101") allowedPasswords.add("T8Izn0AWLJETqNqf7SLz");
  if (room === "A1-102") allowedPasswords.add("OPJf0Ou__BDNaN2N49c-");
  if (room === "A2-201") allowedPasswords.add("4KsOdu_clRl1ftMisKSK");

  return allowedPasswords.has(pwd);
}

// Lưu tài khoản đã đăng nhập thành công trên thiết bị để lần sau gợi ý 1 chạm
type SavedAccount = {
  role: UserRole;
  identifier: string; // Tên đăng nhập cán bộ hoặc Mã phòng
  password: string;
  label: string;
};

const SAVED_ACCOUNTS_KEY = "ktx5s_remembered_accounts_v2";

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
      (a) => !(a.role === acc.role && a.identifier.toUpperCase() === acc.identifier.toUpperCase())
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
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [savedList, setSavedList] = useState<SavedAccount[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const all = loadSavedAccounts();
    setSavedList(all);
    const lastForRole = all.find((a) => a.role === mode);
    if (lastForRole) {
      setIdentifier(lastForRole.identifier);
      setPassword(lastForRole.password);
    }
  }, [mode]);

  const switchMode = (m: UserRole) => {
    setMode(m);
    setError("");
    const lastForRole = savedList.find((a) => a.role === m);
    if (lastForRole) {
      setIdentifier(lastForRole.identifier);
      setPassword(lastForRole.password);
    } else {
      setIdentifier("");
      setPassword("");
    }
  };

  const applySaved = (acc: SavedAccount) => {
    setIdentifier(acc.identifier);
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

    if (mode === "admin") {
      const acc = ADMIN_ACCOUNTS.find((a) => a.username === identifier.trim() && a.password === password);
      if (!acc) return setError("Sai tên đăng nhập hoặc mật khẩu cán bộ.");

      if (remember) {
        rememberAccount({
          role: "admin",
          identifier: acc.username,
          password,
          label: `Cán bộ: ${acc.username}`,
        });
      }
      saveSession({ role: "admin", name: acc.name });
      router.push("/admin");
    } else {
      const room = identifier.trim().toUpperCase();
      if (!/^[A-Z]\d{1,2}-\d{3,4}$/.test(room)) {
        return setError("Mã phòng không đúng định dạng (VD: A3-301 hoặc A1-101).");
      }
      if (!password) return setError("Vui lòng nhập mật khẩu của phòng.");

      if (!verifyRoomPassword(room, password)) {
        return setError("Sai mật khẩu phòng! Mỗi phòng có mật khẩu riêng, bạn không thể truy cập phòng khác.");
      }

      if (remember) {
        rememberAccount({
          role: "student",
          identifier: room,
          password,
          label: `Phòng ${room}`,
        });
      }
      saveSession({ role: "student", roomCode: room, name: `Phòng ${room}` });
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
              <Camera size={18} className="text-teal-300" /> Sinh viên chụp đủ 4 góc phòng hằng tuần
            </li>
            <li className="flex items-center gap-3">
              <Bot size={18} className="text-teal-300" /> AI chấm điểm 5S tự động trong vài giây
            </li>
            <li className="flex items-center gap-3">
              <BarChart3 size={18} className="text-teal-300" /> Cán bộ theo dõi 10 tầng / 200 phòng trên 1 màn hình
            </li>
          </ul>
          <p className="mt-auto pt-10 text-xs text-white/60">© 2026 Trung tâm Quản lý Ký túc xá</p>
        </section>

        {/* ===== CỘT PHẢI: FORM ĐĂNG NHẬP (2 TRƯỜNG) ===== */}
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
              {mode === "admin" ? (
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              ) : (
                <DoorOpen size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              )}
              <input
                name="username"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={mode === "admin" ? "Tên đăng nhập cán bộ" : "Mã phòng (VD: A3-301)"}
                className={`w-full border border-gray-300 rounded-sm pl-9 pr-3 py-2.5 focus:border-[#3c8dbc] focus:outline-none ${
                  mode === "student" ? "uppercase" : ""
                }`}
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
                placeholder={mode === "admin" ? "Mật khẩu" : "Mật khẩu phòng"}
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
