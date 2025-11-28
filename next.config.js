// next.config.js
/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  // Proxy só em desenvolvimento
  async rewrites() {
    if (!isDev) return [];
    return [
      {
        source: '/api/:path*',
        destination: 'http://api.mane.com.vc/:path*',
      },
    ];
  },

  // Permite carregar imagens hospedadas na API
  images: {
    remotePatterns: [
      // produção
      { protocol: 'https', hostname: 'api.mane.com.vc' },
      // dev/local
      { protocol: 'http', hostname: 'localhost', port: '4000' },
    ],
  },
};

module.exports = nextConfig;
