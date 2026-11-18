/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_BASE_PATH || "";
const distDir = process.env.NEXT_DIST_DIR || ".next";

const nextConfig = {
  output: "export",
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
