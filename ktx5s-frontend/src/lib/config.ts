// =====================================================
// CẤU HÌNH CHÍNH — Tự động nhận diện môi trường chạy
// =====================================================

// Bật bộ phân tích & phát hiện gian lận trực tiếp trên trình duyệt khi mở từ GitHub Pages (hoặc khi cổng 8000 chưa bật)
export const USE_MOCK = true;

// Nếu đang chạy trực tiếp trên cổng 8000 (gộp chung với Backend FastAPI) thì gọi thẳng "/api"
// Nếu chạy trên GitHub Pages (*.github.io) thì gọi tới Backend Render HTTPS
// Nếu chạy dev local cổng 3000/3001 thì gọi tới "http://localhost:8000/api"
export const BASE_URL =
  typeof window !== "undefined" && window.location.port === "8000"
    ? "/api"
    : typeof window !== "undefined" && window.location.hostname.endsWith("github.io")
      ? (process.env.NEXT_PUBLIC_API_URL ?? "https://ktx-5s-ai-b3rk.onrender.com/api")
      : process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
