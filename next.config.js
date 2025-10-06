/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Em DEV, permite chamar o backend via /api/* (proxy para http://localhost:4000)
    return isDev
      ? [{ source: '/api/:path*', destination: 'http://localhost:4000/:path*' }]
      : [];
  },
};

module.exports = nextConfig;
