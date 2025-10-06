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
        // só aplica hover em devices com hover
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
      {/* MOBILE: coluna | DESKTOP (>=768px): linha com botão à direita */}
      <div className="menuCard">
        <div className="menuInfo">
          <Group gap={8} wrap="nowrap" align="center">
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
                  fontSize: 18, // >=16px (evita zoom do iOS)
                  lineHeight: 1.2,
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

      {/* CSS responsivo específico do card */}
      <style jsx>{`
        .menuCard {
          display: grid;
          grid-template-columns: 1fr; /* mobile: empilhado */
          gap: 12px;
        }
        .menuActionBtn {
          width: 100%; /* mobile: botão full-width */
          height: 42px;
          font-size: 16px; /* evita zoom do iOS */
          font-weight: 600;
        }

        @media (min-width: 768px) {
          .menuCard {
            grid-template-columns: 1fr auto; /* desktop: info | botão */
            align-items: center;
          }
          .menuActionBtn {
            width: auto; /* desktop: botão do tamanho do conteúdo */
          }
        }
      `}</style>
    </Card>
  );
}
