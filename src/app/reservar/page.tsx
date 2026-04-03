'use client';

import type React from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { DatesProvider, DatePickerInput } from '@mantine/dates';
import {
  Popover,
  TextInput,
  UnstyledButton,
  SimpleGrid,
  Container,
  Group,
  Button,
  Title,
  Text,
  Card,
  Grid,
  Alert,
  Select,
  NumberInput,
  Stack,
  Box,
  rem,
  Skeleton,
  Progress,
  Anchor,
  Badge,
} from '@mantine/core';
import { IconChevronDown, IconArrowLeft } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import BoardingPass from './BoardingPass';
import Link from 'next/link';
import {
  ensureAnalyticsReady,
  setActiveUnitPixelFromUnit,
  trackReservationMade,
} from '@/lib/analytics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconCalendar,
  IconClockHour4,
  IconInfoCircle,
  IconMapPin,
  IconUser,
  IconBuildingStore,
  IconUsers,
  IconMoodKid,
  IconMail,
  IconPhone,
} from '@tabler/icons-react';
import NextImage from 'next/image';
import { apiGet, API_BASE } from '@/lib/api';

dayjs.locale('pt-br');

// ====== Configs
const MAX_PEOPLE_WITHOUT_CONCIERGE = 40;
const MIN_PEOPLE = 2;

// Concierge por unidade
const CONCIERGE_PHONE_AC = '61999312284'; // 61 99931-2284
const CONCIERGE_PHONE_BSB = '61982850776'; // 61 98285-0776

function formatBrPhonePretty(digits: string) {
  const d = digits.replace(/\D+/g, '').slice(0, 11);
  // (61) 99999-9999
  return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
}

function buildConciergeLink(phoneDigits: string) {
  const text = 'Oi Concierge! Quero reservar para mais de 40 pessoas. Pode me ajudar?';
  return `https://wa.me/55${phoneDigits}?text=${encodeURIComponent(text)}`;
}

// Decide qual concierge usar baseado na unidade selecionada
function getConciergePhoneByUnit(unidadeId: string | null, units: UnitOption[]) {
  if (!unidadeId) return CONCIERGE_PHONE_BSB;

  const unitName = (units.find((u) => u.id === unidadeId)?.name || '').toLowerCase();

  // Regras flexíveis (pega "Águas Claras", "aguas claras", "AC", etc)
  const isAC =
    unitName.includes('águas claras') ||
    unitName.includes('aguas claras') ||
    unitName.includes('ac');

  const isBSB =
    unitName.includes('brasília') ||
    unitName.includes('brasilia') ||
    unitName.includes('bsb');

  if (isAC) return CONCIERGE_PHONE_AC;
  if (isBSB) return CONCIERGE_PHONE_BSB;

  // fallback seguro
  return CONCIERGE_PHONE_BSB;
}

// ====== Tipos
type UnitOption = { id: string; name: string; slug?: string };

type AreaOption = {
  id: string;
  name: string;
  description?: string;
  capacity?: number;
  photoUrl?: string;
  available?: number;
  isAvailable?: boolean;
  iconEmoji?: string | null;
};

type AreaMeta = {
  id: string;
  name: string;
  description?: string;
  iconEmoji?: string | null;
  photoUrl?: string | null;
};

type ReservationType = 'ANIVERSARIO' | 'PARTICULAR' | 'CONFRATERNIZACAO' | 'EMPRESA';

const RES_TYPE_LABEL: Record<ReservationType, string> = {
  ANIVERSARIO: 'Aniversário',
  PARTICULAR: 'Particular',
  CONFRATERNIZACAO: 'Confraternização',
  EMPRESA: 'Empresa',
};

type ReservationDto = {
  id: string;
  reservationCode: string;
  unitId: string;
  unit: string;
  areaId: string;
  areaName: string;
  reservationDate: string; // ISO
  people: number;
  kids: number | null;
  fullName: string | null;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  status: 'AWAITING_CHECKIN' | 'CHECKED_IN' | string;
  reservationType?: ReservationType | string | null;
};

type SavedReservationLS = {
  id: string;
  code: string;
  qrUrl: string;
  unitLabel: string;
  areaName: string;
  dateStr: string;
  timeStr: string;
  people: number;
  kids?: number;
  fullName?: string;
  cpf?: string | null;
  emailHint?: string | null;
  reservationType?: ReservationType;
};

const LS_KEY = 'mane:lastReservation';

// ====== Helpers
const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?q=80&w=1600&auto=format&fit=crop';

const onlyDigits = (s: string) => s.replace(/\D+/g, '');
function maskCPF(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 9);
  const p4 = d.slice(9, 11);
  return [p1, p2 && `.${p2}`, p3 && `.${p3}`, p4 && `-${p4}`].filter(Boolean).join('');
}
function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}
function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
function isValidPhone(v: string) {
  const digits = onlyDigits(v);
  return digits.length === 10 || digits.length === 11;
}
function joinDateTimeISO(date: Date | null, time: string) {
  if (!date || !time) return null;
  const [hh, mm] = time.split(':').map(Number);
  const dt = dayjs(date).hour(hh || 0).minute(mm || 0).second(0).millisecond(0).toDate();
  return dt.toISOString();
}

// slots válidos — 11h às 22h, intervalos de 30min
const ALLOWED_SLOTS = (() => {
  const s: string[] = [];
  for (let h = 12; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 22 && m > 0) break;
      s.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return s;
})();
function isValidSlot(v: string) {
  return ALLOWED_SLOTS.includes(v);
}
const SLOT_ERROR_MSG = 'Escolha um horário válido da lista';

// janela de horário
// Usamos meio-dia para evitar problema de fuso (dia voltando 1)
const TODAY_START = dayjs().startOf('day').add(12, 'hour').toDate();
const TOMORROW_START = dayjs().add(1, 'day').startOf('day').add(12, 'hour').toDate();
const OPEN_H = 12,
  OPEN_M = 0,
  CLOSE_H = 22,
  CLOSE_M = 0;
function isTimeOutsideWindow(hhmm: string) {
  if (!hhmm) return false;
  const [hh, mm] = hhmm.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return false;
  if (hh < OPEN_H) return true;
  if (hh === OPEN_H && mm < OPEN_M) return true;
  if (hh > CLOSE_H) return true;
  if (hh === CLOSE_H && mm > CLOSE_M) return true;
  return false;
}
function timeWindowMessage() {
  return `Horário disponível entre ${String(OPEN_H).padStart(2, '0')}:${String(
    OPEN_M
  ).padStart(2, '0')} e ${String(CLOSE_H).padStart(2, '0')}:${String(CLOSE_M).padStart(2, '0')}`;
}

// regra: data/hora no passado
function isPastSelection(date: Date | null, time: string) {
  if (!date || !time) return false;
  const [hh, mm] = time.split(':').map(Number);
  const when = dayjs(date).hour(hh || 0).minute(mm || 0).second(0).millisecond(0);
  return when.isBefore(dayjs());
}

// reserva mesmo dia: permitida desde que o horário seja futuro
const ONE_DAY_AHEAD_MSG = ''; // não mais usado
function isSameDayAsToday(d: Date | null) {
  return !!d && dayjs(d).isSame(dayjs(), 'day');
}

// NumberInput
const numberInputHandler =
  (setter: React.Dispatch<React.SetStateAction<number | ''>>) =>
  (v: string | number) =>
    setter(v === '' ? '' : Number(v));

// ====== Imagens
const S3_BASE = 'https://mane-reservations-prod.s3.amazonaws.com';
const ASSET_BASE = (API_BASE || '').replace(/\/+$/, '');

function sanitizePhoto(raw?: any): string | undefined {
  if (raw == null) return undefined;
  const value =
    typeof raw === 'object' && 'url' in (raw as any)
      ? String((raw as any).url ?? '')
      : String(raw);
  const r = value.trim();
  if (!r || r === 'null' || r === 'undefined' || r === '[object Object]') return undefined;
  return r;
}

function toHttps(u: string) {
  try {
    const url = new URL(u);
    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      url.protocol === 'http:'
    ) {
      url.protocol = 'https:';
      return url.toString();
    }
  } catch {
    // não era absoluta
  }
  return u;
}

function toS3Url(raw?: any): string | undefined {
  let s = sanitizePhoto(raw);
  if (!s) return undefined;
  s = s.replace(/\\/g, '/').trim();
  if (s.startsWith('//')) return `https:${s}`;
  if (/^https?:\/\//i.test(s) || s.startsWith('data:')) return toHttps(s);
  const path = s.startsWith('/') ? s : `/${s}`;
  return `${S3_BASE}${path}`;
}

// ====== Loading overlay
function LoadingOverlay({ visible }: { visible: boolean }) {
  const msgs = useRef([
    'Verificando disponibilidade...',
    'Escolhendo setor...',
    'Encontrando lugares...',
    'Gerando QR Code...',
    'Finalizando reserva...',
  ]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % msgs.current.length), 1300);
    return () => clearInterval(t);
  }, [visible]);

  if (!visible) return null;

  return (
    <Box
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(3px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <Card shadow="md" radius={24} withBorder p="xl" style={{ textAlign: 'center', width: 320 }}>
        <Box
          aria-hidden
          style={{
            width: 56,
            height: 56,
            borderRadius: '9999px',
            margin: '0 auto 12px',
            border: '4px solid #E5F7EC',
            borderTopColor: '#0e7a7f',
            animation: 'spin 0.9s linear infinite',
          }}
        />
        <Title order={4} fw={400} mb={4}>
          Efetuando sua reserva
        </Title>
        <Text size="sm" c="dimmed">
          {msgs.current[idx]}
        </Text>
      </Card>
      <style jsx global>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </Box>
  );
}

