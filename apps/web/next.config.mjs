/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Menu photos are up to 2 MB, plus form overhead. Next.js defaults to 1 MB for server actions.
    serverActions: { bodySizeLimit: "3mb" },
  },
};
export default nextConfig;
