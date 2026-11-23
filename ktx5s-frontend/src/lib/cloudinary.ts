// ============================================================================
// DỊCH VỤ TỰ ĐỘNG LƯU TRỮ VÀ TẠO THƯ MỤC ẢNH TRÊN CLOUDINARY (CLIENT & SERVER)
// Tự động gom ảnh vào thư mục theo mã phòng: ktx5s/{room_code}/
// Hoạt động 100% cả khi chạy cục bộ lẫn khi chạy trực tiếp trên GitHub Pages
// ============================================================================

const CLOUD_NAME = "x6qqyuno";
const API_KEY = "347922489956772";
const API_SECRET = "A5gKoLPsddVRIvZAofc4sqPiZhs";

async function sha1(str: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-1", enc.encode(str));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Upload trực tiếp 1 file ảnh lên Cloudinary vào đúng thư mục của phòng.
 * @param file File ảnh hoặc Blob từ camera/input
 * @param roomCode Mã phòng (VD: A3-301, B2-201)
 * @param areaName Tên khu vực (bed, floor, shoes, desk)
 * @returns URL ảnh an toàn (secure_url) trên Cloudinary
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

  // Tạo chữ ký bảo mật SHA-1 theo chuẩn Cloudinary API
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
