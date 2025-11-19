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
  IconClock,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';

type Props = {
  id: string;
  code: string;
  qrUrl: string;
  unitLabel: string;
  areaName: string;
  dateStr: string; // DD/MM/YYYY
  timeStr: string; // HH:mm
  people: number;
  kids?: number;
  fullName?: string;
  cpf?: string | null;
  emailHint?: string | null;
  /** quando true, esconde o cabeçalho ("Reserva criada", Localizador e aviso de e-mail) */
  hideHeader?: boolean;
  /** Tipo de reserva vindo da API: 'PARTICULAR', 'CONFRATERNIZACAO', etc. */
  reservationType?: string | null;
};

/** remove acentos e baixa */
function norm(s: string) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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
  const parts = norm(s).replace(/—|-/g, ' ').split(/\s+/).filter(Boolean);
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

/** Parse DD/MM/YYYY + HH:mm para Date local (sem libs) */
function parsePtDateTime(dateStr: string, timeStr: string) {
  const [d, m, y] = (dateStr || '').split('/').map((v) => parseInt(v, 10));
  const [hh, mm] = (timeStr || '').split(':').map((v) => parseInt(v, 10));
  if (!y || !m || !d || isNaN(hh) || isNaN(mm)) return null;
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

/** Soma minutos a um Date retornando novo Date */
function addMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60_000);
}

/** Formata ms em D HH:MM:SS (omitindo D quando zero) */
function fmtCountdown(ms: number) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  const base = `${hh}h ${mm}m ${ss}s`;
  return days > 0 ? `${days}d ${base}` : base;
}

/** Badge de status para cada prazo */
function statusLabel(remainingMs: number, labelWhenOk = 'ativo', labelWhenZero = 'encerrado') {
  return remainingMs > 0 ? labelWhenOk : labelWhenZero;
}

