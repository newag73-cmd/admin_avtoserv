import type { NextConfig } from "next";
const nextConfig: NextConfig = { serverExternalPackages: ["@prisma/client", "nodemailer"], poweredByHeader: false, output: "standalone" };
export default nextConfig;
