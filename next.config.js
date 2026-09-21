// next.config.js
/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  // Links curtos das casas (bio, Google, anúncios) → jornada de reserva já na casa certa
  async redirects() {
    return ["bsb", "ac", "sp", "partage"].map((u) => ({
      source: "/" + u,
      destination: "/reserva?unit=" + u + "&utm_source=link-" + u,
      permanent: false,
    }));
  },

  // Proxy só em desenvolvimento
  async rewrites() {
    if (!isDev) return [];
    return [
      {
        source: "/api/:path*",
        destination: "http://api.mane.com.vc/:path*",
      },
    ];
  },

  images: {
    remotePatterns: [
      // PRODUÇÃO: restringe host + caminho (mitiga DoS do Image Optimizer)
      {
        protocol: "https",
        hostname: "api.mane.com.vc",
        pathname: "/**",
      },

      // DEV/LOCAL: só habilita localhost em dev
      ...(isDev
        ? [
            {
              protocol: "http",
              hostname: "localhost",
              port: "4000",
              pathname: "/**",
            },
          ]
        : []),
    ],
  },
};

module.exports = nextConfig;