/** Label amigável para o tipo de reserva */
function reservationTypeLabel(raw?: string | null) {
  if (!raw) return null;
  const x = String(raw)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toUpperCase();

  if (['CONFRATERNIZACAO', 'CONFRATERNIZACAO/GRUPO', 'CONFRATERNIZACAO '].includes(x)) return 'Confraternização';
  if (['EMPRESA', 'CORPORATIVO', 'CORPORATE'].includes(x)) return 'Empresa';
  if (['PARTICULAR', 'PESSOAL', 'PRIVADO'].includes(x)) return 'Particular';
  if (['ANIVERSARIO', 'NIVER', 'BIRTHDAY'].includes(x)) return 'Aniversário';
  return raw; // fallback
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
  reservationType = null,
}: Props) {
  const OUT_BG = '#FBF5E9'; // fundo externo

  const unitAcr = unitCode(unitLabel);
  const areaAcr = areaAcronym(areaName);

  /** === Countdown setup === */
  const reservationAt = useMemo(() => parsePtDateTime(dateStr, timeStr), [dateStr, timeStr]);
  const tolerance15At = useMemo(
    () => (reservationAt ? addMinutes(reservationAt, 15) : null),
    [reservationAt]
  );
  const guests45At = useMemo(
    () => (reservationAt ? addMinutes(reservationAt, 45) : null),
    [reservationAt]
  );

  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const msToReservation = reservationAt ? reservationAt.getTime() - now : 0;
  const msToTolerance15 = tolerance15At ? tolerance15At.getTime() - now : 0;
  const msToGuests45 = guests45At ? guests45At.getTime() - now : 0;

  // cor do topo: antes do horário = verde/azul, depois = vermelho
  const topBarColor = msToReservation > 0 ? '#0ca678' : '#e03131';
  const topBarLabel =
    msToReservation > 0
      ? `Falta ${fmtCountdown(msToReservation)} para sua reserva`
      : `Sua reserva é agora (${timeStr})`;

  return (
    <>
      {/* ====== TOPO COM TIMER ====== */}
      {reservationAt && (
        <Box
          className="bp-topbar"
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 10,
            background: topBarColor,
            color: '#fff',
            borderRadius: 14,
            padding: '8px 14px',
            marginBottom: rem(10),
            textAlign: 'center',
          }}
        >
          <IconClock size={16} stroke={1.6} />
          <Text fw={600} style={{ fontVariantNumeric: 'tabular-nums', fontSize: 'clamp(12px, 2.8vw, 14px)' }}>
            {topBarLabel}
          </Text>

          {/* mostra a tolerância também */}
          <Badge color="white" variant="outline" size="xs">
            {msToTolerance15 > 0 ? `Tolerância até ${fmtCountdown(msToTolerance15)}` : 'Tolerância encerrada'}
          </Badge>
        </Box>
      )}

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

              <Title order={3} mt="sm" ta="center" fw={700} style={{ fontSize: 'clamp(18px, 6vw, 28px)' }}>
                Reserva criada!
              </Title>

              {/* Localizador */}
              <Group gap={8} mt={4} wrap="wrap" justify="center">
                <Text c="dimmed" style={{ fontSize: 'clamp(12px, 3.4vw, 14px)' }}>Localizador:</Text>
                <Badge color="green" size="lg" radius="sm" variant="filled" style={{ letterSpacing: 2 }}>
                  {code}
                </Badge>
              </Group>

              {/* Aviso de e-mail */}
              <Text size="sm" ta="center" style={{ fontSize: 'clamp(12px, 3.6vw, 14px)' }}>
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
            className="bp-card"
            style={{
              width: '100%',
              background: '#fff',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* ENTALHES LATERAIS */}
            <Box aria-hidden style={{ position: 'absolute', top: 'calc(50% - 14px)', left: -3, width: 18, height: 28, background: OUT_BG, zIndex: 2 }} />
            <Box
              aria-hidden
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                left: -12,
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: OUT_BG,
                boxShadow: 'inset 0 0 0 2px #e3e3e3',
                zIndex: 3,
              }}
            />
            <Box aria-hidden style={{ position: 'absolute', top: 'calc(50% - 14px)', right: -3, width: 18, height: 28, background: OUT_BG, zIndex: 2 }} />
            <Box
              aria-hidden
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                right: -12,
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: OUT_BG,
                boxShadow: 'inset 0 0 0 2px #e3e3e3',
                zIndex: 3,
              }}
            />

            {/* Topo: Data / Horário */}
            <Box
              className="bp-toprow"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                alignItems: 'start',
                gap: 12,
                marginBottom: rem(8),
              }}
            >
              <Box>
                <Group gap={6} align="center">
                  <IconCalendar size={14} />
                  <Text size="xs" c="dimmed">Data</Text>
                </Group>
                <Text fw={700} style={{ fontSize: 'clamp(14px, 4.8vw, 16px)' }}>{dateStr}</Text>
              </Box>

              <Box style={{ textAlign: 'right' }}>
                <Group gap={6} justify="right" align="center">
                  <IconClockHour4 size={14} />
                  <Text size="xs" c="dimmed">Horário</Text>
                </Group>
                <Text fw={700} style={{ fontSize: 'clamp(14px, 4.8vw, 16px)' }}>{timeStr}</Text>
              </Box>
            </Box>

            {/* ====== FAIXA DE COUNTDOWN ====== */}
            {reservationAt && (
              <Box
                className="bp-countdown"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  border: '1px dashed var(--mantine-color-gray-4)',
                  borderRadius: 10,
                  padding: '8px 10px',
                  marginBottom: rem(10),
                  background: '#FCFEFF',
                }}
              >
                {/* Tolerância +15 */}
                <Box style={{ textAlign: 'center', minWidth: 0 }}>
                  <Text size="xs" c="dimmed">Tolerância (+15 min)</Text>
                  <Text fw={800} style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: 0.4, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 'clamp(12px, 3.6vw, 15px)' }}>
                    {fmtCountdown(msToTolerance15)}
                  </Text>
                  <Badge size="xs" color={msToTolerance15 > 0 ? 'green' : 'red'} variant="light">
                    {statusLabel(msToTolerance15, 'válida', 'encerrada')}
                  </Badge>
                </Box>

                {/* Convidados +45 */}
                <Box style={{ textAlign: 'center', minWidth: 0 }}>
                  <Text size="xs" c="dimmed">Convidados (+45 min)</Text>
                  <Text fw={800} style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: 0.4, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 'clamp(12px, 3.6vw, 15px)' }}>
                    {fmtCountdown(msToGuests45)}
                  </Text>
                  <Badge size="xs" color={msToGuests45 > 0 ? 'teal' : 'gray'} variant="light">
                    {statusLabel(msToGuests45, 'aberto', 'fechado')}
                  </Badge>
                </Box>
              </Box>
            )}

            {/* Nome / CPF */}
            <Box
              className="bp-namerow"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
                marginTop: rem(2),
                marginBottom: rem(6),
              }}
            >
              <Box style={{ minWidth: 0 }}>
                <Group gap={6} align="center">
                  <IconUser size={14} />
                  <Text size="xs" c="dimmed">Nome</Text>
                </Group>
                <Text fw={600} style={{ fontSize: 'clamp(14px, 4.6vw, 16px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fullName || '—'}
                </Text>
              </Box>
              <Box style={{ textAlign: 'right', minWidth: 0 }}>
                <Group gap={6} justify="right" align="center">
                  <IconId size={14} />
                  <Text size="xs" c="dimmed">CPF</Text>
                </Group>
                <Text fw={600} style={{ fontSize: 'clamp(14px, 4.6vw, 16px)' }}>{fmtCPF(cpf)}</Text>
              </Box>
            </Box>

            {/* Faixa principal com códigos */}
            <Box
              className="bp-coderow"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                alignItems: 'baseline',
                gap: 10,
                marginTop: rem(2),
                marginBottom: rem(6),
              }}
            >
              <Box style={{ textAlign: 'left', minWidth: 0 }}>
                <Title order={1} style={{ fontSize: 'clamp(16px, 7vw, 22px)', lineHeight: 1.05, letterSpacing: 0.5, margin: 0, padding: 0, display: 'inline-block', fontWeight: 700 }}>
                  {unitAcr}
                </Title>

                <Group gap={6} mt={2} align="center" wrap="nowrap" style={{ minWidth: 0, maxWidth: '100%' }}>
                  <IconBuildingStore size={14} />
                  <Text size="xs" c="dimmed" style={{ marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: '100%' }} title={unitLabel}>
                    {unitLabel}
                  </Text>
                </Group>
              </Box>

              <Box style={{ textAlign: 'right', minWidth: 0 }}>
                <Title order={1} style={{ fontSize: 'clamp(16px, 7vw, 22px)', lineHeight: 1.05, letterSpacing: 0.5, margin: 0, padding: 0, display: 'inline-block', fontWeight: 700 }}>
                  {areaAcr}
                </Title>

                <Group gap={6} mt={2} justify="right" wrap="nowrap" style={{ minWidth: 0, maxWidth: '100%' }}>
                  <IconMapPin size={14} />
                  <Text size="xs" c="dimmed" style={{ marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: '100%' }} title={areaName}>
                    {areaName}
                  </Text>
                </Group>
              </Box>
            </Box>

            <Divider my={6} />

            {/* Linha de detalhes */}
            <Box
              className="bp-detailsrow"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
                paddingInline: 8,
                marginTop: rem(6),
                marginBottom: rem(6),
              }}
            >
              <Box style={{ textAlign: 'center' }}>
                <Group gap={6} justify="center" align="center">
                  <IconUsers size={14} />
                  <Text size="xs" c="dimmed">Pessoas</Text>
                </Group>
                <Text fw={700} style={{ color: '#111', marginTop: 2, lineHeight: 1, fontSize: 'clamp(16px, 5vw, 18px)' }}>
                  {people}
                </Text>
              </Box>

              <Box style={{ textAlign: 'center' }}>
                <Group gap={6} justify="center" align="center">
                  <IconMoodKid size={14} />
                  <Text size="xs" c="dimmed">Crianças</Text>
                </Group>
                <Text fw={700} style={{ color: '#111', marginTop: 2, lineHeight: 1, fontSize: 'clamp(16px, 5vw, 18px)' }}>
                  {kids}
                </Text>
              </Box>
            </Box>

            {/* Tipo de Reserva (sempre ANTES dos furinhos/QR) */}
            {!!reservationTypeLabel(reservationType) && (
              <Box
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: 8,
                  paddingInline: 8,
                  marginTop: rem(6),
                  marginBottom: rem(6),
                }}
              >
                <Box style={{ textAlign: 'center' }}>
                  <Text size="xs" c="dimmed">Tipo de Reserva</Text>
                  <Text fw={700} style={{ color: '#111', marginTop: 2, lineHeight: 1, fontSize: 'clamp(16px, 5vw, 18px)' }}>
                    {reservationTypeLabel(reservationType)}
                  </Text>
                </Box>
              </Box>
            )}

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

            {/* QR central (abaixo, separado e com legenda) */}
            <Divider my={10} />

            <Stack align="center" gap={6} mt={4} mb={4}>
              <Box
                style={{
                  padding: 10,
                  background: '#ffffff',
                  borderRadius: 12,
                  border: '2px solid #146C2E',
                  boxShadow: '0 8px 20px rgba(0,0,0,.08)',
                }}
              >
                <img
                  src={`${qrUrl}?t=${Date.now()}`}
                  alt="QR de check-in"
                  width={188}
                  height={188}
                  style={{
                    display: 'block',
                    width: 'clamp(148px, 48vw, 200px)',
                    height: 'clamp(148px, 48vw, 200px)',
                    objectFit: 'contain',
                    background: 'transparent',
                    borderRadius: 8,
                  }}
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              </Box>
              <Text size="xs" c="dimmed">Apresente este QR no check-in</Text>
            </Stack>
          </Card>

          {/* rodapé curto somente quando header está visível */}
          {!hideHeader && (
            <Text size="xs" c="dimmed" ta="center" mt="sm" style={{ maxWidth: rem(520), fontSize: 'clamp(12px, 3.4vw, 14px)' }}>
              Guarde o localizador <b>{code}</b>. Você pode usá-lo para buscar sua reserva rapidamente.
            </Text>
          )}
        </Stack>
      </Card>

      {/* CSS responsivo local */}
      <style jsx>{`
        /* Quebra para telas pequenas */
        @media (max-width: 480px) {
          .bp-toprow { grid-template-columns: 1fr; row-gap: 8px; }
          .bp-toprow > :global(div:last-child) { text-align: left !important; }
          .bp-countdown { grid-template-columns: 1fr; }
          .bp-namerow { grid-template-columns: 1fr; }
          .bp-namerow > :global(div:last-child) { text-align: left !important; }
          .bp-coderow { grid-template-columns: 1fr; row-gap: 10px; }
          .bp-detailsrow { grid-template-columns: 1fr 1fr; }
          .bp-card { padding: 12px !important; }
          .bp-topbar { padding: 8px 10px !important; }
        }

        /* Telas muito estreitas (<360px): força 1 coluna nos detalhes também */
        @media (max-width: 360px) {
          .bp-detailsrow { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}
