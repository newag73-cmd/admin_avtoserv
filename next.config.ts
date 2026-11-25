import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["@prisma/client", "nodemailer"],
  poweredByHeader: false,
  outputFileTracingIncludes: { "/*": ["./data/**/*", "./src/generated/layero/**/*"] },
};
export default nextConfig;
