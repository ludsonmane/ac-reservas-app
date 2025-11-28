'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Container,
  Card,
  Button,
  Title,
  Text,
  Stack,
  Group,
  Box,
  rem,
  Skeleton,
} from '@mantine/core';
import { IconSearch, IconCalendarPlus } from '@tabler/icons-react';

// ⬇️ bootstrap do analytics (não mexido)
import { ensureAnalyticsReady } from '@/lib/analytics';

export default function Home() {
  // Inicializa fbq/gtag apenas uma vez no client
  useEffect(() => {
    ensureAnalyticsReady();
  }, []);

  // Mostra skeleton até hidratar (e um tique a mais para suavizar)
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setHydrated(true), 250);
    return () => clearTimeout(id);
  }, []);

  // --- NOVO: capturar query atual (UTMs) e reaproveitar nos links
  const [query, setQuery] = useState<string>('');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setQuery(window.location.search || '');
    }
  }, []);

  // helper que anexa a query atual ao destino
  const withQuery = useMemo(() => {
    return (basePath: string) => {
      if (!query) return basePath;
      // se já houver query no basePath (não é nosso caso), mesclaria aqui.
      const hasHash = basePath.includes('#');
      if (!hasHash) return `${basePath}${basePath.includes('?') ? '&' : '?'}${query.replace(/^\?/, '')}`;

      // mantém o hash no final, anexando query antes dele
      const [path, hash] = basePath.split('#');
      const sep = path.includes('?') ? '&' : '?';
      return `${path}${sep}${query.replace(/^\?/, '')}#${hash}`;
    };
  }, [query]);

  if (!hydrated) return <HomeSkeleton />;

  return (
    <Box
      style={{
        minHeight: '100dvh',
        background: '#ffffff',
        fontFamily: '"Comfortaa", system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Container size={560} px="md">
        {/* Header centralizado */}
        <Stack align="center" gap={6} mb="sm">
          <Image
            src="/images/1.png"
            alt="Mané Mercado"
            width={180}
            height={80}
            priority
            style={{ height: 80, width: 'auto' }}
          />
        </Stack>

        {/* Card de boas-vindas */}
        <Card
          withBorder
          radius="lg"
          p="lg"
          shadow="sm"
          style={{
            background: '#FBF5E9',
            borderColor: 'rgba(20,108,46,0.15)',
          }}
        >
          <Stack gap="md">
            <Title
              order={3}
              ta="center"
              fw={600}
              style={{ fontSize: 22, lineHeight: 1.25 }}
            >
              Como podemos te ajudar?
            </Title>

            {/* Lista de opções */}
            <Stack gap={14}>
              {/* 1) Reservar (realçado) — COM UTM */}
              <MenuCard
                title="Reservar Mesa"
                description="Faça uma nova reserva de forma rápida e segura."
                href={withQuery('/reservar')}
                icon={<IconCalendarPlus size={20} />}
                actionColor="green"
                variant="filled"
              />

              {/* 2) Localizar (borda/ghost) — opcional: também manter UTM */}
              <MenuCard
                title="Localizar Reserva"
                description="Consulte sua reserva usando o código (ex.: JT5WK6)."
                href={withQuery('/consultar')}
                icon={<IconSearch size={20} />}
                actionColor="green"
                variant="outline"
              />
            </Stack>
          </Stack>
        </Card>

        <Box h={rem(20)} />

        <Text size="xs" c="dimmed" ta="center">
          Dúvidas? Procure nosso concierge no estabelecimento no dia da sua visita.
        </Text>
      </Container>
    </Box>
  );
}

/* --------- Skeleton da Home (carregado antes da hidratação) --------- */
function HomeSkeleton() {
  return (
    <Box
      style={{
        minHeight: '100dvh',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        fontFamily: '"Comfortaa", system-ui, sans-serif',
      }}
    >
      <Container size={560} px="md">
        {/* HEADER */}
        <Stack align="center" gap={6} mb="sm">
          <Skeleton height={44} width={160} radius="sm" />
        </Stack>

        {/* CARD PRINCIPAL */}
        <Card
          withBorder
          radius="lg"
          p="lg"
          shadow="sm"
          style={{
            background: '#FBF5E9',
            borderColor: 'rgba(20,108,46,0.15)',
          }}
        >
          <Stack gap="md">
            <Title order={3} ta="center" fw={600} style={{ fontSize: 22 }}>
              <Skeleton height={26} width={260} mx="auto" radius="sm" />
            </Title>

            {/* CARD 1 */}
            <Card withBorder radius="md" p="md" shadow="xs" style={{ background: '#fff' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
                <Stack gap={6}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Skeleton height={36} width={36} radius={10} />
                    <Skeleton height={20} width={160} radius="sm" />
                  </div>
                  <Skeleton height={14} width={260} radius="xl" />
                </Stack>
                <Skeleton height={40} width={110} radius="md" />
              </div>
            </Card>

            {/* CARD 2 */}
            <Card withBorder radius="md" p="md" shadow="xs" style={{ background: '#fff' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
                <Stack gap={6}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Skeleton height={36} width={36} radius={10} />
                    <Skeleton height={20} width={190} radius="sm" />
                  </div>
                  <Skeleton height={14} width={300} radius="xl" />
                </Stack>
                <Skeleton height={40} width={110} radius="md" />
              </div>
            </Card>
          </Stack>
        </Card>

        <Skeleton mt="md" height={12} width={320} mx="auto" radius="xl" />
      </Container>
    </Box>
  );
}

/* ------------------- Card da lista da Home ------------------- */
function MenuCard({
  title,
  description,
  href,
  icon,
  actionColor = 'dark',
  variant = 'filled',
}: {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
  actionColor?: 'green' | 'dark';
  variant?: 'filled' | 'outline';
}) {
  return (
    <Card
      withBorder
      radius="md"
      p="md"
      shadow="xs"
      style={{
        background: '#fff',
        transition: 'transform .12s ease, box-shadow .12s ease',
      }}
      onMouseEnter={(e) => {
        if (window.matchMedia('(hover: hover)').matches) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,.06)';
        }
      }}
      onMouseLeave={(e) => {
        if (window.matchMedia('(hover: hover)').matches) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,.05)';
        }
      }}
    >
      {/* Sempre 2 colunas: info | botão (também no mobile) */}
      <div className="menuCard">
        <div className="menuInfo">
          <Group gap={8} wrap="nowrap" align="flex-start">
            <Box
              aria-hidden
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: '2px solid rgba(20,108,46,.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#EFFFF3',
                flex: '0 0 auto',
                marginTop: 2,
              }}
            >
              {icon}
            </Box>
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Title
                order={4}
                style={{
                  margin: 0,
                  fontFamily: '"Alfa Slab One", system-ui, sans-serif',
                  letterSpacing: '-0.01em',
                  fontSize: 18,
                  lineHeight: 1.15,
                }}
              >
                {title}
              </Title>
              <Text size="sm" c="dimmed" style={{ lineHeight: 1.35 }}>
                {description}
              </Text>
            </Stack>
          </Group>
        </div>

        <div className="menuAction">
          <Button
            component={Link}
            href={href}
            radius="md"
            color={actionColor}
            variant={variant}
            className="menuActionBtn"
            styles={{
              root: variant === 'outline' ? { background: 'transparent' } : undefined,
            }}
          >
            Acessar
          </Button>
        </div>
      </div>

      {/* CSS do card (botão à direita no mobile também) */}
      <style jsx>{`
        .menuCard {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 10px 12px;
        }
        .menuInfo {
          min-width: 0;
        }
        .menuAction {
          justify-self: end;
        }
        .menuActionBtn {
          width: 110px;
          height: 40px;
          font-size: 16px;
          font-weight: 700;
          padding: 0 14px;
          white-space: nowrap;
        }
        @media (max-width: 340px) {
          .menuCard {
            grid-template-columns: 1fr;
          }
          .menuActionBtn {
            width: 100%;
            justify-self: stretch;
          }
        }
        @media (min-width: 768px) {
          .menuActionBtn {
            width: auto;
            min-width: 120px;
          }
        }
      `}</style>
    </Card>
  );
}
