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

  const resLabel = reservationTypeLabel(reservationType);

  return (
    <>
      <Card radius="lg" p={0} shadow="md" mt="sm" style={{ background: '#034c46', overflow: 'hidden' }}>
        {/* Header verde */}
        <Box py={16} px="md" style={{ textAlign: 'center' as const }}>
          <Text size="xs" c="rgba(243,233,217,0.5)" fw={500}>Reserva confirmada</Text>
          <Text c="#F3E9D9" fw={700} mt={4} style={{ fontFamily: 'var(--font-merri), Merriweather, serif', fontSize: 'clamp(1rem, 4vw, 1.3rem)' }}>
            {fullName || 'Sua mesa está garantida'}
          </Text>
          <Group gap={8} mt={8} justify="center">
            <Badge color="rgba(255,255,255,0.15)" c="#F7C85A" variant="filled" size="sm" radius="sm" style={{ letterSpacing: 1.5, fontWeight: 800 }}>
              {code}
            </Badge>
          </Group>
          {emailHint && (
            <Text size="10px" c="rgba(243,233,217,0.35)" mt={6}>
              Código enviado para {emailHint}
            </Text>
          )}
        </Box>

        {/* Card branco interno */}
        <Box mx={10} mb={10} style={{ borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
          {/* Data + Hora + Local — as 3 infos essenciais */}
          <Box p="md">
            <Group justify="space-between" align="flex-start" mb={12}>
              <Box>
                <Text size="10px" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.04em' }}>Quando</Text>
                <Text fw={700} size="md" c="#111" mt={2}>{dateStr} às {timeStr}</Text>
              </Box>
              <Box style={{ textAlign: 'right' as const }}>
                <Text size="10px" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.04em' }}>Pessoas</Text>
                <Text fw={700} size="md" c="#111" mt={2}>{people}{kids > 0 ? ` + ${kids} criança${kids > 1 ? 's' : ''}` : ''}</Text>
              </Box>
            </Group>

            <Box py={10} style={{ borderTop: '1px solid rgba(0,0,0,0.05)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <Group gap={6} align="center">
                <IconMapPin size={16} color="#034c46" />
                <Box>
                  <Text size="sm" fw={700} c="#034c46">{unitLabel}</Text>
                  <Text size="xs" c="dimmed">{areaName}{resLabel ? ` • ${resLabel}` : ''}</Text>
                </Box>
              </Group>
            </Box>

            {/* Tolerância — uma linha simples */}
            <Text size="xs" c="dimmed" ta="center" mt={10}>
              Tolerância de 15 min • Convidados podem chegar até 45 min após
            </Text>
          </Box>

          {/* QR centralizado */}
          <Box py="md" style={{ textAlign: 'center' as const, background: '#fafafa' }}>
            <Box
              style={{
                display: 'inline-block',
                padding: 8,
                background: '#fff',
                borderRadius: 12,
                border: '2px solid #034c46',
                boxShadow: '0 4px 12px rgba(0,0,0,.06)',
              }}
            >
              <img
                src={`${qrUrl}?t=${Date.now()}`}
                alt="QR de check-in"
                width={160}
                height={160}
                style={{
                  display: 'block',
                  width: 'clamp(130px, 40vw, 170px)',
                  height: 'clamp(130px, 40vw, 170px)',
                  objectFit: 'contain',
                  borderRadius: 6,
                }}
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </Box>
            <Text size="10px" c="dimmed" mt={6}>Apresente na entrada</Text>
          </Box>
        </Box>
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
