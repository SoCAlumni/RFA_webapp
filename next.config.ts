import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 다른 폴더로 빌드해 볼 때: NEXT_DIST_DIR=.next-check npm run build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /* config options here */
};

export default nextConfig;
