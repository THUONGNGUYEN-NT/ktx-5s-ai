/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";
const basePath = process.env.NEXT_BASE_PATH || "";
const distDir = process.env.NEXT_DIST_DIR || ".next";

const nextConfig = {
  // Chỉ áp dụng export tĩnh khi chạy build
  ...(isProd ? { output: "export" } : {}),
  distDir,
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
