// =====================================================
// CẤU HÌNH CHÍNH — Tự động nhận diện môi trường chạy
// =====================================================

// Bật bộ phân tích & phát hiện gian lận trực tiếp trên trình duyệt khi mở từ GitHub Pages (hoặc khi cổng 8000 chưa bật)
export const USE_MOCK = true;

// Nếu đang chạy trực tiếp trên cổng 8000 (gộp chung với Backend FastAPI) thì gọi thẳng "/api"
// Nếu chạy từ cổng 3000/3001 hoặc GitHub Pages thì gọi tới "http://localhost:8000/api"
export const BASE_URL =
  typeof window !== "undefined" && window.location.port === "8000"
    ? "/api"
    : process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
