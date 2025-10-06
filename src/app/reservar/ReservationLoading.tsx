'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Card, Stack, Title, Text, Group, Badge, rem } from '@mantine/core';
import { Loader } from '@mantine/core';
import { IconClockHour4 } from '@tabler/icons-react';

type Props = {
  open: boolean;
  tips?: string[];
};

const DEFAULT_TIPS = [
  'Verificando disponibilidade…',
  'Escolhendo setor…',
  'Encontrando lugares…',
  'Reservando sua mesa…',
  'Quase lá…',
];

export default function ReservationLoading({ open, tips = DEFAULT_TIPS }: Props) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<number | null>(null);

  // evita recriar array
  const safeTips = useMemo(() => (tips.length ? tips : DEFAULT_TIPS), [tips]);

  useEffect(() => {
    if (!open) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      setIdx(0);
      return;
    }
    timerRef.current = window.setInterval(() => {
      setIdx((i) => (i + 1) % safeTips.length);
    }, 1100); // troca a cada ~1.1s
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [open, safeTips.length]);

  if (!open) return null;

  return (
    <Box
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,.35)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <Card
        withBorder
        radius="lg"
        shadow="lg"
        p="xl"
        style={{
          width: 'min(520px, 92vw)',
          background: '#FBF5E9',
          borderColor: '#e8e2d6',
        }}
      >
        <Stack gap="md" align="center">
          <Box
            aria-hidden
            style={{
              width: 72,
              height: 72,
              borderRadius: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid var(--mantine-color-green-5)',
              background: '#EFFFF3',
            }}
          >
            <Loader size="lg" />
          </Box>

          <Title order={3} ta="center" fw={700} style={{ marginTop: rem(4) }}>
            Efetuando sua reserva
          </Title>

          <Group gap={8}>
            <IconClockHour4 size={16} />
            <Text size="sm" c="dimmed" ta="center">
              {safeTips[idx]}
            </Text>
          </Group>

          <Badge
            variant="light"
            color="green"
            size="lg"
            radius="sm"
            mt="xs"
            style={{ letterSpacing: 0.3 }}
          >
            Não feche esta janela
          </Badge>
        </Stack>
      </Card>
    </Box>
  );
}