// ====== Skeleton
function StepSkeleton() {
  return (
    <Stack mt="xs" gap="md">
      <Card withBorder radius={24} shadow="sm" p="md" style={{ background: '#fff' }}>
        <Stack gap="md">
          <Skeleton height={44} radius="md" />
          <Grid gutter="md">
            <Grid.Col span={6}>
              <Skeleton height={44} radius="md" />
            </Grid.Col>
            <Grid.Col span={6}>
              <Skeleton height={44} radius="md" />
            </Grid.Col>
          </Grid>
          <Grid gutter="md">
            <Grid.Col span={6}>
              <Skeleton height={48} radius="md" />
            </Grid.Col>
            <Grid.Col span={6}>
              <Skeleton height={48} radius="md" />
            </Grid.Col>
          </Grid>
          <Skeleton height={36} radius="md" />
        </Stack>
      </Card>
      <Skeleton height={40} radius="md" />
    </Stack>
  );
}

// ====== Ícone da etapa
function stepIconFor(n: number) {
  if (n === 2) return <IconMapPin size={28} />;
  if (n === 3) return <IconUser size={28} />;
  return <IconCalendar size={28} />;
}

// ====== AreaCard
function AreaCard({
  foto,
  titulo,
  desc,
  icon,
  selected,
  onSelect,
  disabled,
  remaining,
}: {
  foto: string;
  titulo: string;
  desc?: string;
  icon?: string | null;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  remaining?: number;
}) {
  const [src, setSrc] = useState(foto || FALLBACK_IMG);
  useEffect(() => {
    setSrc(foto || FALLBACK_IMG);
  }, [foto]);

  const LOW_STOCK_THRESHOLD = 8;
  const showLowStock =
    !disabled && typeof remaining === 'number' && remaining > 0 && remaining <= LOW_STOCK_THRESHOLD;
  const veryLow = typeof remaining === 'number' && remaining <= 3 && remaining > 0 && !disabled;

  return (
    <Card
      withBorder
      radius={24}
      p={0}
      onClick={() => !disabled && onSelect()}
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        overflow: 'hidden',
        borderRadius: 24,
        borderColor: selected ? '#0e7a7f' : 'transparent',
        boxShadow: selected ? '0 8px 32px rgba(14,122,127,.15)' : '0 8px 32px rgba(0,0,0,.06)',
        transition: 'transform .15s ease',
        background: disabled ? '#F4F4F4' : '#fff',
        opacity: disabled ? 0.7 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <Box
        style={{
          position: 'relative',
          height: 'clamp(120px, 32vw, 160px)',
          background: '#f2f2f2',
        }}
      >
        <NextImage
          src={src}
          alt={titulo}
          fill
          sizes="(max-width: 520px) 100vw, 520px"
          style={{ objectFit: 'cover', objectPosition: 'center center' }}
          onError={() => setSrc(FALLBACK_IMG)}
          priority={false}
          unoptimized
          referrerPolicy="no-referrer"
        />

        <Box
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,.45) 100%)',
          }}
        />

        {selected && !disabled && (
          <Badge
            color="green"
            variant="filled"
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              fontWeight: 700,
              boxShadow: '0 6px 18px rgba(0,0,0,.25)',
            }}
          >
            Selecionada
          </Badge>
        )}

        {disabled && (
          <Badge
            color="red"
            variant="filled"
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              fontWeight: 800,
              boxShadow: '0 6px 18px rgba(0,0,0,.25)',
            }}
          >
            ESGOTADO
          </Badge>
        )}

        {showLowStock && (
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              right: 10,
              background: veryLow ? '#D94030' : 'rgba(255,255,255,0.96)',
              color: veryLow ? '#fff' : '#0f5132',
              fontWeight: 800,
              fontSize: 'clamp(11px, 3.2vw, 13px)',
              padding: '5px 10px',
              borderRadius: 10,
              border: veryLow ? 'none' : '2px solid #0f5132',
              boxShadow: '0 4px 12px rgba(0,0,0,.2)',
              letterSpacing: '.2px',
            }}
          >
            {veryLow ? `Últimas ${remaining} vagas!` : `${remaining} vagas restantes`}
          </div>
        )}
      </Box>

      <Box p="md">
        <Title order={4} style={{ margin: 0, fontSize: 'clamp(16px, 5vw, 20px)' }}>
          {titulo}
        </Title>

        {!!desc && (
          <Text size="sm" c="dimmed" mt={4} style={{ lineHeight: 1.35 }}>
            {desc}
          </Text>
        )}

        {!!icon && (
          <Text mt={6} style={{ fontSize: 24, lineHeight: 1 }}>
            {icon}
          </Text>
        )}
      </Box>
    </Card>
  );
}

