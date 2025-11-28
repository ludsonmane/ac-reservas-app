// src/app/layout.tsx
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import './globals.css';

import { ColorSchemeScript, MantineProvider, createTheme, rem } from '@mantine/core';
import { Merriweather, Comfortaa } from 'next/font/google';
import React from 'react';
import Script from 'next/script';
import dynamic from 'next/dynamic';

// carrega MetaPixel **apenas no client**, nunca no SSR (evita quebrar build/SSR)
const MetaPixelBootstrapNoSSR = dynamic(() => import('./MetaPixelBootstrap'), {
  ssr: false,
  loading: () => null,
});

export const metadata = {
  title: 'Mané Mercado • Reservas',
  description: 'Faça sua reserva no Mané Mercado (Águas Claras / Arena Brasília)',
};

// Merriweather para títulos — BLACK (900)
const merri = Merriweather({
  weight: ['900'],
  subsets: ['latin'],
  variable: '--font-merri',
  display: 'swap',
});

// Comfortaa para textos
const comfortaa = Comfortaa({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-comfortaa',
  display: 'swap',
});

// Paleta "green" substituída pelo verde institucional (#034c46 como shade 7)
const maneGreen: string[] = [
  '#e6f0ef', // 0
  '#cde2df', // 1
  '#9cc4bf', // 2
  '#6aa7a0', // 3
  '#3a8a81', // 4
  '#0f6e63', // 5
  '#04534c', // 6
  '#034c46', // 7  <- principal
  '#023a36', // 8
  '#012b29', // 9
];

const theme = createTheme({
  primaryColor: 'green',
  primaryShade: { light: 7, dark: 5 },
  defaultRadius: 'md',

  colors: {
    green: maneGreen as any,
  },

  fontFamily:
    `var(--font-comfortaa), Comfortaa, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`,

  headings: {
    fontFamily:
      `var(--font-merri), Merriweather, serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`,
    fontWeight: 900 as any,
    sizes: {
      h1: { fontSize: rem(28), lineHeight: '1.15' },
      h2: { fontSize: rem(24), lineHeight: '1.2' },
      h3: { fontSize: rem(20), lineHeight: '1.25' },
      h4: { fontSize: rem(18), lineHeight: '1.25' },
    },
  },

  components: {
    Title: {
      defaultProps: { fw: 900 },
      styles: {
        root: {
          fontFamily:
            'var(--font-merri), Merriweather, serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
          fontWeight: 900,
        },
      },
    },
    Button:      { styles: { root: { height: rem(48) } } },
    TextInput:   { styles: { input: { height: rem(48) } } },
    NumberInput: { styles: { input: { height: rem(48) } } },
    Select:      { styles: { input: { height: rem(48) } } },
    TimeInput:   { styles: { input: { height: rem(48) } } },
  },
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const GA4 = process.env.NEXT_PUBLIC_GA4_ID;

  // >>> Flags do snippet CSQ/HJ
  const ENABLE_CSQ = process.env.NEXT_PUBLIC_ENABLE_CSQ !== '0'; // defina 1 para ligar
  const CSQ_ID = process.env.NEXT_PUBLIC_CSQ_ID ?? '6581655';

  return (
    <html lang="pt-BR">
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

        {/* GA4 base (só se houver ID configurado) */}
        {GA4 ? (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA4}`} strategy="afterInteractive" />
            <Script id="ga4" strategy="afterInteractive">
              {`
                try {
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${GA4}', { debug_mode: ${process.env.NODE_ENV !== 'production' ? 'true' : 'false'} });
                } catch (e) {
                  console.error('[GA4 init] ignorado:', e);
                }
              `}
            </Script>
          </>
        ) : null}

        {/* Contentsquare/Hotjar snippet */}
        {ENABLE_CSQ && (
          <Script id="csq-hj" strategy="afterInteractive">
            {`
              try {
                (function (c, s, q, u, a, r, e) {
                  c.hj = c.hj || function(){ (c.hj.q = c.hj.q || []).push(arguments) };
                  c._hjSettings = { hjid: ${CSQ_ID} };
                  r = s.getElementsByTagName('head')[0];
                  e = s.createElement('script');
                  e.async = true;
                  e.src = q + c._hjSettings.hjid + u;
                  r.appendChild(e);
                })(window, document, 'https://static.hj.contentsquare.net/c/csq-', '.js', ${CSQ_ID});
              } catch (e) {
                console.error('[CSQ/HJ init] ignorado:', e);
              }
            `}
          </Script>
        )}
      </head>
      <body
        className={`${merri.variable} ${comfortaa.variable}`}
        style={{
          background: 'transparent',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        }}
      >
        <MantineProvider theme={theme} defaultColorScheme="light">
          <style
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: `
                /* Força Merriweather Black nos títulos */
                h1, h2, h3, h4 {
                  font-family: var(--font-merri), Merriweather, serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif !important;
                  font-weight: 900 !important;
                  letter-spacing: -0.01em;
                }
                html, body {
                  font-family: var(--font-comfortaa), Comfortaa, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
                }
                /* Título do Mantine */
                [class*="mantine-Title-root"] {
                  font-family: var(--font-merri), Merriweather, serif !important;
                  font-weight: 900 !important;
                }
              `,
            }}
          />
          {/* Bootstrap do Meta Pixel (apenas carrega fbq; INIT por unidade via analytics.ts) */}
          <MetaPixelBootstrapNoSSR />

          {children}
        </MantineProvider>

        {/* (Opcional) Noscript do Pixel */}
        {/* <noscript>
          <img height="1" width="1" style={{ display: 'none' }} alt=""
            src="https://www.facebook.com/tr?id=SEU_PIXEL_GLOBAL&ev=PageView&noscript=1" />
        </noscript> */}
      </body>
    </html>
  );
}
