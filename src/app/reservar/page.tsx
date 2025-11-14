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

dayjs.locale('pt-br');

// regra de grupos grandes
const MAX_PEOPLE_WITHOUT_CONCIERGE = 40;
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

/* onChange NumberInput */
const numberInputHandler =
  (setter: React.Dispatch<React.SetStateAction<number | ''>>) =>
    (v: string | number) =>
      setter(v === '' ? '' : Number(v));

/* =========================================================
   Helpers de imagem (normalizar URL da API)
========================================================= */
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

// força https quando a página está em https (evita mixed content)
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

  // normaliza barras invertidas e espaços
  s = s.replace(/\\/g, '/').trim();

  // suporta //cdn...
  if (s.startsWith('//')) return `https:${s}`;

  // absoluta (http/https/data)
  if (/^https?:\/\//i.test(s) || s.startsWith('data:')) {
    return toHttps(s);
  }

  // remove barras extras do começo
  s = s.replace(/^\/+/, '/');

  // se não tiver base, devolver relativo com /
  if (!ASSET_BASE) {
    return s.startsWith('/') ? s : `/${s}`;
  }

  // evita duplicar base
  if (s.startsWith(ASSET_BASE)) return toHttps(s);

  return toHttps(`${ASSET_BASE}${s.startsWith('/') ? s : `/${s}`}`);
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
  if (n === 0) return <IconCalendar size={28} />;
  if (n === 1) return <IconMapPin size={28} />;
  return <IconUser size={28} />;
}

