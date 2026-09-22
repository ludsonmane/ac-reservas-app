'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { IconArrowRight, IconCheck, IconId, IconPencil, IconSparkles, IconUserCheck } from '@tabler/icons-react';
import s from '../reserva.module.css';
import { StepHeader } from '../_components/StepHeader';
import { clearDraft, loadDraft, saveDraft, type Draft } from '../_lib/draft';
import { apiGet } from '@/lib/api';
import { conciergeLink, metaFor } from '../_lib/units';
import { fmtLongDate, joinDateTimeISO } from '../_lib/rules';
import dayjs from 'dayjs';
import { track } from '../_lib/track';
import { birthdayTier, fmtBRL } from '../_lib/benefits';
import {
  birthdayError, hasTwoWords, isValidCPF, isValidEmail, isValidPhone, maskCPF, maskDateBR, maskPhone, onlyDigits, parseDateBR,
} from '../_lib/validators';

// Decisão pendente com o Ludson: o site atual manda `people` = adultos + crianças. Mantido igual por enquanto.
const PEOPLE_INCLUDES_KIDS = true;
const BENEFIT_MIN = 8;

type Lookup =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'new'; disabled?: boolean }
  | { status: 'found'; firstName: string; fullName: string | null; returning: boolean; masked: { email: string | null; cpf: string | null; birthday: string | null }; has: { email: boolean; cpf: boolean; birthday: boolean }; token: string };

/**
 * Tela 2: só WhatsApp e nome. O WhatsApp identifica o cliente (CRM e histórico de reservas) e
 * preenche o nome. Ao confirmar, a última pergunta completa o cadastro do Mané: e-mail, CPF e data de
 * nascimento. Quem foi reconhecido só confere o que já temos (mascarado) e preenche o que faltar.
 */
