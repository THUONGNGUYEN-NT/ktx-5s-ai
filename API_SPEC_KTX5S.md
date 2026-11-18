# 📡 API Specification — KTX 5S AI
> **Tài liệu ngôn ngữ chung giữa Sinh viên A (Backend) và Sinh viên B (Frontend)**
> Cập nhật: 17/11/2026 | Phiên bản: v1.0

---

> [!IMPORTANT]
> **Quy tắc vàng:** Sinh viên A KHÔNG được đổi tên field sau khi đã thống nhất. Nếu cần thêm field mới thì phải báo B trước.

---

## 🌐 Base URL

```
Development (local):   http://localhost:8000/api
Production (deploy):   https://ktx5s-api.onrender.com/api
```

Mọi request đều có header:
```
Content-Type: application/json
```

---

## 📦 Quy ước Response chung

**Mọi API** đều trả về cùng 1 cấu trúc bọc ngoài:

```json
{
  "success": true,
  "data": { ... },
  "message": "Thông báo ngắn gọn"
}
```

Khi có lỗi:
```json
{
  "success": false,
  "data": null,
  "message": "Mô tả lỗi cụ thể",
  "error_code": "INVALID_IMAGE"
}
```

### Danh sách `error_code`:
| Mã lỗi | Ý nghĩa |
|---|---|
| `INVALID_IMAGE` | Ảnh mờ, tối, hoặc không phải phòng KTX |
| `ROOM_NOT_FOUND` | Mã phòng không tồn tại |
| `ALREADY_SUBMITTED` | Phòng đã nộp ảnh tuần này rồi |
| `AI_ERROR` | Gemini API trả về lỗi |
| `UNAUTHORIZED` | Chưa đăng nhập hoặc không có quyền |

---

## 1️⃣ SINH VIÊN — Nộp ảnh phòng

### `POST /submissions`

**Mô tả:** Sinh viên nộp ảnh phòng để AI đánh giá.

**Request (gửi lên):**
```
Content-Type: multipart/form-data
```
| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|:---:|---|
| `room_code` | string | ✅ | Mã phòng (vd: `"A3-205"`) |
| `image` | file (jpg/png) | ✅ | Ảnh chụp trực tiếp từ camera |
| `captured_at` | string (ISO 8601) | ✅ | Thời gian chụp từ client (vd: `"2026-11-17T08:00:00+07:00"`) |

**Response thành công (200):**
```json
{
  "success": true,
  "data": {
    "submission_id": "sub_abc123",
    "room_code": "A3-205",
    "submitted_at": "2026-11-17T08:00:00+07:00",
    "image_url": "https://cdn.example.com/rooms/A3-205/week-47.jpg",
    "ai_result": {
      "status": "Hơi bừa bộn",
      "score": 6.5,
      "is_valid_room_photo": true,
      "checklist": {
        "bed_tidy": false,
        "floor_clean": true,
        "desk_organized": true,
        "shoes_arranged": false
      },
      "issues_detected": [
        "Chăn chưa được gấp gọn",
        "Giày dép để lộn xộn trước cửa"
      ],
      "positive_notes": [
        "Sàn nhà sạch sẽ, không có rác",
        "Bàn học ngăn nắp"
      ],
      "recommendations": "Hãy gấp chăn và xếp giày lên kệ để đạt điểm Sạch tuần sau nhé!"
    }
  },
  "message": "Nộp ảnh thành công! AI đã chấm điểm xong."
}
```

**Response lỗi — ảnh không hợp lệ (400):**
```json
{
  "success": false,
  "data": null,
  "message": "Ảnh quá tối hoặc mờ. Vui lòng chụp lại ở nơi đủ sáng.",
  "error_code": "INVALID_IMAGE"
}
```

---

## 2️⃣ SINH VIÊN — Xem lịch sử đánh giá theo phòng

### `GET /rooms/{room_code}/history`

**Mô tả:** Xem lịch sử các tuần đã nộp ảnh của 1 phòng.

**Ví dụ URL:** `GET /rooms/A3-205/history`

**Query params (tùy chọn):**
| Param | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `limit` | number | `10` | Số tuần muốn xem |
| `page` | number | `1` | Trang |

