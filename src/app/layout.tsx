// src/app/layout.tsx
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import './globals.css';

import { ColorSchemeScript, MantineProvider, createTheme, rem } from '@mantine/core';
import { Merriweather, Comfortaa } from 'next/font/google';
import React from 'react';
import Script from 'next/script';
import MetaPixelBootstrap from './MetaPixelBootstrap';

export const metadata = {
  title: 'Mané Mercado • Reservas',
  description: 'Faça sua reserva no Mané Mercado (Águas Claras / Arena Brasília)',
};

// Merriweather para títulos (Bold)
const merri = Merriweather({
  weight: ['700'],
  subsets: ['latin'],
  variable: '--font-merri',
});

// Comfortaa para textos
const comfortaa = Comfortaa({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-comfortaa',
  display: 'swap',
});

const theme = createTheme({
  primaryColor: 'green',
  defaultRadius: 'md',

  // Body: Comfortaa
  fontFamily:
    `var(--font-comfortaa), Comfortaa, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`,

  // Headings: Merriweather Bold (700)
  headings: {
    fontFamily:
      `var(--font-merri), Merriweather, serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`,
    fontWeight: 700 as any,
    sizes: {
      h1: { fontSize: rem(28), lineHeight: '1.15' },
      h2: { fontSize: rem(24), lineHeight: '1.2' },
      h3: { fontSize: rem(20), lineHeight: '1.25' },
      h4: { fontSize: rem(18), lineHeight: '1.25' },
    },
  },

  components: {
    Title: {
      defaultProps: { fw: 700 },
      styles: {
        root: {
          fontFamily:
            'var(--font-merri), Merriweather, serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
          fontWeight: 700,
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
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA4}', { debug_mode: ${process.env.NODE_ENV !== 'production' ? 'true' : 'false'} });
              `}
            </Script>
          </>
        ) : null}
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
                h1, h2, h3, h4 {
                  font-family: var(--font-merri), Merriweather, serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif !important;
                  font-weight: 700 !important;
                  letter-spacing: -0.01em;
                }
                html, body {
                  font-family: var(--font-comfortaa), Comfortaa, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
                }
                [class*="mantine-Title-root"] { font-weight: 700 !important; }
              `,
            }}
          />
          {/* Bootstrap do Meta Pixel (apenas carrega fbq; a INIT por unidade é feita via analytics.ts) */}
          <MetaPixelBootstrap />

          {children}
        </MantineProvider>

        {/* (Opcional) Noscript do Pixel - apenas se quiser um pixel global de fallback
            Como estamos usando pixel por unidade, normalmente não é necessário. */}
        {/* <noscript>
          <img height="1" width="1" style={{ display: 'none' }} alt=""
            src="https://www.facebook.com/tr?id=SEU_PIXEL_GLOBAL&ev=PageView&noscript=1" />
        </noscript> */}
      </body>
    </html>
  );
}
