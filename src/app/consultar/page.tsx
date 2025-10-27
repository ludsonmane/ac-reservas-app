'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Container,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
  rem,
  Alert,
  Divider,
  Modal,
  Skeleton,
  Anchor,
} from '@mantine/core';
import { IconSearch, IconInfoCircle, IconArrowLeft } from '@tabler/icons-react';
import Image from 'next/image';
import dayjs from 'dayjs';
import BoardingPass from '../reservar/BoardingPass';
import Link from 'next/link';
import { API_BASE } from '@/lib/api';
import { useSearchParams } from 'next/navigation'; // ⬅️ NOVO

/* ====== helpers/consts ====== */
const UNIDADES = [
  { id: 'aguas-claras', label: 'Mané Mercado — Águas Claras' },
  { id: 'arena-brasilia', label: 'Mané Mercado — Arena Brasília' },
];

const AREAS = [
  { id: 'salao', nome: 'Salão' },
  { id: 'varanda', nome: 'Varanda' },
  { id: 'bar', nome: 'Balcão' },
];

function labelFromUnitId(id?: string | null) {
  if (!id) return undefined;
  return UNIDADES.find((u) => u.id === id)?.label;
}
function areaNameFromId(id?: string | null) {
  if (!id) return undefined;
  return AREAS.find((a) => a.id === id)?.nome;
}

/* ====== tipos ====== */
type ReservationDTO = {
  id: string;
  reservationCode?: string | null;
  reservationDate: string;
  people: number;
  kids?: number | null;
  unit?: string | null;       // compat
  unitId?: string | null;     // novo
  area?: string | null;       // compat
  areaName?: string | null;   // novo
  utm_campaign?: string | null;
  fullName?: string | null;
  cpf?: string | null;
  email?: string | null;
};

type BPInput = {
  id: string;
  code: string;
  qrUrl: string;
  unitLabel: string;
  areaName: string;
  dateStr: string;
  timeStr: string;
  people: number;
  kids?: number;
  fullName?: string | null;
  cpf?: string | null;
  emailHint?: string | null;
};

/* ====== Skeletons ====== */
function BoardingPassSkeleton() {
  return (
    <Card withBorder radius="lg" p="lg" shadow="md" mt="sm" style={{ background: '#FBF5E9' }}>
      <Stack gap="xs" align="center">
        <Skeleton height={64} circle />
        <Skeleton height={18} width={180} />
        <Skeleton height={26} width={200} radius="sm" />
        <Skeleton height={14} width="100%" />
        <Card withBorder radius="md" p="md" style={{ width: '100%', background: '#fff' }}>
          <Group justify="space-between">
            <Skeleton height={36} width={120} />
            <Skeleton height={36} width={80} />
          </Group>
          <Skeleton height={20} mt="sm" />
          <Skeleton height={28} mt="xs" />
          <Skeleton height={14} mt="md" />
          <Skeleton height={168} radius="md" mt="md" />
        </Card>
      </Stack>
    </Card>
  );
}

