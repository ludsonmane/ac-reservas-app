'use client';

import { Box, Card, Container, Skeleton, Stack, Title } from '@mantine/core';

export default function ConsultarLoading() {
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
          <Skeleton height={28} width={220} radius="sm" />
          <Skeleton height={14} width={260} radius="xl" />
        </Stack>

        {/* CARD BUSCA */}
        <Card withBorder radius="lg" p="lg" shadow="sm" style={{ background: '#FBF5E9' }}>
          <Stack gap="md">
            <Title order={3} ta="center" fw={600} style={{ fontSize: 22 }}>
              <Skeleton height={26} width={240} mx="auto" radius="sm" />
            </Title>

            <Card withBorder radius="md" p="md" shadow="xs" style={{ background: '#fff' }}>
              <Stack gap="md">
                <Skeleton height={18} width={140} radius="sm" />
                <Skeleton height={42} radius="md" />
                <Skeleton height={40} width={140} radius="md" mx="auto" />
              </Stack>
            </Card>
          </Stack>
        </Card>

        <Skeleton mt="md" height={12} width={320} mx="auto" radius="xl" />
      </Container>
    </Box>
  );
}