export default function Dados() {
  const router = useRouter();
  const [draft, setDraft] = React.useState<Draft | null>(null);

  const [phone, setPhone] = React.useState('');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [cpf, setCpf] = React.useState('');
  const [birthday, setBirthday] = React.useState('');
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [askExtra, setAskExtra] = React.useState(false); // última pergunta aberta?
  const [useKnown, setUseKnown] = React.useState({ email: true, cpf: true, birthday: true }); // usar o que já temos desse telefone?
  const [lookup, setLookup] = React.useState<Lookup>({ status: 'idle' });
  const [recognized, setRecognized] = React.useState<boolean | null>(null); // null = ainda não respondeu "é você?"
  const nameFromCrm = React.useRef(false);
  const [sending, setSending] = React.useState(false);
  const [serverError, setServerError] = React.useState<{ code?: string; message: string; reservationCode?: string } | null>(null);
  const [active, setActive] = React.useState<null | { code: string; when: string; unit: string }>(null);
  const [activeDismissed, setActiveDismissed] = React.useState(false);
  const [swap, setSwap] = React.useState<null | { fromName: string; to: { id: string; name: string } | null }>(null);
  const activeSeq = React.useRef(0);
  const lookupSeq = React.useRef(0);
  const lookupStatus = React.useRef<string>('idle');
  const extraRef = React.useRef<HTMLDivElement>(null);
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
    track('step_view', { step: 'dados' });
  }, [router]);

  // já existe uma mesa guardada para esse WhatsApp? A API do Mané aceita uma reserva ativa por pessoa.
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

  // busca no CRM e no histórico assim que o WhatsApp fica completo (11 dígitos = na hora)
  React.useEffect(() => {
    const d = onlyDigits(phone);
    if (nameFromCrm.current) { setName(''); nameFromCrm.current = false; }
    setUseKnown({ email: true, cpf: true, birthday: true });
    if (d.length < 10) { setLookup({ status: 'idle' }); setRecognized(null); return; }
    const seq = ++lookupSeq.current;
    setLookup({ status: 'loading' });
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/crm/lookup?phone=${d}`, { cache: 'no-store' });
        const j = await res.json();
        if (seq !== lookupSeq.current) return;
        if (j?.found) { setLookup({ status: 'found', ...j }); setRecognized(null); }
        else { setLookup({ status: 'new', disabled: !!j?.disabled }); setRecognized(false); }
      } catch {
        if (seq === lookupSeq.current) { setLookup({ status: 'new' }); setRecognized(false); }
      }
    }, d.length >= 11 ? 0 : 400);
    return () => window.clearTimeout(t);
  }, [phone]);

  React.useEffect(() => {
    if (!askExtra) return;
    track('step_view', { step: 'aniversario' });
    window.setTimeout(() => {
      extraRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (document.getElementById('f-email') || document.getElementById('f-cpf') || document.getElementById('f-birthday'))?.focus();
    }, 60);
  }, [askExtra]);

  if (!draft) return <StepHeader step={2} backHref="/reserva" />;

  const total = draft.adults + draft.kids;
  const meta = metaFor(draft.unitSlug as any);
  const isBirthday = draft.occasion === 'ANIVERSARIO';
  const bigGroup = total >= BENEFIT_MIN;
  const found = lookup.status === 'found' ? lookup : null;
  const isKnown = !!found && recognized === true;
  const knownBirthday = isKnown && !!found?.has.birthday && useKnown.birthday;
  const knownCpf = isKnown && !!found?.has.cpf && useKnown.cpf;
  const knownEmail = isKnown && !!found?.has.email && useKnown.email;

  // ---------- validação ----------
  const errors: Record<string, string | null> = {
    phone: !isValidPhone(phone) ? 'Número incompleto. Use DDD e os 9 dígitos, ex.: (61) 9 9999-9999.' : null,
    name: !hasTwoWords(name) ? 'Digite nome e sobrenome, do jeito que a equipe deve chamar você.' : null,
    birthday: knownBirthday ? null : birthdayError(birthday),
    cpf: knownCpf ? null : !cpf.trim() ? 'Digite o CPF, ele confirma quem é o anfitrião da mesa.' : !isValidCPF(cpf) ? 'Esse CPF não é válido. Confira os 11 dígitos.' : null,
    email: knownEmail ? null : !email.trim() ? 'Digite seu e-mail, é por ele que a confirmação e o convite da agenda chegam.' : !isValidEmail(email) ? 'Esse e-mail parece incompleto. Confira o @ e o ponto.' : null,
  };
  const waitingIdentity = !!found && recognized === null;
  const blockedByActive = !!active && !activeDismissed;
  const canSend = !errors.phone && !errors.name && !waitingIdentity && lookup.status !== 'loading' && !blockedByActive;

  const show = (k: string) => touched[k] ? errors[k] : null;
  const blur = (k: string) => () => { setTouched((t) => ({ ...t, [k]: true })); if (errors[k]) track('field_error', { step: 'dados', field: k }); };

  // ---------- passo 1: confere WhatsApp e nome, abre a última pergunta ----------
  async function confirmar() {
    setTouched((t) => ({ ...t, phone: true, name: true }));
    const st = () => String(lookupStatus.current);
    if (st() === 'loading') {
      setSending(true);
      for (let i = 0; i < 40 && st() === 'loading'; i++) await new Promise((r) => setTimeout(r, 100));
      setSending(false);
      if (st() === 'found') return; // apareceu o "é você?": a pessoa responde e confirma de novo
      window.setTimeout(() => confirmar(), 0);
      return;
    }
    if (!canSend) {
      const first = ['phone', 'name'].find((k) => errors[k]);
      if (first) document.getElementById(`f-${first}`)?.focus();
      return;
    }
    if (!askExtra) { setAskExtra(true); return; }
    completar();
  }

  function completar() {
    setTouched((t) => ({ ...t, email: true, cpf: true, birthday: true }));
    const first = (['email', 'cpf', 'birthday'] as const).find((k) => errors[k]);
    if (first) { document.getElementById(`f-${first}`)?.focus(); track('field_error', { step: 'cadastro', field: first }); return; }
    track('post_confirm_action', { action: 'cadastro_completo', known: isKnown });
    enviar(true);
  }

  // ---------- passo 2: conferência de vaga e criação ----------
  async function enviar(withExtra: boolean) {
    setSending(true);
    setServerError(null);
    setSwap(null);
    const d = draft!;

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

    const iso = withExtra && !knownBirthday ? parseDateBR(birthday) : null;
    const bonus = withExtra && (!!iso || knownBirthday);
    saveDraft({ ...d, phone: onlyDigits(phone), fullName: name.trim(), email: email.trim(), cpf: withExtra ? onlyDigits(cpf) : '', birthday: withExtra ? birthday : '' });
    const params = new URLSearchParams(window.location.search);
    const at = d.attribution || {};
    const pick = (k: keyof typeof at) => params.get(String(k)) || (at[k] as string | undefined) || undefined;
    const body = {
      fullName: name.trim(),
      phone: onlyDigits(phone),
      email: knownEmail ? '' : email.trim().toLowerCase(),
      cpf: withExtra && !knownCpf ? onlyDigits(cpf) : '',
      birthdayDate: iso ? `${iso}T12:00:00.000Z` : null,
      crmToken: isKnown ? found?.token : undefined,
      useKnownBirthday: withExtra && knownBirthday,
      useKnownCpf: withExtra && knownCpf,
      useKnownEmail: knownEmail,
      people: PEOPLE_INCLUDES_KIDS ? total : d.adults,
      kids: d.kids,
      reservationDate: joinDateTimeISO(d.dateYMD!, d.time!),
      dateYMD: d.dateYMD,
      time: d.time,
      areaName: d.areaName,
      unitId: d.unitId,
      areaId: d.areaId,
      notes: bonus && isBirthday ? `Aniversário informado${tier ? `: bônus de ${fmtBRL(tier.bonus)} (faixa ${tier.range} convidados)` : ''}.` : '',
      reservationType: d.occasion || 'PARTICULAR',
      utm_source: pick('utm_source'),
      utm_medium: pick('utm_medium'),
      utm_campaign: pick('utm_campaign'),
      utm_content: pick('utm_content'),
      utm_term: pick('utm_term'),
      url: at.url || window.location.href,
      ref: at.ref || document.referrer || null,
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
      track('reservation_created', { unit: d.unitSlug, people: total, kids: d.kids, type: d.occasion || 'PARTICULAR', known: isKnown, birthday: bonus, days_ahead: Math.round((new Date(d.dateYMD!).getTime() - Date.now()) / 864e5) });
      try { window.localStorage.setItem('mane:lastReservation', JSON.stringify({ id: j.id, code: j.reservationCode, at: Date.now() })); } catch { /* ok */ }
      try { window.sessionStorage.setItem('mane:reserva:bonus', bonus && isBirthday ? (tier ? `Bônus de aniversário de ${fmtBRL(tier.bonus)}` : 'Mimo de aniversário') : ''); } catch { /* ok */ }
      clearDraft();
      try { window.sessionStorage.removeItem('mane:reserva:inicio'); } catch { /* ok */ }
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
    window.setTimeout(() => enviar(knownBirthday || (!!parseDateBR(birthday) && !birthdayError(birthday))), 50);
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
  const tier = isBirthday ? birthdayTier(total) : null;
  const missing = [knownEmail ? null : 'e-mail', knownCpf ? null : 'CPF', knownBirthday ? null : 'data de nascimento'].filter(Boolean) as string[];
  const extraTitle = missing.length === 0 ? 'Confira seus dados' : isKnown ? 'Só falta completar' : 'Só mais três coisas';
  const extraText = missing.length === 0
    ? <>Já temos tudo do seu cadastro. Confira e confirme a mesa.</>
    : isBirthday
      ? <>{missing.join(', ')} de quem faz aniversário{tier ? <>: o <b>bônus de {fmtBRL(tier.bonus)}</b> e os mimos ficam garantidos na chegada</> : <>, para o <b>mimo de aniversário</b> ficar no nome certo</>}.</>
      : <>{missing.join(', ')}: é por aí que chegam a confirmação, o convite da agenda e o <b>bônus de aniversário</b> quando for a sua vez.</>;

  return (
    <>
      <StepHeader step={2} backHref="/reserva" />

      <div className={s.intro}>
        <h1 className={s.h1}>Para quem guardamos a mesa?</h1>
      </div>

      <div className={s.done} data-step={1}>
        <span className={s.stepBadge} aria-hidden="true"><IconCheck size={15} stroke={3} /></span>
        <span className={s.doneText}><small>Sua mesa</small><b>{summary}</b></span>
        <a className={s.doneEdit} href="/reserva"><IconPencil size={15} stroke={2.2} /> alterar</a>
      </div>

      <form className={s.form} onSubmit={(e) => { e.preventDefault(); confirmar(); }} noValidate>
        {/* 1. WhatsApp */}
        <div className={s.fieldWrap} data-step={2}>
          <label className={s.label} htmlFor="f-phone">Seu WhatsApp <small>o código da reserva chega aqui em segundos</small></label>
          <input id="f-phone" className={`${s.input} ${show('phone') ? s.inputErr : ''}`} type="tel" inputMode="tel" autoComplete="tel-national"
            placeholder="(61) 9 9999-9999" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} onBlur={blur('phone')} autoFocus disabled={askExtra} />
          {show('phone') && <p className={s.err} role="alert">{errors.phone}</p>}

          {lookup.status === 'loading' && (
            <p className={`${s.searching} ${s.reveal}`} role="status" aria-live="polite"><span className={s.spinner} aria-hidden="true" /> Buscando dados de reservas anteriores…</p>
          )}
          {lookup.status === 'new' && !found && onlyDigits(phone).length >= 10 && (
            <p className={s.hint} aria-live="polite">Primeira vez por aqui? Ótimo. Só precisamos do seu nome.</p>
          )}

          {found && recognized === null && (
            <div className={`${s.greet} ${s.reveal}`} role="status">
              <IconUserCheck size={22} stroke={2} />
              <div>
                <b>Oi, {found.firstName}! {found.returning ? 'Bom te ver de novo.' : 'A gente já se conhece.'}</b>
                <span>É você mesmo? Se sim, preenchemos o nome com o que já temos.</span>
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
        </div>

        {/* 2. nome */}
        <div className={s.fieldWrap} data-step={3}>
          <label className={s.label} htmlFor="f-name">Seu nome <small>é por ele que a equipe recebe você na porta</small></label>
          <input id="f-name" className={`${s.input} ${show('name') ? s.inputErr : ''}`} type="text" autoComplete="name" autoCapitalize="words"
            placeholder="Nome e sobrenome" value={name} onChange={(e) => { setName(e.target.value); nameFromCrm.current = false; }} onBlur={blur('name')} disabled={askExtra} />
          {show('name') && <p className={s.err} role="alert">{errors.name}</p>}
        </div>

        {/* 3. última pergunta: aniversário (e CPF quando destrava a lista de convidados) */}
        {askExtra && (
          <div ref={extraRef} className={`${s.fieldWrap} ${s.bonusCard} ${s.reveal}`} data-step={4} role="group" aria-labelledby="bonus-title">
            <div className={s.bonusHead}>
              <span className={s.bonusIcon} aria-hidden="true"><IconId size={26} stroke={1.8} /></span>
              <div>
                <b id="bonus-title" className={s.bonusTitle}>{extraTitle}</b>
                <span className={s.bonusText}>{extraText}</span>
              </div>
            </div>

            <label className={s.label} htmlFor="f-email">E-mail <small>confirmação e convite da agenda</small></label>
            {knownEmail ? (
              <div className={s.maskRow}><span className={s.maskChip}><IconCheck size={14} stroke={3} /> {found!.masked.email}</span><button type="button" className={s.linkBtn} onClick={() => setUseKnown((u) => ({ ...u, email: false }))}>trocar</button></div>
            ) : (
              <>
                <input id="f-email" className={`${s.input} ${show('email') ? s.inputErr : ''}`} type="email" inputMode="email" autoComplete="email"
                  placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                {show('email') && <p className={s.err} role="alert">{errors.email}</p>}
              </>
            )}

            <label className={s.label} htmlFor="f-cpf" style={{ marginTop: 14 }}>{isBirthday ? 'CPF de quem faz aniversário' : 'Seu CPF'} <small>{bigGroup ? 'diz quem é o anfitrião da lista de convidados' : 'confirma o nome na chegada'}</small></label>
            {knownCpf ? (
              <div className={s.maskRow}><span className={s.maskChip}><IconCheck size={14} stroke={3} /> {found!.masked.cpf}</span><button type="button" className={s.linkBtn} onClick={() => setUseKnown((u) => ({ ...u, cpf: false }))}>usar outro</button></div>
            ) : (
              <>
                <input id="f-cpf" className={`${s.input} ${show('cpf') ? s.inputErr : ''}`} type="text" inputMode="numeric" autoComplete="off"
                  placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(maskCPF(e.target.value))} />
                {show('cpf') && <p className={s.err} role="alert">{errors.cpf}</p>}
              </>
            )}

            <label className={s.label} htmlFor="f-birthday" style={{ marginTop: 14 }}>{isBirthday ? 'Data de nascimento de quem faz aniversário' : 'Sua data de nascimento'} <small>quem reserva precisa ter entre 18 e 80 anos</small></label>
            {knownBirthday ? (
              <div className={s.maskRow}>
                <span className={s.maskChip}><IconCheck size={14} stroke={3} /> {found!.masked.birthday}</span>
                <span className={s.hint}>já temos a sua.</span>
                <button type="button" className={s.linkBtn} onClick={() => setUseKnown((u) => ({ ...u, birthday: false }))}>usar outra data</button>
              </div>
            ) : (
              <>
                <input id="f-birthday" className={`${s.input} ${show('birthday') ? s.inputErr : ''}`} type="text" inputMode="numeric" autoComplete="bday"
                  placeholder="DD/MM/AAAA" value={birthday} onChange={(e) => setBirthday(maskDateBR(e.target.value))} />
                {show('birthday') && <p className={s.err} role="alert">{errors.birthday}</p>}
              </>
            )}

            <div className={s.greetBtns}>
              <button type="button" className={s.confirm} disabled={sending} onClick={completar}>{sending ? 'Guardando sua mesa…' : <>Confirmar minha mesa <IconArrowRight size={16} stroke={2.4} /></>}</button>
            </div>
            <p className={s.hint}>Você pode voltar e mudar o WhatsApp ou o nome: <button type="button" className={s.linkBtn} onClick={() => setAskExtra(false)}>editar meus dados</button>.</p>
          </div>
        )}

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
            {!ERR[serverError.code || ''] && <span><button type="button" className={s.linkBtn} onClick={() => enviar(knownBirthday || (!!parseDateBR(birthday) && !birthdayError(birthday)))}>Tentar de novo</button></span>}
          </div>
        )}

        {!askExtra && (
          <div className={s.footer}>
            <div className={s.footerInner}>
              <button type="submit" className={s.primary} disabled={sending || waitingIdentity || blockedByActive}>
                {sending ? 'Guardando sua mesa…' : <>Confirmar minha mesa <IconArrowRight size={18} stroke={2.4} /></>}
              </button>
              <p className={s.footerHint}>
                {lookup.status === 'loading' ? 'Buscando dados de reservas anteriores…' : blockedByActive ? 'Resolva a reserva que já existe para esse WhatsApp.' : waitingIdentity ? `Responda se é você, ${found?.firstName}.` : canSend ? `Seu código chega no WhatsApp ${maskPhone(phone)} na mesma hora.` : 'Só WhatsApp e nome. Nada mais.'}
              </p>
            </div>
          </div>
        )}
        {askExtra && sending && (
          <div className={s.footer}><div className={s.footerInner}><p className={s.footerHint}>Guardando sua mesa…</p></div></div>
        )}
      </form>
    </>
  );
}
