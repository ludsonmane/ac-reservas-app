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
import { useEffect, useMemo, useRef, useState, memo } from 'react';
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

/* normalizador de URL de foto (usa API_BASE quando vier relativa) */
function normalizePhotoUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const s = String(url).trim();
  if (!s) return undefined;
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) return s;
  const base = API_BASE || '';
  return `${base}${s.startsWith('/') ? s : `/${s}`}`;
}

/* onChange NumberInput */
const numberInputHandler =
  (setter: React.Dispatch<React.SetStateAction<number | ''>>) =>
    (v: string | number) =>
      setter(v === '' ? '' : Number(v));

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
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Skeleton height={44} radius="md" />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Skeleton height={44} radius="md" />
            </Grid.Col>
          </Grid>
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Skeleton height={48} radius="md" />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
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
    // atualiza quando a prop mudar (troca de área / disponibilidade)
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
        boxShadow: selected ? '0 8px 20px rgba(16,185,129,.15)' : '0 2px 10px rgba(0,0,0,.06)',
        transition: 'transform .12s ease, box-shadow .12s ease',
        background: disabled ? '#F4F4F4' : '#FBF5E9',
        opacity: disabled ? 0.7 : 1,
        willChange: 'transform',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <Box
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9', // mantém proporção em qualquer tela
          background: '#f2f2f2',
        }}
      >
        <NextImage
          src={src}
          alt={titulo}
          fill
          sizes="(max-width: 600px) 100vw, 580px"
          style={{ objectFit: 'cover' }}
          onError={() => setSrc(FALLBACK_IMG)}
          priority={false}
          unoptimized
        />
        <Box
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,.45) 100%)',
            pointerEvents: 'none',
          }}
        />
        {selected && !disabled && (
          <Badge color="green" variant="filled" style={{ position: 'absolute', top: 10, right: 10 }}>
            Selecionada
          </Badge>
        )}
        {disabled && (
          <Badge color="red" variant="filled" style={{ position: 'absolute', top: 10, right: 10 }}>
            Esgotado
          </Badge>
        )}
        {typeof remaining === 'number' && (
          <Badge color="green" variant="light" style={{ position: 'absolute', bottom: 10, right: 10 }}>
            Vagas: {remaining}
          </Badge>
        )}
      </Box>

      <Box p="md">
        <Title order={4} style={{ margin: 0 }}>
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
   Linha de convidado (fix do foco)
========================================================= */
type GuestRow = { clientId: string; name: string; email: string };

