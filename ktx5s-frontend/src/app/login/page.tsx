"use client";
// TRANG ĐĂNG NHẬP — Phân quyền chặt theo phòng, hỗ trợ lưu & gợi ý tài khoản đã đăng nhập
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, DoorOpen, ShieldCheck, Bot, Camera, BarChart3, LogIn, X, CheckSquare } from "lucide-react";
import { saveSession, type UserRole } from "@/lib/session";
import { BUILDINGS, FLOORS, ROOMS_PER_FLOOR } from "@/components/status";

// Danh sách tài khoản Cán bộ KTX được cấp quyền
const ADMIN_ACCOUNTS = [
  { username: "admin", password: "admin123", name: "admin" },
  { username: "canbo01", password: "ktx@2026", name: "Nguyễn Văn A" },
  { username: "canbo_demo", password: "bE-pQGCDcpmd3sUlokX3", name: "Cán bộ Demo" },
];

// Kiểm tra Sinh viên có thực sự thuộc phòng đó và đúng mật khẩu hay không
function verifyStudentAccount(roomCode: string, studentId: string, password: string): boolean {
  const room = roomCode.trim().toUpperCase();
  const sid = studentId.trim().toUpperCase();
  const pwd = password.trim();

  // 1. Kiểm tra phòng có tồn tại trong 200 phòng KTX (4 tòa A-D × 10 tầng × 5 phòng) không
  const validRooms = new Set<string>();
  for (const b of BUILDINGS) {
    for (let f = 1; f <= FLOORS; f++) {
      for (let r = 1; r <= ROOMS_PER_FLOOR; r++) {
        validRooms.add(`${b}${f}-${f}${String(r).padStart(2, "0")}`);
      }
    }
  }
  if (!validRooms.has(room)) return false;

  // 2. Bảng tài khoản sinh viên cố định được phân theo từng phòng
  const fixedAccounts: Record<string, { room: string; passwords: string[] }> = {
    SV001:       { room: "A3-301", passwords: ["sv123", "123456"] },
    SV002:       { room: "A3-301", passwords: ["sv123", "123456"] },
    SV101:       { room: "A1-101", passwords: ["sv123", "123456", "T8Izn0AWLJETqNqf7SLz"] },
    SV_DEMO_101: { room: "A1-101", passwords: ["sv123", "T8Izn0AWLJETqNqf7SLz"] },
    SV102:       { room: "A1-102", passwords: ["sv123", "123456", "OPJf0Ou__BDNaN2N49c-"] },
    SV_DEMO_102: { room: "A1-102", passwords: ["sv123", "OPJf0Ou__BDNaN2N49c-"] },
    SV201:       { room: "A2-201", passwords: ["sv123", "123456", "4KsOdu_clRl1ftMisKSK"] },
    SV_DEMO_201: { room: "A2-201", passwords: ["sv123", "4KsOdu_clRl1ftMisKSK"] },
  };

  if (fixedAccounts[sid]) {
    const acc = fixedAccounts[sid];
    return acc.room === room && acc.passwords.includes(pwd);
  }

  // 3. Quy tắc mã sinh viên theo phòng chuẩn của KTX:
  // Phòng <MãPhòng> (VD: B2-201) chỉ chấp nhận mã SV dạng "SV-B2-201-01".."08" hoặc "SVB2201" với mật khẩu "sv123"
  const compactRoom = room.replace("-", ""); // VD: B2201
  const isAssignedToRoom =
    sid === `SV${compactRoom}` ||
    (sid.startsWith(`SV-${room}-`) && /^[1-8]$|^0[1-8]$/.test(sid.slice(`SV-${room}-`.length)));

  return isAssignedToRoom && (pwd === "sv123" || pwd === "123456");
}

// Lưu danh sách tài khoản đã từng đăng nhập thành công trên trình duyệt của người dùng
type SavedAccount = {
  role: UserRole;
  roomCode?: string;
  username: string; // admin username hoặc studentId
  password: string;
  label: string;
};

