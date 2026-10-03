/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdfmake", "docx", "@prisma/client", "bcryptjs"],
  experimental: { serverActions: { bodySizeLimit: "15mb" } },
};
export default nextConfig;
