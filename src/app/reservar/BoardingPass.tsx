'use client';

import { Card, Stack, Text, Title, Box, Divider, Group, Badge, rem } from '@mantine/core';
import {
  IconUsers,
  IconBuildingStore,
  IconMapPin,
  IconCalendar,
  IconClockHour4,
  IconQrcode,
  IconMoodKid,
  IconUser,
  IconId,
} from '@tabler/icons-react';

type Props = {
  id: string;
  code: string;
  qrUrl: string;
  unitLabel: string;
  areaName: string;
  dateStr: string;  // DD/MM/YYYY
  timeStr: string;  // HH:mm
  people: number;
  kids?: number;
  fullName?: string;
  cpf?: string | null;
  emailHint?: string | null;
  /** quando true, esconde o cabeçalho ("Reserva criada", Localizador e aviso de e-mail) */
  hideHeader?: boolean;
};

/** remove acentos e baixa */
function norm(s: string) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Código da UNIDADE conforme a regra (MMAC, MMAR, maneSP ...) */
function unitCode(label: string) {
  const n = norm(label);
  const isMane = /mane\s+mercado/.test(n);

  if (isMane && /aguas\s+claras/.test(n)) return 'MMAC';
  if (isMane && /\barena\b/.test(n)) return 'MMAR';
  if (isMane && /sao\s+paulo/.test(n)) return 'maneSP';

  if (isMane) {
    const parts = n.split(/\s+/).filter(Boolean);
    const last = parts[parts.length - 1] || '';
    const suf = last.slice(0, 2).toUpperCase();
    return `MM${suf}`;
  }
  return (label || '').replace(/\s+/g, '').slice(0, 4).toUpperCase();
}

/** Sigla de 3 letras para a Área (estilo SDU) */
function areaAcronym(s: string) {
  const parts = norm(s)
    .replace(/—|-/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  const a = (parts[0][0] || '').toUpperCase();
  const b = (parts[1][0] || parts[parts.length - 1][0] || '').toUpperCase();
  const c = (parts[2]?.[0] || '').toUpperCase();
  return (a + b + c).slice(0, 3);
}

/** Formata CPF (com privacidade) */
function fmtCPF(v?: string | null) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length !== 11) return '—';
  // máscara LGPD: 000.***.***-00
  return `${d.slice(0, 3)}.***.***-${d.slice(9, 11)}`;
}

