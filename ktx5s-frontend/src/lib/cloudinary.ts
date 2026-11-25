// ============================================================================
// DỊCH VỤ TỰ ĐỘNG LƯU TRỮ, TẠO THƯ MỤC ẢNH & ĐỒNG BỘ DỮ LIỆU XUYÊN THIẾT BỊ TRÊN CLOUDINARY
// Tự động gom ảnh vào thư mục theo mã phòng: ktx5s/{room_code}/
// Đồng bộ kết quả chấm điểm 5S thời gian thực giữa Điện thoại <-> Laptop trên GitHub Pages
// ============================================================================

const CLOUD_NAME = "x6qqyuno";
const API_KEY = "347922489956772";
const API_SECRET = "A5gKoLPsddVRIvZAofc4sqPiZhs";
const LIVE_CLOUD_PUBLIC_ID = "ktx5s/live_submissions_v1.json";

async function sha1(str: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-1", enc.encode(str));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Upload trực tiếp 1 file ảnh lên Cloudinary vào đúng thư mục của phòng.
 */
export async function uploadToCloudinary(
  file: File | Blob,
  roomCode: string,
  areaName: string = "photo"
): Promise<string> {
  const cleanRoom = (roomCode || "UNKNOWN")
    .trim()
    .toUpperCase()
    .replace(/\//g, "-")
    .replace(/\\/g, "-");

  const folder = `ktx5s/${cleanRoom}`;
  const timestamp = Math.floor(Date.now() / 1000);

  const toSign = `folder=${folder}&timestamp=${timestamp}${API_SECRET}`;
  const signature = await sha1(toSign);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", API_KEY);
  formData.append("timestamp", timestamp.toString());
  formData.append("folder", folder);
  formData.append("signature", signature);

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      console.warn("Lỗi upload Cloudinary:", errJson);
      return "";
    }

    const data = await res.json();
    console.log(`☁️ [Cloudinary Upload] Thành công ảnh ${areaName} phòng ${cleanRoom}:`, data.secure_url);
    return data.secure_url || data.url || "";
  } catch (err) {
    console.warn("Không thể kết nối Cloudinary trực tiếp:", err);
    return "";
  }
}

/**
 * Upload song song 4 ảnh khu vực lên Cloudinary vào thư mục phòng
 */
export async function uploadAllFourAreasToCloudinary(
  files: Record<string, File>,
  roomCode: string
): Promise<Record<string, string>> {
  const cleanRoom = (roomCode || "ROOM").trim().toUpperCase();
  const keys = Object.keys(files);

  const results: Record<string, string> = {};

  await Promise.all(
    keys.map(async (key) => {
      const file = files[key];
      if (file) {
        const url = await uploadToCloudinary(file, cleanRoom, key);
        if (url) {
          results[key] = url;
        }
      }
    })
  );

  return results;
}

/**
 * Tải danh sách lượt nộp thực tế từ Cloudinary (đồng bộ Điện thoại <-> Laptop)
 */
export async function fetchCloudLiveRecords<T = Record<string, unknown>>(): Promise<T | null> {
  try {
    const url = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${LIVE_CLOUD_PUBLIC_ID}?t=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && typeof data === "object" && !("test" in data)) {
      return data as T;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Lưu và đồng bộ danh sách lượt nộp lên Cloudinary để mọi thiết bị khác (Laptop / Điện thoại) đều thấy ngay
 */
export async function pushCloudLiveRecords(records: Record<string, unknown>): Promise<boolean> {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `invalidate=true&overwrite=true&public_id=${LIVE_CLOUD_PUBLIC_ID}&timestamp=${timestamp}${API_SECRET}`;
    const signature = await sha1(toSign);

    const jsonBlob = new Blob([JSON.stringify(records)], { type: "application/json" });
    const formData = new FormData();
    formData.append("file", jsonBlob, "live_submissions_v1.json");
    formData.append("api_key", API_KEY);
    formData.append("timestamp", timestamp.toString());
    formData.append("public_id", LIVE_CLOUD_PUBLIC_ID);
    formData.append("overwrite", "true");
    formData.append("invalidate", "true");
    formData.append("signature", signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`, {
      method: "POST",
      body: formData,
    });
    return res.ok;
  } catch (err) {
    console.warn("Không thể đồng bộ dữ liệu lên Cloudinary:", err);
    return false;
  }
}