**Response thành công (200):**
```json
{
  "success": true,
  "data": {
    "room_code": "A3-205",
    "total_submissions": 5,
    "history": [
      {
        "submission_id": "sub_abc123",
        "week": "2026-W47",
        "submitted_at": "2026-11-17T08:00:00+07:00",
        "image_url": "https://cdn.example.com/rooms/A3-205/week-47.jpg",
        "status": "Hơi bừa bộn",
        "score": 6.5,
        "is_overridden": false,
        "override_note": null
      },
      {
        "submission_id": "sub_xyz789",
        "week": "2026-W46",
        "submitted_at": "2026-11-10T20:30:00+07:00",
        "image_url": "https://cdn.example.com/rooms/A3-205/week-46.jpg",
        "status": "Sạch",
        "score": 9.0,
        "is_overridden": true,
        "override_note": "Cán bộ xác nhận: Phòng sạch hơn AI đánh giá"
      }
    ]
  },
  "message": "OK"
}
```

---

## 3️⃣ CÁN BỘ — Xem Dashboard tổng quan

### `GET /admin/dashboard`

**Mô tả:** Lấy số liệu thống kê tổng hợp toàn ký túc xá theo tuần.

**Query params:**
| Param | Kiểu | Mặc định | Mô tả |
|---|---|---|---|
| `week` | string | Tuần hiện tại | Tuần cần xem (vd: `"2026-W47"`) |

**Response thành công (200):**
```json
{
  "success": true,
  "data": {
    "week": "2026-W47",
    "summary": {
      "total_rooms": 120,
      "submitted": 95,
      "not_submitted": 25,
      "submission_rate_percent": 79.2
    },
    "breakdown": {
      "clean": 60,
      "slightly_messy": 25,
      "messy": 10
    },
    "avg_score": 7.4,
    "deadline": "2026-11-17T21:00:00+07:00",
    "top_violations": [
      { "room_code": "B2-101", "score": 2.1, "status": "Bừa bộn" },
      { "room_code": "C1-304", "score": 3.5, "status": "Bừa bộn" }
    ]
  },
  "message": "OK"
}
```

---

## 4️⃣ CÁN BỘ — Lọc danh sách phòng

### `GET /admin/rooms`

**Mô tả:** Lấy danh sách tất cả phòng có thể lọc theo nhiều tiêu chí.

**Query params:**
| Param | Kiểu | Mô tả | Ví dụ |
|---|---|---|---|
| `week` | string | Tuần cần lọc | `2026-W47` |
| `status` | string | `clean` / `slightly_messy` / `messy` / `not_submitted` | `messy` |
| `building` | string | Tên tòa nhà | `A` |
| `floor` | number | Tầng | `3` |
| `page` | number | Trang (mặc định 1) | `1` |
| `limit` | number | Số phòng mỗi trang (mặc định 20) | `20` |

**Response thành công (200):**
```json
{
  "success": true,
  "data": {
    "total": 10,
    "page": 1,
    "limit": 20,
    "rooms": [
      {
        "room_code": "B2-101",
        "building": "B",
        "floor": 2,
        "week": "2026-W47",
        "status": "Bừa bộn",
        "score": 2.1,
        "submitted_at": "2026-11-17T19:45:00+07:00",
        "image_url": "https://cdn.example.com/rooms/B2-101/week-47.jpg",
        "is_overridden": false
      }
    ]
  },
  "message": "OK"
}
```

---

## 5️⃣ CÁN BỘ — Xem chi tiết 1 lượt nộp

### `GET /admin/submissions/{submission_id}`

**Mô tả:** Xem đầy đủ chi tiết kết quả AI của 1 lượt nộp ảnh.

**Response thành công (200):**
```json
{
  "success": true,
  "data": {
    "submission_id": "sub_abc123",
    "room_code": "B2-101",
    "submitted_at": "2026-11-17T19:45:00+07:00",
    "image_url": "https://cdn.example.com/rooms/B2-101/week-47.jpg",
    "ai_result": {
      "status": "Bừa bộn",
      "score": 2.1,
      "is_valid_room_photo": true,
      "checklist": {
        "bed_tidy": false,
        "floor_clean": false,
        "desk_organized": false,
        "shoes_arranged": false
      },
      "issues_detected": [
        "Rác thải vứt trên sàn nhà",
        "Quần áo bẩn vứt lộn xộn trên giường",
        "Thức ăn thừa trên bàn học"
      ],
      "positive_notes": [],
      "recommendations": "Phòng cần được dọn dẹp toàn bộ trước khi nộp lại."
    },
    "override": null
  },
  "message": "OK"
}
```