export default function BoardingPass({
  code,
  qrUrl,
  unitLabel,
  areaName,
  dateStr,
  timeStr,
  people,
  kids = 0,
  fullName = '',
  cpf,
  emailHint,
  hideHeader = false,
}: Props) {
  const OUT_BG = '#FBF5E9'; // fundo externo (para “vazar” nos recortes)

  const unitAcr = unitCode(unitLabel);
  const areaAcr = areaAcronym(areaName);

  return (
    <Card withBorder radius="lg" p="lg" shadow="md" mt="sm" style={{ background: OUT_BG }}>
      <Stack gap="xs" align="center">
        {!hideHeader && (
          <>
            {/* Cabeçalho visual */}
            <Box
              aria-hidden
              style={{
                width: 64,
                height: 64,
                borderRadius: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '3px solid var(--mantine-color-green-5)',
                background: '#EFFFF3',
              }}
            >
              <IconQrcode size={34} color="var(--mantine-color-green-6)" />
            </Box>

            <Title order={3} mt="sm" ta="center" fw={700}>
              Reserva criada!
            </Title>

            {/* Localizador */}
            <Group gap={8} mt={4}>
              <Text c="dimmed">Localizador:</Text>
              <Badge color="green" size="lg" radius="sm" variant="filled" style={{ letterSpacing: 2 }}>
                {code}
              </Badge>
            </Group>

            {/* Aviso de e-mail */}
            <Text size="sm" ta="center">
              Enviamos o <b>código de reserva</b> e o <b>link de consulta</b> para seu e-mail
              {emailHint ? ` (${emailHint})` : ''}.
            </Text>

            <Divider my="md" w="100%" />
          </>
        )}

        {/* ===== Cartão estilo boarding pass ===== */}
        <Card
          withBorder
          radius="md"
          p="md"
          style={{
            width: '100%',
            background: '#fff',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* --- ENTALHES LATERAIS --- */}
          <Box aria-hidden style={{ position: 'absolute', top: 'calc(50% - 14px)', left: -3, width: 18, height: 28, background: OUT_BG, zIndex: 2 }} />
          <Box aria-hidden style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: -12, width: 24, height: 24, borderRadius: '50%', background: OUT_BG, boxShadow: 'inset 0 0 0 2px #e3e3e3', zIndex: 3 }} />
          <Box aria-hidden style={{ position: 'absolute', top: 'calc(50% - 14px)', right: -3, width: 18, height: 28, background: OUT_BG, zIndex: 2 }} />
          <Box aria-hidden style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: -12, width: 24, height: 24, borderRadius: '50%', background: OUT_BG, boxShadow: 'inset 0 0 0 2px #e3e3e3', zIndex: 3 }} />

          {/* Topo: Data à ESQUERDA, Horário à DIREITA */}
          <Box
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: rem(8),
              gap: 12,
            }}
          >
            <Box>
              <Group gap={6} align="center">
                <IconCalendar size={14} />
                <Text size="xs" c="dimmed">Data</Text>
              </Group>
              <Text fw={700}>{dateStr}</Text>
            </Box>

            <Box style={{ textAlign: 'right' }}>
              <Group gap={6} justify="right" align="center">
                <IconClockHour4 size={14} />
                <Text size="xs" c="dimmed">Horário</Text>
              </Group>
              <Text fw={700}>{timeStr}</Text>
            </Box>
          </Box>

          {/* Nome / CPF */}
          <Box style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: rem(2), marginBottom: rem(6) }}>
            <Box style={{ flex: 1 }}>
              <Group gap={6} align="center">
                <IconUser size={14} />
                <Text size="xs" c="dimmed">Nome</Text>
              </Group>
              <Text fw={600}>{fullName || '—'}</Text>
            </Box>
            <Box style={{ flex: 1, textAlign: 'right' }}>
              <Group gap={6} justify="right" align="center">
                <IconId size={14} />
                <Text size="xs" c="dimmed">CPF</Text>
              </Group>
              <Text fw={600}>{fmtCPF(cpf)}</Text>
            </Box>
          </Box>

          {/* Faixa principal com códigos */}
          <Box
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 16,
              marginTop: rem(4),
              marginBottom: rem(8),
            }}
          >
            <Box style={{ flex: 1, textAlign: 'left' }}>
              <Title
                order={1}
                style={{
                  fontSize: rem(40),
                  lineHeight: 1,
                  letterSpacing: 1,
                  margin: 0,
                  padding: 0,
                  display: 'inline-block',
                }}
              >
                {unitAcr}
              </Title>

              <Group gap={6} mt={2} align="center" wrap="nowrap" style={{ minWidth: 0, maxWidth: '100%' }}>
                <IconBuildingStore size={14} />
                <Text
                  size="xs"
                  c="dimmed"
                  style={{
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'block',
                    maxWidth: '100%',
                  }}
                  title={unitLabel} // mostra tooltip completo ao passar o mouse
                >
                  {unitLabel}
                </Text>
              </Group>
            </Box>

            <Box style={{ flex: 1, textAlign: 'right' }}>
              <Title
                order={1}
                style={{
                  fontSize: rem(40),
                  lineHeight: 1,
                  letterSpacing: 1,
                  margin: 0,
                  padding: 0,
                  display: 'inline-block',
                }}
              >
                {areaAcr}
              </Title>

              <Group gap={6} mt={2} justify="right">
                <IconMapPin size={14} />
                <Text size="xs" c="dimmed" style={{ marginTop: 2 }}>
                  {areaName}
                </Text>
              </Group>
            </Box>
          </Box>

          <Divider my={6} />

          {/* Linha de detalhes */}
          <Box
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
              paddingInline: 8,
              marginTop: rem(6),
              marginBottom: rem(6),
            }}
          >
            <Box style={{ width: '50%', textAlign: 'center' }}>
              <Group gap={6} justify="center" align="center">
                <IconUsers size={14} />
                <Text size="xs" c="dimmed">Pessoas</Text>
              </Group>
              <Text fw={700} style={{ color: '#111', marginTop: 2, lineHeight: 1 }}>
                {people}
              </Text>
            </Box>

            <Box style={{ width: '50%', textAlign: 'center' }}>
              <Group gap={6} justify="center" align="center">
                <IconMoodKid size={14} />   {/* ← aqui */}
                <Text size="xs" c="dimmed">Crianças</Text>
              </Group>

              <Text fw={700} style={{ color: '#111', marginTop: 2, lineHeight: 1 }}>
                {kids}
              </Text>
            </Box>
          </Box>

          {/* Faixa de furinhos */}
          <Box style={{ position: 'relative', marginTop: rem(6), marginBottom: rem(10) }}>
            <Box aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 16, background: '#fff', zIndex: 2 }} />
            <Box aria-hidden style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 16, background: '#fff', zIndex: 2 }} />
            <Box
              aria-hidden
              style={{
                width: '100%',
                height: 14,
                backgroundImage: 'radial-gradient(circle, #d0d0d0 4px, rgba(0,0,0,0) 4.8px)',
                backgroundSize: '20px 14px',
                backgroundRepeat: 'repeat-x',
                backgroundPosition: 'center',
                filter: 'drop-shadow(0 1px 0 rgba(0,0,0,.04))',
              }}
            />
          </Box>

          {/* QR central */}
          <Box style={{ display: 'flex', justifyContent: 'center', paddingBottom: rem(6) }}>
            <img
              src={`${qrUrl}?t=${Date.now()}`}
              alt="QR de check-in"
              width={168}
              height={168}
              style={{
                display: 'block',
                width: 168,
                height: 168,
                objectFit: 'contain',
                borderRadius: 8,
                background: 'transparent',
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          </Box>
        </Card>

        {/* rodapé curto somente quando header está visível */}
        {!hideHeader && (
          <Text size="xs" c="dimmed" ta="center" mt="sm" style={{ maxWidth: rem(460) }}>
            Guarde o localizador <b>{code}</b>. Você pode usá-lo para buscar sua reserva rapidamente.
          </Text>
        )}
      </Stack>
    </Card>
  );
}