// ====== Poster/WhatsApp
function buildWhatsappLink(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

async function loadImage(src: string, cross: boolean = false) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    if (cross) im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

function firstAndLastName(full: string) {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

async function generatePoster({
  fullName,
  unitLabel,
  areaName,
  dateStr,
  timeStr,
  people,
  kids,
  qrUrl,
  logoUrl = '/images/1.png',
}: {
  fullName: string;
  unitLabel: string;
  areaName: string;
  dateStr: string;
  timeStr: string;
  people: number;
  kids: number;
  qrUrl?: string;
  logoUrl?: string;
}) {
  const W = 1080, H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const cx = W / 2;
  const R = 48;

  // Cores da referência
  const tealDark = '#0a4f48';
  const yellow = '#f0c850';
  const darkGreen = '#0b2b2c';
  const cyan = '#8bd8d8';
  const pink = '#e86bab';
  const magenta = '#d44088';
  const red = '#cc3355';
  const hotpink = '#e05580';

  const firstName = (fullName || '').trim().split(/\s+/)[0] || '';

  const dateParts = (dateStr || '').split('/');
  const day = dateParts[0] || '';
  const month = dateParts[1] || '';
  const monthNames: Record<string, string> = { '01': 'JANEIRO', '02': 'FEVEREIRO', '03': 'MARÇO', '04': 'ABRIL', '05': 'MAIO', '06': 'JUNHO', '07': 'JULHO', '08': 'AGOSTO', '09': 'SETEMBRO', '10': 'OUTUBRO', '11': 'NOVEMBRO', '12': 'DEZEMBRO' };
  const monthName = monthNames[month] || month;

  const weekDays = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
  let weekDay = '';
  try {
    const [dd, mm, yy] = (dateStr || '').split('/').map(Number);
    if (dd && mm && yy) weekDay = weekDays[new Date(yy, mm - 1, dd).getDay()] || '';
  } catch {}

  // Proporções baseadas na referência (1080x1080)
  // Banner topo: ~65px | Nome: ~250px | Conteúdo: ~700px | Footer: ~65px
  const bannerH = 65;
  const nameH = 250;
  const footerH = 65;
  const contentY = bannerH + nameH;
  const contentH = H - contentY - footerH;
  const sideW = 80; // laterais ~7.4% da largura

  /* ── Clip arredondado ── */
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, R);
  ctx.clip();

  /* ── 1. Banner amarelo topo ── */
  ctx.fillStyle = yellow;
  ctx.fillRect(0, 0, W, bannerH);
  ctx.fillStyle = tealDark;
  ctx.font = 'italic 700 26px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.fillText('●  Uma nova experiência  ●', cx, bannerH / 2 + 9);

  /* ── 2. Faixa teal com nome ── */
  ctx.fillStyle = tealDark;
  ctx.fillRect(0, bannerH, W, nameH);
  ctx.fillStyle = '#c9a84c';
  let nameFS = 140;
  ctx.font = `italic 700 ${nameFS}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = 'center';
  let nameW = ctx.measureText(firstName).width;
  while (nameW > W - 160 && nameFS > 50) {
    nameFS -= 8;
    ctx.font = `italic 700 ${nameFS}px Georgia, "Times New Roman", serif`;
    nameW = ctx.measureText(firstName).width;
  }
  ctx.fillText(firstName, cx, bannerH + nameH / 2 + nameFS * 0.32);

  /* ── 3. Fundo amarelo do conteúdo ── */
  ctx.fillStyle = yellow;
  ctx.fillRect(0, contentY, W, contentH);

  /* ── 4. Lateral esquerda — losangos teal sobre cyan ── */
  ctx.fillStyle = cyan;
  ctx.fillRect(0, contentY, sideW, contentH);
  const dSize = 40;
  const dSpacing = 54;
  for (let row = 0; row < Math.ceil(contentH / dSpacing) + 1; row++) {
    for (let col = 0; col < 2; col++) {
      const dx = 18 + col * 44;
      const dy = contentY + 30 + row * dSpacing + (col === 1 ? dSpacing / 2 : 0);
      if (dy > contentY + contentH + dSize) continue;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = tealDark;
      ctx.translate(dx, dy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-dSize / 2, -dSize / 2, dSize, dSize);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;

  /* ── 5. Lateral direita — xadrez rosa/vermelho ── */
  const chkS = sideW / 2; // 40px cada quadrado, 2 colunas
  const chkColors = [pink, magenta, red, hotpink];
  for (let row = 0; row < Math.ceil(contentH / chkS) + 1; row++) {
    for (let col = 0; col < 2; col++) {
      const x = W - sideW + col * chkS;
      const y = contentY + row * chkS;
      if (y > contentY + contentH) continue;
      ctx.fillStyle = chkColors[(row * 2 + col) % 4];
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x, y, chkS, chkS);
    }
  }
  ctx.globalAlpha = 1;

  /* ── 6. Conteúdo central ── */
  const innerTop = contentY + 55;

  // Badge da data — verde oliva
  const bdgW = 280, bdgH = 72;
  const bdgX = cx - bdgW / 2, bdgY = innerTop;
  ctx.fillStyle = '#7a9a6e';
  ctx.beginPath(); ctx.roundRect(bdgX, bdgY, bdgW, bdgH, 10); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = '800 50px system-ui, -apple-system, Arial';
  const dayNumW = ctx.measureText(day).width;
  ctx.fillText(day, cx - 32, bdgY + bdgH / 2 + 17);
  ctx.font = '600 30px system-ui, -apple-system, Arial';
  ctx.fillText(`/${monthName}`, cx + dayNumW / 2 + 10, bdgY + bdgH / 2 + 12);

  // Dia da semana
  const line1Y = bdgY + bdgH + 70;
  ctx.fillStyle = darkGreen;
  ctx.font = '900 58px system-ui, -apple-system, Arial';
  ctx.textAlign = 'center';
  ctx.fillText(weekDay, cx, line1Y);

  // "às HH:MM"
  const line2Y = line1Y + 68;
  ctx.font = '900 58px system-ui, -apple-system, Arial';
  ctx.fillText(`às ${timeStr}`, cx, line2Y);

  // Pin de localização (vetor)
  const pinY = line2Y + 70;
  ctx.fillStyle = darkGreen;
  ctx.beginPath();
  ctx.arc(cx, pinY, 22, Math.PI, 0);
  ctx.lineTo(cx, pinY + 32);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = yellow;
  ctx.beginPath();
  ctx.arc(cx, pinY, 8, 0, Math.PI * 2);
  ctx.fill();

  // MANÉ MERCADO
  const maneY = pinY + 78;
  ctx.fillStyle = darkGreen;
  ctx.font = '900 58px system-ui, -apple-system, Arial';
  ctx.fillText('MANÉ MERCADO', cx, maneY);

  // Unidade
  ctx.font = '400 34px system-ui, -apple-system, Arial';
  ctx.fillText(unitLabel, cx, maneY + 50);

  /* ── 7. Footer teal ── */
  ctx.fillStyle = tealDark;
  ctx.fillRect(0, H - footerH, W, footerH);
  ctx.fillStyle = yellow;
  ctx.font = '700 24px system-ui, -apple-system, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('mane.com.vc', cx, H - footerH / 2 + 8);

  ctx.restore();

  const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.95)!);
  const fileName = `reserva-mane-${Date.now()}.jpg`;
  const url = URL.createObjectURL(blob);
  return { blob, fileName, url };
}

// ====== Helpers de URL/UTM
function readUrlAttribution() {
  if (typeof window === 'undefined') {
    return {
      utm_source: 'site',
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      url: null,
      ref: null,
    };
  }
  const params = new URLSearchParams(window.location.search);
  const get = (k: string) => (params.get(k) || '').trim() || null;

  return {
    utm_source: get('utm_source') || 'site',
    utm_medium: get('utm_medium'),
    utm_campaign: get('utm_campaign'),
    utm_content: get('utm_content'),
    utm_term: get('utm_term'),
    url: window.location.href,
    ref: document.referrer || null,
  };
}

// ====== Página
export default function ReservarMane() {
  const [reservationType, setReservationType] = useState<ReservationType>('ANIVERSARIO');

  const [step, setStep] = useState(0);
  const [stepLoading, setStepLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [activeReservation, setActiveReservation] = useState<ReservationDto | null>(null);

  const bootedRef = useRef(false);
  useEffect(() => {
    if (bootedRef.current) return;
    ensureAnalyticsReady();
    bootedRef.current = true;
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    const targets = [20, 40, 60, 80, 100];
    const target = targets[Math.min(step, 4)];
    requestAnimationFrame(() => setProgress(target));
  }, [step]);

  const goToStep = (n: number) => {
    setStepLoading(true);
    setStep(n);
    const t = setTimeout(() => setStepLoading(false), 250);
    return () => clearTimeout(t);
  };

  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [unidade, setUnidade] = useState<string | null>(null);

  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [areasError, setAreasError] = useState<string | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);

  const [areasMeta, setAreasMeta] = useState<Record<string, AreaMeta>>({});

  const [adultos, setAdultos] = useState<number | ''>(2);
  const [criancas, setCriancas] = useState<number | ''>(0);
  const [data, setData] = useState<Date | null>(null);
  const [hora, setHora] = useState<string>('');
  const [timeError, setTimeError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [pastError, setPastError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [birthdayRaw, setBirthdayRaw] = useState<string | null>(null);
  const [birthdayError, setBirthdayError] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [shareBusy, setShareBusy] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [posterBlob, setPosterBlob] = useState<Blob | null>(null);
  const [posterName, setPosterName] = useState<string | null>(null);

  const total = useMemo(() => {
    const a = typeof adultos === 'number' ? adultos : 0;
    const c = typeof criancas === 'number' ? criancas : 0;
    return Math.max(1, a + c);
  }, [adultos, criancas]);

  const peopleError = total < MIN_PEOPLE ? `Mínimo de ${MIN_PEOPLE} pessoas` : null;

  // Concierge dinâmico por unidade (AC vs BSB)
  const conciergePhone = useMemo(() => getConciergePhoneByUnit(unidade, units), [unidade, units]);
  const conciergeLink = useMemo(() => buildConciergeLink(conciergePhone), [conciergePhone]);
  const conciergePhonePretty = useMemo(
    () => formatBrPhonePretty(conciergePhone),
    [conciergePhone]
  );

  // Restore reserva ativa (localStorage)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (async () => {
      const apiBase = API_BASE || '';
      const raw = localStorage.getItem(LS_KEY);
      let saved: SavedReservationLS | null = null;
      if (raw) {
        try {
          saved = JSON.parse(raw) as SavedReservationLS;
        } catch {
          localStorage.removeItem(LS_KEY);
        }
      }

      if (saved?.reservationType) {
        setReservationType(saved.reservationType);
      }

      if (saved?.id) {
        try {
          const resp = await fetch(
            `${apiBase}/v1/reservations/public/active?id=${encodeURIComponent(saved.id)}`,
            { cache: 'no-store' }
          );
          if (resp.ok) {
            const r = (await resp.json()) as ReservationDto;
            if (r.status === 'AWAITING_CHECKIN') {
              setReservationType((prev) =>
                prev === 'ANIVERSARIO'
                  ? 'ANIVERSARIO'
                  : ((r.reservationType as ReservationType) ?? prev)
              );
              setActiveReservation({ ...r, reservationType });
              setCreatedId(r.id);
              setCreatedCode(r.reservationCode);
              setStep(4);
              return;
            }
          } else {
            localStorage.removeItem(LS_KEY);
          }
        } catch {
          // ignore
        }
      }
    })();
  }, []);

  // Units
  useEffect(() => {
    let alive = true;
    (async () => {
      setUnitsLoading(true);
      setUnitsError(null);
      try {
        const list = await apiGet<any[]>('/v1/units/public/options/list');
        const normalized: UnitOption[] = (list ?? [])
          .map((u: any) => [String(u.id ?? u._id ?? u.slug ?? u.name), String(u.name ?? u.title ?? u.slug ?? '')])
          .map(([id, name]) => ({ id, name }));
        if (!alive) return;
        setUnits(normalized);
      } catch (e: any) {
        if (!alive) return;
        setUnitsError(e?.message || 'Falha ao carregar unidades.');
        setUnits([]);
        setUnidade(null);
      } finally {
        if (alive) setUnitsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Pixel por unidade
  useEffect(() => {
    if (!unidade || units.length === 0) return;
    const unitObj = units.find((u) => u.id === unidade);
    if (unitObj) {
      setActiveUnitPixelFromUnit({ id: unitObj.id, name: unitObj.name, slug: unitObj.slug });
    } else {
      setActiveUnitPixelFromUnit(unidade);
    }
  }, [unidade, units]);

  // Metadados de áreas por unidade
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!unidade) {
        setAreasMeta({});
        return;
      }
      try {
        let list = await apiGet<any[]>(`/v1/areas/public/by-unit/${encodeURIComponent(unidade)}`);

        if (!Array.isArray(list) || list.length === 0) {
          const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
          const qs = new URLSearchParams({
            unitId: String(unidade),
            date: tomorrow,
            time: '18:00',
          }).toString();
          const alt = await apiGet<any[]>(`/v1/reservations/public/availability?${qs}`);
          list = Array.isArray(alt) ? alt : [];
        }

        const metaMap: Record<string, AreaMeta> = {};
        for (const a of list) {
          const id = String(a?.id ?? a?._id ?? '');
          if (!id) continue;

          const description = String(a?.description ?? a?.desc ?? a?.area?.description ?? '').trim();
          const iconEmojiRaw = a?.iconEmoji ?? a?.icon_emoji ?? a?.area?.iconEmoji ?? a?.area?.icon_emoji;

          const rawPhoto =
            a?.photoUrlAbsolute ??
            a?.photoPath ??
            a?.photoUrl ??
            a?.photo ??
            a?.imageUrl ??
            a?.image ??
            a?.coverUrl ??
            a?.photo_url ??
            a?.area?.photoUrl ??
            a?.area?.photo ??
            a?.area?.imageUrl ??
            a?.area?.image ??
            a?.area?.coverUrl;

          const photoS3 = toS3Url(rawPhoto) || undefined;

          metaMap[id] = {
            id,
            name: String(a?.name ?? a?.title ?? ''),
            description,
            photoUrl: photoS3,
            iconEmoji: typeof iconEmojiRaw === 'string' && iconEmojiRaw.trim() ? iconEmojiRaw.trim() : null,
          };
        }

        if (!alive) return;
        setAreasMeta(metaMap);
      } catch (err) {
        if (!alive) return;
        console.error('[areas-meta] erro:', err);
        setAreasMeta({});
      }
    })();

    return () => {
      alive = false;
    };
  }, [unidade]);

  const ymd = useMemo(() => (data ? dayjs(data).format('YYYY-MM-DD') : ''), [data]);

  // Disponibilidade de áreas (dependendo de data/hora)
  useEffect(() => {
    let alive = true;

    if (!unidade) {
      setAreas([]);
      setAreaId(null);
      return;
    }

    if (!ymd || !hora) {
      const metaList = Object.values(areasMeta);
      const normalized: AreaOption[] = metaList.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description || '',
        photoUrl: m.photoUrl || undefined,
        iconEmoji: m.iconEmoji ?? null,
        capacity: undefined,
        available: undefined,
        isAvailable: undefined,
      }));

      if (!alive) return;
      setAreas(normalized);
      setAreaId((curr) => (normalized.some((x) => x.id === curr) ? curr : null));
      return () => {
        alive = false;
      };
    }

    (async () => {
      setAreasLoading(true);
      setAreasError(null);
      try {
        const qs = new URLSearchParams({
          unitId: String(unidade),
          date: ymd,
          time: hora,
        }).toString();
        const list = await apiGet<any[]>(`/v1/reservations/public/availability?${qs}`);

        const metaMap = areasMeta;

        const normalized: AreaOption[] = (list ?? []).map((a: any) => {
          const id = String(a.id ?? a._id);
          const meta = metaMap[id];

          const rawPhoto =
            a?.photoUrlAbsolute ??
            a?.photoPath ??
            a?.photoUrl ??
            a?.photo ??
            a?.imageUrl ??
            a?.image ??
            a?.coverUrl ??
            a?.photo_url ??
            meta?.photoUrl ??
            '';

          const photo = toS3Url(rawPhoto) ?? meta?.photoUrl ?? undefined;

          const desc = String(a?.description ?? a?.desc ?? a?.area?.description ?? meta?.description ?? '').trim();

          const icon =
            typeof a?.iconEmoji === 'string' && a.iconEmoji.trim()
              ? a.iconEmoji.trim()
              : typeof a?.icon_emoji === 'string' && a.icon_emoji.trim()
              ? a.icon_emoji.trim()
              : meta?.iconEmoji ?? null;

          return {
            id,
            name: String(a?.name ?? a?.title ?? meta?.name ?? ''),
            description: desc,
            photoUrl: photo,
            capacity: typeof a?.capacity === 'number' ? a.capacity : undefined,
            available:
              typeof a?.available === 'number'
                ? a.available
                : typeof a?.remaining === 'number'
                ? a.remaining
                : undefined,
            isAvailable: Boolean(a?.isAvailable ?? (a?.available ?? a?.remaining ?? 0) > 0),
            iconEmoji: icon,
          };
        });

        if (!alive) return;
        setAreas(normalized);

        setAreaId((curr) => {
          const need = typeof total === 'number' ? total : 0;
          const chosen = normalized.find((x) => x.id === curr);
          const left = chosen ? chosen.available ?? 0 : 0;
          if (!chosen || left < need) {
            const firstOk = normalized.find((x) => (x.available ?? 0) >= need);
            return firstOk?.id ?? null;
          }
          return curr;
        });
      } catch (e: any) {
        if (!alive) return;
        setAreasError(e?.message || 'Falha ao carregar disponibilidade.');
        setAreas([]);
        setAreaId(null);
      } finally {
        if (alive) setAreasLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [unidade, ymd, hora, total, areasMeta]);

  const contactOk = isValidEmail(email) && isValidPhone(phone);

  // Regras de navegação
  const canNext1 = Boolean(
    unidade && data && hora && total >= MIN_PEOPLE && !timeError && !dateError && !pastError
  );

  const chosen = areas.find((a) => a.id === areaId);
  const leftChosen = chosen ? chosen.available ?? chosen.capacity ?? 0 : 0;
  const canNext2 = Boolean(areaId) && leftChosen >= (typeof total === 'number' ? total : 0);

  const canFinish = fullName.trim().length >= 3 && onlyDigits(cpf).length === 11 && contactOk && !!birthday;

  const [showConcierge, setShowConcierge] = useState(false);

  const [socialProofText, setSocialProofText] = useState('');
  useEffect(() => {
    const phrases = [
      '89 reservas nos últimos 3 dias',
      '127 reservas feitas esta semana',
      '34 reservas só hoje',
      'Última reserva há 8 minutos',
    ];
    setSocialProofText(phrases[Math.floor(Math.random() * phrases.length)]);
  }, []);

  // resetar horário quando muda unidade ou data
  useEffect(() => {
    setHora('');
  }, [unidade]);
  useEffect(() => {
    setHora('');
  }, [ymd]);

  const handleContinueStep1 = () => {
    setError(null);
    if (!unidade) {
      setError('Escolha em qual unidade você quer ir.');
      return;
    }
    if (!data) {
      setError('Escolha a data da sua reserva.');
      return;
    }
    if (!hora) {
      setError('Escolha o horário da sua reserva.');
      return;
    }
    const qty = typeof total === 'number' ? total : 0;
    if (qty < MIN_PEOPLE) {
      setError(`Mínimo de ${MIN_PEOPLE} pessoas para reservar.`);
      return;
    }
    if (isPastSelection(data, hora)) {
      setError('Esse horário já passou. Escolha um horário futuro.');
      return;
    }
    if (qty > MAX_PEOPLE_WITHOUT_CONCIERGE) {
      setShowConcierge(true);
      return;
    }
    goToStep(2);
  };

  async function confirmarReserva() {
    setSending(true);
    setError(null);
    try {
      if (total < MIN_PEOPLE) {
        setError(`Mínimo de ${MIN_PEOPLE} pessoas para reservar.`);
        goToStep(1);
        setSending(false);
        return;
      }
      if (!data || !hora) {
        setError('Selecione data e horário.');
        goToStep(1);
        setSending(false);
        return;
      }
      if (isPastSelection(data, hora)) {
        setError('Esse horário já passou. Escolha um horário futuro.');
        goToStep(1);
        setSending(false);
        return;
      }
      if (dayjs(data).isBefore(TODAY_START, 'day')) {
        setError('Data inválida. Selecione uma data a partir de hoje.');
        goToStep(1);
        setSending(false);
        return;
      }
      if (isPastSelection(data, hora)) {
        setError('Esse horário já passou. Selecione um horário no futuro.');
        goToStep(1);
        setSending(false);
        return;
      }
      if (isTimeOutsideWindow(hora)) {
        setError(`Horário indisponível. ${timeWindowMessage()}.`);
        goToStep(1);
        setSending(false);
        return;
      }
      if (!contactOk) {
        setError('Preencha um e-mail e telefone válidos.');
        setSending(false);
        return;
      }
      if (!areaId || !unidade) {
        setError('Selecione a unidade e a área.');
        goToStep(2);
        setSending(false);
        return;
      }
      if (!birthday) {
        setError(null);
        setBirthdayError('Obrigatório');
        goToStep(3);
        setSending(false);
        return;
      }

      const reservationISO = joinDateTimeISO(data, hora);
      const birthdayISO = birthday ? dayjs(birthday).startOf('day').toDate().toISOString() : undefined;
      const kidsNum = typeof criancas === 'number' && !Number.isNaN(criancas) ? criancas : 0;

      // UTM / URL / Ref direto da URL
      const attribution = readUrlAttribution();

      const payload = {
        fullName,
        cpf: onlyDigits(cpf),
        people: typeof total === 'number' ? total : 0,
        kids: kidsNum,
        reservationDate: reservationISO!,
        birthdayDate: birthdayISO,
        email: email.trim().toLowerCase(),
        phone: onlyDigits(phone),
        unitId: unidade,
        areaId: areaId,
        utm_source: attribution.utm_source ?? 'site',
        utm_medium: attribution.utm_medium,
        utm_campaign: attribution.utm_campaign ?? `${unidade}:${areaId}`,
        utm_content: attribution.utm_content,
        utm_term: attribution.utm_term,
        url: attribution.url,
        ref: attribution.ref,
        source: 'site',
        reservationType: reservationType,
      };

      console.debug('[payload.reservationType]', reservationType);

      const resp = await fetch(`${API_BASE || ''}/v1/reservations/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await resp.json().catch(() => ({} as any));

      if (!resp.ok) {
        if (resp.status === 409 && (json as any)?.error?.code === 'ALREADY_HAS_ACTIVE_RESERVATION') {
          const activeId = (json as any).error.reservationId as string;
          if (activeId) {
            const activeResp = await fetch(
              `${API_BASE || ''}/v1/reservations/public/active?id=${encodeURIComponent(activeId)}`,
              { cache: 'no-store' }
            );
            if (activeResp.ok) {
              const r = (await activeResp.json()) as ReservationDto;

              setReservationType((prev) =>
                prev === 'ANIVERSARIO' ? 'ANIVERSARIO' : ((r.reservationType as ReservationType) ?? prev)
              );
              setActiveReservation({ ...r, reservationType });

              setCreatedId(r.id);
              setCreatedCode(r.reservationCode);
              setStep(4);
              if (typeof window !== 'undefined') {
                const qrUrl = `${API_BASE || ''}/v1/reservations/${r.id}/qrcode`;
                const lsPayload: SavedReservationLS = {
                  id: r.id,
                  code: r.reservationCode,
                  qrUrl,
                  unitLabel: r.unit || '',
                  areaName: r.areaName || '',
                  dateStr: dayjs(r.reservationDate).format('DD/MM/YYYY'),
                  timeStr: dayjs(r.reservationDate).format('HH:mm'),
                  people: r.people ?? 0,
                  kids: r.kids ?? 0,
                  fullName: r.fullName ?? undefined,
                  cpf: r.cpf ?? undefined,
                  emailHint: r.email ?? undefined,
                  reservationType,
                };
                localStorage.setItem(LS_KEY, JSON.stringify(lsPayload));
              }
              setSending(false);
              return;
            }
          }

          setError('Você já tem uma reserva ativa. Faça o check-in para poder reservar de novo.');
          setSending(false);
          return;
        }

        const msg =
          (json as any)?.error?.message ||
          (json as any)?.message ||
          'Não foi possível concluir sua reserva agora. Tente novamente.';
        setError(msg);
        setSending(false);
        return;
      }

      const resOk = json as { id: string; reservationCode: string; status?: string };

      const unitObj = units.find((u) => u.id === unidade);
      const unitLabel = unitObj?.name || unitObj?.slug || unidade || '';
      const areaObj = areas.find((a) => a.id === areaId);
      const areaLabel = areaObj?.name || '';

      await trackReservationMade({
        reservationCode: resOk.reservationCode,
        fullName,
        email,
        phone: onlyDigits(phone),
        unit: unitLabel,
        area: areaLabel,
        status: resOk.status || 'AWAITING_CHECKIN',
        source: 'site',
      });

      let reservationLoaded: ReservationDto | null = null;
      try {
        const fetchCreated = await fetch(
          `${API_BASE || ''}/v1/reservations/public/active?id=${encodeURIComponent(resOk.id)}`,
          { cache: 'no-store' }
        );
        if (fetchCreated.ok) {
          reservationLoaded = (await fetchCreated.json()) as ReservationDto;
        }
      } catch {
        // ignore
      }

      setCreatedId(resOk.id);
      setCreatedCode(resOk.reservationCode);
      setStep(4);

      if (typeof window !== 'undefined') {
        const qrUrl = `${API_BASE || ''}/v1/reservations/${resOk.id}/qrcode`;
        const lsPayload: SavedReservationLS = {
          id: resOk.id,
          code: resOk.reservationCode,
          qrUrl,
          unitLabel: reservationLoaded?.unit || unitLabel,
          areaName: reservationLoaded?.areaName || areaLabel,
          dateStr: reservationLoaded?.reservationDate
            ? dayjs(reservationLoaded.reservationDate).format('DD/MM/YYYY')
            : dayjs(data).format('DD/MM/YYYY'),
          timeStr: reservationLoaded?.reservationDate
            ? dayjs(reservationLoaded.reservationDate).format('HH:mm')
            : hora,
          people: reservationLoaded?.people ?? (typeof total === 'number' ? total : 0),
          kids: reservationLoaded?.kids ?? (typeof criancas === 'number' ? criancas : 0),
          fullName: reservationLoaded?.fullName ?? fullName,
          cpf: reservationLoaded?.cpf ?? cpf,
          emailHint: reservationLoaded?.email ?? email,
          reservationType,
        };
        localStorage.setItem(LS_KEY, JSON.stringify(lsPayload));
      }

      if (reservationLoaded) {
        setReservationType((prev) =>
          prev === 'ANIVERSARIO'
            ? 'ANIVERSARIO'
            : ((reservationLoaded?.reservationType as ReservationType) ?? prev)
        );
        setActiveReservation({ ...reservationLoaded, reservationType });
      } else {
        const reservationISO2 = joinDateTimeISO(data, hora)!;
        setActiveReservation({
          id: resOk.id,
          reservationCode: resOk.reservationCode,
          unitId: unidade!,
          unit: unitLabel,
          areaId: areaId!,
          areaName: areaLabel,
          reservationDate: reservationISO2,
          people: typeof total === 'number' ? total : 0,
          kids: typeof criancas === 'number' ? criancas : 0,
          fullName,
          cpf: onlyDigits(cpf),
          email: email.trim().toLowerCase(),
          phone: onlyDigits(phone),
          status: 'AWAITING_CHECKIN',
          reservationType,
        });
      }
    } finally {
      setSending(false);
    }
  }

  const apiBase = API_BASE || '';
  const qrUrl = createdId ? `${apiBase}/v1/reservations/${createdId}/qrcode` : '';

  const boardingUnitLabel = activeReservation?.unit || units.find((u) => u.id === unidade)?.name || '—';
  const boardingAreaName = activeReservation?.areaName || areas.find((a) => a.id === areaId)?.name || '—';
  const boardingDateStr = activeReservation
    ? dayjs(activeReservation.reservationDate).format('DD/MM/YYYY')
    : data
    ? dayjs(data).format('DD/MM/YYYY')
    : '--/--/----';
  const boardingTimeStr = activeReservation ? dayjs(activeReservation.reservationDate).format('HH:mm') : hora || '--:--';
  const boardingPeople = activeReservation ? activeReservation.people ?? 0 : typeof total === 'number' ? total : 0;
  const boardingKids = activeReservation ? activeReservation.kids ?? 0 : typeof criancas === 'number' ? criancas : 0;
  const boardingFullName = activeReservation?.fullName ?? fullName;
  const boardingCpf = activeReservation?.cpf ?? cpf;
  const boardingEmail = activeReservation?.email ?? email;
  const boardingReservationType = (activeReservation as any)?.reservationType ?? reservationType;

  const [shareBusyInternal, setShareBusyInternal] = useState(false);

  // Auto-gerar poster ao chegar no step 4
  useEffect(() => {
    if (step === 4 && createdId && !posterUrl) {
      ensurePoster().catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, createdId]);

  async function ensurePoster() {
    if (posterUrl && posterBlob) return { url: posterUrl, blob: posterBlob, name: posterName! };
    setShareBusy(true);
    setShareBusyInternal(true);
    try {
      const poster = await generatePoster({
        fullName: boardingFullName || 'Cliente',
        unitLabel: boardingUnitLabel || '',
        areaName: boardingAreaName || '',
        dateStr: boardingDateStr || '',
        timeStr: boardingTimeStr || '',
        people: boardingPeople || 0,
        kids: boardingKids || 0,
        qrUrl: qrUrl || undefined,
        logoUrl: '/images/1.png',
      });
      setPosterUrl(poster.url);
      setPosterBlob(poster.blob);
      setPosterName(poster.fileName);
      return { url: poster.url, blob: poster.blob, name: poster.fileName };
    } finally {
      setShareBusy(false);
      setShareBusyInternal(false);
    }
  }

  async function downloadPoster() {
    const p = await ensurePoster();
    const a = document.createElement('a');
    a.href = p.url;
    a.download = p.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function shareWhatsapp() {
    const guestLink = `${window.location.origin}/convidados/${createdCode ?? createdId}`;
    const text = [
      `Fiz minha reserva no Mané Mercado! 🎉`,
      '',
      `📍 ${boardingUnitLabel}`,
      `📅 ${boardingDateStr} às ${boardingTimeStr}`,
      '',
      `Registre sua presença e ganhe benefícios:`,
      guestLink,
      '',
      `Te espero lá!`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const p = await ensurePoster();
      const file = new File([p.blob], p.name, { type: 'image/jpeg' });
      // @ts-ignore
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        // @ts-ignore
        await navigator.share({ text, files: [file] });
        return;
      }
    } catch {
      // ignore → fallback
    }

    const wpp = buildWhatsappLink(text);
    window.open(wpp, '_blank', 'noopener,noreferrer');
  }

  return (
    <DatesProvider settings={{ locale: 'pt-br' }}>
      <Box style={{ background: '#ffffff', minHeight: '100dvh', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative blobs — smaller on mobile */}
        <Box className="deco-blob" style={{ position: 'absolute', top: -60, left: -60, width: 110, height: 110, borderRadius: '50%', background: '#e34b4b', opacity: 0.4, pointerEvents: 'none', zIndex: 0 }} />
        <Box className="deco-blob" style={{ position: 'absolute', top: -30, right: -40, width: 80, height: 80, borderRadius: '50%', background: '#6dc7d1', opacity: 0.35, pointerEvents: 'none', zIndex: 0 }} />
        <Box className="deco-blob" style={{ position: 'absolute', top: 400, left: -40, width: 60, height: 90, borderRadius: '50%', background: '#4f8e72', opacity: 0.2, pointerEvents: 'none', zIndex: 0 }} />
        <Box className="deco-blob" style={{ position: 'absolute', bottom: 200, left: -30, width: 80, height: 70, borderRadius: '50%', background: '#f5c4c4', opacity: 0.35, pointerEvents: 'none', zIndex: 0 }} />
        <Box className="deco-blob" style={{ position: 'absolute', top: 220, right: -35, width: 70, height: 70, borderRadius: '50%', background: '#f7c85a', opacity: 0.2, pointerEvents: 'none', zIndex: 0 }} />
        <LoadingOverlay visible={sending || shareBusy} />

        {/* HEADER — compacto e funcional */}
        <Container size="xs" px="md" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', paddingBottom: 8, width: '100%', position: 'relative', zIndex: 1 }}>
          {/* Row: back + logo + spacer */}
          <Group justify="space-between" align="center" mb={12}>
            {step === 0 ? (
              <Anchor
                component={Link}
                href="/"
                c="dimmed"
                style={{ display: 'flex', alignItems: 'center', padding: 4 }}
              >
                <IconArrowLeft size={18} color="#0b2b2c" />
              </Anchor>
            ) : step >= 4 ? (
              <Box style={{ width: 26 }} />
            ) : (
              <UnstyledButton
                onClick={() => goToStep(step - 1)}
                style={{ display: 'flex', alignItems: 'center', padding: 4 }}
              >
                <IconArrowLeft size={18} color="#0b2b2c" />
              </UnstyledButton>
            )}
            <NextImage
              src="/images/1.png"
              alt="Mané Mercado"
              width={120}
              height={40}
              style={{ height: 36, width: 'auto' }}
              priority
            />
            <Box style={{ width: 26 }} />
          </Group>

          {/* Step indicator */}
          {step < 4 ? (
            <Box>
              <Group gap={5} justify="center" mb={6}>
                {[0,1,2,3].map((s) => (
                  <Box
                    key={s}
                    style={{
                      width: s === step ? 28 : 8,
                      height: 6,
                      borderRadius: 3,
                      background: s <= step ? '#0e7a7f' : 'rgba(14,122,127,0.12)',
                      transition: 'all 300ms ease',
                    }}
                  />
                ))}
              </Group>
              <Text size="sm" c="#0b2b2c" ta="center" style={{ fontFamily: 'var(--font-merri), Merriweather, serif', fontWeight: 900 }}>
                {['Tipo de reserva', 'Data e horário', 'Escolha a área', 'Seus dados'][step]}
              </Text>
            </Box>
          ) : (
            <Box style={{ textAlign: 'center' as const }}>
              <Text size="sm" fw={700} c="#0b2b2c">Reserva concluída</Text>
              <Text size="xs" c="dimmed">Seu QR Code foi gerado</Text>
            </Box>
          )}
        </Container>

        {/* CONTEÚDO */}
        <Container
          size="xs"
          px="md"
          style={{
            paddingTop: 12,
            paddingBottom: 40,
            paddingLeft: 'calc(env(safe-area-inset-left) + 16px)',
            paddingRight: 'calc(env(safe-area-inset-right) + 16px)',
            fontFamily: 'var(--font-comfortaa), Comfortaa, sans-serif',
            width: '100%',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* PASSO 0 — Tipo */}
          {step === 0 && (
            <Stack mt="xs" gap="sm">

              {/* ── Seleção de tipo: grid 2x2 ── */}
              <SimpleGrid cols={2} spacing={10}>
                {(
                  [
                    { key: 'ANIVERSARIO', label: 'Aniversário', icon: (c: string) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg> },
                    { key: 'PARTICULAR', label: 'Particular', icon: (c: string) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
                    { key: 'CONFRATERNIZACAO', label: 'Confraternização', icon: (c: string) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 11.5V6a1 1 0 0 0-1-1h-3.5"/><path d="M8 11.5V6a1 1 0 0 1 1-1h3.5"/><path d="M12 2v3"/><path d="M8 16c0 4 8 4 8 0"/><path d="m8 12-2 4"/><path d="m16 12 2 4"/><path d="M5.2 20h13.6"/></svg> },
                    { key: 'EMPRESA', label: 'Empresa', icon: (c: string) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg> },
                  ] as { key: ReservationType; label: string; icon: (c: string) => React.ReactNode }[]
                ).map((opt) => {
                  const sel = reservationType === opt.key;
                  return (
                    <UnstyledButton
                      key={opt.key}
                      onClick={() => setReservationType(opt.key)}
                      style={{
                        padding: '18px 10px',
                        borderRadius: 20,
                        border: sel ? '2px solid #0e7a7f' : '1.5px solid rgba(0,0,0,0.08)',
                        background: sel ? 'rgba(14,122,127,0.08)' : '#fff',
                        textAlign: 'center' as const,
                        transition: 'all 150ms ease',
                        boxShadow: sel ? '0 4px 16px rgba(14,122,127,0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
                      }}
                    >
                      <Box style={{ display: 'flex', justifyContent: 'center' }}>
                        {opt.icon(sel ? '#0e7a7f' : '#999')}
                      </Box>
                      <Text size="sm" c={sel ? '#0e7a7f' : '#0b2b2c'} mt={8} style={{ fontFamily: 'var(--font-merri), Merriweather, serif', fontWeight: 900 }}>
                        {opt.label}
                      </Text>
                    </UnstyledButton>
                  );
                })}
              </SimpleGrid>

              {/* ── Pacotes Aniversário (reward card — só aparece após selecionar) ── */}
              {reservationType === 'ANIVERSARIO' && (() => {
                const Ornament = () => (
                  <svg width="80" height="8" viewBox="0 0 80 8" fill="none" style={{ display: 'block', margin: '0 auto' }}>
                    <line x1="0" y1="4" x2="28" y2="4" stroke="#C8902A" strokeWidth="0.5" strokeOpacity="0.4" />
                    <circle cx="32" cy="4" r="1.5" fill="#C8902A" fillOpacity="0.5" />
                    <circle cx="40" cy="4" r="2.5" fill="#F7C85A" fillOpacity="0.6" />
                    <circle cx="48" cy="4" r="1.5" fill="#C8902A" fillOpacity="0.5" />
                    <line x1="52" y1="4" x2="80" y2="4" stroke="#C8902A" strokeWidth="0.5" strokeOpacity="0.4" />
                  </svg>
                );
                const GoldLine = () => (
                  <Box mx="auto" style={{ width: 40, height: 1, background: 'linear-gradient(90deg, transparent, rgba(200,144,42,0.35), transparent)' }} />
                );
                const tiers = [
                  { range: '8 a 15', bonus: 100, level: 1 as const, headline: 'Comemore com quem importa', perks: ['Brinquedoteca day use para 1 criança'] },
                  { range: '16 a 30', bonus: 150, level: 2 as const, headline: 'Reúna a turma toda', perks: ['Brinquedoteca day use para 2 crianças'] },
                  { range: 'Mais de 30', bonus: 200, level: 3 as const, headline: 'A celebração completa', perks: ['Garrafa de Caju do Mané', 'Brinquedoteca day use para 2 crianças', 'Cardápio personalizado — menu 3 etapas'] },
                ];
                return (
                  <Box style={{ borderRadius: 24, overflow: 'hidden', background: 'linear-gradient(170deg, #022d29 0%, #034c46 40%, #043f3a 100%)', boxShadow: '0 12px 40px rgba(2,45,41,0.35), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                    <Box pt={16} pb={12} px="md" style={{ textAlign: 'center' as const }}>
                      <Ornament />
                      <Text mt={8} c="#F3E9D9" style={{ fontFamily: 'var(--font-merri), Merriweather, serif', fontSize: 'clamp(0.95rem, 3.8vw, 1.15rem)', lineHeight: 1.25, letterSpacing: '-0.01em' }}>
                        Seu aniversário merece ser inesquecível
                      </Text>
                      <Text size="10px" c="rgba(243,233,217,0.45)" mt={6} lh={1.5}>Quanto mais convidados, mais mimos.</Text>
                      <Box mt={10}><GoldLine /></Box>
                    </Box>
                    <Box px={12} pb={12}>
                      <Stack gap={8}>
                        {tiers.map((tier) => {
                          const isVIP = tier.level === 3;
                          const cardBg = tier.level === 1 ? 'linear-gradient(135deg, #FDFAF4 0%, #F9F3E8 100%)' : tier.level === 2 ? 'linear-gradient(135deg, #FAF4E5 0%, #F4EBDA 100%)' : 'linear-gradient(135deg, #F7EDD5 0%, #EEDBB5 100%)';
                          return (
                            <Box key={tier.range} style={{ borderRadius: 14, background: cardBg, border: isVIP ? '1.5px solid rgba(200,144,42,0.5)' : '1px solid rgba(200,144,42,0.1)', boxShadow: isVIP ? '0 6px 24px rgba(200,144,42,0.12), inset 0 1px 0 rgba(255,255,255,0.6)' : 'inset 0 1px 0 rgba(255,255,255,0.6)', overflow: 'hidden' }}>
                              {isVIP && (<Box style={{ background: 'linear-gradient(90deg, #B8842A, #D4A644, #B8842A)', padding: '5px 0', textAlign: 'center' as const }}><Text size="9px" fw={800} c="#fff" tt="uppercase" style={{ letterSpacing: '0.12em', textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}>Experiência completa</Text></Box>)}
                              <Box px="sm" py={12}>
                                <Group justify="space-between" align="flex-start" wrap="nowrap" gap={10}>
                                  <Box style={{ flex: 1 }}>
                                    <Text size="14px" fw={900} c="#B8842A" tt="uppercase" style={{ fontFamily: 'var(--font-merri), Merriweather, serif', letterSpacing: '0.06em' }}>{tier.range} convidados</Text>
                                    <Text fw={800} c="#034c46" mt={3} style={{ fontFamily: 'var(--font-merri), Merriweather, serif', fontSize: isVIP ? 15 : 14, lineHeight: 1.3 }}>{tier.headline}</Text>
                                  </Box>
                                  <Box style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                                    <Text c="#034c46" fw={900} style={{ fontFamily: 'var(--font-merri), Merriweather, serif', fontSize: isVIP ? 36 : 28, lineHeight: 1 }}><span style={{ fontSize: isVIP ? 14 : 12, fontFamily: 'var(--font-comfortaa), Comfortaa, sans-serif', fontWeight: 700, opacity: 0.4, verticalAlign: 'super', marginRight: 1 }}>R$</span>{tier.bonus}</Text>
                                    <Text size="12px" c="#B8842A" fw={800} tt="uppercase" mt={2} style={{ letterSpacing: '0.04em' }}>DE BÔNUS</Text>
                                  </Box>
                                </Group>
                                <Box mt={10} pt={8} style={{ borderTop: '1px solid rgba(200,144,42,0.1)' }}>
                                  <Stack gap={4}>
                                    {tier.perks.map((p) => (<Group key={p} gap={7} align="center" wrap="nowrap"><Box style={{ width: 4, height: 4, borderRadius: '50%', background: '#C8902A', flexShrink: 0, opacity: 0.55 }} /><Text size="xs" c="#5a4a35" lh={1.4}>{p}</Text></Group>))}
                                    {false && tier.level > 1 && (<Text size="10px" c="#B8842A" fw={500} mt={1} style={{ fontStyle: 'italic', opacity: 0.65 }}>+ tudo do pacote anterior</Text>)}
                                  </Stack>
                                </Box>
                              </Box>
                            </Box>
                          );
                        })}
                      </Stack>
                      <Text size="9px" c="rgba(243,233,217,0.3)" ta="center" mt={8} lh={1.3} style={{ fontStyle: 'italic' }}>Bônus creditado automaticamente no dia da reserva.</Text>
                    </Box>
                  </Box>
                );
              })()}

              {/* ── CTA contextual ── */}
              <Button
                size="md"
                onClick={() => goToStep(1)}
                type="button"
                fullWidth
                style={{ fontWeight: 700, borderRadius: 999, background: '#f7c85a', color: '#0b2b2c', height: 50 }}
              >
                {reservationType === 'ANIVERSARIO' ? 'Garantir meus bônus →' : 'Escolher data e horário →'}
              </Button>
            </Stack>
          )}

          {/* PASSO 1 — Reserva */}
          {step === 1 &&
            (stepLoading ? (
              <StepSkeleton />
            ) : (
              <Stack mt="xs" gap="md">
                <Text size="xs" c="dimmed" ta="center" lh={1.4}>
                  Sextas e sábados lotam rápido — garanta sua mesa.
                </Text>
                <Stack gap="md">
                    {/* Unidade como cards — acessível pra todos */}
                    <Box>
                      <Text size="sm" fw={600} c="#0b2b2c" mb={8}>Onde você quer ir?</Text>
                      {unitsLoading ? (
                        <Text size="xs" c="dimmed">Carregando unidades...</Text>
                      ) : (
                        <Stack gap={6}>
                          {units.map((u) => {
                            const sel = unidade === u.id;
                            return (
                              <UnstyledButton
                                key={u.id}
                                onClick={() => {
                                  setUnidade(u.id);
                                  setError(null);
                                  if (u) setActiveUnitPixelFromUnit({ id: u.id, name: u.name, slug: u.slug });
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  padding: '14px 16px',
                                  borderRadius: 12,
                                  border: sel ? '2px solid #0e7a7f' : '1.5px solid rgba(0,0,0,0.1)',
                                  background: sel ? '#0e7a7f' : '#fff',
                                  transition: 'all 150ms ease',
                                  boxShadow: sel ? '0 4px 16px rgba(14,122,127,0.2)' : '0 2px 8px rgba(0,0,0,0.04)',
                                  width: '100%',
                                }}
                              >
                                <Box
                                  style={{
                                    width: 32, height: 32, borderRadius: 8,
                                    background: sel ? 'rgba(255,255,255,0.15)' : 'rgba(14,122,127,0.08)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  <IconMapPin size={18} color={sel ? '#F7C85A' : '#0e7a7f'} />
                                </Box>
                                <Text size="sm" fw={700} c={sel ? '#fff' : '#222'}>
                                  {u.name}
                                </Text>
                                {sel && (
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F7C85A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                              </UnstyledButton>
                            );
                          })}
                        </Stack>
                      )}
                    </Box>

                    <Grid gutter="md">
                      <Grid.Col span={6}>
                        <NumberInput
                          label="Adultos"
                          min={2}
                          value={adultos}
                          onChange={numberInputHandler(setAdultos)}
                          leftSection={<IconUsers size={16} />}
                          size="md"
                          styles={{ input: { height: rem(48) } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <NumberInput
                          label="Crianças"
                          min={0}
                          value={criancas}
                          onChange={numberInputHandler(setCriancas)}
                          leftSection={<IconMoodKid size={16} />}
                          size="md"
                          styles={{ input: { height: rem(48) } }}
                        />
                      </Grid.Col>
                    </Grid>

                    <Grid gutter="md">
                      <Grid.Col span={6}>
                        <DatePickerInput
                          locale="pt-br"
                          label="Data"
                          placeholder="Selecionar data"
                          value={data}
                          onChange={(value) => {
                            // Normaliza pro meio-dia usando dayjs pra evitar problema de fuso
                            const dateValue = value ? dayjs(value).startOf('day').add(12, 'hour').toDate() : null;

                            setData(dateValue);

                            if (!dateValue) {
                              setDateError(null);
                              setPastError(null);
                              return;
                            }

                            const isPast = dayjs(dateValue).isBefore(dayjs().startOf('day'));

                            if (isPast) {
                              setDateError('Selecione uma data a partir de hoje');
                            } else {
                              setDateError(null);
                            }

                            setPastError(() => {
                              if (!hora) return null;
                              return isPastSelection(dateValue, hora)
                                ? 'Esse horário já passou. Escolha um horário futuro.'
                                : null;
                            });
                          }}
                          valueFormat="DD/MM/YYYY"
                          leftSection={<IconCalendar size={16} />}
                          allowDeselect={false}
                          minDate={TODAY_START}
                          size="md"
                          styles={{ input: { height: rem(48) } }}
                          error={dateError}
                          weekendDays={[]}
                        />
                      </Grid.Col>

                      <Grid.Col span={6}>
                        <SlotTimePicker
                          value={hora}
                          onChange={(val) => {
                            setHora(val);
                            setTimeError(val && !isValidSlot(val) ? SLOT_ERROR_MSG : null);

                            setPastError(() => {
                              if (!data || !val) return null;
                              return isPastSelection(data, val)
                                ? 'Esse horário já passou. Escolha um horário futuro.'
                                : null;
                            });
                          }}
                          label="Horário"
                          placeholder="Selecionar"
                          error={timeError || pastError}
                          disabledSlots={(() => {
                            if (!data || !unidade) return [];
                            const unitName = (units.find((u) => u.id === unidade)?.name || '').toLowerCase();
                            const isBSB = unitName.includes('brasília') || unitName.includes('brasilia') || unitName.includes('bsb');
                            if (!isBSB) return [];
                            const dow = dayjs(data).day(); // 0=dom, 6=sab
                            if (dow !== 0 && dow !== 6) return [];
                            // Sáb/Dom em BSB: bloquear 14:00-17:00
                            return ALLOWED_SLOTS.filter((s) => {
                              const h = Number(s.split(':')[0]);
                              return h >= 14 && h < 17;
                            });
                          })()}
                        />
                      </Grid.Col>
                    </Grid>

                    {/* Resumo removido — aparece no Step 3 */}

                    {(peopleError || pastError || timeError || dateError) && (
                      <Alert color={peopleError || pastError || timeError ? 'red' : 'yellow'} icon={<IconInfoCircle />}>
                        {peopleError || pastError || timeError || dateError}
                      </Alert>
                    )}
                  </Stack>

                {error && step === 1 && (
                  <Alert color="red" radius="md" icon={<IconInfoCircle size={18} />} styles={{ message: { fontSize: 14 } }}>
                    {error}
                  </Alert>
                )}

                <Button
                  size="md"
                  onClick={handleContinueStep1}
                  type="button"
                  fullWidth
                  style={{ fontWeight: 700, borderRadius: 999, background: '#f7c85a', color: '#0b2b2c', height: 50 }}
                >
                  Ver áreas disponíveis →
                </Button>
              </Stack>
            ))}

          {/* PASSO 2 — Área */}
          {step === 2 &&
            (stepLoading ? (
              <StepSkeleton />
            ) : (
              <Stack mt="xs" gap="md">
                {/* Mini resumo contextual */}
                <Card radius={16} p="xs" style={{ background: '#0e7a7f' }}>
                  <Text size="10px" ta="center" c="#F3E9D9" lh={1.4}>
                    {RES_TYPE_LABEL[reservationType]} • {total} pessoa(s) • {data ? dayjs(data).format('DD/MM') : ''} às {hora || ''}
                  </Text>
                </Card>
                <Text size="xs" c="dimmed" ta="center" lh={1.4}>
                  Escolha onde você e seus convidados vão curtir.
                </Text>
                {areasLoading && (
                  <Text size="sm" c="dimmed">
                    Carregando áreas...
                  </Text>
                )}
                {areasError && (
                  <Alert color="red" icon={<IconInfoCircle />}>
                    {areasError}
                  </Alert>
                )}
                {!areasLoading && !areasError && areas.length === 0 && (
                  <Alert color="yellow" icon={<IconInfoCircle />}>
                    Não há áreas cadastradas para esta unidade.
                  </Alert>
                )}

                {areas.map((a) => {
                  const left = a.available ?? a.capacity ?? 0;
                  const need = typeof total === 'number' ? total : 0;
                  const disabled = left < need;
                  return (
                    <AreaCard
                      key={a.id}
                      foto={a.photoUrl || FALLBACK_IMG}
                      titulo={`${a.name}${typeof left === 'number' ? `` : ''}`}
                      desc={a.description || '—'}
                      icon={a.iconEmoji ?? null}
                      selected={areaId === a.id}
                      onSelect={() => !disabled && setAreaId(a.id)}
                      disabled={disabled}
                      remaining={left}
                    />
                  );
                })}

                <Button
                  size="md"
                  onClick={() => goToStep(3)}
                  disabled={!canNext2}
                  type="button"
                  fullWidth
                  style={{ fontWeight: 700, borderRadius: 999, background: !canNext2 ? undefined : '#f7c85a', color: '#0b2b2c', height: 50 }}
                >
                  Quase lá! Finalizar →
                </Button>
              </Stack>
            ))}

          {/* PASSO 3 — Cadastro */}
          {step === 3 &&
            (stepLoading ? (
              <StepSkeleton />
            ) : (
              <Stack mt="xs" gap="sm">
                {/* Resumo compacto da reserva */}
                <Card radius={16} p="sm" style={{ background: '#0e7a7f' }}>
                  <Text size="xs" ta="center" c="#F3E9D9" lh={1.5}>
                    {RES_TYPE_LABEL[reservationType]} • {units.find((u) => u.id === unidade)?.name ?? '—'} • {areas.find((a) => a.id === areaId)?.name ?? '—'}
                    <br />
                    {total} pessoa(s) • {data ? dayjs(data).format('DD/MM') : '--'} às {hora || '--:--'}
                  </Text>
                </Card>

                {/* Motivacional */}
                <Text size="xs" c="dimmed" ta="center" lh={1.4}>
                  Último passo! Preencha seus dados e receba o QR Code.
                </Text>

                {/* Todos os campos num card só */}
                <Card withBorder radius={24} p="md" style={{ background: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}>
                  <Stack gap="sm">
                    <TextInput
                      label="Nome completo"
                      placeholder="Seu nome"
                      value={fullName}
                      onChange={(e) => setFullName(e.currentTarget.value)}
                      leftSection={<IconUser size={16} />}
                      size="md"
                      styles={{ input: { height: rem(48) } }}
                    />
                    <TextInput
                      label="WhatsApp / Telefone"
                      placeholder="(61) 99999-9999"
                      value={phone}
                      onChange={(e) => setPhone(maskPhone(e.currentTarget.value))}
                      leftSection={<IconPhone size={16} />}
                      error={phone.length > 0 && !isValidPhone(phone) ? 'Informe um telefone válido' : null}
                      size="md"
                      styles={{ input: { height: rem(48) } }}
                    />
                    <TextInput
                      label="E-mail"
                      placeholder="seuemail@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.currentTarget.value)}
                      leftSection={<IconMail size={16} />}
                      error={email.length > 0 && !isValidEmail(email) ? 'Informe um e-mail válido' : null}
                      size="md"
                      styles={{ input: { height: rem(48) } }}
                    />

                    {/* Divisor sutil */}
                    <Box my={4} style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }} />
                    <Text size="10px" c="dimmed" style={{ marginTop: -2 }}>
                      Para garantir os bônus na sua chegada
                    </Text>

                    <Grid gutter="sm">
                      <Grid.Col span={6}>
                        <TextInput
                          label="CPF"
                          placeholder="000.000.000-00"
                          value={cpf}
                          onChange={(e) => setCpf(maskCPF(e.currentTarget.value))}
                          size="md"
                          styles={{ input: { height: rem(48) } }}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <TextInput
                          label="Nascimento"
                          placeholder="DD/MM/AAAA"
                          value={birthday ? dayjs(birthday).format('DD/MM/YYYY') : (birthdayRaw ?? '')}
                          onChange={(e) => {
                            const raw = e.currentTarget.value.replace(/\D/g, '').slice(0, 8);
                            let masked = raw;
                            if (raw.length > 2) masked = raw.slice(0, 2) + '/' + raw.slice(2);
                            if (raw.length > 4) masked = raw.slice(0, 2) + '/' + raw.slice(2, 4) + '/' + raw.slice(4);
                            setBirthdayRaw(masked);
                            if (raw.length === 8) {
                              const [dd, mm, yyyy] = [Number(raw.slice(0, 2)), Number(raw.slice(2, 4)), Number(raw.slice(4, 8))];
                              const d = new Date(yyyy, mm - 1, dd);
                              if (d.getDate() === dd && d.getMonth() === mm - 1 && d <= new Date() && yyyy >= 1900) {
                                setBirthday(d);
                                setBirthdayError(null);
                              } else {
                                setBirthday(null);
                                setBirthdayError('Data inválida');
                              }
                            } else {
                              setBirthday(null);
                            }
                          }}
                          required
                          size="md"
                          styles={{ input: { height: rem(48) } }}
                          leftSection={<IconCalendar size={16} />}
                          error={birthdayError || undefined}
                        />
                      </Grid.Col>
                    </Grid>
                  </Stack>
                </Card>

                {error && (
                  <Alert color="red" icon={<IconInfoCircle />}>
                    {error}
                  </Alert>
                )}

                <Button size="md" loading={sending} disabled={!canFinish} onClick={confirmarReserva} type="button" fullWidth style={{ fontWeight: 700, fontSize: 16, borderRadius: 999, background: !canFinish ? undefined : '#f7c85a', color: '#0b2b2c', height: 50 }}>
                  Garantir minha mesa
                </Button>

                {/* Trust signals */}
                <Group gap={12} justify="center" mt={4}>
                  <Group gap={4} align="center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <Text size="9px" c="dimmed">Dados protegidos</Text>
                  </Group>
                  <Group gap={4} align="center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <Text size="9px" c="dimmed">Sem cobrança</Text>
                  </Group>
                  <Group gap={4} align="center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    <Text size="9px" c="dimmed">Reserva gratuita</Text>
                  </Group>
                </Group>
              </Stack>
            ))}

          {/* PASSO 4 — Só o convite como protagonista */}
          {step === 4 && createdId && (
            <Stack mt="xs" gap="sm">
              {/* Convite gerado automaticamente */}
              {posterUrl ? (
                <Box style={{ width: '100%' }}>
                  <img
                    src={posterUrl}
                    alt="Seu convite"
                    style={{ width: '100%', height: 'auto', borderRadius: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
                  />
                </Box>
              ) : (
                <Card radius={24} p="lg" style={{ background: '#0e7a7f', textAlign: 'center' as const }}>
                  <Group gap={6} align="center" justify="center" mb={4}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F7C85A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <Text size="sm" fw={700} c="#F7C85A">Reserva confirmada!</Text>
                  </Group>
                  <Text c="#F3E9D9" fw={700} size="md" style={{ fontFamily: 'var(--font-merri), Merriweather, serif' }}>
                    {boardingFullName}
                  </Text>
                  <Text size="xs" c="rgba(243,233,217,0.5)" mt={8}>
                    {boardingDateStr} às {boardingTimeStr} • {boardingUnitLabel}
                  </Text>
                  <Box mt="md" style={{ display: 'inline-block', padding: 6, background: 'rgba(255,255,255,0.9)', borderRadius: 10 }}>
                    <img
                      src={`${qrUrl}?t=${Date.now()}`}
                      alt="QR" width={120} height={120}
                      style={{ display: 'block', width: 120, height: 120, borderRadius: 6 }}
                      crossOrigin="anonymous" referrerPolicy="no-referrer"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  </Box>
                  <Text size="9px" c="rgba(243,233,217,0.3)" mt={6}>Apresente na entrada</Text>
                </Card>
              )}

              {/* Info removida — localizador/tolerância */}

              {/* CTAs */}
              <Button
                size="md"
                onClick={shareWhatsapp}
                disabled={shareBusyInternal}
                fullWidth
                style={{ fontWeight: 700, borderRadius: 999, background: '#f7c85a', color: '#0b2b2c', height: 50 }}
              >
                Enviar convite no WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadPoster}
                disabled={shareBusyInternal}
                fullWidth
                style={{ borderRadius: 999, borderColor: 'rgba(0,0,0,0.18)', color: '#0b2b2c' }}
              >
                Salvar convite
              </Button>
            </Stack>
          )}

          {showConcierge && (
            <Box
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,.45)',
                zIndex: 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
              }}
              role="dialog"
              aria-modal="true"
            >
              <Card withBorder radius={24} shadow="md" p={0} style={{ width: 480, maxWidth: '100%', overflow: 'hidden' }}>
                <Box px="md" py="sm" style={{ borderBottom: '1px solid rgba(0,0,0,.08)', background: '#fff' }}>
                  <Title order={4} fw={500} m={0}>
                    Reserva para grupo grande
                  </Title>
                </Box>
                <Box px="md" py="md">
                  <Text>
                    Para reservas acima de <b>{MAX_PEOPLE_WITHOUT_CONCIERGE}</b> pessoas, é necessário falar com nosso concierge pelo WhatsApp.
                  </Text>
                  <Text size="sm" c="dimmed" mt={6}>
                    Assim garantimos a melhor organização do espaço e atendimento do seu grupo. 🙂
                  </Text>
                </Box>
                <Group
                  justify="end"
                  gap="sm"
                  px="md"
                  py="sm"
                  style={{
                    borderTop: '1px solid rgba(0,0,0,.08)',
                    background: '#fff',
                  }}
                >
                  <Button variant="default" onClick={() => setShowConcierge(false)}>
                    Fechar
                  </Button>
                  <Button component="a" href={conciergeLink} target="_blank" rel="noreferrer" color="green">
                    Abrir WhatsApp {conciergePhonePretty}
                  </Button>
                </Group>
              </Card>
            </Box>
          )}

          <Box h={rem(32)} />
        </Container>
      </Box>
    </DatesProvider>
  );
}

// ====== SlotTimePicker
function SlotTimePicker({
  value,
  onChange,
  label = 'Horário',
  placeholder = 'Selecionar',
  error,
  disabledSlots = [],
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  error?: string | null;
  disabledSlots?: string[];
}) {
  const [opened, { open, close, toggle }] = useDisclosure(false);

  return (
    <Popover opened={opened} onChange={(o) => (o ? open() : close())} width={260} position="bottom-start" shadow="md">
      <Popover.Target>
        <TextInput
          label={label}
          placeholder={placeholder}
          value={value}
          readOnly
          onClick={toggle}
          leftSection={<IconClockHour4 size={16} />}
          rightSection={<IconChevronDown size={16} />}
          size="md"
          error={error}
          styles={{ input: { height: '48px', cursor: 'pointer', backgroundColor: '#fff' } }}
        />
      </Popover.Target>

      <Popover.Dropdown>
        <SimpleGrid cols={3} spacing={8}>
          {ALLOWED_SLOTS.map((slot) => {
            const blocked = disabledSlots.includes(slot);
            return (
              <UnstyledButton
                key={slot}
                onClick={() => {
                  if (blocked) return;
                  onChange(slot);
                  close();
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: value === slot ? '2px solid #0e7a7f' : '1px solid rgba(0,0,0,.12)',
                  background: blocked ? '#f0f0f0' : value === slot ? 'rgba(14,122,127,.08)' : '#fff',
                  fontWeight: 400,
                  fontSize: 14,
                  textAlign: 'center',
                  opacity: blocked ? 0.4 : 1,
                  cursor: blocked ? 'not-allowed' : 'pointer',
                  textDecoration: blocked ? 'line-through' : 'none',
                }}
              >
                {slot}
              </UnstyledButton>
            );
          })}
        </SimpleGrid>
      </Popover.Dropdown>
    </Popover>
  );
}
