// =====================================================
// CẤU HÌNH CHÍNH — Tự động nhận diện môi trường chạy
// =====================================================

// Cho phép dự phòng dữ liệu mẫu khi người xem mở link GitHub Pages mà không bật cổng 8000
export const USE_MOCK = true;

// Nếu đang chạy trực tiếp trên cổng 8000 (gộp chung với Backend FastAPI) thì gọi thẳng "/api"
// Nếu chạy từ cổng 3000/3001 hoặc GitHub Pages thì gọi tới "http://localhost:8000/api"
export const BASE_URL =
  typeof window !== "undefined" && window.location.port === "8000"
    ? "/api"
    : process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
