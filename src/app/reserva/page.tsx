'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dayjs from 'dayjs';
import { apiGet } from '@/lib/api';
import { toS3Url } from '@/lib/assets';
import s from './reserva.module.css';
import { StepHeader } from './_components/StepHeader';
import { UnitPicker, type UnitOption } from './_components/UnitPicker';
import { ChipGroup } from './_components/Chips';
import { PeopleCounter } from './_components/PeopleCounter';
import { DayChips } from './_components/DayChips';
import { SlotGrid } from './_components/SlotGrid';
import { AreaCards, type AreaCard } from './_components/AreaCards';
import { Question } from './_components/Question';
import { BenefitCard } from './_components/BenefitCard';
import { IconArrowRight } from '@tabler/icons-react';
import { EMPTY_DRAFT, loadDraft, saveDraft, type Draft, type Occasion } from './_lib/draft';
import { track } from './_lib/track';
import { detectSlug, metaFor, conciergeLink } from './_lib/units';
import {
  DEFAULT_MIN_PEOPLE, MAX_PEOPLE_WITHOUT_CONCIERGE, earliestBookable, isSpUnit, isBsbUnit, periodOf,
  ruleCovers, type RecurringRule, fmtLongDate, peakMinPeople, unitRulesForDay, lastBookableSlot,
} from './_lib/rules';

type AvailArea = {
  id: string; name: string; description?: string | null; photoUrl?: string | null; photoUrlAbsolute?: string | null;
  available?: number; remaining?: number; isAvailable?: boolean; isActive?: boolean;
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Tela1 />
    </Suspense>
  );
}

