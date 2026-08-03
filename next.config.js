/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep local images / SVGs working out of the box.
  images: {
    // Supabase Storage public URLs are remote; allow them when needed.
    remotePatterns: [],
  },
};

module.exports = nextConfig;