const GuestInputRow = memo(function GuestInputRow(props: {
  idx: number;
  row: GuestRow;
  setGuestRows: React.Dispatch<React.SetStateAction<GuestRow[]>>;
}) {
  const { idx, row, setGuestRows } = props;

  const updateName = (value: string) => {
    setGuestRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], name: value };
      return next;
    });
  };

  const updateEmail = (value: string) => {
    setGuestRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], email: value };
      return next;
    });
  };

  return (
    <Grid gutter="sm" align="center">
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <TextInput
          label={`Nome ${idx + 1}`}
          placeholder="Nome do convidado"
          value={row.name}
          onChange={(e) => updateName(e.currentTarget.value)}
          autoComplete="off"
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <TextInput
          label={`E-mail ${idx + 1}`}
          placeholder="email@exemplo.com"
          value={row.email}
          onChange={(e) => updateEmail(e.currentTarget.value)}
          error={row.email && !isEmail(row.email) ? 'E-mail inválido' : undefined}
          autoComplete="off"
        />
      </Grid.Col>
    </Grid>
  );
});

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
     2.1) Carregar metadados das áreas por unidade
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
            photoUrl: (normalizePhotoUrl(a?.photoUrl ?? a?.photo) ?? null),
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
     3) carregar áreas conforme unidade/data/hora
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
        photoUrl: m.photoUrl || undefined, // já normalizada
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
          const rawPhoto = a.photoUrl ?? a.photo ?? meta?.photoUrl ?? '';
          const photo = normalizePhotoUrl(rawPhoto) || undefined;
          const desc = String(a.description ?? a.desc ?? a.area?.description ?? meta?.description ?? '').trim();
          const icon =
            (typeof a.iconEmoji === 'string' && a.iconEmoji.trim()) ? a.iconEmoji.trim() :
              (typeof a.icon_emoji === 'string' && a.icon_emoji.trim()) ? a.icon_emoji.trim() :
                (meta?.iconEmoji ?? null);

          return {
            id,
            name: String(a.name ?? a.title ?? meta?.name ?? ''),
            description: desc,
            photoUrl: photo, // <<-- sempre prioriza banco (normalizado)
            capacity: typeof a.capacity === 'number' ? a.capacity : undefined,
            available:
              typeof a.available === 'number'
                ? a.available
                : (typeof a.remaining === 'number' ? a.remaining : undefined),
            isAvailable: Boolean(a.isAvailable ?? (a.available ?? a.remaining ?? 0) > 0),
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
     Compartilhar com a lista (estado e UI)
  ========================================================= */
  const mkGuestRow = (): GuestRow => ({
    clientId: (globalThis.crypto?.randomUUID?.() ?? String(Math.random())),
    name: '',
    email: '',
  });

  const [shareOpen, setShareOpen] = useState(false);
  // 👉 começa com APENAS 1 convidado
  const [guestRows, setGuestRows] = useState<GuestRow[]>([mkGuestRow()]);
  const [savingGuests, setSavingGuests] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  async function handleShareSubmit() {
    setShareError(null);

    const clearList = guestRows
      .map((g) => ({ name: g.name.trim(), email: g.email.trim().toLowerCase() }))
      .filter((g) => g.name || g.email);

    if (clearList.length === 0) {
      setShareError('Preencha ao menos um convidado.');
      return;
    }
    for (const g of clearList) {
      if (!g.name) {
        setShareError('Há convidado sem nome.');
        return;
      }
      if (!isEmail(g.email)) {
        setShareError(`E-mail inválido encontrado: ${g.email}`);
        return;
      }
    }
    if (!createdId) {
      setShareError('ID da reserva não encontrado.');
      return;
    }

    setSavingGuests(true);
    try {
      const api = API_BASE || '';
      const GUESTS_ENDPOINT = `${api}/v1/reservations/${createdId}/guests`;
      const payload = {
        guests: clearList.map((g) => ({
          name: g.name,
          email: g.email,
          role: 'GUEST' as const,
        })),
      };

      const resp = await fetch(GUESTS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j?.message || 'Falha ao salvar convidados.');
      }

      const who = (activeReservation?.fullName || fullName || '').trim() || 'Cliente';
      const title = `RESERVA DO ${who.toUpperCase()} NO MANÉ MERCADO`;

      const startISO =
        activeReservation?.reservationDate ||
        joinDateTimeISO(data, hora) ||
        dayjs().add(15, 'minute').toDate().toISOString();
      const endISO = dayjs(startISO).add(2, 'hour').toDate().toISOString();

      const details = [
        `Código: ${createdCode || activeReservation?.reservationCode || '-'}`,
        `Unidade: ${boardingUnitLabel}`,
        `Área: ${boardingAreaName}`,
        `Data/Hora: ${boardingDateStr} ${boardingTimeStr}`,
        `Pessoas: ${boardingPeople} (Crianças: ${boardingKids})`,
        '',
        'Gerado pelo sistema de reservas do Mané Mercado.',
      ].join('\n');

      const calendarUrl = buildGoogleCalendarUrl({
        title,
        startISO,
        endISO,
        guestEmails: clearList.map((g) => g.email),
        details,
        timezone: 'America/Sao_Paulo',
      });

      if (typeof window !== 'undefined') {
        window.open(calendarUrl, '_blank', 'noopener,noreferrer');
      }

      setShareOpen(false);
      setShareError(null);
    } catch (e: any) {
      setShareError(e?.message || 'Erro ao compartilhar convidados.');
    } finally {
      setSavingGuests(false);
    }
  }

  function ShareListModal() {
    if (!shareOpen) return null;
    return (
      <Box
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.45)',
          zIndex: 90,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
        role="dialog"
        aria-modal="true"
      >
        <Card
          withBorder
          radius="lg"
          shadow="lg"
          p={0}
          style={{ width: 720, maxWidth: '100%', overflow: 'hidden', background: '#fff' }}
        >
          <Box px="md" py="sm" style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>
            <Title order={4} fw={600} m={0}>
              Compartilhar com a lista
            </Title>
            <Text size="sm" c="dimmed" mt={4}>
              Adicione os nomes e e-mails de quem você quer convidar. Começamos com 1 campo — você pode adicionar mais.
            </Text>
          </Box>

          <Box px="md" py="md" style={{ maxHeight: '65vh', overflow: 'auto' }}>
            <Stack gap="xs">
              {guestRows.map((row, idx) => (
                <GuestInputRow
                  key={`guest-${idx}`} // índice estável
                  idx={idx}
                  row={row}
                  setGuestRows={setGuestRows}
                />
              ))}

              <Group justify="center" mt="xs">
                <Button
                  variant="light"
                  onClick={() => setGuestRows((prev) => [...prev, mkGuestRow()])}
                >
                  + Adicionar convidado
                </Button>
              </Group>

              {shareError && (
                <Alert color="red" icon={<IconInfoCircle />}>
                  {shareError}
                </Alert>
              )}
            </Stack>
          </Box>

          <Group justify="end" gap="sm" px="md" py="sm" style={{ borderTop: '1px solid rgba(0,0,0,.08)' }}>
            <Button variant="default" onClick={() => setShareOpen(false)} disabled={savingGuests}>
              Cancelar
            </Button>
            <Button color="green" onClick={handleShareSubmit} loading={savingGuests}>
              Salvar & abrir Google Meet
            </Button>
          </Group>
        </Card>
      </Box>
    );
  }

  /* =========================================================
     Render
  ========================================================= */
  return (
    <DatesProvider settings={{ locale: 'pt-br' }}>
      <Box
        style={{
          background: '#ffffff',
          minHeight: '100dvh',
          overflowX: 'hidden', // evita scroll lateral
        }}
      >
        <LoadingOverlay visible={sending} />

        {/* HEADER */}
        <Container
          size="xs"
          px="md"
          style={{
            marginTop: 64,
            marginBottom: 12,
            width: '100%',
            maxWidth: 580,
          }}
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
              width={150}
              height={40}
              style={{ height: 40, width: 'auto' }}
              priority
            />
            <Title
              order={2}
              ta="center"
              fw={400}
              style={{ fontFamily: '"Alfa Slab One", system-ui, sans-serif', color: '#146C2E' }}
            >
              Mané Mercado Reservas
            </Title>

            <Text
              size="sm"
              c="dimmed"
              ta="center"
              style={{ fontFamily: '"Comfortaa", system-ui, sans-serif' }}
            >
              Águas Claras &amp; Arena Brasília
            </Text>

            <Card
              radius="md"
              p="sm"
              style={{ width: '100%', maxWidth: 460, background: '#fff', border: 'none' }}
              shadow="sm"
            >
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
                      section: { transition: 'width 300ms ease' },
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
            maxWidth: 580,
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
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Adultos"
                        min={1}
                        value={adultos}
                        onChange={numberInputHandler(setAdultos)}
                        leftSection={<IconUsers size={16} />}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
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
                    <Grid.Col span={{ base: 12, sm: 6 }}>
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
                        closeOnChange
                        // 👇 posiciona o popover imediatamente abaixo do input (inclusive no mobile)
                        popoverProps={{
                          withinPortal: true,
                          position: 'bottom-start',
                          middlewares: { shift: true, flip: true, inline: true },
                          offset: 8,
                          zIndex: 310,
                        }}
                      />

                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6 }}>
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

              <Group gap="sm" grow>
                <Button fullWidth variant="light" radius="md" onClick={() => goToStep(0)} type="button">
                  Voltar
                </Button>
                <Button
                  fullWidth
                  color="green"
                  radius="md"
                  onClick={() => goToStep(2)}
                  disabled={!canNext2}
                  type="button"
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
                    // 👇 garante popover “grudado” ao input (iOS/Android também)
                    popoverProps={{
                      withinPortal: true,
                      position: 'bottom-start',
                      middlewares: { shift: true, flip: true, inline: true },
                      offset: 8,
                      zIndex: 310,
                    }}
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

              <Group gap="sm" grow>
                <Button fullWidth variant="light" radius="md" onClick={() => goToStep(1)} type="button">
                  Voltar
                </Button>
                <Button
                  fullWidth
                  color="green"
                  radius="md"
                  loading={sending}
                  disabled={!canFinish}
                  onClick={confirmarReserva}
                  type="button"
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
                  <Title order={5} fw={500}>Compartilhar com a lista</Title>
                  <Text size="sm" c="dimmed" ta="center">
                    Convide sua galera por e-mail e já deixe uma reunião do Google pronta para alinharem os detalhes.
                  </Text>
                  <Button color="green" radius="md" onClick={() => setShareOpen(true)}>
                    COMPARTILHAR COM A LISTA
                  </Button>
                </Stack>
              </Card>

              {/* Modal de convidados */}
              <ShareListModal />
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
      width="target"
      position="bottom-start"
      shadow="md"
      withinPortal
      keepMounted
      middlewares={{ shift: true, flip: true, inline: true }}
      offset={8}
      zIndex={310}
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
          styles={{ input: { height: 48, cursor: 'pointer', backgroundColor: '#fff' } }}
        />
      </Popover.Target>

      <Popover.Dropdown>
        <SimpleGrid cols={{ base: 3, sm: 6 }} spacing={8}>
          {ALLOWED_SLOTS.map((slot) => (
            <UnstyledButton
              key={slot}
              onClick={() => {
                onChange(slot);
                close();
              }}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
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
