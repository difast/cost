/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdfmake", "docx", "@prisma/client", "bcryptjs"],
  experimental: { serverActions: { bodySizeLimit: "15mb" } },
};
export default nextConfig;
