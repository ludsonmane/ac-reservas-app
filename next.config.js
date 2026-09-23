// next.config.js
/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  async redirects() {
    return [
      // a jornada mora na raiz: / (tela 1), /dados (tela 2), /pronto/CODIGO (tela 3).
      // Caminhos antigos caem no lugar certo com a query (utm, unit, people, date) preservada.
      { source: "/reservar", destination: "/", permanent: false },
      { source: "/reserva", destination: "/", permanent: false },
      { source: "/reserva/dados", destination: "/dados", permanent: false },
      { source: "/reserva/pronto/:code", destination: "/pronto/:code", permanent: false },
      // Links curtos das casas (bio, Google, anúncios) → já na casa certa
      ...["bsb", "ac", "sp", "partage"].map((u) => ({
        source: "/" + u,
        destination: "/?unit=" + u + "&utm_source=link-" + u,
        permanent: false,
      })),
    ];
  },

  // Proxy da API: em dev sempre; em produção só quando API_PROXY_TARGET está definido
  // (ambientes de preview em domínio *.up.railway.app, que a API não libera no CORS).
  async rewrites() {
    const target = (process.env.API_PROXY_TARGET || "").replace(/\/+$/, "");
    if (!isDev) {
      return target ? [{ source: "/v1/:path*", destination: `${target}/v1/:path*` }] : [];
    }
    return [
      {
        source: "/api/:path*",
        destination: "https://api.mane.com.vc/:path*",
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