/* =========================================================
   AreaCard
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
        boxShadow: selected ? '0 8px 20px rgba(16, 185, 129, .15)' : '0 2px 10px rgba(0,0,0,.06)',
        transition: 'transform .15s ease',
        background: disabled ? '#F4F4F4' : '#FBF5E9',
        opacity: disabled ? 0.7 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <Box style={{ position: 'relative', height: 'clamp(120px, 32vw, 160px)', background: '#f2f2f2' }}>
        <NextImage
          src={src}
          alt={titulo}
          fill
          sizes="(max-width: 520px) 100vw, 520px"
          style={{ objectFit: 'cover' }}
          onError={() => setSrc(FALLBACK_IMG)}
          priority={false}
          unoptimized
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
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
        {typeof remaining === 'number' && (
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
              textTransform: 'uppercase',
            }}
          >
            VAGAS: {remaining}
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

// Gera um poster 1080x1350 (4:5) com logo, nome e dados da reserva.
// Retorna { blob, fileName, url }
async function generatePoster({
  fullName,
  unitLabel,
  areaName,      // mantido na assinatura (não usado na arte)
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
    const lw = 420, lh = 140;
    ctx.drawImage(logo, (W - lw) / 2, 80, lw, lh);
  } catch { }

  // título
  ctx.fillStyle = '#146C2E';
  ctx.font = '700 56px system-ui, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('RESERVA CONFIRMADA', W / 2, 300);

  // Nome (apenas primeiro + último)
  const displayName = firstAndLastName(fullName || '');
  ctx.font = '800 64px system-ui, Arial';
  ctx.fillText(displayName.toUpperCase(), W / 2, 380);

  // dados
  ctx.textAlign = 'left';
  ctx.font = '600 44px system-ui, Arial';
  const left = 120, top = 470, lh2 = 70;
  const lines = [
    `Unidade: ${unitLabel}`,
    `Data: ${dateStr}`,
    `Horário: ${timeStr}`,
    `Pessoas: ${people}${kids ? `  •  Crianças: ${kids}` : ''}`,
  ];
  ctx.fillStyle = '#0f5132';
  lines.forEach((t, i) => ctx.fillText(t, left, top + i * lh2));

  // QR opcional
  if (qrUrl) {
    try {
      const qr = await loadImage(qrUrl, true);
      const s = 360;
      ctx.drawImage(qr, W - s - 120, top - 40, s, s);
      ctx.font = '500 28px system-ui, Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f5132';
      ctx.fillText('Apresente este QR no check-in', W - s / 2 - 120, top + s + 20);
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
function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
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
  const [step, setStep] = useState(0);
  const [stepLoading, setStepLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // estados de reserva criada/ativa
  const [activeReservation, setActiveReservation] = useState<ReservationDto | null>(null);

  // boot analytics
  const bootedRef = useRef(false);
  useEffect(() => {
    if (bootedRef.current) return;
    ensureAnalyticsReady();
    bootedRef.current = true;
  }, []);

  // progresso do header
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    const targets = [33, 66, 100, 100];
    const target = targets[Math.min(step, 3)];
    requestAnimationFrame(() => setProgress(target));
  }, [step]);

  const goToStep = (n: number) => {
    setStepLoading(true);
    setStep(n);
    const t = setTimeout(() => setStepLoading(false), 250);
    return () => clearTimeout(t);
  };

  // unidades
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [unidade, setUnidade] = useState<string | null>(null);

  // áreas (lista atual renderizada)
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [areasError, setAreasError] = useState<string | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);

  // ⭐ metadados estáticos das áreas (emoji/descrição/foto) por unidade
  const [areasMeta, setAreasMeta] = useState<Record<string, AreaMeta>>({});

  // passo 1
  const [adultos, setAdultos] = useState<number | ''>(2);
  const [criancas, setCriancas] = useState<number | ''>(0);
  const [data, setData] = useState<Date | null>(null);
  const [hora, setHora] = useState<string>('');
  const [timeError, setTimeError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [pastError, setPastError] = useState<string | null>(null); // 👈 novo

  // passo 3
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [birthdayError, setBirthdayError] = useState<string | null>(null); // 👈 obrigatório

  // envio
  const [sending, setSending] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // compartilhamento
  const [shareBusy, setShareBusy] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [posterBlob, setPosterBlob] = useState<Blob | null>(null);
  const [posterName, setPosterName] = useState<string | null>(null);

  // cálculo total (sem teto 👇)
  const total = useMemo(() => {
    const a = typeof adultos === 'number' ? adultos : 0;
    const c = typeof criancas === 'number' ? criancas : 0;
    return Math.max(1, a + c);
  }, [adultos, criancas]);

  /* =========================================================
     1) Checar LS e API /v1/reservations/public/active
  ========================================================= */
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
              setStep(3);
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

  /* =========================================================
     2) Carregar unidades
  ========================================================= */
  useEffect(() => {
    let alive = true;
    (async () => {
      setUnitsLoading(true);
      setUnitsError(null);
      try {
        const list = await apiGet<any[]>('/v1/units/public/options/list');
        const normalized: UnitOption[] = (list ?? []).map((u: any) => ({
          id: String(u.id ?? u._id ?? u.slug ?? u.name),
          name: String(u.name ?? u.title ?? u.slug ?? ''),
          slug: u.slug ?? undefined,
        }));
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

  /* ativa pixel por unidade */
  useEffect(() => {
    if (!unidade || units.length === 0) return;
    const unitObj = units.find((u) => u.id === unidade);
    if (unitObj) {
      setActiveUnitPixelFromUnit({ id: unitObj.id, name: unitObj.name, slug: unitObj.slug });
    } else {
      setActiveUnitPixelFromUnit(unidade);
    }
  }, [unidade, units]);

  /* =========================================================
     2.1) Carregar metadados das áreas por unidade (normalizando foto)
  ========================================================= */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!unidade) {
        setAreasMeta({});
        return;
      }
      try {
        const list = await apiGet<any[]>(`/v1/areas/public/by-unit/${unidade}`);
        const metaMap: Record<string, AreaMeta> = {};
        for (const a of list ?? []) {
          const id = String(a?.id ?? a?._id);
          const description = String(a?.description ?? a?.desc ?? a?.area?.description ?? '').trim();
          const iconEmojiRaw =
            a?.iconEmoji ?? a?.icon_emoji ?? a?.area?.iconEmoji ?? a?.area?.icon_emoji;

          metaMap[id] = {
            id,
            name: String(a?.name ?? a?.title ?? ''),
            description,
            photoUrl:
              resolvePhotoUrl(
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
                a?.area?.coverUrl
              ) || null,
            iconEmoji:
              typeof iconEmojiRaw === 'string' && iconEmojiRaw.trim()
                ? iconEmojiRaw.trim()
                : null,
          };
        }
        if (!alive) return;
        setAreasMeta(metaMap);
      } catch {
        if (!alive) return;
        setAreasMeta({});
      }
    })();
    return () => {
      alive = false;
    };
  }, [unidade]);

  /* =========================================================
     3) carregar áreas conforme unidade/data/hora (priorizar foto da disponibilidade)
  ========================================================= */
  const ymd = useMemo(() => (data ? dayjs(data).format('YYYY-MM-DD') : ''), [data]);

  useEffect(() => {
    let alive = true;

    if (!unidade) {
      setAreas([]);
      setAreaId(null);
      return;
    }

    // sem data/hora → usa apenas metadados carregados
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

    // com data/hora → disponibilidade + merge de metadados
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

          // prioriza foto da disponibilidade; se não houver, cai para meta; sempre normaliza
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

          const photo = resolvePhotoUrl(rawPhoto);

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

        // ajusta área selecionada conforme vagas
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

  /* =========================================================
     REGRAS de navegação
  ========================================================= */
  const contactOk = isValidEmail(email) && isValidPhone(phone);
  const canNext1 = Boolean(unidade && data && hora && total > 0 && !timeError && !dateError && !pastError);

  const chosen = areas.find((a) => a.id === areaId);
  const leftChosen = chosen ? chosen.available ?? chosen.capacity ?? 0 : 0;
  const canNext2 = Boolean(areaId) && leftChosen >= (typeof total === 'number' ? total : 0);

  const canFinish =
    fullName.trim().length >= 3 &&
    onlyDigits(cpf).length === 11 &&
    contactOk &&
    !!birthday; // 👈 aniversário obrigatório

  // estado do modal Concierge 40+
  const [showConcierge, setShowConcierge] = useState(false);

  const handleContinueStep1 = () => {
    setError(null);

    // trava grupo grande só no clique de Continuar
    const qty = typeof total === 'number' ? total : 0;
    if (qty > MAX_PEOPLE_WITHOUT_CONCIERGE) {
      setShowConcierge(true);
      return;
    }

    goToStep(1);
  };

  /* =========================================================
     Confirmação da Reserva
  ========================================================= */
  async function confirmarReserva() {
    setSending(true);
    setError(null);
    try {
      if (!data || !hora) {
        setError('Selecione data e horário.');
        goToStep(0);
        setSending(false);
        return;
      }
      if (dayjs(data).isBefore(TODAY_START, 'day')) {
        setError('Data inválida. Selecione uma data a partir de hoje.');
        goToStep(0);
        setSending(false);
        return;
      }
      if (isPastSelection(data, hora)) {
        setError('Esse horário já passou. Selecione um horário no futuro.');
        goToStep(0);
        setSending(false);
        return;
      }
      if (isTimeOutsideWindow(hora)) {
        setError(`Horário indisponível. ${timeWindowMessage()}.`);
        goToStep(0);
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
        setSending(false);
        return;
      }
      if (!birthday) {
        setError(null);
        setBirthdayError('Obrigatório');
        goToStep(2);
        setSending(false);
        return;
      }

      const reservationISO = joinDateTimeISO(data, hora);
      const birthdayISO = birthday ? dayjs(birthday).startOf('day').toDate().toISOString() : undefined;
      const kidsNum = typeof criancas === 'number' && !Number.isNaN(criancas) ? criancas : 0;

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
        utm_source: 'site',
        utm_campaign: `${unidade}:${areaId}`,
        source: 'site',
      };

      const resp = await fetch(`${API_BASE || ''}/v1/reservations/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await resp.json().catch(() => ({} as any));

      if (!resp.ok) {
        if (resp.status === 409 && json?.error?.code === 'ALREADY_HAS_ACTIVE_RESERVATION') {
          const activeId = json.error.reservationId as string;
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
              setStep(3);

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
          json?.error?.message ||
          json?.message ||
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
      setStep(3);

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
        };
        localStorage.setItem(LS_KEY, JSON.stringify(lsPayload));
      }

      if (reservationLoaded) {
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
        });
      }
    } finally {
      setSending(false);
    }
  }

  /* =========================================================
     Construção de campos do Boarding
  ========================================================= */
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

  /* =========================================================
     Compartilhar (WhatsApp simples com arte)
  ========================================================= */
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
      '',
      `Vem com a gente!`
    ].join('\n');

    // tenta Web Share API com arquivo
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

    // fallback: abre WhatsApp com o texto (e deixamos botão de baixar a arte ao lado)
    const wpp = buildWhatsappLink(text);
    window.open(wpp, '_blank', 'noopener,noreferrer');
  }

  /* =========================================================
     Render
  ========================================================= */
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
                  {step < 3 ? `Etapa ${step + 1} de 3` : ''}
                </Text>

                {step < 3 ? (
                  <>
                    <Title order={5} ta="center" fw={400}>
                      {['Reserva', 'Área', 'Cadastro'][step]}
                    </Title>
                    <Text size="sm" c="dimmed" ta="center">
                      {['Unidade, pessoas e horário', 'Escolha onde quer sentar', 'Dados necessários.'][step]}
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
          {/* PASSO 1 */}
          {step === 0 && (stepLoading ? (
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
                        label="Adultos"
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
                      <DatePickerInput
                        locale="pt-br"
                        label="Data"
                        value={data}
                        onChange={(value) => {
                          const d = value as unknown as Date | null;
                          setData(d);
                          const invalid = d ? dayjs(d).isBefore(TODAY_START, 'day') : false;
                          setDateError(invalid ? 'Selecione uma data a partir de hoje' : null);

                          // regra: horário no passado (hoje com horário anterior ao atual)
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

                          // regra: horário no passado (hoje com horário anterior ao atual)
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
                      <b>Total:</b> {total} pessoa(s) • <b>Data:</b>{' '}
                      {data ? dayjs(data).format('DD/MM') : '--'}/{hora || '--:--'}{' '}
                      {dateError && <Text component="span" c="red">• {dateError}</Text>}
                      {(timeError || pastError) && (
                        <Text component="span" c="red"> • {pastError || timeError}</Text>
                      )}
                    </Text>
                  </Card>

                  {(pastError || timeError || dateError) && (
                    <Alert color={pastError ? 'red' : 'yellow'} icon={<IconInfoCircle />}>
                      {pastError || timeError || dateError}
                    </Alert>
                  )}
                </Stack>
              </Card>

              <Button color="green" radius="md" disabled={!canNext1} onClick={handleContinueStep1} type="button">
                Continuar
              </Button>
            </Stack>
          ))}

          {/* PASSO 2 */}
          {step === 1 && (stepLoading ? (
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
                    titulo={`${a.name}${typeof left === 'number' ? ` • ${left} vagas` : ''}`}
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
                <Button variant="light" radius="md" onClick={() => goToStep(0)} type="button" style={{ flex: 1 }}>
                  Voltar
                </Button>
                <Button
                  color="green"
                  radius="md"
                  onClick={() => goToStep(2)}
                  disabled={!canNext2}
                  type="button"
                  style={{ flex: 2 }}
                >
                  Continuar
                </Button>
              </Group>
            </Stack>
          ))}

          {/* PASSO 3 */}
          {step === 2 && (stepLoading ? (
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
                    label="Nascimento *"
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
                  <b>Unidade:</b> {units.find((u) => u.id === unidade)?.name ?? '—'} • <b>Área:</b>{' '}
                  {areas.find((a) => a.id === areaId)?.name ?? '—'}
                  <br />
                  <b>Pessoas:</b> {total} • <b>Data/Hora:</b>{' '}
                  {data ? dayjs(data).format('DD/MM') : '--'}/{hora || '--:--'}
                </Text>
              </Card>

              <Group gap="sm">
                <Button variant="light" radius="md" onClick={() => goToStep(1)} type="button" style={{ flex: 1 }}>
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
          {step === 3 && createdId && (
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

          {/* Modal Concierge 40+ */}
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
