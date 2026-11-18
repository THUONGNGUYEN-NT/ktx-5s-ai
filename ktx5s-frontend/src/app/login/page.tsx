"use client";
// TRANG ĐĂNG NHẬP — chia 2 cột vừa màn hình laptop, có tài khoản test
import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, DoorOpen, ShieldCheck, Bot, Camera, BarChart3, LogIn, Wand2 } from "lucide-react";
import { saveSession, type UserRole } from "@/lib/session";

// Tài khoản cán bộ dùng để test (khi có backend sẽ thay bằng API đăng nhập)
const ADMIN_ACCOUNTS = [
  { username: "admin", password: "admin123", name: "admin" },
  { username: "canbo01", password: "ktx@2026", name: "Nguyễn Văn A" },
];

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<UserRole>("admin");
  const [f1, setF1] = useState("");
  const [f2, setF2] = useState("");
  const [error, setError] = useState("");

  const switchMode = (m: UserRole) => {
    setMode(m);
    setF1("");
    setF2("");
    setError("");
  };

  const fillTest = () => {
    if (mode === "admin") { setF1("admin"); setF2("admin123"); }
    else { setF1("A3-301"); setF2("SV001"); }
    setError("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "admin") {
      const acc = ADMIN_ACCOUNTS.find((a) => a.username === f1.trim() && a.password === f2);
      if (!acc) return setError("Sai tên đăng nhập hoặc mật khẩu.");
      saveSession({ role: "admin", name: acc.name });
      router.push("/admin");
    } else {
      const room = f1.trim().toUpperCase();
      const sid = f2.trim().toUpperCase();
      if (!/^[A-Z]\d{1,2}-\d{3,4}$/.test(room)) return setError("Mã phòng không đúng định dạng (VD: A3-301 hoặc B10-1001).");
      if (!sid) return setError("Vui lòng nhập mã sinh viên.");
      saveSession({ role: "student", roomCode: room, studentId: sid });
      sessionStorage.removeItem("ai_result");
      router.push("/student");
    }
  };

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
          <h1 className="text-xl font-semibold mt-8 leading-snug">Hệ thống đánh giá vệ sinh phòng ở ký túc xá bằng trí tuệ nhân tạo</h1>
          <ul className="mt-8 flex flex-col gap-4 text-white/90">
            <li className="flex items-center gap-3"><Camera size={18} className="text-teal-300" /> Sinh viên tự chụp ảnh phòng hằng tuần</li>
            <li className="flex items-center gap-3"><Bot size={18} className="text-teal-300" /> AI chấm điểm 5S tự động trong vài giây</li>
            <li className="flex items-center gap-3"><BarChart3 size={18} className="text-teal-300" /> Cán bộ theo dõi toàn KTX trên một màn hình</li>
          </ul>
          <p className="mt-auto pt-10 text-xs text-white/60">© 2026 Trung tâm Quản lý Ký túc xá</p>
        </section>

        {/* ===== CỘT PHẢI: FORM ĐĂNG NHẬP ===== */}
        <section className="p-10">
          <h2 className="text-xl font-semibold text-gray-800">Đăng nhập hệ thống</h2>
          <p className="text-gray-500 mt-1">Chọn vai trò của bạn để tiếp tục</p>

          <div className="grid grid-cols-2 mt-6 border-b border-gray-200">
            {([["admin", "Cán bộ KTX"], ["student", "Sinh viên"]] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => switchMode(key)}
                className={`py-2.5 -mb-px border-b-2 font-semibold ${mode === key ? "border-[#3c8dbc] text-[#3c8dbc]" : "border-transparent text-gray-400 hover:text-gray-600"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4 mt-6">
            <div className="relative">
              {mode === "admin" ? <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /> : <DoorOpen size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />}
              <input
                value={f1}
                onChange={(e) => setF1(e.target.value)}
                placeholder={mode === "admin" ? "Tên đăng nhập" : "Mã phòng (VD: A3-301)"}
                className={`w-full border border-gray-300 rounded-sm pl-9 pr-3 py-2.5 focus:border-[#3c8dbc] focus:outline-none ${mode === "student" ? "uppercase" : ""}`}
              />
            </div>
            <div className="relative">
              {mode === "admin" ? <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /> : <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />}
              <input
                type={mode === "admin" ? "password" : "text"}
                value={f2}
                onChange={(e) => setF2(e.target.value)}
                placeholder={mode === "admin" ? "Mật khẩu" : "Mã sinh viên"}
                className="w-full border border-gray-300 rounded-sm pl-9 pr-3 py-2.5 focus:border-[#3c8dbc] focus:outline-none"
              />
            </div>

            {error && <p className="bg-red-50 border-l-4 border-[#dd4b39] text-[#dd4b39] px-3 py-2">{error}</p>}

            <button type="submit" className="flex items-center justify-center gap-2 bg-[#3c8dbc] hover:bg-[#367fa9] text-white py-2.5 rounded-sm font-semibold">
              <LogIn size={16} /> Đăng nhập
            </button>
          </form>

          {/* Tài khoản test */}
          <div className="mt-6 bg-[#f39c12]/10 border border-[#f39c12]/40 rounded-sm p-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-[#c87f0a]">🔑 Tài khoản dùng thử</p>
              <button type="button" onClick={fillTest} className="flex items-center gap-1 text-xs text-[#3c8dbc] hover:underline">
                <Wand2 size={12} /> Điền tự động
              </button>
            </div>
            {mode === "admin" ? (
              <div className="mt-1 text-gray-600 leading-relaxed">
                <p>Tên đăng nhập: <b>admin</b> · Mật khẩu: <b>admin123</b></p>
                <p>Tên đăng nhập: <b>canbo01</b> · Mật khẩu: <b>ktx@2026</b></p>
              </div>
            ) : (
              <p className="mt-1 text-gray-600">Mã phòng: <b>A3-301</b> · Mã sinh viên: <b>SV001</b> (hoặc bất kỳ)</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