---

## 6️⃣ CÁN BỘ — Duyệt đè kết quả AI

### `PATCH /admin/submissions/{submission_id}/override`

**Mô tả:** Cán bộ chỉnh sửa kết quả AI nếu AI chấm sai.

**Request body:**
```json
{
  "new_status": "Hơi bừa bộn",
  "new_score": 5.5,
  "note": "Phòng thực tế không tệ như AI đánh giá. Ánh sáng kém khiến AI nhầm."
}
```

| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|:---:|---|
| `new_status` | string | ✅ | `"Sạch"` / `"Hơi bừa bộn"` / `"Bừa bộn"` |
| `new_score` | number | ✅ | Điểm mới từ 0.0 đến 10.0 |
| `note` | string | ✅ | Lý do cán bộ chỉnh sửa |

**Response thành công (200):**
```json
{
  "success": true,
  "data": {
    "submission_id": "sub_abc123",
    "original_status": "Bừa bộn",
    "original_score": 2.1,
    "new_status": "Hơi bừa bộn",
    "new_score": 5.5,
    "overridden_by": "cb_nguyen_van_a",
    "overridden_at": "2026-11-17T21:30:00+07:00",
    "note": "Phòng thực tế không tệ như AI đánh giá."
  },
  "message": "Đã cập nhật kết quả thành công."
}
```

---

## 7️⃣ CÁN BỘ — Xuất báo cáo tuần

### `GET /admin/reports/export`

**Mô tả:** Tải file báo cáo danh sách phòng vi phạm tuần ra Excel/CSV.

**Query params:**
| Param | Kiểu | Mô tả |
|---|---|---|
| `week` | string | Tuần cần xuất (vd: `2026-W47`) |
| `format` | string | `excel` hoặc `csv` (mặc định: `excel`) |

**Response:** Trả về file tải xuống trực tiếp (không phải JSON).

---

## 🎨 Bảng màu trạng thái (Dành cho Sinh viên B)

| `status` trả về từ API | Màu hiển thị | Badge |
|---|---|---|
| `"Sạch"` | 🟢 Xanh lá (`#22c55e`) | ✅ Sạch |
| `"Hơi bừa bộn"` | 🟡 Vàng (`#eab308`) | ⚠️ Hơi bừa bộn |
| `"Bừa bộn"` | 🔴 Đỏ (`#ef4444`) | ❌ Bừa bộn |
| `null` / chưa nộp | ⚫ Xám (`#6b7280`) | — Chưa nộp |

---

## 📋 Checklist field names (quan trọng — B dùng để render UI)

```json
"checklist": {
  "bed_tidy":        true,   // Giường có gọn không?
  "floor_clean":     true,   // Sàn có sạch không?
  "desk_organized":  true,   // Bàn học có ngăn nắp không?
  "shoes_arranged":  false   // Giày dép có xếp đúng chỗ không?
}
```

---

## 🗂️ Mock Data cho Sinh viên B (dùng khi A chưa xong API)

```javascript
// mock-api.js — B dùng file này tạm thời
export const mockSubmissionResult = {
  success: true,
  data: {
    submission_id: "mock_001",
    room_code: "A3-205",
    submitted_at: new Date().toISOString(),
    image_url: "https://placehold.co/600x400",
    ai_result: {
      status: "Hơi bừa bộn",
      score: 6.5,
      is_valid_room_photo: true,
      checklist: {
        bed_tidy: false,
        floor_clean: true,
        desk_organized: true,
        shoes_arranged: false,
      },
      issues_detected: ["Chăn chưa được gấp gọn", "Giày dép để lộn xộn"],
      positive_notes: ["Sàn nhà sạch sẽ", "Bàn học ngăn nắp"],
      recommendations: "Gấp chăn và xếp giày lên kệ nhé!",
    },
  },
  message: "Nộp ảnh thành công!",
};

export const mockDashboard = {
  success: true,
  data: {
    week: "2026-W47",
    summary: {
      total_rooms: 120,
      submitted: 95,
      not_submitted: 25,
      submission_rate_percent: 79.2,
    },
    breakdown: { clean: 60, slightly_messy: 25, messy: 10 },
    avg_score: 7.4,
  },
};
```

---

*Tài liệu này do AI tạo ra dựa trên kế hoạch dự án KTX 5S AI. Hai sinh viên cần đọc kỹ và xác nhận trước khi bắt đầu code.*