const SAVED_ACCOUNTS_KEY = "ktx5s_remembered_accounts_v1";

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
      (a) => !(a.role === acc.role && a.username.toUpperCase() === acc.username.toUpperCase() && (a.roomCode ?? "") === (acc.roomCode ?? ""))
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
  const [roomCode, setRoomCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [savedList, setSavedList] = useState<SavedAccount[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const all = loadSavedAccounts();
    setSavedList(all);
    // Tự động điền nếu trước đó đã từng đăng nhập và lưu mật khẩu ở vai trò hiện tại
    const lastForRole = all.find((a) => a.role === mode);
    if (lastForRole) {
      setRoomCode(lastForRole.roomCode ?? "");
      setUsername(lastForRole.username);
      setPassword(lastForRole.password);
    }
  }, [mode]);

  const switchMode = (m: UserRole) => {
    setMode(m);
    setError("");
    const lastForRole = savedList.find((a) => a.role === m);
    if (lastForRole) {
      setRoomCode(lastForRole.roomCode ?? "");
      setUsername(lastForRole.username);
      setPassword(lastForRole.password);
    } else {
      setRoomCode("");
      setUsername("");
      setPassword("");
    }
  };

  const applySaved = (acc: SavedAccount) => {
    setRoomCode(acc.roomCode ?? "");
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

    if (mode === "admin") {
      const acc = ADMIN_ACCOUNTS.find((a) => a.username === username.trim() && a.password === password);
      if (!acc) return setError("Sai tên đăng nhập hoặc mật khẩu cán bộ.");

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
      const room = roomCode.trim().toUpperCase();
      const sid = username.trim().toUpperCase();
      if (!/^[A-Z]\d{1,2}-\d{3,4}$/.test(room)) {
        return setError("Mã phòng không đúng định dạng (VD: A3-301 hoặc A1-101).");
      }
      if (!sid) return setError("Vui lòng nhập mã sinh viên.");
      if (!password) return setError("Vui lòng nhập mật khẩu sinh viên.");

      if (!verifyStudentAccount(room, sid, password)) {
        return setError(
          "Mã sinh viên không thuộc phòng này hoặc sai mật khẩu! Bạn chỉ được phép truy cập đúng phòng được phân."
        );
      }

      if (remember) {
        rememberAccount({
          role: "student",
          roomCode: room,
          username: sid,
          password,
          label: `Phòng ${room} · SV ${sid}`,
        });
      }
      saveSession({ role: "student", roomCode: room, studentId: sid });
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

        {/* ===== CỘT PHẢI: FORM ĐĂNG NHẬP ===== */}
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

          {/* Gợi ý đăng nhập nhanh — CHỈ hiện khi người dùng đã từng đăng nhập & lưu từ lần trước */}
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

          <form onSubmit={submit} className="flex flex-col gap-3.5 mt-5" autoComplete="on">
            {mode === "student" && (
              <div className="relative">
                <DoorOpen size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  name="room_code"
                  autoComplete="organization"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder="Mã phòng được phân (VD: A3-301)"
                  className="w-full border border-gray-300 rounded-sm pl-9 pr-3 py-2.5 uppercase focus:border-[#3c8dbc] focus:outline-none"
                />
              </div>
            )}

            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={mode === "admin" ? "Tên đăng nhập cán bộ" : "Mã sinh viên"}
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
              <CheckSquare size={14} className="text-[#3c8dbc] hidden" />
              Lưu tài khoản & mật khẩu cho lần đăng nhập sau
            </label>

            {error && (
              <p className="bg-red-50 border-l-4 border-[#dd4b39] text-[#dd4b39] px-3 py-2 text-xs">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="flex items-center justify-center gap-2 bg-[#3c8dbc] hover:bg-[#367fa9] text-white py-2.5 rounded-sm font-semibold mt-1"
            >
              <LogIn size={16} /> Đăng nhập
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
