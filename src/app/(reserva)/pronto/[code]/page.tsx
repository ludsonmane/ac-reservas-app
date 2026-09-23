'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { IconBrandWhatsapp, IconCalendarPlus, IconCheck, IconCopy, IconGift, IconPencil, IconUsers } from '@tabler/icons-react';
import { apiGet, getBaseUrl } from '@/lib/api';
import s from '../../reserva.module.css';
import t from './ticket.module.css';
import { StepHeader } from '../../_components/StepHeader';
import { Confetti } from '../../_components/Confetti';
import { track } from '../../_lib/track';
import { detectSlug, metaFor, conciergeLink } from '../../_lib/units';
import { GUEST_LIST_MIN } from '../../_lib/benefits';

dayjs.locale('pt-br');

type Reservation = {
  id: string; reservationCode: string; fullName: string; people: number; kids: number; reservationDate: string;
  unit?: string | null; unitRef?: { name?: string } | null; areaName?: string | null; areaRef?: { name?: string } | null;
  reservationType?: string | null; status?: string; phone?: string | null;
};

const OCCASION: Record<string, string> = { ANIVERSARIO: 'Aniversário', CONFRATERNIZACAO: 'Confraternização', EMPRESA: 'Empresa' };

/** Tela 3: o bilhete da mesa. Topo verde com a casa, picote, código grande, QR emoldurado e o combinado de chegada. */
export default function Pronto() {
  const { code } = useParams<{ code: string }>();
  const [r, setR] = React.useState<Reservation | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [bonus, setBonus] = React.useState('');
  const [party, setParty] = React.useState(false);
  React.useEffect(() => { try { setBonus(window.sessionStorage.getItem('mane:reserva:bonus') || ''); } catch { /* ok */ } }, []);

  React.useEffect(() => {
    if (!code) return;
    apiGet<Reservation>(`/v1/reservations/public/by-code/${encodeURIComponent(String(code).toUpperCase())}`)
      .then((x) => {
        setR(x); track('step_view', { step: 'pronto' });
        // confete só na primeira vez que o bilhete dessa reserva abre nesta sessão
        try {
          const k = `mane:confete:${x.reservationCode}`;
          if (!window.sessionStorage.getItem(k)) { window.sessionStorage.setItem(k, '1'); window.setTimeout(() => setParty(true), 350); }
        } catch { window.setTimeout(() => setParty(true), 350); }
      })
      .catch((e) => setErr(e?.message || 'Reserva não encontrada.'));
  }, [code]);

  if (err) {
    return (
      <>
        <StepHeader step={3} />
        <div className={`${s.alert} ${s.alertBad}`}><b>Não achamos essa reserva.</b><span>{err}</span><span><a className={s.linkBtn} href="/">Fazer uma reserva</a></span></div>
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
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://reservas.mane.com.vc';
  const guestLink = `${origin}/convidados/${r.reservationCode}`;
  const tolEnd = when.add(45, 'minute').format('HH[h]mm');
  const weekday = when.format('dddd');
  const wdCap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const occasion = OCCASION[String(r.reservationType || '')] || null;
  const hasList = r.people >= GUEST_LIST_MIN;
  const invite = `Você tem lugar na mesa.\n\n${first} guardou uma mesa no ${unitName} para ${weekday}, ${when.format('DD/MM')}, às ${when.format('HH[h]mm')}, e colocou você na lista.\n\nSeu código de entrada: ${r.reservationCode}\nMostre na porta e vá direto para a mesa. O lugar é seu até ${tolEnd}.\n\nConfirme que vai e veja como chegar: ${guestLink}`;
  const waShare = `https://wa.me/?text=${encodeURIComponent(invite)}`;
  const gIso = (d: dayjs.Dayjs) => d.toDate().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Mesa no ${unitName}`)}&dates=${gIso(when)}/${gIso(when.add(2, 'hour'))}&details=${encodeURIComponent(`Código ${r.reservationCode}. ${r.people} pessoas, ${area}. Sua mesa espera você por 15 minutos.`)}&location=${encodeURIComponent(unitName)}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(r.reservationCode); setCopied(true); window.setTimeout(() => setCopied(false), 1800); track('post_confirm_action', { action: 'copy_code' }); } catch { /* ok */ }
  };

  return (
    <>
      <Confetti fire={party} />
      <StepHeader step={3} />

      <div className={`${s.intro} ${t.intro}`}>
        <span className={t.stamp} aria-hidden="true"><IconCheck size={26} stroke={3} /></span>
        <h1 className={s.h1}>Pronto, {first}. Sua mesa está guardada.</h1>
        <p className={s.lead}>O código já foi para o seu WhatsApp. Mostre na chegada.</p>
      </div>

      <article className={t.ticket} aria-label={`Reserva ${r.reservationCode}`}>
        <span className={t.shine} aria-hidden="true" />
        {/* topo: a casa e o dia */}
        <header className={t.top}>
          <span className={t.kicker}>Mesa guardada no</span>
          <strong className={t.unit}>{unitName}</strong>
          <div className={t.when}>
            <span className={t.day}>{when.format('DD')}</span>
            <span className={t.whenText}><b>{wdCap}</b><small>{when.format('D [de] MMMM')} · chegada às {when.format('HH[h]mm')}</small></span>
          </div>
          <dl className={t.grid}>
            <div><dt>Pessoas</dt><dd>{r.people}{r.kids ? <small> · {r.kids} {r.kids === 1 ? 'criança' : 'crianças'}</small> : null}</dd></div>
            <div><dt>Ambiente</dt><dd>{area || 'a definir'}</dd></div>
            {occasion && <div><dt>Ocasião</dt><dd>{occasion}</dd></div>}
          </dl>
        </header>

        {bonus && (
          <div className={t.ribbon}><IconGift size={16} stroke={2.2} aria-hidden="true" /> <b>{bonus}</b> garantido na mesa</div>
        )}

        {/* picote */}
        <div className={t.tear} aria-hidden="true"><i /><span /><i /></div>

        {/* parte de baixo: código e QR */}
        <section className={t.bottom}>
          <span className={t.codeLabel}>Seu código de entrada</span>
          <button type="button" className={t.code} onClick={copy} aria-label={`Código ${r.reservationCode}, toque para copiar`}>
            <span>{r.reservationCode}</span>
            <small>{copied ? <><IconCheck size={13} stroke={3} /> copiado</> : <><IconCopy size={13} stroke={2.2} /> toque para copiar</>}</small>
          </button>
          <div className={t.qrWrap}>
            <img className={t.qr} src={qr} alt="QR Code da reserva" width={150} height={150} />
          </div>
          <p className={t.qrNote}>Ou mostre o QR na porta.</p>

          <div className={t.rule}>
            <b>Combinado de chegada</b>
            <span>Sua mesa espera você por 15 minutos. Seus convidados têm até <b>{tolEnd}</b> para chegar com o código.</span>
          </div>
        </section>
      </article>

      <div className={s.actions}>
        <a className={t.wa} href={waShare} target="_blank" rel="noreferrer" onClick={() => track('post_confirm_action', { action: 'share_whatsapp' })}>
          <span className={t.waIcon} aria-hidden="true"><IconBrandWhatsapp size={24} stroke={2.2} /></span>
          <span className={t.waText}><b>Mandar o convite</b><small>{hasList ? 'no WhatsApp, com a lista de convidados' : 'no WhatsApp, mensagem pronta'}</small></span>
          <span className={t.waArrow} aria-hidden="true">→</span>
        </a>
        <p className={s.footerHint}>
          {hasList ? <><IconUsers size={13} stroke={2.2} style={{ verticalAlign: '-2px' }} /> Cada convidado recebe o código e entra direto.</> : 'Convidado com código na mão chega mais.'}
        </p>
        <div className={`${s.secondary} ${t.actions2}`}>
          <a className={s.ghost} href={gcal} target="_blank" rel="noreferrer" onClick={() => track('post_confirm_action', { action: 'add_calendar' })}><IconCalendarPlus size={18} stroke={2.2} /> Salvar na agenda</a>
          <a className={s.ghost} href={conciergeLink(meta?.concierge || '61982850776', `Oi! Preciso alterar ou cancelar minha reserva ${r.reservationCode} (${when.format('DD/MM')} às ${when.format('HH:mm')}).`)} target="_blank" rel="noreferrer" onClick={() => track('post_confirm_action', { action: 'change' })}><IconPencil size={18} stroke={2.2} /> Alterar ou cancelar</a>
        </div>
      </div>
    </>
  );
}
