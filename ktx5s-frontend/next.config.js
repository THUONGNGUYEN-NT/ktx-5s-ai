/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";
// Mặc định basePath trên GitHub Pages là /ktx-5s-ai
const defaultBasePath = isProd ? "/ktx-5s-ai" : "";
const basePath = process.env.NEXT_BASE_PATH !== undefined ? process.env.NEXT_BASE_PATH : defaultBasePath;
const distDir = process.env.NEXT_DIST_DIR || ".next";

const nextConfig = {
  // Chỉ áp dụng export tĩnh khi chạy build production
  ...(isProd ? { output: "export" } : {}),
  distDir,
  trailingSlash: isProd,
  basePath,
  assetPrefix: basePath || undefined,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: {
    unoptimized: true,
  },
  experimental: {
    // Tối ưu hóa import lucide-react để khởi động nhanh hơn gấp nhiều lần
    optimizePackageImports: ["lucide-react"],
  },
  webpack: (config, { dev }) => {
    // Trong môi trường dev trên OneDrive Windows: dùng cache bộ nhớ (memory)
    // để tránh lỗi OneDrive khóa file và lỗi ENOENT vendor-chunks
    if (dev) {
      config.cache = { type: "memory" };
    }
    return config;
  },
};

module.exports = nextConfig;
