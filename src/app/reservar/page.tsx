'use client';

export const dynamic = 'force-dynamic';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { DatesProvider, DatePickerInput } from '@mantine/dates';
import {
  Popover, TextInput, SimpleGrid, UnstyledButton,
  Container, Group, Button, Title, Text, Card, Grid, Badge,
  Select, NumberInput, Alert, Stack, Box, rem, Skeleton, Progress, Anchor
} from '@mantine/core';
import { IconChevronDown, IconArrowLeft } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import BoardingPass from './BoardingPass';
import Link from 'next/link';

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
import { useRouter } from 'next/navigation';
import { apiPost, apiGet, API_BASE } from '@/lib/api';


dayjs.locale('pt-br');

/* ===================== DADOS ===================== */
const UNIDADES = [
  { id: 'aguas-claras', label: 'Mané Mercado — Águas Claras' },
  { id: 'arena-brasilia', label: 'Mané Mercado — Arena Brasília' },
];

const AREAS = [
  {
    id: 'salao',
    nome: 'Salão',
    desc: 'Interno, climatizado e confortável',
    foto:
      'https://images.unsplash.com/photo-1541542684-4a9c4af87c03?q=80&w=1600&auto=format&fit=crop',
  },
  {
    id: 'varanda',
    nome: 'Varanda',
    desc: 'Externo, arejado e descontraído',
    foto:
      'https://images.unsplash.com/photo-1582582621950-48b395e0d9b2?q=80&w=1600&auto=format&fit=crop',
  },
  {
    id: 'bar',
    nome: 'Balcão',
    desc: 'Perfeito para 1–2 pessoas',
    foto:
      'https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=1600&auto=format&fit=crop',
  },
];

const STEP_META = [
  { title: 'Reserva', desc: 'Unidade, pessoas e horário' },
  { title: 'Área', desc: 'Escolha onde quer sentar' },
  { title: 'Cadastro', desc: 'Dados necessários.' },
];

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?q=80&w=1600&auto=format&fit=crop';

/* ===================== HELPERS ===================== */
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

// --- Slots de horário permitidos ---
const ALLOWED_SLOTS = [
  // almoço
  '12:00', '12:30', '13:00', '13:30',
  // fim de tarde / noite
  '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30',
  '21:00',
];

function isValidSlot(v: string) {
  return ALLOWED_SLOTS.includes(v);
}
const SLOT_ERROR_MSG = 'Escolha um horário válido da lista';

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
                border: value === slot ? '2px solid var(--mantine-color-green-6)' : '1px solid rgba(0,0,0,.12)',
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

/** ====== Regras de data/horário ====== */
const TODAY_START = dayjs().startOf('day').toDate();
const OPEN_H = 12;
const OPEN_M = 0;
const CLOSE_H = 21;
const CLOSE_M = 30;

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
  return `Horário disponível entre ${String(OPEN_H).padStart(2, '0')}:${String(OPEN_M).padStart(2, '0')} e ${String(CLOSE_H).padStart(2, '0')}:${String(CLOSE_M).padStart(2, '0')}`;
}

/* mapeia onChange do Mantine NumberInput (string|number) -> state (number|'') */
const numberInputHandler =
  (setter: React.Dispatch<React.SetStateAction<number | ''>>) =>
    (v: string | number) =>
      setter(v === '' ? '' : Number(v));

/* ===================== Loading Overlay ===================== */
function LoadingOverlay({ visible }: { visible: boolean }) {
  const msgs = useRef([
    'Verificando disponibilidade...',
    'Escolhendo setor...',
    'Encontrando lugares...',
    'Gerando QR Code...',
    'Finalizando reserva...'
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
            width: 56, height: 56, borderRadius: '9999px',
            margin: '0 auto 12px',
            border: '4px solid #E5F7EC',
            borderTopColor: 'var(--mantine-color-green-6)',
            animation: 'spin 0.9s linear infinite'
          }}
        />
        <Title order={4} fw={400} mb={4}>Efetuando sua reserva</Title>
        <Text size="sm" c="dimmed">{msgs.current[idx]}</Text>
      </Card>
      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </Box>
  );
}

/* ===================== Skeletons ===================== */
function StepSkeleton() {
  return (
    <Stack mt="xs" gap="md">
      <Card withBorder radius="lg" shadow="sm" p="md" style={{ background: '#FBF5E9' }}>
        <Stack gap="md">
          <Skeleton height={44} radius="md" />
          <Grid gutter="md">
            <Grid.Col span={6}><Skeleton height={44} radius="md" /></Grid.Col>
            <Grid.Col span={6}><Skeleton height={44} radius="md" /></Grid.Col>
          </Grid>
          <Grid gutter="md">
            <Grid.Col span={6}><Skeleton height={48} radius="md" /></Grid.Col>
            <Grid.Col span={6}><Skeleton height={48} radius="md" /></Grid.Col>
          </Grid>
          <Skeleton height={36} radius="md" />
        </Stack>
      </Card>
      <Skeleton height={40} radius="md" />
    </Stack>
  );
}

