'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { IconArrowRight, IconCheck, IconPencil, IconSparkles, IconUserCheck } from '@tabler/icons-react';
import s from '../reserva.module.css';
import { StepHeader } from '../_components/StepHeader';
import { clearDraft, loadDraft, saveDraft, type Draft } from '../_lib/draft';
import { apiGet } from '@/lib/api';
import { conciergeLink } from '../_lib/units';
import { fmtLongDate, joinDateTimeISO } from '../_lib/rules';
import dayjs from 'dayjs';
import { track } from '../_lib/track';
import { metaFor } from '../_lib/units';
import {
  hasTwoWords, isValidCPF, isValidEmail, isValidPhone, maskCPF, maskDateBR, maskPhone, onlyDigits, parseDateBR,
} from '../_lib/validators';

// Decisão pendente com o Ludson: o site atual manda `people` = adultos + crianças. Mantido igual por enquanto.
const PEOPLE_INCLUDES_KIDS = true;

type Lookup =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'new' }
  | { status: 'found'; firstName: string; fullName: string | null; returning: boolean; masked: { email: string | null; cpf: string | null; birthday: string | null }; has: { email: boolean; cpf: boolean; birthday: boolean }; token: string };

export default function Dados() {
  const router = useRouter();
  const [draft, setDraft] = React.useState<Draft | null>(null);

  // campos
  const [phone, setPhone] = React.useState('');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [cpf, setCpf] = React.useState('');
  const [birthday, setBirthday] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [lookup, setLookup] = React.useState<Lookup>({ status: 'idle' });
  const [recognized, setRecognized] = React.useState<boolean | null>(null); // null = ainda não respondeu "é você?"
  const [useCrm, setUseCrm] = React.useState({ email: true, cpf: true, birthday: true });
  const nameFromCrm = React.useRef(false); // o nome atual veio do CRM (não foi digitado)?
  const [sending, setSending] = React.useState(false);
  const [serverError, setServerError] = React.useState<{ code?: string; message: string; reservationCode?: string } | null>(null);
  const [active, setActive] = React.useState<null | { code: string; when: string; unit: string }>(null);
  const [activeDismissed, setActiveDismissed] = React.useState(false);
  const [swap, setSwap] = React.useState<null | { fromName: string; to: { id: string; name: string } | null }>(null);
  const activeSeq = React.useRef(0);
  const lookupSeq = React.useRef(0);
  const lookupStatus = React.useRef<string>('idle');
  React.useEffect(() => { lookupStatus.current = lookup.status; }, [lookup.status]);

  React.useEffect(() => {
    const d = loadDraft();
    if (!d.unitId || !d.dateYMD || !d.time || !d.areaId) { router.replace('/reserva'); return; }
    setDraft(d);
    setPhone(d.phone ? maskPhone(d.phone) : '');
    setName(d.fullName || '');
    setEmail(d.email || '');
    setCpf(d.cpf ? maskCPF(d.cpf) : '');
    setBirthday(d.birthday || '');
    setNotes(d.notes || '');
    track('step_view', { step: 'dados' });
  }, [router]);

  // já existe uma mesa guardada para esse WhatsApp? A API aceita uma reserva ativa por pessoa.
  React.useEffect(() => {
    const d = onlyDigits(phone);
    setActive(null); setActiveDismissed(false);
    if (d.length < 10) return;
    const seq = ++activeSeq.current;
    const tm = window.setTimeout(async () => {
      try {
        const r = await apiGet<any>(`/v1/reservations/public/active?phone=${d}`);
        if (seq !== activeSeq.current || !r || r.status !== 'AWAITING_CHECKIN') return;
        const when = dayjs(r.reservationDate);
        setActive({ code: String(r.reservationCode || ''), when: `${when.format('DD/MM')} às ${when.format('HH[h]mm')}`, unit: String(r.unitRef?.name || r.unit || '').replace(/,.*$/, '') });
      } catch { /* 404 = nenhuma ativa */ }
    }, 350);
    return () => window.clearTimeout(tm);
  }, [phone]);

  // consulta o CRM assim que o WhatsApp fica completo
  React.useEffect(() => {
    const d = onlyDigits(phone);
    if (nameFromCrm.current) { setName(''); nameFromCrm.current = false; }
    setUseCrm({ email: true, cpf: true, birthday: true });
    if (d.length < 10) { setLookup({ status: 'idle' }); setRecognized(null); return; }
    const seq = ++lookupSeq.current;
    setLookup({ status: 'loading' });
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/crm/lookup?phone=${d}`, { cache: 'no-store' });
        const j = await res.json();
        if (seq !== lookupSeq.current) return;
        if (j?.found) { setLookup({ status: 'found', ...j }); setRecognized(null); }
        else { setLookup({ status: 'new' }); setRecognized(false); }
      } catch {
        if (seq === lookupSeq.current) { setLookup({ status: 'new' }); setRecognized(false); }
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [phone]);

  if (!draft) return <StepHeader step={2} backHref="/reserva" />;

  const total = draft.adults + draft.kids;
  const meta = metaFor(draft.unitSlug as any);
  const isBirthday = draft.occasion === 'ANIVERSARIO';
  const needsCpf = isBirthday || total >= 8;
  const found = lookup.status === 'found' ? lookup : null;
  const isKnown = !!found && recognized === true;

  // o CRM cobre o campo? (cliente reconhecido, CRM tem o dado e a pessoa não pediu para trocar)
  const crmCovers = (k: 'email' | 'cpf' | 'birthday') => isKnown && !!found?.has[k] && useCrm[k];

  // ---------- validação ----------
  const errors: Record<string, string | null> = {
    phone: !isValidPhone(phone) ? 'Número incompleto. Use DDD e os 9 dígitos, ex.: (61) 9 9999-9999.' : null,
    name: !hasTwoWords(name) ? 'Digite nome e sobrenome, do jeito que a equipe deve chamar você.' : null,
    email: email.trim() && !isValidEmail(email) ? 'Esse e-mail parece incompleto. Confira o @ e o ponto, ou deixe em branco.' : null,
    cpf: needsCpf && !crmCovers('cpf') && cpf.trim() && !isValidCPF(cpf) ? 'Esse CPF não é válido. Confira os 11 dígitos.' : null,
    birthday: isBirthday && !crmCovers('birthday') && birthday.trim() && !parseDateBR(birthday) ? 'Essa data não existe. Use dia, mês e ano, ex.: 14/03/1990.' : null,
  };
  const waitingIdentity = !!found && recognized === null;
  const blockedByActive = !!active && !activeDismissed;
  const canSend = !errors.phone && !errors.name && !errors.email && !errors.cpf && !errors.birthday && !waitingIdentity && lookup.status !== 'loading' && !blockedByActive;

  const show = (k: string) => touched[k] ? errors[k] : null;
  const blur = (k: string) => () => { setTouched((t) => ({ ...t, [k]: true })); if (errors[k]) track('field_error', { step: 'dados', field: k }); };

  // ---------- envio ----------
  async function submit() {
    setTouched({ phone: true, name: true, email: true, cpf: true, birthday: true });
    const st = () => String(lookupStatus.current);
    if (st() === 'loading') {
      setSending(true);
      for (let i = 0; i < 40 && st() === 'loading'; i++) await new Promise((r) => setTimeout(r, 100));
      setSending(false);
      if (st() === 'found') return; // apareceu o "é você?": a pessoa responde e confirma de novo
      window.setTimeout(() => submit(), 0);
      return;
    }
    if (!canSend) {
      const first = ['phone', 'name', 'email', 'cpf', 'birthday'].find((k) => errors[k]);
      if (first) document.getElementById(`f-${first}`)?.focus();
      return;
    }
    setSending(true);
    setServerError(null);
    setSwap(null);
    const d = draft!;

    // conferência final: a área ainda cabe o grupo nesse horário?
    try {
      const list = await apiGet<any[]>(`/v1/reservations/public/availability?unitId=${encodeURIComponent(d.unitId!)}&date=${d.dateYMD}&time=${d.time}`);
      const total0 = d.adults + d.kids;
      const mine = (list || []).find((a) => String(a.id) === d.areaId);
      const fits = (a: any) => Number(a.available ?? a.remaining ?? 0) >= total0 && a.isActive !== false && !(String(a.name).toLowerCase() === 'maneco' && d.time! < '18:00');
      if (mine && !fits(mine)) {
        const alt = (list || []).filter(fits).sort((a, b) => Number(b.available ?? 0) - Number(a.available ?? 0))[0] || null;
        setSwap({ fromName: String(mine.name).replace(/^Ala\s+/i, ''), to: alt ? { id: String(alt.id), name: String(alt.name).replace(/^Ala\s+/i, '') } : null });
        track('availability_empty', { step: 'dados', area: mine.name, alt: alt?.name || null });
        setSending(false);
        return;
      }
    } catch { /* se a conferência falhar, o servidor decide */ }
    saveDraft({ ...d, phone: onlyDigits(phone), fullName: name.trim(), email: email.trim(), cpf: onlyDigits(cpf), birthday, notes });
    const params = new URLSearchParams(window.location.search);
    const body = {
      fullName: name.trim(),
      phone: onlyDigits(phone),
      email: crmCovers('email') ? '' : email.trim(),
      cpf: crmCovers('cpf') ? '' : (needsCpf ? onlyDigits(cpf) : ''),
      birthdayDate: isBirthday && !crmCovers('birthday') && parseDateBR(birthday) ? `${parseDateBR(birthday)}T12:00:00.000Z` : null,
      crmToken: isKnown ? found?.token : undefined,
      people: PEOPLE_INCLUDES_KIDS ? total : d.adults,
      kids: d.kids,
      reservationDate: joinDateTimeISO(d.dateYMD!, d.time!),
      unitId: d.unitId,
      areaId: d.areaId,
      notes,
      reservationType: d.occasion || 'PARTICULAR',
      utm_source: params.get('utm_source') || undefined,
      utm_medium: params.get('utm_medium') || undefined,
      utm_campaign: params.get('utm_campaign') || undefined,
      utm_term: params.get('utm_term') || undefined,
      url: window.location.href,
      ref: document.referrer || null,
    };
    try {
      const res = await fetch('/api/reserva', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = j?.error?.code || j?.code;
        const message = j?.error?.message || j?.message || 'Não foi possível concluir sua reserva agora. Tente de novo.';
        setServerError({ code, message, reservationCode: j?.error?.reservationCode || j?.reservationCode });
        track('field_error', { step: 'dados', field: 'server', code });
        setSending(false);
        return;
      }
      track('reservation_created', { unit: d.unitSlug, people: total, kids: d.kids, type: d.occasion || 'PARTICULAR', known: isKnown, days_ahead: Math.round((new Date(d.dateYMD!).getTime() - Date.now()) / 864e5) });
      try { window.localStorage.setItem('mane:lastReservation', JSON.stringify({ id: j.id, code: j.reservationCode, at: Date.now() })); } catch { /* ok */ }
      clearDraft();
      router.push(`/reserva/pronto/${encodeURIComponent(j.reservationCode)}`);
    } catch {
      setServerError({ message: 'A conexão caiu no meio. Suas escolhas estão guardadas, tente de novo.' });
      setSending(false);
    }
  }

  function acceptSwap() {
    if (!swap?.to || !draft) return;
    const nd = { ...draft, areaId: swap.to.id, areaName: swap.to.name };
    setDraft(nd); saveDraft(nd); setSwap(null);
    window.setTimeout(() => submit(), 50);
  }

  const ERR: Record<string, { title: string; action?: { label: string; href: string } }> = {
    ALREADY_HAS_ACTIVE_RESERVATION: { title: 'Você já tem uma mesa guardada.', action: { label: 'Ver minha reserva', href: '/consultar' } },
    NO_CAPACITY: { title: 'Esse horário acabou de lotar.', action: { label: 'Escolher outro horário', href: '/reserva?edit=time' } },
    BOOKING_WINDOW_CLOSED: { title: 'Esse horário fechou enquanto você preenchia.', action: { label: 'Escolher outro horário', href: '/reserva?edit=time' } },
    CLOSED_DAY: { title: 'A casa não abre nesse dia.', action: { label: 'Escolher outro dia', href: '/reserva?edit=date' } },
    OUTSIDE_OPENING_HOURS: { title: 'Esse horário está fora do funcionamento.', action: { label: 'Escolher outro horário', href: '/reserva?edit=time' } },
    RECURRING_BLOCKED: { title: 'Esse horário não recebe reservas.', action: { label: 'Escolher outro horário', href: '/reserva?edit=time' } },
    BLOCKED_DAY: { title: 'Esse dia está bloqueado para reservas.', action: { label: 'Escolher outro dia', href: '/reserva?edit=date' } },
    MIN_PEOPLE_REQUIRED: { title: 'Nesse horário a casa reserva a partir de mais pessoas.', action: { label: 'Ajustar o grupo', href: '/reserva?edit=people' } },
    MAX_PEOPLE_EXCEEDED: { title: 'Grupo grande merece atenção pessoal.', action: { label: 'Chamar a equipe no WhatsApp', href: conciergeLink(meta?.concierge || '61982850776', `Oi! Quero reservar para ${total} pessoas no Mané ${meta?.short || ''}. Podem me ajudar?`) } },
    FESTIVAL_AREA_UNAVAILABLE: { title: 'Essa área só abre em dias de festival.', action: { label: 'Escolher outro ambiente', href: '/reserva?edit=time' } },
    AREA_NOT_FOUND: { title: 'Esse ambiente não está mais disponível.', action: { label: 'Escolher outro ambiente', href: '/reserva?edit=time' } },
  };

  const summary = `${draft.unitName?.replace(/,.*$/, '')} · ${fmtLongDate(draft.dateYMD!)} · ${draft.time!.replace(':00', 'h').replace(':30', 'h30')} · ${total} pessoas · ${draft.areaName?.replace(/^Ala\s+/i, '')}`;

  return (
    <>
      <StepHeader step={2} backHref="/reserva" />

      <div className={s.intro}>
        <h1 className={s.h1}>Para quem guardamos a mesa?</h1>
      </div>

      {/* resumo da tela 1 */}
      <div className={s.done} data-step={1}>
        <span className={s.stepBadge} aria-hidden="true"><IconCheck size={15} stroke={3} /></span>
        <span className={s.doneText}><small>Sua mesa</small><b>{summary}</b></span>
        <a className={s.doneEdit} href="/reserva"><IconPencil size={15} stroke={2.2} /> alterar</a>
      </div>

      <form className={s.form} onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        {/* 1. WhatsApp: a chave do cliente */}
        <div className={s.fieldWrap} data-step={2}>
          <label className={s.label} htmlFor="f-phone">Seu WhatsApp <small>o código da reserva chega aqui em segundos</small></label>
          <input id="f-phone" className={`${s.input} ${show('phone') ? s.inputErr : ''}`} type="tel" inputMode="tel" autoComplete="tel-national"
            placeholder="(61) 9 9999-9999" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} onBlur={blur('phone')} autoFocus />
          {show('phone') && <p className={s.err} role="alert">{errors.phone}</p>}

          {lookup.status === 'loading' && <p className={s.hint} aria-live="polite">Procurando você no Mané…</p>}

          {found && recognized === null && (
            <div className={`${s.greet} ${s.reveal}`} role="status">
              <IconUserCheck size={22} stroke={2} />
              <div>
                <b>Oi, {found.firstName}! {found.returning ? 'Bom te ver de novo.' : 'A gente já se conhece.'}</b>
                <span>É você mesmo? Se sim, preenchemos o resto com o que já temos.</span>
                <div className={s.greetBtns}>
                  <button type="button" className={s.confirm} onClick={() => { setRecognized(true); if (found.fullName) { setName(found.fullName); nameFromCrm.current = true; } }}>Sou eu <IconCheck size={16} stroke={2.6} /></button>
                  <button type="button" className={s.ghost} onClick={() => { setRecognized(false); if (nameFromCrm.current) { setName(''); nameFromCrm.current = false; } }}>Não sou eu</button>
                </div>
              </div>
            </div>
          )}
          {found && recognized === true && (
            <p className={`${s.hint} ${s.okText}`}><IconSparkles size={14} stroke={2} /> Reconhecemos você, {found.firstName}. Só confira o nome abaixo.</p>
          )}
          {active && !activeDismissed && (
            <div className={`${s.alert} ${s.alertWarn} ${s.reveal}`} role="status">
              <b>Esse WhatsApp já tem uma mesa guardada: {active.unit}, {active.when}.</b>
              <span>A casa aceita uma reserva ativa por pessoa. Você pode ver essa reserva, ou falar com a gente para mudar a data dela.</span>
              <span>
                <a className={s.linkBtn} href={`/consultar?code=${active.code}`}>Ver essa reserva</a>{' · '}
                <a className={s.linkBtn} href={conciergeLink(meta?.concierge || '61982850776', `Oi! Tenho a reserva ${active.code} (${active.when}) e quero mudar para ${fmtLongDate(draft.dateYMD!)} às ${draft.time}. Podem ajudar?`)} target="_blank" rel="noreferrer">Mudar a data dela</a>{' · '}
                <button type="button" className={s.linkBtn} onClick={() => setActiveDismissed(true)}>Não é minha</button>
              </span>
            </div>
          )}
          {lookup.status === 'new' && onlyDigits(phone).length >= 10 && (
            <p className={s.hint}>Primeira vez por aqui? Ótimo. Só precisamos do seu nome.</p>
          )}
        </div>

        {/* 2. nome */}
        <div className={s.fieldWrap} data-step={3}>
          <label className={s.label} htmlFor="f-name">Seu nome <small>é por ele que a equipe recebe você na porta</small></label>
          <input id="f-name" className={`${s.input} ${show('name') ? s.inputErr : ''}`} type="text" autoComplete="name" autoCapitalize="words"
            placeholder="Nome e sobrenome" value={name} onChange={(e) => { setName(e.target.value); nameFromCrm.current = false; }} onBlur={blur('name')} />
          {show('name') && <p className={s.err} role="alert">{errors.name}</p>}
        </div>

        {/* 3. o que destrava o mimo */}
        {needsCpf && (
          <div className={`${s.fieldWrap} ${s.reveal}`} data-step={4}>
            <label className={s.label} htmlFor="f-cpf">
              {isBirthday ? 'CPF de quem faz aniversário' : 'Seu CPF'}
              <small>{isBirthday ? 'para o mimo de aniversário ficar no nome certo, garantido na chegada' : 'grupos de 8 ou mais ganham lista de convidados; o CPF diz quem é o anfitrião'}</small>
            </label>
            {crmCovers('cpf') ? (
              <div className={s.maskRow}><span className={s.maskChip}><IconCheck size={14} stroke={3} /> {found!.masked.cpf}</span><button type="button" className={s.linkBtn} onClick={() => setUseCrm((u) => ({ ...u, cpf: false }))}>usar outro</button></div>
            ) : (
              <>
                <input id="f-cpf" className={`${s.input} ${show('cpf') ? s.inputErr : ''}`} type="text" inputMode="numeric" autoComplete="off"
                  placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(maskCPF(e.target.value))} onBlur={blur('cpf')} />
                {show('cpf') && <p className={s.err} role="alert">{errors.cpf}</p>}
                {!cpf && <p className={s.hint}>Opcional. Sem ele a mesa fica guardada do mesmo jeito, só o mimo não entra.</p>}
              </>
            )}

            {isBirthday && (
              <>
                <label className={s.label} htmlFor="f-birthday" style={{ marginTop: 14 }}>Data de nascimento <small>confirma o aniversário</small></label>
                {crmCovers('birthday') ? (
                  <div className={s.maskRow}><span className={s.maskChip}><IconCheck size={14} stroke={3} /> {found!.masked.birthday}</span><button type="button" className={s.linkBtn} onClick={() => setUseCrm((u) => ({ ...u, birthday: false }))}>corrigir</button></div>
                ) : (
                  <>
                    <input id="f-birthday" className={`${s.input} ${show('birthday') ? s.inputErr : ''}`} type="text" inputMode="numeric" autoComplete="bday"
                      placeholder="DD/MM/AAAA" value={birthday} onChange={(e) => setBirthday(maskDateBR(e.target.value))} onBlur={blur('birthday')} />
                    {show('birthday') && <p className={s.err} role="alert">{errors.birthday}</p>}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* 4. e-mail opcional */}
        <div className={s.fieldWrap} data-step={5}>
          <label className={s.label} htmlFor="f-email">E-mail <small>opcional, para receber o convite da agenda</small></label>
          {crmCovers('email') ? (
            <div className={s.maskRow}><span className={s.maskChip}><IconCheck size={14} stroke={3} /> {found!.masked.email}</span><button type="button" className={s.linkBtn} onClick={() => setUseCrm((u) => ({ ...u, email: false }))}>trocar</button></div>
          ) : (
            <>
              <input id="f-email" className={`${s.input} ${show('email') ? s.inputErr : ''}`} type="email" inputMode="email" autoComplete="email"
                placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={blur('email')} />
              {show('email') && <p className={s.err} role="alert">{errors.email}</p>}
            </>
          )}
        </div>

        {/* 5. observação */}
        <div className={s.fieldWrap} data-step={6}>
          <label className={s.label} htmlFor="f-notes">Algo que a equipe precisa saber? <small>opcional</small></label>
          <input id="f-notes" className={s.input} type="text" maxLength={140} placeholder="Bolo, cadeirinha, acessibilidade…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {swap && (
          <div className={`${s.alert} ${s.alertWarn} ${s.reveal}`} role="alert">
            <b>A {swap.fromName} acabou de lotar para {total} pessoas.</b>
            {swap.to ? (
              <>
                <span>Ficou a {swap.to.name}, no mesmo horário. Confirmar assim?</span>
                <div className={s.greetBtns}>
                  <button type="button" className={s.confirm} onClick={acceptSwap}>Confirmar na {swap.to.name} <IconCheck size={16} stroke={2.6} /></button>
                  <a className={s.ghost} href="/reserva?edit=time">Ver outros horários</a>
                </div>
              </>
            ) : (
              <>
                <span>Nenhuma área cabe o grupo nesse horário.</span>
                <div className={s.greetBtns}><a className={s.ghost} href="/reserva?edit=time">Escolher outro horário</a></div>
              </>
            )}
          </div>
        )}

        {serverError && (
          <div className={`${s.alert} ${s.alertBad}`} role="alert">
            <b>{ERR[serverError.code || '']?.title || 'Não deu para concluir.'}</b>
            <span>{serverError.message}</span>
            {ERR[serverError.code || '']?.action && (
              <span><a className={s.linkBtn} href={serverError.code === 'ALREADY_HAS_ACTIVE_RESERVATION' && serverError.reservationCode ? `/consultar?code=${serverError.reservationCode}` : ERR[serverError.code || ''].action!.href}>{ERR[serverError.code || ''].action!.label}</a></span>
            )}
            {!ERR[serverError.code || ''] && <span><button type="button" className={s.linkBtn} onClick={() => submit()}>Tentar de novo</button></span>}
          </div>
        )}

        <div className={s.footer}>
          <div className={s.footerInner}>
            <button type="submit" className={s.primary} disabled={sending || waitingIdentity || blockedByActive}>
              {sending ? 'Guardando sua mesa…' : <>Confirmar minha mesa <IconArrowRight size={18} stroke={2.4} /></>}
            </button>
            <p className={s.footerHint}>
              {lookup.status === 'loading' ? 'Conferindo seu número…' : blockedByActive ? 'Resolva a reserva que já existe para esse WhatsApp.' : waitingIdentity ? `Responda se é você, ${found?.firstName}.` : canSend ? `Seu código chega no WhatsApp ${maskPhone(phone)} na mesma hora.` : 'Nome e WhatsApp bastam. O resto é opcional.'}
            </p>
          </div>
        </div>
      </form>
    </>
  );
}
