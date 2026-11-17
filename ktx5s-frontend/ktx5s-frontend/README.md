# KTX 5S Frontend

Giao diện web cho hệ thống đánh giá vệ sinh phòng ở KTX tự động bằng AI.

## Cách chạy dự án

### Bước 1 — Cài Node.js
Vào [nodejs.org](https://nodejs.org) → tải bản **LTS** → cài đặt.

### Bước 2 — Cài thư viện
Mở terminal trong thư mục này, chạy:
```bash
npm install
```

### Bước 3 — Chạy ứng dụng
```bash
npm run dev
```

Mở trình duyệt vào: **http://localhost:3000**

---

## Chế độ Mock (dùng khi A chưa xong API)
Mặc định `USE_MOCK = true` trong file `src/lib/config.ts`.
Khi Sinh viên A xong API, đổi thành `false`.

## Cấu trúc thư mục
```
src/
  app/
    page.tsx                  ← Trang chủ chọn vai trò
    student/page.tsx          ← Nhập mã phòng
    student/camera/page.tsx   ← Chụp ảnh phòng
    student/result/page.tsx   ← Xem kết quả AI
    student/history/page.tsx  ← Lịch sử đánh giá
    admin/page.tsx            ← Dashboard cán bộ
  components/
    StatusBadge.tsx           ← Badge trạng thái (Sạch/Bừa/...)
    RoomCard.tsx              ← Thẻ phòng trong danh sách
  lib/
    config.ts                 ← Cài đặt USE_MOCK và BASE_URL
    mock-api.ts               ← Dữ liệu giả để test UI
    api.ts                    ← Hàm gọi API thật
```
