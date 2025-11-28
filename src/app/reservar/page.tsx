'use client';

export const dynamic = 'force-dynamic';
import type React from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { DatesProvider, DatePickerInput } from '@mantine/dates';
import {
  Popover,
  TextInput,
  SimpleGrid,
  UnstyledButton,
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
import { getAttributionForPayload } from '@/lib/utm';

dayjs.locale('pt-br');

// regra de grupos grandes / mínimos
const MAX_PEOPLE_WITHOUT_CONCIERGE = 40;
const MIN_PEOPLE = 8; // 👈 mínimo exigido
const CONCIERGE_WPP_LINK =
  'https://wa.me/5561982850776?text=Oi%20Concierge!%20Quero%20reservar%20para%20mais%20de%2040%20pessoas.%20Pode%20me%20ajudar%3F';

/* =========================================================
   Tipos
========================================================= */
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

type ReservationType = 'PARTICULAR' | 'CONFRATERNIZACAO' | 'EMPRESA';
const RES_TYPE_LABEL: Record<ReservationType, string> = {
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

/* =========================================================
   Helpers
========================================================= */
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

/* slots válidos */
const ALLOWED_SLOTS = ['12:00', '12:30', '13:00', '18:00', '18:30', '19:00'];
function isValidSlot(v: string) {
  return ALLOWED_SLOTS.includes(v);
}
const SLOT_ERROR_MSG = 'Escolha um horário válido da lista';

/* janela de horário */
const TODAY_START = dayjs().startOf('day').toDate();
const TOMORROW_START = dayjs().add(1, 'day').startOf('day').toDate(); // 👈 novo
const OPEN_H = 12,
  OPEN_M = 0,
  CLOSE_H = 21,
  CLOSE_M = 30;
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

/* regra: data/hora no passado */
function isPastSelection(date: Date | null, time: string) {
  if (!date || !time) return false;
  const [hh, mm] = time.split(':').map(Number);
  const when = dayjs(date).hour(hh || 0).minute(mm || 0).second(0).millisecond(0);
  return when.isBefore(dayjs());
}

/* 1 dia de antecedência */
const ONE_DAY_AHEAD_MSG = 'Reservas precisam ser feitas com 1 dia de antecedência.'; // 👈 novo
function isSameDayAsToday(d: Date | null) { // 👈 novo
  return !!d && dayjs(d).isSame(dayjs(), 'day');
}

/* onChange NumberInput */
const numberInputHandler =
  (setter: React.Dispatch<React.SetStateAction<number | ''>>) =>
    (v: string | number) =>
      setter(v === '' ? '' : Number(v));

/* =========================================================
   Helpers de imagem
========================================================= */
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
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.protocol === 'http:') {
      url.protocol = 'https:';
      return url.toString();
    }
  } catch {
    // não era absoluta
  }
  return u;
}

