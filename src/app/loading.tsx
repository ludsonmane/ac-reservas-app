'use client';

import {
  Box,
  Card,
  Container,
  Skeleton,
  Stack,
  Title,
} from '@mantine/core';

export default function HomeLoading() {
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
          <Skeleton height={28} width={180} radius="sm" />
          <Skeleton height={14} width={220} radius="xl" />
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
            <Title
              order={3}
              ta="center"
              fw={600}
              style={{ fontSize: 22, lineHeight: 1.25 }}
            >
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
