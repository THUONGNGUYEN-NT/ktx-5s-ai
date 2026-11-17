// =====================================================
// MOCK DATA — Copy từ API_SPEC_KTX5S.md
// Sinh viên B dùng file này khi A chưa xong API thật
// =====================================================

export const mockSubmissionResult = {
  success: true,
  data: {
    submission_id: "mock_001",
    room_code: "A3-205",
    submitted_at: new Date().toISOString(),
    image_url: "https://placehold.co/600x400/e2e8f0/64748b?text=Anh+phong+KTX",
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
      issues_detected: [
        "Chăn chưa được gấp gọn",
        "Giày dép để lộn xộn trước cửa",
      ],
      positive_notes: [
        "Sàn nhà sạch sẽ, không có rác",
        "Bàn học ngăn nắp",
      ],
      recommendations:
        "Hãy gấp chăn và xếp giày lên kệ để đạt điểm Sạch tuần sau nhé!",
    },
  },
  message: "Nộp ảnh thành công! AI đã chấm điểm xong.",
};

export const mockHistory = {
  success: true,
  data: {
    room_code: "A3-205",
    total_submissions: 3,
    history: [
      {
        submission_id: "mock_001",
        week: "2026-W47",
        submitted_at: "2026-11-17T08:00:00+07:00",
        image_url: "https://placehold.co/600x400/e2e8f0/64748b?text=Tuan+47",
        status: "Hơi bừa bộn",
        score: 6.5,
        is_overridden: false,
        override_note: null,
      },
      {
        submission_id: "mock_002",
        week: "2026-W46",
        submitted_at: "2026-11-10T20:30:00+07:00",
        image_url: "https://placehold.co/600x400/e2e8f0/64748b?text=Tuan+46",
        status: "Sạch",
        score: 9.0,
        is_overridden: true,
        override_note: "Cán bộ xác nhận: Phòng sạch hơn AI đánh giá",
      },
      {
        submission_id: "mock_003",
        week: "2026-W45",
        submitted_at: "2026-11-03T19:00:00+07:00",
        image_url: "https://placehold.co/600x400/e2e8f0/64748b?text=Tuan+45",
        status: "Bừa bộn",
        score: 2.1,
        is_overridden: false,
        override_note: null,
      },
    ],
  },
  message: "OK",
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
    deadline: "2026-11-17T21:00:00+07:00",
    top_violations: [
      { room_code: "B2-101", score: 2.1, status: "Bừa bộn" },
      { room_code: "C1-304", score: 3.5, status: "Bừa bộn" },
      { room_code: "A4-110", score: 4.0, status: "Bừa bộn" },
    ],
  },
};

export const mockRooms = {
  success: true,
  data: {
    total: 5,
    page: 1,
    limit: 20,
    rooms: [
      { room_code: "B2-101", building: "B", floor: 2, week: "2026-W47", status: "Bừa bộn",      score: 2.1, submitted_at: "2026-11-17T19:45:00+07:00", image_url: "https://placehold.co/400x300", is_overridden: false },
      { room_code: "C1-304", building: "C", floor: 1, week: "2026-W47", status: "Bừa bộn",      score: 3.5, submitted_at: "2026-11-17T20:10:00+07:00", image_url: "https://placehold.co/400x300", is_overridden: false },
      { room_code: "A3-205", building: "A", floor: 3, week: "2026-W47", status: "Hơi bừa bộn",  score: 6.5, submitted_at: "2026-11-17T08:00:00+07:00", image_url: "https://placehold.co/400x300", is_overridden: false },
      { room_code: "A1-101", building: "A", floor: 1, week: "2026-W47", status: "Sạch",          score: 9.2, submitted_at: "2026-11-17T07:30:00+07:00", image_url: "https://placehold.co/400x300", is_overridden: false },
      { room_code: "D2-201", building: "D", floor: 2, week: "2026-W47", status: null,            score: null, submitted_at: null, image_url: null, is_overridden: false },
    ],
  },
};
