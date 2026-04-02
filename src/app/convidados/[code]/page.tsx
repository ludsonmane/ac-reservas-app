'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Button,
  Card,
  Container,
  Group,
  Stack,
  Text,
  TextInput,
  Alert,
  rem,
} from '@mantine/core';
import { IconUser, IconId, IconInfoCircle, IconCheck } from '@tabler/icons-react';
import NextImage from 'next/image';
import { apiGet, apiPost } from '@/lib/api';

/* CPF mask */
function maskCPF(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

type Reservation = {
  id: string;
  reservationCode: string;
  fullName: string;
  date?: string;
  time?: string;
  reservationDate?: string;
  adults: number;
  kids: number;
  reservationType: string;
  unit?: string;
  unitRef?: { name: string };
  area?: string;
  areaRef?: { name: string };
  areaName?: string;
  guests?: { id: string; name: string; cpf?: string; createdAt: string }[];
};

export default function ConvidadosPage() {
  const params = useParams();
  const code = (params?.code as string || '').toUpperCase();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!code) return;
    (async () => {
      try {
        const r = await apiGet<Reservation>(`/v1/reservations/public/by-code/${code}`);
        setReservation(r);
      } catch (e: any) {
        setError('Reserva não encontrada.');
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  async function handleSubmit() {
    setFormError('');
    const cleanCpf = cpf.replace(/\D/g, '');
    if (!name.trim() || name.trim().length < 2) {
      setFormError('Preencha seu nome.');
      return;
    }
    if (cleanCpf.length !== 11) {
      setFormError('CPF inválido.');
      return;
    }
    setSending(true);
    try {
      await apiPost('/v1/reservations/public/guest-register', {
        code,
        name: name.trim(),
        cpf: cleanCpf,
      });
      setSuccess(true);
      // Refresh guests list
      try {
        const r = await apiGet<Reservation>(`/v1/reservations/public/by-code/${code}`);
        setReservation(r);
      } catch {}
    } catch (e: any) {
      const msg = e?.message || 'Erro ao registrar.';
      if (msg.includes('já está')) {
        setFormError('Você já está na lista de convidados!');
      } else {
        setFormError(msg);
      }
    } finally {
      setSending(false);
    }
  }

  // Parse date — usa reservationDate (ISO) como fonte principal
  const rawDate = reservation?.reservationDate || reservation?.date || '';
  const dateObj = rawDate ? new Date(rawDate) : null;

  const monthNames: Record<number, string> = { 0: 'Janeiro', 1: 'Fevereiro', 2: 'Março', 3: 'Abril', 4: 'Maio', 5: 'Junho', 6: 'Julho', 7: 'Agosto', 8: 'Setembro', 9: 'Outubro', 10: 'Novembro', 11: 'Dezembro' };
  const weekDays: Record<number, string> = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };

  const dayName = dateObj ? weekDays[dateObj.getDay()] : '';
  const dayNum = dateObj ? dateObj.getDate() : '';
  const monthName = dateObj ? monthNames[dateObj.getMonth()] : '';
  const timeStr = dateObj ? `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}` : (reservation?.time || '');

  const firstName = (reservation?.fullName || '').split(/\s+/)[0] || '';
  const guestCount = reservation?.guests?.length ?? 0;

  // Benefícios por tier (só aniversário)
  const isAniversario = (reservation?.reservationType || '').toUpperCase().includes('ANIVERSARIO');
  const totalPeople = (reservation?.adults || 0) + (reservation?.kids || 0);
  const tier = totalPeople >= 30 ? 3 : totalPeople >= 16 ? 2 : totalPeople >= 8 ? 1 : 0;
  const tierInfo = {
    1: { bonus: 'R$100', perks: ['Brinquedoteca day use para 1 criança'] },
    2: { bonus: 'R$150', perks: ['Brinquedoteca day use para 2 crianças'] },
    3: { bonus: 'R$200', perks: ['Garrafa de Caju do Mané', 'Brinquedoteca para 2 crianças', 'Cardápio personalizado — menu 3 etapas'] },
  }[tier] || null;

  return (
    <Box style={{ background: 'linear-gradient(180deg, #034c46 0%, #022d29 100%)', minHeight: '100dvh' }}>
      <Container size="xs" px="md" py="xl" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
        {/* Logo */}
        <Box style={{ textAlign: 'center' as const }} mb="lg">
          <NextImage
            src="/images/1.png"
            alt="Mané Mercado"
            width={120}
            height={40}
            style={{ height: 36, width: 'auto', margin: '0 auto', filter: 'brightness(0) invert(1)', opacity: 0.7 }}
            priority
          />
        </Box>

        {loading && (
          <Text c="rgba(243,233,217,0.5)" ta="center">Carregando...</Text>
        )}

        {error && !loading && (
          <Card radius="lg" p="lg" style={{ background: 'rgba(255,255,255,0.06)', textAlign: 'center' as const }}>
            <Text c="#F3E9D9" size="lg" fw={700}>Reserva não encontrada</Text>
            <Text c="rgba(243,233,217,0.5)" size="sm" mt="sm">Verifique o código e tente novamente.</Text>
          </Card>
        )}

        {reservation && !loading && (
          <Stack gap="md">
            {/* Header do convite */}
            <Box style={{ textAlign: 'center' as const }}>
              <Text c="rgba(243,233,217,0.45)" size="xs">VOCÊ FOI CONVIDADO POR</Text>
              <Text
                c="#F0D48A"
                mt={4}
                style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 700, fontStyle: 'italic', fontSize: 'clamp(1.5rem, 6vw, 2.2rem)' }}
              >
                {firstName}
              </Text>
              <Text c="rgba(243,233,217,0.5)" size="sm" mt={4} lh={1.4}>
                {isAniversario ? `para seu Aniversário no Mané!` : `para uma experiência no Mané!`}
              </Text>
            </Box>

            {/* Info da reserva */}
            <Card radius="lg" p="md" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(243,233,217,0.08)' }}>
              <Group justify="space-between" align="center">
                <Box>
                  <Text c="#F0D48A" fw={800} style={{ fontSize: 'clamp(2rem, 8vw, 3rem)', lineHeight: 1, fontFamily: 'system-ui' }}>
                    {dayNum}
                  </Text>
                  <Text c="rgba(243,233,217,0.6)" size="xs" mt={2}>{dayName} • {monthName}</Text>
                </Box>
                <Box style={{ textAlign: 'right' as const }}>
                  <Text c="#F3E9D9" fw={700} size="lg">{timeStr}</Text>
                  <Text c="rgba(243,233,217,0.5)" size="xs" mt={2}>{reservation.unitRef?.name || reservation.unit || ''}</Text>
                </Box>
              </Group>
            </Card>

            {/* Benefícios que o aniversariante ganhou */}
            {isAniversario && tierInfo && (
              <Card radius="lg" p="md" style={{ background: 'linear-gradient(135deg, #F7EDD5 0%, #EEDBB5 100%)', border: '1.5px solid rgba(200,144,42,0.3)' }}>
                <Text size="xs" c="#B8842A" fw={600} ta="center">
                  🎂 Aniversário de {firstName}
                </Text>
                <Text size="xs" c="#5a4a35" ta="center" mt={4} lh={1.4}>
                  Com {totalPeople} convidados, {firstName} ganhou:
                </Text>

                <Box mt={10} p="sm" style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 10 }}>
                  <Text fw={900} c="#034c46" ta="center" size="xl" style={{ fontFamily: 'var(--font-merri), Merriweather, serif' }}>
                    {tierInfo.bonus}
                  </Text>
                  <Text size="10px" c="#B8842A" ta="center" fw={600} tt="uppercase">de bônus em consumação</Text>

                  <Stack gap={4} mt={8}>
                    {tierInfo.perks.map((p) => (
                      <Group key={p} gap={6} align="center" wrap="nowrap" justify="center">
                        <Box style={{ width: 4, height: 4, borderRadius: '50%', background: '#C8902A', flexShrink: 0, opacity: 0.6 }} />
                        <Text size="xs" c="#5a4a35" lh={1.4}>{p}</Text>
                      </Group>
                    ))}
                  </Stack>
                </Box>

                <Text size="10px" c="#B8842A" mt={8} ta="center" lh={1.3} style={{ fontStyle: 'italic' }}>
                  Registre-se abaixo para confirmar sua presença na celebração.
                </Text>
              </Card>
            )}

            {/* Form ou sucesso */}
            {success ? (
              <Card radius="lg" p="lg" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', textAlign: 'center' as const }}>
                <IconCheck size={40} color="#22c55e" style={{ margin: '0 auto' }} />
                <Text c="#F3E9D9" fw={700} size="md" mt="sm">Pronto, {name.split(' ')[0]}!</Text>
                <Text c="rgba(243,233,217,0.6)" size="sm" mt={4} lh={1.4}>
                  Você está na lista. Apresente seu CPF na entrada do Mané.
                </Text>
                {isAniversario && tierInfo && (
                  <Text c="#F0D48A" size="sm" fw={600} mt={8}>
                    Você faz parte da celebração de {firstName}! 🎉
                  </Text>
                )}
              </Card>
            ) : (
              <Card radius="lg" p="md" style={{ background: '#fff' }}>
                <Stack gap="sm">
                  <Text size="sm" fw={600} c="#034c46">
                    Confirme sua presença
                  </Text>
                  <Text size="xs" c="dimmed" lh={1.4}>
                    Registre seu nome e CPF para garantir os benefícios da reserva e agilizar sua entrada.
                  </Text>

                  <TextInput
                    label="Seu nome"
                    placeholder="Nome completo"
                    value={name}
                    onChange={(e) => setName(e.currentTarget.value)}
                    leftSection={<IconUser size={16} />}
                    size="md"
                    styles={{ input: { height: rem(48) } }}
                  />
                  <TextInput
                    label="CPF"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(maskCPF(e.currentTarget.value))}
                    leftSection={<IconId size={16} />}
                    size="md"
                    styles={{ input: { height: rem(48) } }}
                  />

                  {formError && (
                    <Alert color="red" radius="md" icon={<IconInfoCircle size={16} />}>
                      {formError}
                    </Alert>
                  )}

                  <Button
                    color="green"
                    radius="md"
                    size="md"
                    fullWidth
                    loading={sending}
                    onClick={handleSubmit}
                    style={{ fontWeight: 700 }}
                  >
                    Confirmar presença
                  </Button>

                  <Group gap={8} justify="center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <Text size="9px" c="dimmed">Seus dados estão protegidos</Text>
                  </Group>
                </Stack>
              </Card>
            )}

            {/* Lista de convidados confirmados */}
            {guestCount > 0 && (
              <Box>
                <Text size="xs" c="rgba(243,233,217,0.35)" ta="center" mb={6}>
                  {guestCount} convidado{guestCount > 1 ? 's' : ''} confirmado{guestCount > 1 ? 's' : ''}
                </Text>
                <Group gap={6} justify="center" wrap="wrap">
                  {reservation.guests!.map((g) => (
                    <Box
                      key={g.id}
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        borderRadius: 8,
                        padding: '4px 10px',
                      }}
                    >
                      <Text size="xs" c="rgba(243,233,217,0.6)">{g.name.split(' ')[0]}</Text>
                    </Box>
                  ))}
                </Group>
              </Box>
            )}
          </Stack>
        )}
      </Container>
    </Box>
  );
}
