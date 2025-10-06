// src/app/layout.tsx
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import { ColorSchemeScript, MantineProvider, createTheme, rem } from '@mantine/core';
import { Alfa_Slab_One, Comfortaa } from 'next/font/google';
import './globals.css';

export const metadata = {
  title: 'Mané Mercado • Reservas',
  description: 'Faça sua reserva no Mané Mercado (Águas Claras / Arena Brasília)',
};

// Alfa Slab One — apenas 400
const alfa = Alfa_Slab_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-alfa',
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

  // Headings: Alfa Slab One (400 SEMPRE)
  headings: {
    fontFamily:
      `var(--font-alfa), Alfa Slab One, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`,
    fontWeight: '400' as any,
    sizes: {
      h1: { fontSize: rem(28), lineHeight: '1.15' },
      h2: { fontSize: rem(24), lineHeight: '1.2' },
      h3: { fontSize: rem(20), lineHeight: '1.25' },
      h4: { fontSize: rem(18), lineHeight: '1.25' },
    },
  },

  components: {
    Title: {
      defaultProps: { fw: 400 },
      styles: {
        root: {
          fontFamily:
            'var(--font-alfa), Alfa Slab One, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
          fontWeight: 400,
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
  return (
    <html lang="pt-BR">
      <head>
        <ColorSchemeScript />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body
        className={`${alfa.variable} ${comfortaa.variable}`}
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
                  font-family: var(--font-alfa), Alfa Slab One, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif !important;
                  font-weight: 400 !important;
                  letter-spacing: -0.01em;
                }
                html, body {
                  font-family: var(--font-comfortaa), Comfortaa, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
                }
                [class*="mantine-Title-root"] { font-weight: 400 !important; }
              `,
            }}
          />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