function BoardingPassSkeleton() {
  return (
    <Card withBorder radius="lg" p="lg" shadow="md" mt="sm" style={{ background: '#FBF5E9' }}>
      <Stack gap="xs" align="center">
        <Skeleton height={64} circle />
        <Skeleton height={20} width={160} />
        <Skeleton height={28} width={200} radius="sm" />
        <Skeleton height={14} width="100%" />
        <Card withBorder radius="md" p="md" style={{ width: '100%', background: '#fff' }}>
          <Grid gutter="md" align="center">
            <Grid.Col span={6}><Skeleton height={40} /></Grid.Col>
            <Grid.Col span={6}><Skeleton height={40} /></Grid.Col>
          </Grid>
          <Skeleton height={30} mt="sm" />
          <Skeleton height={18} mt="xs" />
          <Skeleton height={12} mt="md" />
          <Skeleton height={168} radius="md" mt="md" />
        </Card>
      </Stack>
    </Card>
  );
}

/* ===== Ícone grande da etapa ===== */
function stepIconFor(n: number) {
  if (n === 0) return <IconCalendar size={28} />;
  if (n === 1) return <IconMapPin size={28} />;
  return <IconUser size={28} />;
}

/* ===================== COMPONENTE AreaCard ===================== */
function AreaCard({
  foto,
  titulo,
  desc,
  selected,
  onSelect,
}: {
  foto: string;
  titulo: string;
  desc: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const [src, setSrc] = useState(foto || FALLBACK_IMG);

  return (
    <Card
      withBorder
      radius="lg"
      p={0}
      onClick={onSelect}
      style={{
        cursor: 'pointer',
        overflow: 'hidden',
        borderColor: selected ? 'var(--mantine-color-green-5)' : 'transparent',
        boxShadow: selected ? '0 8px 20px rgba(16, 185, 129, .15)' : '0 2px 10px rgba(0,0,0,.06)',
        transition: 'transform .15s ease',
        background: '#FBF5E9',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <Box style={{ position: 'relative', height: 160, background: '#f2f2f2' }}>
        <NextImage
          src={src}
          alt={titulo}
          fill
          sizes="(max-width: 520px) 100vw, 520px"
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
          }}
        />
        {selected && (
          <Badge color="green" variant="filled" style={{ position: 'absolute', top: 10, right: 10 }}>
            Selecionada
          </Badge>
        )}
      </Box>

      <Box p="md">
        <Title order={4} style={{ margin: 0 }}>
          {titulo}
        </Title>
        <Text size="sm" c="dimmed" mt={4} style={{ lineHeight: 1.35 }}>
          {desc}
        </Text>
      </Box>
    </Card>
  );
}

/* ===================== PÁGINA ===================== */
export default function ReservarMane() {
  const router = useRouter();

  // Passos
  const [step, setStep] = useState(0);
  const [stepLoading, setStepLoading] = useState(false);

  // Progresso animado do cabeçalho
  const [progress, setProgress] = useState(0);
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

  // Passo 1
  const [unidade, setUnidade] = useState<string | null>(UNIDADES[0].id);
  const [adultos, setAdultos] = useState<number | ''>(2);
  const [criancas, setCriancas] = useState<number | ''>(0);
  const [data, setData] = useState<Date | null>(null);
  const [hora, setHora] = useState<string>('');
  const [timeError, setTimeError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const handleContinueStep1 = () => {
    console.log('[STEP1] crianças =', criancas, '| typeof =', typeof criancas);
    goToStep(1);
  };

  // Passo 2
  const [areaId, setAreaId] = useState<string | null>(AREAS[0].id);

  // Passo 3 (dados do cliente)
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState<Date | null>(null);

  // Envio
  const [sending, setSending] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdDetail, setCreatedDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // total (antes de canNext1)
  const total = useMemo(() => {
    const a = typeof adultos === 'number' ? adultos : 0;
    const c = typeof criancas === 'number' ? criancas : 0;
    return Math.max(1, Math.min(20, a + c));
  }, [adultos, criancas]);

  const contactOk = isValidEmail(email) && isValidPhone(phone);
  const canNext1 = Boolean(unidade && data && hora && total > 0 && !timeError && !dateError);
  const canNext2 = Boolean(areaId);
  const canFinish = fullName.trim().length >= 3 && onlyDigits(cpf).length === 11 && contactOk;

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

      const reservationISO = joinDateTimeISO(data, hora);
      const birthdayISO = birthday ? dayjs(birthday).startOf('day').toDate().toISOString() : undefined;

      const kidsNum = typeof criancas === 'number' && !Number.isNaN(criancas) ? criancas : 0;

      const payload = {
        fullName,
        cpf: onlyDigits(cpf),
        people: total,
        kids: kidsNum,
        reservationDate: reservationISO!,
        birthdayDate: birthdayISO,
        email: email.trim(),
        phone: onlyDigits(phone),
        unit: unidade ?? undefined,
        area: areaId ?? undefined,
        utm_source: 'site',
        utm_campaign: `${unidade}:${areaId}`,
        source: 'site',
      };

      console.log('[FRONT] payload=', payload, 'kids=', payload.kids, 'type=', typeof payload.kids);

      const res = await apiPost<{ id: string }>('/reservas', payload);
      setCreatedId(res.id);

      // Buscar detalhe p/ pegar reservationCode (e confirmar kids do DB)
      setDetailLoading(true);
      try {
        const detail = await apiGet<any>(`/v1/reservations/${res.id}`);
        setCreatedDetail(detail);
        setCreatedCode(detail?.reservationCode ?? null);
      } catch {
        // fallback silencioso
      } finally {
        setDetailLoading(false);
      }

      goToStep(3);
    } catch (e: any) {
      console.error('[FRONT] confirmarReserva erro:', e);
      setError(e?.message || 'Não foi possível concluir sua reserva agora. Tente novamente.');
    } finally {
      setSending(false);
    }
  }

  // base API & QR — usa API_BASE do helper (sempre absoluto em DEV)
  const apiBase = API_BASE || '';
  const qrUrl = createdId ? `${apiBase}/v1/reservations/${createdId}/qrcode` : '';

  // dados p/ boarding pass (usa detail se disponível)
  const unitLabel =
    UNIDADES.find(u => u.id === unidade)?.label ??
    createdDetail?.unit ??
    '—';

  const areaName =
    AREAS.find(a => a.id === areaId)?.nome ??
    createdDetail?.area ??
    '—';

  const dateStr = createdDetail?.reservationDate
    ? dayjs(createdDetail.reservationDate).format('DD/MM/YYYY')
    : (typeof data === 'object' && data ? dayjs(data).format('DD/MM/YYYY') : '--/--/----');

  const timeStr = createdDetail?.reservationDate
    ? dayjs(createdDetail.reservationDate).format('HH:mm')
    : (hora || '--:--');

  const peopleNum = createdDetail?.people ?? (typeof total === 'number' ? total : 0);
  const kidsNum = createdDetail?.kids ?? (typeof criancas === 'number' ? criancas : 0);

  return (
    <DatesProvider settings={{ locale: 'pt-br' }}>
      <Box style={{ background: '#ffffff', minHeight: '100dvh' }}>
        {/* Overlay de carregamento (confirmar reserva) */}
        <LoadingOverlay visible={sending} />

        {/* HEADER (fluído, sem sticky) */}
        <Container size={480} px="md" style={{ marginTop: '64px', marginBottom: 12 }}>
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
              style={{
                fontFamily: '"Alfa Slab One", system-ui, sans-serif',
                color: '#146C2E',
              }}
            >
              Mané Mercado Reservas
            </Title>

            <Text size="sm" c="dimmed" ta="center" style={{ fontFamily: '"Comfortaa", system-ui, sans-serif' }}>
              Águas Claras & Arena Brasília
            </Text>

            {/* ===== Cabeçalho de etapa + Ícone + Progresso ===== */}
            <Card radius="md" p="sm" style={{ width: '100%', maxWidth: 460, background: '#fff', border: 'none' }} shadow="sm">

              <Stack gap={6} align="stretch">
                {/* Selo com ícone grande */}
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
                {/* ===== Cabeçalho de etapa + Ícone + Progresso ===== */}
                {step < 3 ? (
                  <>
                    <Title order={5} ta="center" fw={400}>
                      {STEP_META[step].title}
                    </Title>
                    <Text size="sm" c="dimmed" ta="center">
                      {STEP_META[step].desc}
                    </Text>
                  </>
                ) : (
                  <>
                    <Title order={5} ta="center" fw={400}>Reserva concluída</Title>
                    <Text size="sm" c="dimmed" ta="center">Seu QR Code foi gerado</Text>
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
            {/* ===== Fim cabeçalho ===== */}
          </Stack>
        </Container>

        {/* CONTEÚDO */}
        <Container
          size={480}
          px="md"
          style={{
            minHeight: '100dvh',
            paddingTop: 12,
            paddingLeft: 'calc(env(safe-area-inset-left) + 16px)',
            paddingRight: 'calc(env(safe-area-inset-right) + 16px)',
            fontFamily: '"Comfortaa", system-ui, sans-serif',
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
                    placeholder="Selecione"
                    data={UNIDADES.map((u) => ({ value: u.id, label: u.label }))}
                    value={unidade}
                    onChange={setUnidade}
                    withAsterisk={false}
                    leftSection={<IconBuildingStore size={16} />}
                  />

                  <Grid gutter="md">
                    <Grid.Col span={6}>
                      <NumberInput
                        label="Adultos"
                        min={1}
                        max={20}
                        value={adultos}
                        onChange={numberInputHandler(setAdultos)}
                        withAsterisk={false}
                        leftSection={<IconUsers size={16} />}
                        clampBehavior="strict"
                      />
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <NumberInput
                        label="Crianças"
                        min={0}
                        max={10}
                        value={criancas}
                        onChange={numberInputHandler(setCriancas)}
                        withAsterisk={false}
                        leftSection={<IconMoodKid size={16} />}
                        clampBehavior="strict"
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
                          const d = (value as unknown as Date | null);
                          setData(d);
                          const invalid = d ? dayjs(d).isBefore(TODAY_START, 'day') : false;
                          setDateError(invalid ? 'Selecione uma data a partir de hoje' : null);
                        }}
                        withAsterisk={false}
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
                        }}
                        label="Horário"
                        placeholder="Selecionar"
                        error={timeError}
                      />
                    </Grid.Col>
                  </Grid>

                  <Card withBorder radius="md" p="sm" style={{ background: '#fffdf7' }}>
                    <Text size="sm" ta="center">
                      <b>Total:</b> {total} pessoa(s) •{' '}
                      <b>Data:</b> {data ? dayjs(data).format('DD/MM') : '--'}/{hora || '--:--'}{' '}
                      {dateError && (
                        <Text component="span" c="red">
                          • {dateError}
                        </Text>
                      )}
                      {timeError && (
                        <Text component="span" c="red">
                          {' '}
                          • {timeError}
                        </Text>
                      )}
                    </Text>
                  </Card>
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
              {AREAS.map((a) => (
                <AreaCard
                  key={a.id}
                  foto={a.foto}
                  titulo={a.nome}
                  desc={a.desc}
                  selected={areaId === a.id}
                  onSelect={() => setAreaId(a.id)}
                />
              ))}

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
                    withAsterisk={false}
                    leftSection={<IconUser size={16} />}
                  />
                  <TextInput
                    label="CPF"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(maskCPF(e.currentTarget.value))}
                    withAsterisk={false}
                  />

                  <Grid gutter="md">
                    <Grid.Col span={12}>
                      <TextInput
                        label="E-mail"
                        placeholder="seuemail@exemplo.com"
                        value={email}
                        onChange={(e) => setEmail(e.currentTarget.value)}
                        withAsterisk={false}
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
                        withAsterisk={false}
                        leftSection={<IconPhone size={16} />}
                        error={phone.length > 0 && !isValidPhone(phone) ? 'Informe um telefone válido' : null}
                      />
                      <Text size="xs" c="dimmed" mt={4}>
                        Usaremos e-mail/telefone apenas para entrar em contato caso necessário.
                      </Text>
                    </Grid.Col>
                  </Grid>

                  <DatePickerInput
                    label="Nascimento (opcional)"
                    placeholder="Selecionar"
                    value={birthday}
                    onChange={(value) => {
                      const d = (value as unknown) as Date | null;
                      setBirthday(d);
                    }}
                    valueFormat="DD/MM/YYYY"
                    allowDeselect
                    size="md"
                    styles={{ input: { height: rem(48) } }}
                    leftSection={<IconCalendar size={16} />}
                    weekendDays={[]}

                    // 👇 facilita escolher anos/meses e abre na década de 1990
                    defaultLevel="decade"
                    defaultDate={new Date(1990, 0, 1)}
                    maxDate={new Date()}
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
                  <b>Unidade:</b> {UNIDADES.find((u) => u.id === unidade)?.label} • <b>Área:</b>{' '}
                  {AREAS.find((a) => a.id === areaId)?.nome}
                  <br />
                  <b>Pessoas:</b> {total} • <b>Data/Hora:</b> {data ? dayjs(data).format('DD/MM') : '--'}/
                  {hora || '--:--'}
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

          {/* PASSO 4 — Boarding Pass */}
          {step === 3 && createdId && (
            detailLoading ? (
              <BoardingPassSkeleton />
            ) : (
              <BoardingPass
                id={createdId}
                code={createdCode ?? createdId}
                qrUrl={qrUrl}
                unitLabel={unitLabel}
                areaName={areaName}
                dateStr={dateStr}
                timeStr={timeStr}
                people={peopleNum}
                kids={kidsNum}
                fullName={createdDetail?.fullName ?? fullName}
                cpf={createdDetail?.cpf ?? cpf}
                emailHint={email}
              />
            )
          )}

          <Box h={rem(32)} />
        </Container>
      </Box>
    </DatesProvider>
  );
}
