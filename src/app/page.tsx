'use client';

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
} from '@mantine/core';
import { IconSearch, IconCalendarPlus } from '@tabler/icons-react';

export default function Home() {
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
            width={160}
            height={44}
            priority
            style={{ height: 44, width: 'auto' }}
          />
          <Title
            order={2}
            fw={500}
            ta="center"
            style={{
              color: '#146C2E',
              fontFamily: '"Alfa Slab One", system-ui, sans-serif',
            }}
          >
            Mané Mercado
          </Title>
          <Text size="sm" c="dimmed" ta="center">
            Águas Claras & Arena Brasília
          </Text>
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
              {/* 1) Reservar (realçado) */}
              <MenuCard
                title="Reservar Mesa"
                description="Faça uma nova reserva de forma rápida e segura."
                href="/reservar"
                icon={<IconCalendarPlus size={20} />}
                actionColor="green"
                variant="filled"
              />

              {/* 2) Localizar (borda/ghost) */}
              <MenuCard
                title="Localizar Reserva"
                description="Consulte sua reserva usando o código (ex.: JT5WK6)."
                href="/consultar"
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
  icon: React.ReactNode;
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
      {/* SEMPRE 2 COLUNAS: info | botão (inclusive no mobile) */}
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
                  fontSize: 18, // >=16px (anti-zoom iOS)
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
              root:
                variant === 'outline'
                  ? { background: 'transparent' }
                  : undefined,
            }}
          >
            Acessar
          </Button>
        </div>
      </div>

      {/* CSS do card (mantém botão à direita no mobile) */}
      <style jsx>{`
        .menuCard {
          display: grid;
          grid-template-columns: 1fr auto; /* SEMPRE 2 colunas */
          align-items: center;
          gap: 10px 12px;
        }
        .menuInfo {
          min-width: 0; /* permite texto quebrar sem empurrar o botão */
        }
        .menuAction {
          justify-self: end; /* alinha à direita */
        }
        .menuActionBtn {
          width: 110px;     /* largura fixa p/ caber no mobile */
          height: 40px;
          font-size: 16px;  /* evita zoom do iOS */
          font-weight: 700;
          padding: 0 14px;
          white-space: nowrap;
        }

        /* Em telas MUITO estreitas (<340px), deixamos stack como fallback */
        @media (max-width: 340px) {
          .menuCard {
            grid-template-columns: 1fr;
          }
          .menuActionBtn {
            width: 100%;
            justify-self: stretch;
          }
        }

        /* Desktop: mantém botão do tamanho do conteúdo */
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
