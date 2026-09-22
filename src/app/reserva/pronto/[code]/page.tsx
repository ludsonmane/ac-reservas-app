'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { IconBrandWhatsapp, IconCalendarPlus, IconCopy, IconPencil } from '@tabler/icons-react';
import { apiGet, getBaseUrl } from '@/lib/api';
import s from '../../reserva.module.css';
import { StepHeader } from '../../_components/StepHeader';
import { track } from '../../_lib/track';
import { detectSlug, metaFor, conciergeLink } from '../../_lib/units';

dayjs.locale('pt-br');

type Reservation = {
  id: string; reservationCode: string; fullName: string; people: number; kids: number; reservationDate: string;
  unit?: string | null; unitRef?: { name?: string } | null; areaName?: string | null; areaRef?: { name?: string } | null;
  reservationType?: string | null; status?: string; phone?: string | null;
};

// Tela 3 (versão inicial da etapa 2; a etapa 3 do plano completa: alterar, cancelar, agenda .ics).
export default function Pronto() {
  const { code } = useParams<{ code: string }>();
  const [r, setR] = React.useState<Reservation | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [bonus, setBonus] = React.useState('');
  React.useEffect(() => { try { setBonus(window.sessionStorage.getItem('mane:reserva:bonus') || ''); } catch { /* ok */ } }, []);

  React.useEffect(() => {
    if (!code) return;
    apiGet<Reservation>(`/v1/reservations/public/by-code/${encodeURIComponent(String(code).toUpperCase())}`)
      .then((x) => { setR(x); track('step_view', { step: 'pronto' }); })
      .catch((e) => setErr(e?.message || 'Reserva não encontrada.'));
  }, [code]);

  if (err) {
    return (
      <>
        <StepHeader step={3} />
        <div className={`${s.alert} ${s.alertBad}`}><b>Não achamos essa reserva.</b><span>{err}</span><span><a className={s.linkBtn} href="/reserva">Fazer uma reserva</a></span></div>
      </>
    );
  }
  if (!r) return <StepHeader step={3} />;

  const when = dayjs(r.reservationDate);
  const unitName = (r.unitRef?.name || r.unit || '').replace(/,.*$/, '');
  const slug = detectSlug(null, unitName);
  const meta = metaFor(slug);
  const area = (r.areaRef?.name || r.areaName || '').replace(/^Ala\s+/i, '');
  const first = (r.fullName || '').split(/\s+/)[0];
  const qr = `${getBaseUrl()}/v1/reservations/${r.id}/qrcode`;
  const guestLink = `${typeof window !== 'undefined' ? window.location.origin : 'https://reservas.mane.com.vc'}/convidados/${r.reservationCode}`;
  const tolEnd = when.add(45, 'minute').format('HH[h]mm');
  const weekday = when.format('dddd');
  const invite = `Você tem lugar na mesa.\n\n${first} guardou uma mesa no ${unitName} para ${weekday}, ${when.format('DD/MM')}, às ${when.format('HH[h]mm')}, e colocou você na lista.\n\nSeu código de entrada: ${r.reservationCode}\nMostre na porta e vá direto para a mesa. O lugar é seu até ${tolEnd}.\n\nConfirme que vai e veja como chegar: ${guestLink}`;
  const waShare = `https://wa.me/?text=${encodeURIComponent(invite)}`;
  const gIso = (d: dayjs.Dayjs) => d.toDate().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Mesa no ${unitName}`)}&dates=${gIso(when)}/${gIso(when.add(2, 'hour'))}&details=${encodeURIComponent(`Código ${r.reservationCode}. ${r.people} pessoas, ${area}. Sua mesa espera você por 15 minutos.`)}&location=${encodeURIComponent(unitName)}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(r.reservationCode); setCopied(true); window.setTimeout(() => setCopied(false), 1800); track('post_confirm_action', { action: 'copy_code' }); } catch { /* ok */ }
  };

  return (
    <>
      <StepHeader step={3} />

      <div className={s.intro}>
        <h1 className={s.h1}>Pronto. Sua mesa está guardada.</h1>
        <p className={s.lead}>Mostre este código na chegada. Ele já foi para o seu WhatsApp.</p>
      </div>

      <div className={s.ticket}>
        <div className={s.ticketUnit}>{unitName}</div>
        <div className={s.ticketWhen}>{weekday.charAt(0).toUpperCase() + weekday.slice(1)}, {when.format('D [de] MMMM')} · {when.format('HH[h]mm')}</div>
        <div className={s.ticketMeta}>{r.people} pessoas{r.kids ? ` (${r.kids} crianças)` : ''} · {area}{r.reservationType === 'ANIVERSARIO' ? ' · Aniversário' : ''}</div>
        {bonus && <div className={`${s.ticketMeta} ${s.okText}`}>{bonus} garantido na mesa.</div>}

        <button type="button" className={s.codeBig} onClick={copy} aria-label={`Código ${r.reservationCode}, toque para copiar`}>
          <span>{r.reservationCode}</span>
          <small><IconCopy size={13} stroke={2.2} /> {copied ? 'copiado' : 'toque para copiar'}</small>
        </button>
        <img className={s.qrImg} src={qr} alt="QR Code da reserva" width={140} height={140} />
        <p className={s.note}>Ou mostre o QR na porta.</p>

        <div className={s.rule}>
          <b>Combinado de chegada</b>
          <span>Sua mesa espera você por 15 minutos. Seus convidados têm até {tolEnd} para chegar com o código.</span>
        </div>
      </div>

      <div className={s.actions}>
        <a className={s.primary} href={waShare} target="_blank" rel="noreferrer" onClick={() => track('post_confirm_action', { action: 'share_whatsapp' })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }}>
          <IconBrandWhatsapp size={20} stroke={2.2} /> Enviar convite no WhatsApp
        </a>
        <p className={s.footerHint}>Convidado com código na mão chega mais. É a diferença entre 5 e 8 na mesa.</p>
        <div className={s.secondary}>
          <a className={s.ghost} href={gcal} target="_blank" rel="noreferrer" onClick={() => track('post_confirm_action', { action: 'add_calendar' })}><IconCalendarPlus size={18} stroke={2.2} /> Salvar na agenda</a>
          <a className={s.ghost} href={conciergeLink(meta?.concierge || '61982850776', `Oi! Preciso alterar ou cancelar minha reserva ${r.reservationCode} (${when.format('DD/MM')} às ${when.format('HH:mm')}).`)} target="_blank" rel="noreferrer" onClick={() => track('post_confirm_action', { action: 'change' })}><IconPencil size={18} stroke={2.2} /> Alterar ou cancelar</a>
        </div>
      </div>
    </>
  );
}
