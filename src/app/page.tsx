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

        {/* Cart de boas-vindas */}
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
            <Title order={3} ta="center" fw={600}>
              Como podemos te ajudar?
            </Title>

            {/* Grid “manual” responsivo */}
            <Box
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 14,
              }}
            >
              <Box
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: 14,
                }}
              >
                {/* 1) Reservar primeiro (preenchido) */}
                <MenuCard
                  title="Reservar Mesa"
                  description="Faça uma nova reserva de forma rápida e segura."
                  href="/reservar"
                  icon={<IconCalendarPlus size={20} />}
                  actionColor="green"
                  variant="filled"
                />

                {/* 2) Localizar como ghost (apenas borda) */}
                <MenuCard
                  title="Localizar Reserva"
                  description="Consulte sua reserva usando o código (ex.: JT5WK6)."
                  href="/consultar"
                  icon={<IconSearch size={20} />}
                  actionColor="green"
                  variant="outline" // 👈 ghost button
                />
              </Box>
            </Box>
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
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,.05)';
      }}
    >
      <Group justify="space-between" align="center" wrap="wrap">
        <Stack gap={4} style={{ minWidth: 220 }}>
          <Group gap={8}>
            <Box
              aria-hidden
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                border: '2px solid rgba(20,108,46,.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#EFFFF3',
              }}
            >
              {icon}
            </Box>
            <Title order={4} style={{ margin: 0 }}>
              {title}
            </Title>
          </Group>
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        </Stack>

        <Button
          component={Link}
          href={href}
          radius="md"
          color={actionColor}
          variant={variant}
          mt={{ base: 'sm', md: 0 }}
          styles={{
            root: variant === 'outline'
              ? { background: 'transparent' } // reforça o "ghost"
              : undefined,
          }}
        >
          Acessar
        </Button>
      </Group>
    </Card>
  );
}
