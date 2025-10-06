'use client';

import { useState } from 'react';
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

/* ====== helpers/consts ====== */
// mesmas opções usadas no fluxo de reserva (apenas para mapear labels)
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
  return UNIDADES.find(u => u.id === id)?.label;
}
function areaNameFromId(id?: string | null) {
  if (!id) return undefined;
  return AREAS.find(a => a.id === id)?.nome;
}

/* ====== tipos ====== */
type ReservationDTO = {
  id: string;
  reservationCode?: string | null;
  reservationDate: string;
  people: number;
  kids?: number | null;

  // mapeamentos
  unit?: string | null;          // 'aguas-claras'
  area?: string | null;          // 'salao'
  utm_campaign?: string | null;  // fallback "unidade:area"
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

/* ====== Skeleton do BoardingPass (igual padrão da reserva) ====== */
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

/* ====== Página ====== */
export default function ConsultarReservaPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // modal
  const [opened, setOpened] = useState(false);
  const [bpProps, setBpProps] = useState<BPInput | null>(null);

  async function buscar() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Informe o código da reserva (ex.: JT5WK6).');
      setBpProps(null);
      setOpened(false);
      return;
    }

    setLoading(true);
    setError(null);
    setBpProps(null);
    setOpened(true); // abre a modal imediatamente e mostra skeleton

    const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

    try {
      // recomendado:
      // GET /v1/reservations/lookup?code=JT5WK6
      let url = `${base}/v1/reservations/lookup?code=${encodeURIComponent(trimmed)}`;
      let r = await fetch(url, { cache: 'no-store' });

      // fallback alternativo (se preferir /code/:code)
      if (r.status === 404) {
        url = `${base}/v1/reservations/code/${encodeURIComponent(trimmed)}`;
        r = await fetch(url, { cache: 'no-store' });
      }

      if (!r.ok) {
        throw new Error(r.status === 404 ? 'Reserva não encontrada.' : 'Falha ao consultar reserva.');
      }

      const data = (await r.json()) as ReservationDTO;

      // Deriva props para o BoardingPass
      let unitId = data.unit || undefined;
      let areaId = data.area || undefined;

      if ((!unitId || !areaId) && data.utm_campaign) {
        const [u, a] = data.utm_campaign.split(':');
        unitId = unitId || u;
        areaId = areaId || a;
      }

      const unitLabel = labelFromUnitId(unitId) || 'Mané Mercado';
      const areaName = areaNameFromId(areaId) || '—';

      const dateStr = dayjs(data.reservationDate).format('DD/MM/YYYY');
      const timeStr = dayjs(data.reservationDate).format('HH:mm');

      const bp: BPInput = {
        id: data.id,
        code: (data.reservationCode || trimmed),
        qrUrl: `${base}/v1/reservations/${data.id}/qrcode`,
        unitLabel,
        areaName,
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

  const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

  return (
    <Box
      style={{
        minHeight: '100dvh',
        background: '#ffffff',
        fontFamily: '"Comfortaa", system-ui, sans-serif',
      }}
    >
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
              autoComplete="off"
              spellCheck={false}
              maxLength={12}
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

        {/* Não renderizamos o BoardingPass embaixo — apenas na modal */}
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
            header: { display: 'none' }, // some o header da modal
            body: { paddingTop: 0 },
            content: { background: 'transparent', boxShadow: 'none' },
          }}
          withCloseButton={false}
        >
          {/* Conteúdo da modal: Skeleton enquanto busca, Boarding ao carregar */}
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
    </Box>
  );
}