function Tela1() {
  const router = useRouter();
  const params = useSearchParams();

  // ---------- estado ----------
  // começa vazio no servidor e no cliente (mesmo HTML); o rascunho entra depois de montar
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [ready, setReady] = React.useState(false);
  const [units, setUnits] = React.useState<UnitOption[]>([]);
  const [unitsLoading, setUnitsLoading] = React.useState(true);
  const [rules, setRules] = React.useState<RecurringRule[]>([]);
  const [avail, setAvail] = React.useState<{ AFTERNOON: AvailArea[]; NIGHT: AvailArea[] } | null>(null);
  const [availLoading, setAvailLoading] = React.useState(false);
  const [touchedContinue, setTouchedContinue] = React.useState(false);
  // fluxo progressivo: qual pergunta está em foco e se o bloco de pessoas foi confirmado
  type QKey = 'unit' | 'people' | 'date' | 'time' | 'area';
  const [editing, setEditing] = React.useState<QKey | null>(null);
  const [peopleDone, setPeopleDone] = React.useState(false);
  const [, setTick] = React.useState(0);
  React.useEffect(() => { const i = window.setInterval(() => setTick((x) => x + 1), 60000); return () => window.clearInterval(i); }, []);

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  React.useEffect(() => {
    const d = loadDraft();
    // link com o tamanho da mesa e o dia (bio, anúncio "reserve pra 8 no sábado"): ?people=8&date=2026-10-04
    const wantPeople = Number(params.get('people') || params.get('pessoas') || 0);
    if (!d.adults && wantPeople >= 1 && wantPeople <= 200) { d.adults = Math.floor(wantPeople); }
    // ?occasion=aniversario (anúncio de aniversário) já marca a ocasião
    const occ = String(params.get('occasion') || params.get('ocasiao') || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!d.occasion && (occ === 'ANIVERSARIO' || occ === 'CONFRATERNIZACAO' || occ === 'EMPRESA')) d.occasion = occ as Occasion;
    const wantDate = params.get('date') || params.get('dia');
    if (!d.dateYMD && wantDate && /^\d{4}-\d{2}-\d{2}$/.test(wantDate) && wantDate >= dayjs().format('YYYY-MM-DD')) d.dateYMD = wantDate;
    // guarda a origem (UTMs) no rascunho: a tela 2 não tem mais a query na URL
    const utm: Record<string, string> = {};
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) { const v = params.get(k); if (v) utm[k] = v; }
    if (Object.keys(utm).length || !d.attribution) {
      d.attribution = { ...(d.attribution || {}), ...utm, url: window.location.href, ref: document.referrer || d.attribution?.ref || '' };
    }
    setDraft(d); setPeopleDone(false); setReady(true); track('step_view', { step: 'quando' });
    const edit = params.get('edit');
    if (edit === 'unit' || edit === 'people' || edit === 'date' || edit === 'time') setEditing(edit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => { if (ready) saveDraft(draft); }, [draft, ready]);

  // ---------- unidades ----------
  React.useEffect(() => {
    if (!ready) return;
    let alive = true;
    (async () => {
      try {
        const list = await apiGet<any[]>('/v1/units/public/options/list');
        if (!alive) return;
        const norm: UnitOption[] = (list ?? []).map((u) => ({
          id: String(u.id), name: String(u.name ?? ''), slug: u.slug ?? null,
          minPeople: typeof u.minPeople === 'number' ? u.minPeople : null,
        }));
        setUnits(norm);
        // pré-seleção pelo link (?unit=bsb|ac|sp|partage ou id)
        const want = params.get('unit');
        if (want && !draft.unitId) {
          const u = norm.find((x) => x.id === want || detectSlug(x.slug, x.name) === want || x.slug === want);
          if (u) selectUnit(u);
        }
        if (!want && !draft.unitId) track('reserve_start', { source: params.get('utm_source') || 'direto' });
        else track('reserve_start', { source: params.get('utm_source') || 'link-unidade', unit: want });
      } catch {
        /* a UI mostra os cartões desabilitados */
      } finally {
        if (alive) setUnitsLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function selectUnit(u: UnitOption) {
    const slug = detectSlug(u.slug, u.name);
    const min = Math.max(DEFAULT_MIN_PEOPLE, u.minPeople ?? 0);
    patch({
      unitId: u.id, unitName: u.name, unitSlug: slug, minPeople: min,
      time: null, areaId: null, areaName: null,
      adults: draft.adults && draft.adults < min ? min : draft.adults,
    });
    // pré-seleção via link não pode apagar um ?edit=time/date que veio junto
    setEditing((e) => (e === 'unit' || e === null ? null : e));
  }

  const unit = units.find((u) => u.id === draft.unitId) || null;
  const sp = isSpUnit(draft.unitSlug, draft.unitName);
  const bsb = isBsbUnit(draft.unitSlug, draft.unitName); // sábado abre 11:00
  const minPeople = draft.minPeople ?? DEFAULT_MIN_PEOPLE;
  const total = draft.adults + draft.kids;

  // ---------- bloqueios recorrentes da unidade ----------
  React.useEffect(() => {
    if (!draft.unitId) { setRules([]); return; }
    let alive = true;
    apiGet<any[]>(`/v1/blocks/public/recurring?unitId=${encodeURIComponent(draft.unitId)}`)
      .then((list) => alive && setRules((list ?? []).map((r) => ({
        dow: Number(r.dow), fromTime: String(r.fromTime), toTime: String(r.toTime), areaId: r.areaId ?? null, reason: r.reason ?? null,
      }))))
      .catch(() => alive && setRules([]));
    return () => { alive = false; };
  }, [draft.unitId]);

  // ---------- disponibilidade por período (2 chamadas por dia escolhido) ----------
  React.useEffect(() => {
    if (!draft.unitId || !draft.dateYMD) { setAvail(null); return; }
    let alive = true;
    setAvailLoading(true);
    const q = (time: string) =>
      apiGet<AvailArea[]>(`/v1/reservations/public/availability?unitId=${encodeURIComponent(draft.unitId!)}&date=${draft.dateYMD}&time=${time}`)
        .then((l) => l ?? []).catch(() => [] as AvailArea[]);
    Promise.all([q('12:00'), q('18:00')]).then(([a, n]) => {
      if (!alive) return;
      setAvail({ AFTERNOON: a, NIGHT: n });
      setAvailLoading(false);
    });
    return () => { alive = false; };
  }, [draft.unitId, draft.dateYMD]);

  // horários em que nenhuma área cabe o grupo
  const fullSlots = React.useMemo(() => {
    const set = new Set<string>();
    if (!avail || !draft.dateYMD) return set;
    const fits = (list: AvailArea[]) => list.some((a) => (a.available ?? a.remaining ?? 0) >= Math.max(total, 1));
    const fullA = !fits(avail.AFTERNOON);
    const fullN = !fits(avail.NIGHT);
    for (let h = 12; h <= 22; h++) for (const m of ['00', '30']) {
      const t = `${String(h).padStart(2, '0')}:${m}`;
      if ((periodOf(t) === 'AFTERNOON' && fullA) || (periodOf(t) === 'NIGHT' && fullN)) set.add(t);
    }
    return set;
  }, [avail, total, draft.dateYMD]);

  // ---------- ambientes do período escolhido ----------
  const areas: AreaCard[] = React.useMemo(() => {
    if (!avail || !draft.time || !draft.dateYMD) return [];
    const list = avail[periodOf(draft.time)] || [];
    return list
      .filter((a) => a.isActive !== false)
      .map((a) => ({
        id: String(a.id), name: String(a.name), description: a.description,
        photoUrl: toS3Url(a.photoUrlAbsolute ?? a.photoUrl) ?? null,
        available: Number(a.available ?? a.remaining ?? 0),
        blocked: rules.some((r) => r.areaId === a.id && ruleCovers(r, draft.dateYMD!, draft.time!)),
      }));
  }, [avail, draft.time, draft.dateYMD, rules]);

  // sugestão: criança leva para a área de família; senão, a que tem mais lugar
  const suggestedId = React.useMemo(() => {
    const ok = areas.filter((a) => a.available >= total && !a.blocked && !(a.name.toLowerCase() === 'maneco' && draft.time && draft.time < '18:00'));
    if (ok.length === 0) return null;
    if (draft.kids > 0) {
      const fam = ok.find((a) => /fam[ií]lia|brinquedoteca/i.test(a.name));
      if (fam) return fam.id;
    }
    if (draft.occasion === 'ANIVERSARIO' || total >= 16) {
      const big = [...ok].sort((a, b) => b.available - a.available)[0];
      return big.id;
    }
    return [...ok].sort((a, b) => b.available - a.available)[0].id;
  }, [areas, total, draft.kids, draft.occasion, draft.time]);

  // aplica a sugestão quando ainda não há escolha (ou a escolhida deixou de caber)
  React.useEffect(() => {
    if (!draft.time) return;
    const chosen = areas.find((a) => a.id === draft.areaId);
    if (chosen && chosen.available >= total && !chosen.blocked) return;
    const sug = areas.find((a) => a.id === suggestedId);
    patch({ areaId: sug?.id ?? null, areaName: sug?.name ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedId, areas.length, draft.time]);

  React.useEffect(() => {
    if (draft.time && areas.length > 0 && !suggestedId) track('availability_empty', { unit: draft.unitSlug, date: draft.dateYMD, time: draft.time, people: total });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedId, areas.length]);

  // ---------- validação ----------
  const missing: string[] = [];
  if (!draft.unitId) missing.push('a casa');
  if (draft.adults <= 0) missing.push('quantos adultos');
  if (!draft.dateYMD) missing.push('o dia');
  if (!draft.time) missing.push('o horário');
  if (draft.time && !draft.areaId) missing.push('o ambiente');
  const peakMin = draft.dateYMD && draft.time ? peakMinPeople(draft.dateYMD, draft.time, draft.unitSlug) : 1;
  const belowPeak = draft.adults > 0 && !!draft.time && total < peakMin && total >= minPeople;
  const dayRules = draft.dateYMD ? unitRulesForDay(rules, draft.dateYMD) : [];
  const lastSlot = draft.dateYMD ? lastBookableSlot(draft.dateYMD, sp, rules, bsb) : null;
  const belowMin = draft.adults > 0 && total < minPeople;
  const tooBig = total > MAX_PEOPLE_WITHOUT_CONCIERGE;
  const canContinue = missing.length === 0 && !belowMin && !tooBig && !belowPeak;

  const earliest = earliestBookable();
  const meta = metaFor(draft.unitSlug as any);

  function onContinue() {
    setTouchedContinue(true);
    if (!canContinue) {
      track('field_error', { step: 'quando', missing, belowMin, tooBig });
      return;
    }
    saveDraft(draft);
    router.push('/reserva/dados');
  }

  // ---------- fluxo progressivo ----------
  const timeLabel = (hhmm: string) => hhmm.replace(':00', 'h').replace(':30', 'h30');
  const answers: Record<QKey, string | null> = {
    unit: draft.unitId ? `Mané ${meta?.short || draft.unitName || ''}`.trim() : null,
    people: peopleDone && draft.adults > 0 && !belowMin && !tooBig
      ? `${total} pessoas${draft.kids ? ` (${draft.kids} ${draft.kids === 1 ? 'criança' : 'crianças'})` : ''}`
      : null,
    date: draft.dateYMD ? fmtLongDate(draft.dateYMD) : null,
    time: draft.time ? timeLabel(draft.time) : null,
    area: draft.areaName ? draft.areaName.replace(/^Ala\s+/i, '') : null,
  };
  const order: QKey[] = ['unit', 'people', 'date', 'time'];
  const firstOpen = order.find((k) => !answers[k]) ?? null;
  const active: QKey = editing ?? firstOpen ?? 'area';
  const stateOf = (k: QKey): 'active' | 'done' | 'locked' =>
    k === active ? 'active' : answers[k] ? 'done' : 'locked';
  const showArea = !!draft.time && active === 'area';

  // ---------- render ----------
  if (!ready) {
    return (
      <>
        <StepHeader step={1} backHref="/" />
        <div className={s.intro}><h1 className={s.h1}>Vamos guardar sua mesa.</h1></div>
      </>
    );
  }

  return (
    <>
      <StepHeader step={1} backHref="/" />

      <div className={s.intro}>
        <h1 className={s.h1}>Vamos guardar sua mesa.</h1>
      </div>

      {/* 1. casa */}
      <Question id="unit" title="Em qual Mané?" index={1} state={stateOf('unit')} answer={answers.unit} onEdit={() => setEditing('unit')}>
        <UnitPicker units={units} loading={unitsLoading} value={draft.unitId} onChange={(u) => selectUnit(u)} />
        {draft.unitId && minPeople > DEFAULT_MIN_PEOPLE && (
          <p className={s.hint}>Aqui a mesa é guardada a partir de {minPeople} pessoas. Grupo menor não precisa reservar: é só chegar.</p>
        )}
      </Question>

      {/* 2. pessoas */}
      <Question id="people" title="Quem vem?" aside="o número exato ajuda a montar a mesa" index={2} state={stateOf('people')} answer={answers.people} onEdit={() => setEditing('people')}>
        <div className={s.counterCard}>
          <PeopleCounter id="reserva-adultos" label="Adultos" helper="Conte você também" value={draft.adults} min={0} max={200}
            quick={[2, 4, 6, 8, 10, 12, 14, 30, 40]} onChange={(n) => patch({ adults: n })} />
          <PeopleCounter id="reserva-criancas" label="Crianças" helper="Até 12 anos, para a mesa já vir com espaço para elas" value={draft.kids} min={0} max={60}
            quick={[0, 1, 2, 3, 4, 5]} onChange={(n) => patch({ kids: n })} />
          <div className={s.total} aria-live="polite">
            <span>Total na mesa</span>
            <span className={s.totalNum}><b>{total}</b>{total === 1 ? 'pessoa' : 'pessoas'}</span>
            {draft.unitId && total > 0 && belowMin && (
              <p className={`${s.totalNote} ${s.warn}`}>Mínimo de {minPeople} pessoas nesta casa.</p>
            )}

          </div>
        </div>
        {draft.adults > 0 && !tooBig && <BenefitCard people={total} occasion={draft.occasion} />}
        {tooBig ? (
          <div className={`${s.alert} ${s.alertInfo}`} role="status">
            <b>Grupo grande merece atenção pessoal.</b>
            <span>
              Acima de {MAX_PEOPLE_WITHOUT_CONCIERGE} pessoas, nossa equipe monta a reserva com você no WhatsApp.{' '}
              <a className={s.linkBtn} href={conciergeLink(meta?.concierge || '61982850776', `Oi! Quero reservar para ${total} pessoas no Mané ${meta?.short || ''}. Podem me ajudar?`)} target="_blank" rel="noreferrer">Chamar a equipe</a>
            </span>
          </div>
        ) : (
          <div className={s.confirmRow}>
            <button type="button" className={s.confirm} disabled={draft.adults <= 0 || belowMin}
              onClick={() => { setPeopleDone(true); setEditing(null); }}>
              {draft.adults > 0 && !belowMin ? `Somos ${total}` : 'Quantos vêm?'} <IconArrowRight size={18} stroke={2.4} />
            </button>
          </div>
        )}
      </Question>

      {/* 3. dia */}
      <Question id="date" title="Que dia?" index={3} state={stateOf('date')} answer={answers.date} onEdit={() => setEditing('date')}>
        <DayChips value={draft.dateYMD} sp={sp} onChange={(d) => { patch({ dateYMD: d, time: null, areaId: null, areaName: null }); if (d) setEditing(null); }} />
        {draft.dateYMD === dayjs().format('YYYY-MM-DD') && <p className={s.hint}>{earliest.reason}</p>}
        {sp && <p className={s.hint}>O Mané de São Paulo não abre às segundas.</p>}
      </Question>

      {/* 4. horário */}
      <Question id="time" title="Que horas vocês chegam?" aside="a mesa espera 15 min" index={4} state={stateOf('time')} answer={answers.time} onEdit={() => setEditing('time')}>
        {draft.dateYMD && (availLoading && !avail ? (
          <div className={s.slots} aria-busy="true">{Array.from({ length: 8 }).map((_, i) => <div key={i} className={s.skeleton} />)}</div>
        ) : (
          <SlotGrid dateYMD={draft.dateYMD} sp={sp} bsb={bsb} rules={rules} fullSlots={fullSlots} value={draft.time}
            onChange={(tm) => { patch({ time: tm, areaId: null, areaName: null }); setEditing(null); }} />
        ))}
        {draft.dateYMD && (
          <div className={s.slotNote}>
            <span>A mesa espera 15 minutos depois do horário.</span>
            <span>{fmtLongDate(draft.dateYMD)}</span>
          </div>
        )}
        {dayRules.length > 0 && lastSlot && (
          <div className={`${s.alert} ${s.alertInfo}`} role="status">
            <b>Neste dia a casa recebe reservas até {lastSlot.replace(':00', 'h').replace(':30', 'h30')}.</b>
            <span>{dayRules[0].reason ? dayRules[0].reason.replace(/\s+—\s+/g, ', ') : 'Depois disso é só chegar e sentar.'}</span>
          </div>
        )}
      </Question>

      {/* 5. ocasião + ambiente */}
      {showArea && belowPeak && (
        <div className={`${s.alert} ${s.alertWarn} ${s.reveal}`} role="status">
          <b>Nesse horário a casa reserva a partir de {peakMin} pessoas.</b>
          <span>Sexta à noite, sábado de dia e domingo no almoço são de pico. <button type="button" className={s.linkBtn} onClick={() => setEditing('people')}>Ajustar o grupo</button> ou <button type="button" className={s.linkBtn} onClick={() => setEditing('time')}>escolher outro horário</button>.</span>
        </div>
      )}
      {showArea && (
        <>
          <section className={`${s.block} ${s.reveal}`} aria-labelledby="q-occ" data-step={5}>
            <h2 className={s.q} id="q-occ"><span className={s.qTitle}><span className={s.stepBadge} aria-hidden="true">5</span>É uma ocasião especial?</span><small>opcional</small></h2>
            <ChipGroup<Occasion & string> soft ariaLabel="Ocasião"
              options={[{ value: 'ANIVERSARIO', label: 'Aniversário' }, { value: 'CONFRATERNIZACAO', label: 'Confraternização' }, { value: 'EMPRESA', label: 'Empresa' }]}
              value={draft.occasion as any} onChange={(v) => patch({ occasion: (v as Occasion) ?? null })} />
            <BenefitCard people={total} occasion={draft.occasion} compact />
          </section>

          <section className={`${s.block} ${s.reveal}`} aria-labelledby="q-area" data-step={6}>
            <h2 className={s.q} id="q-area"><span className={s.qTitle}><span className={s.stepBadge} aria-hidden="true">6</span>Onde vocês querem ficar?</span></h2>
            {areas.length === 0 && availLoading ? (
              <div className={s.areas} aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className={s.skeleton} style={{ height: 150 }} />)}</div>
            ) : areas.length === 0 ? (
              <div className={`${s.alert} ${s.alertWarn}`}><b>Não achamos áreas para essa casa.</b><span>Tente outro dia ou fale com a gente no WhatsApp.</span></div>
            ) : !suggestedId ? (
              <div className={`${s.alert} ${s.alertBad}`} role="status">
                <b>Esse horário lotou para {total} pessoas.</b>
                <span>
                  <button type="button" className={s.linkBtn} onClick={() => setEditing('time')}>Escolher outro horário</button>
                  {' '}ou{' '}
                  <a className={s.linkBtn} href={conciergeLink(meta?.concierge || '61982850776', `Oi! Queria uma mesa para ${total} no Mané ${meta?.short || ''} ${fmtLongDate(draft.dateYMD!)} às ${draft.time}, mas o site mostrou lotado. Tem alguma opção?`)} target="_blank" rel="noreferrer">falar com a gente no WhatsApp</a>.
                </span>
              </div>
            ) : (
              <>
                <AreaCards areas={areas} value={draft.areaId} suggestedId={suggestedId} time={draft.time!} people={total}
                  onChange={(a) => patch({ areaId: a.id, areaName: a.name })} />
                <p className={s.hint}>
                  {draft.areaId === suggestedId
                    ? draft.kids > 0 ? 'Sugerimos essa porque vêm crianças. Toque em outra para trocar.' : 'Sugerimos a área com mais lugar para o grupo. Toque em outra para trocar.'
                    : 'Você escolheu. A equipe recebe vocês nessa área.'}
                </p>
              </>
            )}
          </section>
        </>
      )}

      {showArea && (
        <div className={s.footer}>
          <div className={s.footerInner}>
            <button type="button" className={s.primary} onClick={onContinue} disabled={!canContinue && touchedContinue}>
              Guardar esse horário
            </button>
            <p className={s.footerHint}>
              {canContinue
                ? `${answers.unit} · ${total} pessoas · ${fmtLongDate(draft.dateYMD!)} · ${timeLabel(draft.time!)} · ${answers.area}`
                : missing.length ? `Falta escolher ${missing.join(', ')}.` : belowPeak ? `Mínimo de ${peakMin} pessoas nesse horário.` : ''}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