function resolvePhotoUrl(raw?: any): string | undefined {
  let s = sanitizePhoto(raw);
  if (!s) return undefined;
  s = s.replace(/\\/g, '/').trim();
  if (s.startsWith('//')) return `https:${s}`;
  if (/^https?:\/\//i.test(s) || s.startsWith('data:')) return toHttps(s);
  s = s.replace(/^\/+/, '/');
  if (!ASSET_BASE) return s.startsWith('/') ? s : `/${s}`;
  if (s.startsWith(ASSET_BASE)) return toHttps(s);
  return toHttps(`${ASSET_BASE}${s.startsWith('/') ? s : `/${s}`}`);
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

/* =========================================================
   Loading overlay
========================================================= */
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
      <Card shadow="md" radius="lg" withBorder p="xl" style={{ textAlign: 'center', width: 320 }}>
        <Box
          aria-hidden
          style={{
            width: 56,
            height: 56,
            borderRadius: '9999px',
            margin: '0 auto 12px',
            border: '4px solid #E5F7EC',
            borderTopColor: 'var(--mantine-color-green-6)',
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

/* =========================================================
   Skeleton
========================================================= */
function StepSkeleton() {
  return (
    <Stack mt="xs" gap="md">
      <Card withBorder radius="lg" shadow="sm" p="md" style={{ background: '#FBF5E9' }}>
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

/* =========================================================
   Ícone da etapa
========================================================= */
function stepIconFor(n: number) {
  // 0: Tipo | 1: Reserva | 2: Área | 3: Cadastro | 4: Concluído
  if (n === 2) return <IconMapPin size={28} />;
  if (n === 3) return <IconUser size={28} />;
  return <IconCalendar size={28} />;
}

/* =========================================================
   AreaCard (sem contagem; mostra só "Poucas vagas disponíveis")
========================================================= */
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

  const LOW_STOCK_THRESHOLD = 8; // <<< ajuste aqui se quiser outro limite
  const showLowStock =
    !disabled &&
    typeof remaining === 'number' &&
    remaining > 0 &&
    remaining <= LOW_STOCK_THRESHOLD;

  return (
    <Card
      withBorder
      radius="lg"
      p={0}
      onClick={() => !disabled && onSelect()}
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        overflow: 'hidden',
        borderColor: selected ? 'var(--mantine-color-green-5)' : 'transparent',
        boxShadow: selected
          ? '0 8px 20px rgba(16, 185, 129, .15)'
          : '0 2px 10px rgba(0,0,0,.06)',
        transition: 'transform .15s ease',
        background: disabled ? '#F4F4F4' : '#FBF5E9',
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

        {/* overlay escuro suave */}
        <Box
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,.45) 100%)',
          }}
        />

        {/* Selo de selecionada */}
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

        {/* ESGOTADO */}
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

        {/* Poucas vagas */}
        {showLowStock && (
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              right: 10,
              background: 'rgba(255,255,255,0.96)',
              color: '#0f5132',
              fontWeight: 800,
              fontSize: 'clamp(12px, 3.5vw, 14px)',
              padding: '6px 10px',
              borderRadius: 12,
              border: '2px solid #0f5132',
              boxShadow: '0 6px 18px rgba(0,0,0,.25)',
              letterSpacing: '.2px',
              textTransform: 'none',
            }}
          >
            Poucas vagas disponíveis
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

/* =========================================================
   WhatsApp + Poster (canvas)
========================================================= */
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

// Poster 1080x1350 (4:5) com QR centralizado horizontalmente
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
  const W = 1080, H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // fundo
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#e7ffe7');
  grad.addColorStop(1, '#e9f7ef');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // moldura
  ctx.strokeStyle = '#146C2E';
  ctx.lineWidth = 16;
  ctx.strokeRect(24, 24, W - 48, H - 48);

  // logo
  try {
    const logo = await loadImage(logoUrl);
    const lw = 360, lh = 140;
    ctx.drawImage(logo, (W - lw) / 2, 80, lw, lh);
  } catch { }

  // título / nome
  ctx.fillStyle = '#146C2E';
  ctx.textAlign = 'center';
  ctx.font = '700 56px system-ui, Arial';
  ctx.fillText('RESERVA CONFIRMADA', W / 2, 300);

  const displayName = firstAndLastName(fullName || '');
  ctx.font = '800 64px system-ui, Arial';
  ctx.fillText(displayName.toUpperCase(), W / 2, 380);

  // dados (à esquerda)
  ctx.textAlign = 'left';
  ctx.font = '600 44px system-ui, Arial';
  ctx.fillStyle = '#0f5132';
  const left = 120, top = 470, lh2 = 70;
  const lines = [
    `Unidade: ${unitLabel}`,
    `Data: ${dateStr}`,
    `Horário: ${timeStr}`,
    `Pessoas: ${people}${kids ? `  •  Crianças: ${kids}` : ''}`,
  ];
  lines.forEach((t, i) => ctx.fillText(t, left, top + i * lh2));

  // QR centralizado (x = (W - s)/2), y ajustado para ficar abaixo dos textos
  if (qrUrl) {
    try {
      const qr = await loadImage(qrUrl, true);
      const s = 360;
      const qrX = (W - s) / 2;  // centralizado
      const qrY = 720;          // abaixo dos textos
      ctx.drawImage(qr, qrX, qrY, s, s);

      // legenda
      ctx.textAlign = 'center';
      ctx.font = '500 28px system-ui, Arial';
      ctx.fillStyle = '#0f5132';
      ctx.fillText('Apresente este QR no check-in', qrX + s / 2, qrY + s + 32);
    } catch { }
  }

  // rodapé
  ctx.textAlign = 'center';
  ctx.font = '500 30px system-ui, Arial';
  ctx.fillStyle = '#166534';
  ctx.fillText('Mané Mercado • mane.com.vc', W / 2, H - 60);

  const blob: Blob = await new Promise((r) =>
    canvas.toBlob((b) => r(b!), 'image/jpeg', 0.92)!
  );
  const fileName = `reserva-mane-${Date.now()}.jpg`;
  const url = URL.createObjectURL(blob);
  return { blob, fileName, url };
}


/* =========================================================
   Helpers novos (Calendar/Email)
========================================================= */
function buildGoogleCalendarUrl({
  title,
  startISO,
  endISO,
  guestEmails,
  details,
  timezone = 'America/Sao_Paulo',
}: {
  title: string;
  startISO: string;
  endISO: string;
  guestEmails: string[];
  details?: string;
  timezone?: string;
}) {
  const fmt = (iso: string) => dayjs(iso).format('YYYYMMDDTHHmmss');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(startISO)}/${fmt(endISO)}`,
    ctz: timezone,
    details: details || '',
    conference: 'hangouts',
  });
  if (guestEmails.length) params.set('add', guestEmails.join(','));
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/* =========================================================
   Página
========================================================= */
export default function ReservarMane() {
  const [reservationType, setReservationType] = useState<ReservationType>('PARTICULAR');

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

  const [adultos, setAdultos] = useState<number | ''>(8);
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

  // erro de mínimo de pessoas
  const peopleError = total < MIN_PEOPLE ? `Mínimo de ${MIN_PEOPLE} pessoas` : null;

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
              setActiveReservation(r);
              setCreatedId(r.id);
              setCreatedCode(r.reservationCode);
              if (r.reservationType) setReservationType(r.reservationType as ReservationType);
              setStep(4);
              return;
            }
          } else {
            localStorage.removeItem(LS_KEY);
          }
        } catch {
          // ignora
        }
      }
    })();
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setUnitsLoading(true);
      setUnitsError(null);
      try {
        const list = await apiGet<any[]>('/v1/units/public/options/list');
        const normalized: UnitOption[] = (list ?? [])
          .map((u: any) => ([
            String(u.id ?? u._id ?? u.slug ?? u.name),
            String(u.name ?? u.title ?? u.slug ?? '')
          ]))
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

  useEffect(() => {
    if (!unidade || units.length === 0) return;
    const unitObj = units.find((u) => u.id === unidade);
    if (unitObj) {
      setActiveUnitPixelFromUnit({ id: unitObj.id, name: unitObj.name, slug: unitObj.slug });
    } else {
      setActiveUnitPixelFromUnit(unidade);
    }
  }, [unidade, units]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!unidade) {
        setAreasMeta({});
        return;
      }
      try {
        let list = await apiGet<any[]>(`/v1/areas/public/by-unit/${encodeURIComponent(unidade)}`);

        // 🔁 Fallback: se vier vazio, tenta disponibilidade de amanhã às 18:00
        if (!Array.isArray(list) || list.length === 0) {
          const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
          const qs = new URLSearchParams({ unitId: String(unidade), date: tomorrow, time: '18:00' }).toString();
          console.warn('[areas-meta] by-unit vazio; usando fallback availability', { unidade });
          const alt = await apiGet<any[]>(`/v1/reservations/public/availability?${qs}`);
          list = Array.isArray(alt) ? alt : [];
        }

        const metaMap: Record<string, AreaMeta> = {};
        for (const a of list) {
          const id = String(a?.id ?? a?._id ?? '');
          if (!id) continue;

          const description = String(a?.description ?? a?.desc ?? a?.area?.description ?? '').trim();
          const iconEmojiRaw =
            a?.iconEmoji ?? a?.icon_emoji ?? a?.area?.iconEmoji ?? a?.area?.icon_emoji;

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

    return () => { alive = false; };
  }, [unidade]);

  const ymd = useMemo(() => (data ? dayjs(data).format('YYYY-MM-DD') : ''), [data]);

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
        const qs = new URLSearchParams({ unitId: String(unidade), date: ymd, time: hora }).toString();
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

          const desc = String(
            a?.description ?? a?.desc ?? a?.area?.description ?? meta?.description ?? ''
          ).trim();

          const icon =
            (typeof a?.iconEmoji === 'string' && a.iconEmoji.trim()) ? a.iconEmoji.trim()
              : (typeof a?.icon_emoji === 'string' && a.icon_emoji.trim()) ? a.icon_emoji.trim()
                : (meta?.iconEmoji ?? null);

          return {
            id,
            name: String(a?.name ?? a?.title ?? meta?.name ?? ''),
            description: desc,
            photoUrl: photo,
            capacity: typeof a?.capacity === 'number' ? a.capacity : undefined,
            available: typeof a?.available === 'number'
              ? a.available
              : (typeof a?.remaining === 'number' ? a.remaining : undefined),
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

  // 👇 exige mínimo na etapa 1
  const canNext1 = Boolean(
    unidade && data && hora && total >= MIN_PEOPLE && !timeError && !dateError && !pastError
  );

  const chosen = areas.find((a) => a.id === areaId);
  const leftChosen = chosen ? chosen.available ?? chosen.capacity ?? 0 : 0;
  const canNext2 = Boolean(areaId) && leftChosen >= (typeof total === 'number' ? total : 0);

  const canFinish =
    fullName.trim().length >= 3 &&
    onlyDigits(cpf).length === 11 &&
    contactOk &&
    !!birthday;

  const [showConcierge, setShowConcierge] = useState(false);

  const handleContinueStep1 = () => {
    setError(null);
    const qty = typeof total === 'number' ? total : 0;

    // 👇 trava por mínimo
    if (qty < MIN_PEOPLE) {
      setError(`Mínimo de ${MIN_PEOPLE} pessoas para reservar.`);
      return;
    }

    // 🔒 hoje não pode avançar
    if (isSameDayAsToday(data)) {
      setError(ONE_DAY_AHEAD_MSG);
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
      // 👇 double check de mínimo
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
      // 🔒 1 dia de antecedência
      if (isSameDayAsToday(data)) {
        setError(ONE_DAY_AHEAD_MSG);
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

      // <<< ADD: UTM/url/ref do cliente
      const attribution = getAttributionForPayload();

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
        // UTM/attribs — prioriza o que veio da URL; mantém fallback antigo
        utm_source: (attribution as any).utm_source ?? 'site',
        utm_medium: (attribution as any).utm_medium ?? null,
        utm_campaign: (attribution as any).utm_campaign ?? `${unidade}:${areaId}`,
        utm_content: (attribution as any).utm_content ?? null,
        utm_term: (attribution as any).utm_term ?? null,
        url: (attribution as any).url ?? (typeof window !== 'undefined' ? window.location.href : null),
        ref: (attribution as any).ref ?? (typeof document !== 'undefined' ? document.referrer || null : null),
        source: 'site',
        reservationType,
      };

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
              setActiveReservation(r);
              setCreatedId(r.id);
              setCreatedCode(r.reservationCode);
              if (r.reservationType) setReservationType(r.reservationType as ReservationType);
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
        // ignora
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
          dateStr:
            reservationLoaded?.reservationDate
              ? dayjs(reservationLoaded.reservationDate).format('DD/MM/YYYY')
              : dayjs(data).format('DD/MM/YYYY'),
          timeStr:
            reservationLoaded?.reservationDate
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
        if (reservationLoaded.reservationType) {
          setReservationType(reservationLoaded.reservationType as ReservationType);
        }
        setActiveReservation(reservationLoaded);
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

  const boardingUnitLabel =
    activeReservation?.unit || units.find((u) => u.id === unidade)?.name || '—';
  const boardingAreaName =
    activeReservation?.areaName || areas.find((a) => a.id === areaId)?.name || '—';
  const boardingDateStr = activeReservation
    ? dayjs(activeReservation.reservationDate).format('DD/MM/YYYY')
    : data
      ? dayjs(data).format('DD/MM/YYYY')
      : '--/--/----';
  const boardingTimeStr = activeReservation
    ? dayjs(activeReservation.reservationDate).format('HH:mm')
    : hora || '--:--';
  const boardingPeople = activeReservation ? activeReservation.people ?? 0 : typeof total === 'number' ? total : 0;
  const boardingKids = activeReservation ? activeReservation.kids ?? 0 : typeof criancas === 'number' ? criancas : 0;
  const boardingFullName = activeReservation?.fullName ?? fullName;
  const boardingCpf = activeReservation?.cpf ?? cpf;
  const boardingEmail = activeReservation?.email ?? email;
  const boardingReservationType =
    (activeReservation as any)?.reservationType ?? reservationType;

  const [shareBusyInternal, setShareBusyInternal] = useState(false);

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
    const text = [
      `Minha reserva no Mané Mercado 🎉`,
      '',
      `• Unidade: ${boardingUnitLabel}`,
      `• Área: ${boardingAreaName}`,
      `• Data: ${boardingDateStr}`,
      `• Horário: ${boardingTimeStr}`,
      `• Pessoas: ${boardingPeople}${boardingKids ? ` (Crianças: ${boardingKids})` : ''}`,
      boardingReservationType ? `• Tipo: ${RES_TYPE_LABEL[boardingReservationType as ReservationType] || boardingReservationType}` : '',
      '',
      `Vem com a gente!`
    ].filter(Boolean).join('\n');

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
      // ignora e cai no wa.me
    }

    const wpp = buildWhatsappLink(text);
    window.open(wpp, '_blank', 'noopener,noreferrer');
  }

  return (
    <DatesProvider settings={{ locale: 'pt-br' }}>
      <Box style={{ background: '#ffffff', minHeight: '100dvh' }}>
        <LoadingOverlay visible={sending || shareBusy} />

        {/* HEADER */}
        <Container
          size="xs"
          px="md"
          style={{ marginTop: '48px', marginBottom: 12, width: '100%' }}
        >
          <Anchor
            component={Link}
            href="/"
            c="dimmed"
            size="sm"
            mt={4}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <IconArrowLeft size={16} />
            Voltar
          </Anchor>
          <Stack gap={8} align="center">
            <NextImage
              src="/images/1.png"
              alt="Mané Mercado"
              width={180}
              height={60}
              style={{ height: 60, width: 'auto' }}
              priority
            />
            <Title
              order={2}
              ta="center"
              fw={400}
              style={{ fontFamily: '"Alfa Slab One", system-ui, sans-serif', color: '#146C2E', fontSize: 'clamp(20px, 5.6vw, 28px)' }}
            >
              Mané Mercado Reservas
            </Title>

            <Text
              size="sm"
              c="dimmed"
              ta="center"
              style={{ fontFamily: '"Comfortaa", system-ui, sans-serif' }}
            >
              Águas Claras &amp; Brasília
            </Text>

            <Card radius="md" p="sm" style={{ width: '100%', maxWidth: 460, background: '#fff', border: 'none' }} shadow="sm">
              <Stack gap={6} align="stretch">
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
                    margin: '0 auto 4px',
                  }}
                >
                  {stepIconFor(step)}
                </Box>

                <Text size="xs" c="dimmed" ta="center">
                  {step < 4 ? `Etapa ${step + 1} de 4` : ''}
                </Text>

                {step < 4 ? (
                  <>
                    <Title order={5} ta="center" fw={400}>
                      {['Tipo', 'Reserva', 'Área', 'Cadastro'][step]}
                    </Title>
                    <Text size="sm" c="dimmed" ta="center">
                      {['Selecione o tipo de reserva', 'Unidade, pessoas e horário', 'Escolha onde quer sentar', 'Dados necessários.'][step]}
                    </Text>
                  </>
                ) : (
                  <>
                    <Title order={5} ta="center" fw={400}>
                      Reserva concluída
                    </Title>
                    <Text size="sm" c="dimmed" ta="center">
                      Seu QR Code foi gerado
                    </Text>
                  </>
                )}

                <Box mt={6}>
                  <Progress
                    value={progress}
                    color="green"
                    size="lg"
                    radius="xl"
                    striped
                    animated
                    styles={{
                      root: { transition: 'width 300ms ease' },
                      section: { transition: 'width 500ms ease' },
                    }}
                  />
                </Box>
              </Stack>
            </Card>
          </Stack>
        </Container>

        {/* CONTEÚDO */}
        <Container
          size="xs"
          px="md"
          style={{
            minHeight: '100dvh',
            paddingTop: 12,
            paddingLeft: 'calc(env(safe-area-inset-left) + 16px)',
            paddingRight: 'calc(env(safe-area-inset-right) + 16px)',
            fontFamily: '"Comfortaa", system-ui, sans-serif',
            width: '100%',
          }}
        >
          {/* PASSO 0 — Tipo */}
          {step === 0 && (
            <Stack mt="xs" gap="md">
              <Card withBorder radius="lg" shadow="sm" p="md" style={{ background: '#FBF5E9' }}>
                <Stack gap="md">
                  <Text size="sm" c="dimmed">Escolha o tipo de reserva</Text>
                  <Grid gutter="md">
                    {([
                      { key: 'ANIVERSÁRIO', label: 'Aniversário', desc: 'Celebre seu dia com uma experiência completa para você e seus convidados.' },
                      { key: 'PARTICULAR', label: 'Particular', desc: 'Para você e seus convidados.' },
                      { key: 'CONFRATERNIZACAO', label: 'Confraternização', desc: 'Formaturas, reuniões de amigos, despedidas...' },
                      { key: 'EMPRESA', label: 'Empresa', desc: 'Eventos corporativos.' },
                    ] as { key: ReservationType; label: string; desc: string }[]).map(opt => (
                      <Grid.Col span={12} key={opt.key}>
                        <Card
                          withBorder
                          radius="md"
                          p="md"
                          onClick={() => setReservationType(opt.key)}
                          style={{
                            cursor: 'pointer',
                            borderColor: reservationType === opt.key ? 'var(--mantine-color-green-5)' : 'transparent',
                            background: reservationType === opt.key ? '#EFFFF3' : '#fff',
                          }}
                        >
                          <Group justify="space-between" align="flex-start">
                            <div>
                              <Title order={4} fw={600} style={{ margin: 0 }}>{opt.label}</Title>
                              <Text size="sm" c="dimmed">{opt.desc}</Text>
                            </div>
                            {reservationType === opt.key && (
                              <Badge color="green" variant="filled">Selecionado</Badge>
                            )}
                          </Group>
                        </Card>
                      </Grid.Col>
                    ))}
                  </Grid>
                </Stack>
              </Card>

              <Group gap="sm">
                <Button
                  color="green"
                  radius="md"
                  onClick={() => goToStep(1)}
                  type="button"
                  style={{ flex: 1 }}
                >
                  Continuar
                </Button>
              </Group>
            </Stack>
          )}

          {/* PASSO 1 — Reserva */}
          {step === 1 && (stepLoading ? (
            <StepSkeleton />
          ) : (
            <Stack mt="xs" gap="md">
              <Card withBorder radius="lg" shadow="sm" p="md" style={{ background: '#FBF5E9' }}>
                <Stack gap="md">
                  <Select
                    label="Unidade"
                    placeholder={unitsLoading ? 'Carregando...' : 'Selecione'}
                    data={units.map((u) => ({ value: u.id, label: u.name }))}
                    value={unidade}
                    onChange={(val) => {
                      setUnidade(val);
                      const u = units.find((x) => x.id === val);
                      if (u) setActiveUnitPixelFromUnit({ id: u.id, name: u.name, slug: u.slug });
                      else if (val) setActiveUnitPixelFromUnit(val);
                    }}
                    withAsterisk
                    leftSection={<IconBuildingStore size={16} />}
                    searchable={false}
                    nothingFoundMessage={unitsLoading ? 'Carregando...' : 'Nenhuma unidade'}
                    error={!unidade ? 'Selecione a unidade' : undefined}
                    allowDeselect={false}
                  />

                  <Grid gutter="md">
                    <Grid.Col span={6}>
                      <NumberInput
                        label="Adultos (mín. total 8)"
                        min={1}
                        value={adultos}
                        onChange={numberInputHandler(setAdultos)}
                        leftSection={<IconUsers size={16} />}
                      />
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <NumberInput
                        label="Crianças"
                        min={0}
                        value={criancas}
                        onChange={numberInputHandler(setCriancas)}
                        leftSection={<IconMoodKid size={16} />}
                      />
                    </Grid.Col>
                  </Grid>

                  <Grid gutter="md">
                    <Grid.Col span={6}>
                      {/* 👇 atualizado: minDate = TOMORROW_START + validações de hoje */}
                      <DatePickerInput
                        locale="pt-br"
                        label="Data"
                        value={data}
                        onChange={(value) => {
                          const d = value as unknown as Date | null;
                          setData(d);

                          // ❌ hoje não pode | ❌ passado não pode
                          const isSameDay = isSameDayAsToday(d);
                          const isPast = d ? dayjs(d).isBefore(TOMORROW_START, 'day') : false;

                          if (isSameDay) {
                            setDateError(ONE_DAY_AHEAD_MSG);
                          } else if (isPast) {
                            setDateError('Selecione uma data a partir de amanhã');
                          } else {
                            setDateError(null);
                          }

                          setPastError(() => {
                            if (!d || !hora) return null;
                            return isPastSelection(d, hora)
                              ? 'Esse horário já passou. Escolha um horário futuro.'
                              : null;
                          });
                        }}
                        valueFormat="DD/MM/YYYY"
                        leftSection={<IconCalendar size={16} />}
                        allowDeselect={false}
                        // 🔒 não deixa escolher hoje no calendário
                        minDate={TOMORROW_START}
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
                      />
                    </Grid.Col>
                  </Grid>

                  <Card withBorder radius="md" p="sm" style={{ background: '#fffdf7' }}>
                    <Text size="sm" ta="center">
                      <b>Tipo:</b> {RES_TYPE_LABEL[reservationType]} • <b>Total:</b> {total} pessoa(s) • <b>Data:</b>{' '}
                      {data ? dayjs(data).format('DD/MM/YY') : '--'} - {hora || '--:--'}{' '}
                      {peopleError && <Text component="span" c="red">• {peopleError}</Text>}
                      {dateError && <Text component="span" c="red">• {dateError}</Text>}
                      {(timeError || pastError) && (
                        <Text component="span" c="red"> • {pastError || timeError}</Text>
                      )}
                    </Text>
                  </Card>

                  {(peopleError || pastError || timeError || dateError) && (
                    <Alert color={peopleError ? 'red' : pastError ? 'red' : 'yellow'} icon={<IconInfoCircle />}>
                      {peopleError || pastError || timeError || dateError}
                    </Alert>
                  )}
                </Stack>
              </Card>

              <Group gap="sm">
                <Button variant="light" radius="md" onClick={() => goToStep(0)} type="button" style={{ flex: 1 }}>
                  Voltar
                </Button>
                <Button color="green" radius="md" disabled={!canNext1} onClick={handleContinueStep1} type="button" style={{ flex: 2 }}>
                  Continuar
                </Button>
              </Group>
            </Stack>
          ))}

          {/* PASSO 2 — Área */}
          {step === 2 && (stepLoading ? (
            <StepSkeleton />
          ) : (
            <Stack mt="xs" gap="md">
              {areasLoading && <Text size="sm" c="dimmed">Carregando áreas...</Text>}
              {areasError && <Alert color="red" icon={<IconInfoCircle />}>{areasError}</Alert>}
              {!areasLoading && !areasError && areas.length === 0 && (
                <Alert color="yellow" icon={<IconInfoCircle />}>Não há áreas cadastradas para esta unidade.</Alert>
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

              <Group gap="sm">
                <Button variant="light" radius="md" onClick={() => goToStep(1)} type="button" style={{ flex: 1 }}>
                  Voltar
                </Button>
                <Button
                  color="green"
                  radius="md"
                  onClick={() => goToStep(3)}
                  disabled={!canNext2}
                  type="button"
                  style={{ flex: 2 }}
                >
                  Continuar
                </Button>
              </Group>
            </Stack>
          ))}

          {/* PASSO 3 — Cadastro */}
          {step === 3 && (stepLoading ? (
            <StepSkeleton />
          ) : (
            <Stack mt="xs" gap="md">
              <Card withBorder radius="lg" shadow="sm" p="md" style={{ background: '#FBF5E9' }}>
                <Stack gap="md">
                  <TextInput
                    label="Nome completo"
                    placeholder="Seu nome"
                    value={fullName}
                    onChange={(e) => setFullName(e.currentTarget.value)}
                    leftSection={<IconUser size={16} />}
                  />
                  <TextInput
                    label="CPF"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(maskCPF(e.currentTarget.value))}
                  />

                  <Grid gutter="md">
                    <Grid.Col span={12}>
                      <TextInput
                        label="E-mail"
                        placeholder="seuemail@exemplo.com"
                        value={email}
                        onChange={(e) => setEmail(e.currentTarget.value)}
                        leftSection={<IconMail size={16} />}
                        error={email.length > 0 && !isValidEmail(email) ? 'Informe um e-mail válido' : null}
                      />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <TextInput
                        label="Telefone"
                        placeholder="(61) 99999-9999"
                        value={phone}
                        onChange={(e) => setPhone(maskPhone(e.currentTarget.value))}
                        leftSection={<IconPhone size={16} />}
                        error={phone.length > 0 && !isValidPhone(phone) ? 'Informe um telefone válido' : null}
                      />
                      <Text size="xs" c="dimmed" mt={4}>
                        Usaremos e-mail/telefone apenas para entrar em contato caso necessário.
                      </Text>
                    </Grid.Col>
                  </Grid>

                  <DatePickerInput
                    label="Nascimento"
                    placeholder="Selecionar"
                    value={birthday}
                    onChange={(value) => {
                      const d = value as unknown as Date | null;
                      setBirthday(d);
                      if (d) setBirthdayError(null);
                    }}
                    valueFormat="DD/MM/YYYY"
                    required
                    allowDeselect={false}
                    size="md"
                    styles={{ input: { height: rem(48) } }}
                    leftSection={<IconCalendar size={16} />}
                    weekendDays={[]}
                    defaultLevel="decade"
                    defaultDate={new Date(1990, 0, 1)}
                    maxDate={new Date()}
                    error={birthdayError || undefined}
                  />
                </Stack>
              </Card>

              {error && (
                <Alert color="red" icon={<IconInfoCircle />}>
                  {error}
                </Alert>
              )}

              <Card withBorder radius="md" p="sm" style={{ background: '#fffdf7' }}>
                <Text size="sm" ta="center">
                  <b>Tipo:</b> {RES_TYPE_LABEL[reservationType]} • <b>Unidade:</b> {units.find((u) => u.id === unidade)?.name ?? '—'} • <b>Área:</b>{' '}
                  {areas.find((a) => a.id === areaId)?.name ?? '—'}
                  <br />
                  <b>Pessoas:</b> {total} • <b>Data/Hora:</b>{' '}
                  {data ? dayjs(data).format('DD/MM') : '--'}/{hora || '--:--'}
                </Text>
              </Card>

              <Group gap="sm">
                <Button variant="light" radius="md" onClick={() => goToStep(2)} type="button" style={{ flex: 1 }}>
                  Voltar
                </Button>
                <Button
                  color="green"
                  radius="md"
                  loading={sending}
                  disabled={!canFinish}
                  onClick={confirmarReserva}
                  type="button"
                  style={{ flex: 2 }}
                >
                  Confirmar reserva
                </Button>
              </Group>
            </Stack>
          ))}

          {/* PASSO 4 — Boarding Pass + Compartilhar */}
          {step === 4 && createdId && (
            <>
              <BoardingPass
                id={createdId}
                code={createdCode ?? createdId}
                qrUrl={qrUrl}
                unitLabel={boardingUnitLabel}
                areaName={boardingAreaName}
                dateStr={boardingDateStr}
                timeStr={boardingTimeStr}
                people={boardingPeople}
                kids={boardingKids}
                fullName={boardingFullName}
                cpf={boardingCpf}
                emailHint={boardingEmail}
                reservationType={boardingReservationType as ReservationType}
              />

              <Card withBorder radius="lg" shadow="sm" p="md" mt="md" style={{ background: '#FBF5E9' }}>
                <Stack gap="xs" align="center">
                  <Title order={5} fw={500}>Compartilhar</Title>
                  <Text size="sm" c="dimmed" ta="center">
                    Gere sua arte personalizada e envie no WhatsApp.
                  </Text>

                  <Group gap="sm" wrap="wrap" justify="center">
                    <Button variant="default" radius="md" onClick={downloadPoster} disabled={shareBusyInternal}>
                      Baixar Convite
                    </Button>
                    <Button color="green" radius="md" onClick={shareWhatsapp} disabled={shareBusyInternal}>
                      Enviar no WhatsApp
                    </Button>
                  </Group>

                  {posterUrl && (
                    <Box mt="sm" style={{ width: '100%', maxWidth: 360 }}>
                      <img
                        src={posterUrl}
                        alt="Prévia da arte"
                        style={{ width: '100%', height: 'auto', borderRadius: 12, border: '1px solid rgba(0,0,0,.08)' }}
                      />
                    </Box>
                  )}
                </Stack>
              </Card>
            </>
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
              <Card withBorder radius="lg" shadow="md" p={0} style={{ width: 480, maxWidth: '100%', overflow: 'hidden' }}>
                <Box px="md" py="sm" style={{ borderBottom: '1px solid rgba(0,0,0,.08)', background: '#fff' }}>
                  <Title order={4} fw={500} m={0}>Reserva para grupo grande</Title>
                </Box>
                <Box px="md" py="md">
                  <Text>
                    Para reservas acima de <b>{MAX_PEOPLE_WITHOUT_CONCIERGE}</b> pessoas, é necessário falar com nosso concierge pelo WhatsApp.
                  </Text>
                  <Text size="sm" c="dimmed" mt={6}>
                    Assim garantimos a melhor organização do espaço e atendimento do seu grupo. 🙂
                  </Text>
                </Box>
                <Group justify="end" gap="sm" px="md" py="sm" style={{ borderTop: '1px solid rgba(0,0,0,.08)', background: '#fff' }}>
                  <Button variant="default" onClick={() => setShowConcierge(false)}>Fechar</Button>
                  <Button component="a" href={CONCIERGE_WPP_LINK} target="_blank" rel="noreferrer" color="green">
                    Abrir WhatsApp (61 98285-0776)
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

/* =========================================================
   SlotTimePicker
========================================================= */
function SlotTimePicker({
  value,
  onChange,
  label = 'Horário',
  placeholder = 'Selecionar',
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  error?: string | null;
}) {
  const [opened, { open, close, toggle }] = useDisclosure(false);

  return (
    <Popover
      opened={opened}
      onChange={(o) => (o ? open() : close())}
      width={260}
      position="bottom-start"
      shadow="md"
    >
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
          {ALLOWED_SLOTS.map((slot) => (
            <UnstyledButton
              key={slot}
              onClick={() => {
                onChange(slot);
                close();
              }}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border:
                  value === slot
                    ? '2px solid var(--mantine-color-green-6)'
                    : '1px solid rgba(0,0,0,.12)',
                background: value === slot ? 'rgba(34,197,94,.08)' : '#fff',
                fontWeight: 400,
                fontSize: 14,
                textAlign: 'center',
              }}
            >
              {slot}
            </UnstyledButton>
          ))}
        </SimpleGrid>
      </Popover.Dropdown>
    </Popover>
  );
}