function ConsultarSkeletonInline() {
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
      <Container size={560} px="md" style={{ paddingTop: rem(40), paddingBottom: rem(24) }}>
        <Anchor c="dimmed" size="sm" mb={rem(8)} style={{ visibility: 'hidden' }}>
          Voltar
        </Anchor>

        <Stack align="center" gap={6} mb="sm">
          <Skeleton height={44} width={160} radius="sm" />
          <Skeleton height={28} width={220} radius="sm" />
          <Skeleton height={14} width={280} radius="xl" />
        </Stack>

        <Card withBorder radius="lg" p="lg" shadow="sm" style={{ background: '#FBF5E9' }}>
          <Stack gap="md">
            <Title order={3} ta="center" fw={600} style={{ fontSize: 22 }}>
              <Skeleton height={26} width={240} mx="auto" radius="sm" />
            </Title>
            <Card withBorder radius="md" p="md" shadow="xs" style={{ background: '#fff' }}>
              <Stack gap="md">
                <Skeleton height={16} width={160} radius="sm" />
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

/* ====== Página ====== */
export default function ConsultarReservaPage() {
  const [hydrated, setHydrated] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [bpProps, setBpProps] = useState<BPInput | null>(null);

  const searchParams = useSearchParams(); // ⬅️ NOVO

  useEffect(() => {
    const id = setTimeout(() => setHydrated(true), 200);
    return () => clearTimeout(id);
  }, []);

  // ⬅️ NOVO: pegar ?code= da URL e jogar no input (sem auto-buscar)
  useEffect(() => {
    const raw = searchParams?.get('code') || searchParams?.get('c') || '';
    if (raw) {
      setCode(normalizeCode(raw));
    }
  }, [searchParams]);

  const showSkeleton = !hydrated;

  // Normaliza para A-Z/0-9 e remove espaços
  function normalizeCode(v: string) {
    return v.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  }

  async function buscar() {
    const normalized = normalizeCode(code);
    if (!/^[A-Z0-9]{6}$/.test(normalized)) {
      setError('Informe um código válido (6 caracteres A–Z/0–9, ex.: JT5WK6).');
      setBpProps(null);
      setOpened(false);
      return;
    }

    setLoading(true);
    setError(null);
    setBpProps(null);
    setOpened(true);

    try {
      // 1) Público novo
      let url = `${API_BASE}/v1/reservations/public/lookup?code=${encodeURIComponent(normalized)}`;
      let r = await fetch(url, { cache: 'no-store' });

      // 2) Fallback (rotas antigas)
      if (r.status === 404) {
        url = `${API_BASE}/v1/reservations/lookup?code=${encodeURIComponent(normalized)}`;
        r = await fetch(url, { cache: 'no-store' });
      }
      if (r.status === 404) {
        url = `${API_BASE}/v1/reservations/code/${encodeURIComponent(normalized)}`;
        r = await fetch(url, { cache: 'no-store' });
      }

      if (!r.ok) {
        throw new Error(r.status === 404 ? 'Reserva não encontrada.' : 'Falha ao consultar reserva.');
      }

      const data = (await r.json()) as ReservationDTO;

      // tenta novas props; fallback para utm_campaign "unit:area" do legado
      let unitId = data.unitId || data.unit || undefined;
      let areaName = data.areaName || data.area || undefined;

      if ((!unitId || !areaName) && data.utm_campaign) {
        const [u, a] = data.utm_campaign.split(':');
        unitId = unitId || u;
        areaName = areaName || a;
      }

      const unitLabel = labelFromUnitId(unitId) || (data.unit ?? 'Mané Mercado');
      const areaFinal = areaNameFromId(areaName || '') || (areaName ?? '—');

      const dateStr = dayjs(data.reservationDate).format('DD/MM/YYYY');
      const timeStr = dayjs(data.reservationDate).format('HH:mm');

      const bp: BPInput = {
        id: data.id,
        code: data.reservationCode || normalized,
        qrUrl: `${API_BASE}/v1/reservations/${data.id}/qrcode`,
        unitLabel,
        areaName: String(areaFinal),
        dateStr,
        timeStr,
        people: data.people ?? 0,
        kids: data.kids ?? 0,
        fullName: data.fullName ?? null,
        cpf: data.cpf ?? null,
        emailHint: data.email ?? null,
      };
      setBpProps(bp);
    } catch (e: any) {
      setError(e?.message || 'Falha ao consultar reserva.');
      setOpened(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      style={{
        minHeight: '100dvh',
        background: '#ffffff',
        fontFamily: '"Comfortaa", system-ui, sans-serif',
      }}
    >
      {showSkeleton ? (
        <ConsultarSkeletonInline />
      ) : (
        <Container size={560} px="md" style={{ paddingTop: rem(40), paddingBottom: rem(24) }}>
          {/* Voltar */}
          <Anchor
            component={Link}
            href="/"
            c="dimmed"
            size="sm"
            mb={rem(8)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <IconArrowLeft size={16} />
            Voltar
          </Anchor>

          {/* Header */}
          <Stack align="center" gap={6} mb="sm">
            <Image
              src="/images/1.png"
              alt="Mané Mercado"
              width={160}
              height={44}
              priority
              style={{ height: 44, width: 'auto' }}
            />
            <Title
              order={2}
              fw={500}
              ta="center"
              style={{
                color: '#146C2E',
                fontFamily: '"Alfa Slab One", system-ui, sans-serif',
              }}
            >
              Localizar Reserva
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              Use seu código (ex.: <b>JT5WK6</b>) para visualizar a reserva e o QR.
            </Text>
          </Stack>

          {/* Formulário de busca */}
          <Card withBorder radius="lg" p="lg" shadow="sm" style={{ background: '#FBF5E9' }}>
            <Stack gap="md">
              <TextInput
                label="Código da reserva"
                placeholder="Digite o código (ex.: JT5WK6)"
                value={code}
                onChange={(e) => setCode(e.currentTarget.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }} // ⬅️ Enter para buscar
                autoComplete="off"
                spellCheck={false}
                maxLength={6}
                styles={{ input: { textTransform: 'uppercase', letterSpacing: '0.08em' } }}
              />
              <Group justify="center">
                <Button
                  onClick={buscar}
                  loading={loading}
                  leftSection={<IconSearch size={18} />}
                  color="green"
                  radius="md"
                >
                  Buscar
                </Button>
              </Group>

              {error && (
                <Alert color="red" icon={<IconInfoCircle />}>
                  {error}
                </Alert>
              )}
            </Stack>
          </Card>

          <Divider my="lg" opacity={0} />

          {/* MODAL DO TICKET */}
          <Modal
            opened={opened}
            onClose={() => setOpened(false)}
            centered
            size="lg"
            radius="lg"
            overlayProps={{ blur: 2, opacity: 0.35 }}
            styles={{
              header: { display: 'none' },
              body: { paddingTop: 0 },
              content: { background: 'transparent', boxShadow: 'none' },
            }}
            withCloseButton={false}
          >
            {bpProps ? (
              <BoardingPass
                id={bpProps.id}
                code={bpProps.code}
                qrUrl={bpProps.qrUrl}
                unitLabel={bpProps.unitLabel}
                areaName={bpProps.areaName}
                dateStr={bpProps.dateStr}
                timeStr={bpProps.timeStr}
                people={bpProps.people}
                kids={bpProps.kids ?? 0}
                fullName={bpProps.fullName ?? undefined}
                cpf={bpProps.cpf ?? undefined}
                emailHint={bpProps.emailHint ?? undefined}
              />
            ) : (
              <BoardingPassSkeleton />
            )}
          </Modal>
        </Container>
      )}
    </Box>
  );
}
