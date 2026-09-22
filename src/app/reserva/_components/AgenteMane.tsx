'use client';
// Agente do Mané: botão flutuante + painel de chat dentro da jornada de reserva.
// PASSO 1 (demonstração): respostas locais, sem IA. Nos passos 2 e 3 o cérebro passa a ser o mane-agent via proxy no servidor.
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import s from './agente.module.css';
import { loadDraft, type Draft } from '../_lib/draft';
import { conciergeLink, metaFor } from '../_lib/units';
import { track } from '../_lib/track';

type Msg =
  | { id: number; who: 'bot' | 'me'; text: string }
  | { id: number; who: 'resumo'; rows: { k: string; v: string }[] }
  | { id: number; who: 'card'; title: string; text: string; action: string; payload: Record<string, unknown> };

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
function fmtDia(ymd: string | null) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DIAS[dt.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}
function shiftTime(t: string, min: number) {
  const [h, m] = t.split(':').map(Number);
  const tot = h * 60 + m + min;
  return `${String(Math.floor(tot / 60)).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
}
function nomeCasa(d: Draft) {
  const m = metaFor((d.unitSlug as any) || null);
  return m ? `Mané ${m.short}` : d.unitName;
}
function resumoRows(d: Draft): { k: string; v: string }[] {
  const rows: { k: string; v: string }[] = [];
  if (d.unitName) rows.push({ k: 'Casa', v: nomeCasa(d)! });
  const total = (d.adults || 0) + (d.kids || 0);
  if (total) rows.push({ k: 'Mesa', v: `${total} pessoa${total > 1 ? 's' : ''}${d.kids ? `, ${d.kids} criança${d.kids > 1 ? 's' : ''}` : ''}` });
  if (d.dateYMD) rows.push({ k: 'Dia', v: `${fmtDia(d.dateYMD)}${d.time ? ` às ${d.time.replace(':00', 'h').replace(':30', 'h30')}` : ''}` });
  if (d.areaName) rows.push({ k: 'Ambiente', v: d.areaName.replace(/^Ala\s+/i, '') });
  return rows;
}
function resumo(d: Draft) {
  const partes: string[] = [];
  if (d.unitName) partes.push(nomeCasa(d)!);
  const total = (d.adults || 0) + (d.kids || 0);
  if (total) partes.push(`${total} pessoa${total > 1 ? 's' : ''}${d.kids ? ` (${d.kids} criança${d.kids > 1 ? 's' : ''})` : ''}`);
  if (d.dateYMD) partes.push(fmtDia(d.dateYMD)!);
  if (d.time) partes.push(`às ${d.time}`);
  if (d.areaName) partes.push(`no ${d.areaName}`);
  return partes.join(', ');
}

// Cérebro de demonstração: regras simples em cima do rascunho. Some no passo 3.
function demoReply(text: string, d: Draft, nextId: () => number): Msg[] {
  const q = text.toLowerCase();
  const total = (d.adults || 0) + (d.kids || 0);
  const casa = nomeCasa(d) || 'a casa';
  if (/hor[aá]rio|lotou|lotad|cheio|outro/.test(q)) {
    const base = d.time || '19:00';
    const a = shiftTime(base, -30), b = shiftTime(base, 60);
    return [
      { id: nextId(), who: 'bot', text: `Às ${base} ${casa} costuma estar cheia. Dois horários que quase sempre têm mesa pro seu grupo:` },
      { id: nextId(), who: 'card', title: `${fmtDia(d.dateYMD) || 'mesmo dia'} às ${a}`, text: 'Meia hora antes. A casa ainda está tranquila e você pega a mesa boa.', action: `Usar ${a}`, payload: { time: a } },
      { id: nextId(), who: 'card', title: `${fmtDia(d.dateYMD) || 'mesmo dia'} às ${b}`, text: 'Uma hora depois. A primeira leva já saiu, vaga abre.', action: `Usar ${b}`, payload: { time: b } },
    ];
  }
  if (/crian|kids|brinq|fam[ií]lia/.test(q)) {
    return [{ id: nextId(), who: 'bot', text: `Com criança o melhor é o ambiente Família: fica ao lado da brinquedoteca e tem cadeirão. ${d.kids ? `Vi que vocês vêm com ${d.kids} criança${d.kids > 1 ? 's' : ''}, então já sugeri ele na sua reserva.` : 'Se quiser, marco ele pra você.'}` }];
  }
  if (/m[ií]nimo|quantas|pessoas|grupo/.test(q)) {
    const min = d.minPeople || 1;
    return [{ id: nextId(), who: 'bot', text: min > 1
      ? `Em ${casa} a reserva online é a partir de ${min} pessoas. Grupos menores são bem-vindos sem reserva, é só chegar. ${total && total < min ? `Você marcou ${total}: dá pra ajustar o grupo ou vir direto.` : ''}`
      : `${casa} aceita reserva pra qualquer tamanho de grupo. A partir de 8 pessoas você ganha um mimo e uma lista de convidados.` }];
  }
  if (/toler|atras|espera|segura/.test(q)) {
    return [{ id: nextId(), who: 'bot', text: 'A mesa fica guardada por 15 minutos depois do horário. Se for atrasar mais, me avisa aqui ou pelo WhatsApp da casa que a gente segura até 45.' }];
  }
  if (/cancel|alter|mudar|troc/.test(q)) {
    return [{ id: nextId(), who: 'bot', text: 'Depois de confirmar você recebe um código. Com ele dá pra alterar dia, hora e quantidade direto no site, ou cancelar pelo WhatsApp da casa. Sem multa, sem burocracia.' }];
  }
  if (/estacion|carro|chegar|onde|endere/.test(q)) {
    return [{ id: nextId(), who: 'bot', text: `${casa} tem estacionamento próprio com manobrista. Chegando, é só dizer seu nome na recepção que a mesa já está no seu nome.` }];
  }
  if (/card[aá]pio|comer|prato|chope|bebida|pre[çc]o/.test(q)) {
    return [{ id: nextId(), who: 'bot', text: 'O cardápio completo está em menu.mane.com.vc. Se me disser o que gosta (carne, peixe, pizza, vegetariano), eu indico por onde começar.' }];
  }
  if (/oi|ol[aá]|bom dia|boa tarde|boa noite|obrigad|valeu/.test(q)) {
    return [{ id: nextId(), who: 'bot', text: 'Tô aqui. Pode perguntar sobre horário, ambiente, grupo, tolerância ou como alterar depois.' }];
  }
  return [{ id: nextId(), who: 'bot', text: 'Boa pergunta. Nesta demonstração eu respondo sobre horário, ambiente pra crianças, mínimo de pessoas, tolerância, alteração e como chegar. Se for outra coisa, o time da casa responde pelo WhatsApp.' }];
}

const HINTS: Record<string, string> = {
  availability_empty: 'Lotou nesse horário? Eu te acho outro que cabe seu grupo.',
  slot_blocked_view: 'Esse horário não abre reserva. Quer que eu explique e sugira outro?',
  field_error: 'Travou em algo? Eu ajudo a fechar sua reserva.',
  idle: 'Precisa de ajuda pra fechar sua reserva?',
};

const SHOW_AFTER_MS = 60_000; // só se oferece depois de 1 minuto na jornada sem fechar a reserva
const START_KEY = 'mane:reserva:inicio';

export default function AgenteMane() {
  const pathname = usePathname();
  const done = !!pathname && /\/reserva\/pronto\//.test(pathname); // reserva feita: o agente não aparece
  const [visible, setVisible] = useState(false);
  // o relógio começa na primeira tela e continua nas seguintes (guardado na sessão do navegador)
  useEffect(() => {
    if (done) return;
    let start = 0;
    try { start = Number(window.sessionStorage.getItem(START_KEY) || 0); } catch { /* sem storage */ }
    if (!start) { start = Date.now(); try { window.sessionStorage.setItem(START_KEY, String(start)); } catch { /* ok */ } }
    const left = Math.max(0, SHOW_AFTER_MS - (Date.now() - start));
    const t = window.setTimeout(() => setVisible(true), left);
    return () => window.clearTimeout(t);
  }, [done]);
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const idRef = useRef(1);
  const nextId = () => idRef.current++;
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shown = useRef<Set<string>>(new Set());
  const opened = useRef(false);

  // rascunho atual (o site salva no sessionStorage a cada resposta)
  useEffect(() => {
    const t = setInterval(() => setDraft(loadDraft()), 1500);
    return () => clearInterval(t);
  }, []);

  // gatilhos: eventos do funil (lotou / bloqueado / erro) e inatividade
  useEffect(() => {
    const onFunil = (e: Event) => {
      const ev = (e as CustomEvent).detail?.event as string;
      if (!visible || open || opened.current || !HINTS[ev] || shown.current.has(ev)) return;
      shown.current.add(ev);
      setHint(HINTS[ev]);
    };
    window.addEventListener('mane:funil', onFunil);
    let idle: ReturnType<typeof setTimeout> | null = null;
    const arm = () => {
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => {
        if (visible && !open && !opened.current && !shown.current.has('idle')) { shown.current.add('idle'); setHint(HINTS.idle); }
      }, 40_000);
    };
    ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((n) => window.addEventListener(n, arm, { passive: true }));
    arm();
    const onScroll = () => setCompact(window.scrollY > 120);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('mane:funil', onFunil);
      ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((n) => window.removeEventListener(n, arm));
      window.removeEventListener('scroll', onScroll);
      if (idle) clearTimeout(idle);
    };
  }, [open, visible]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    setTimeout(() => inputRef.current?.focus(), 350);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => { logRef.current?.scrollTo({ top: 1e9 }); }, [msgs, typing]);

  const abrir = (origem: string) => {
    setHint(null); setOpen(true); opened.current = true;
    track('agent_open', { origem, step: draft.time ? 'ambiente' : draft.dateYMD ? 'hora' : draft.adults ? 'dia' : 'casa' });
    if (msgs.length === 0) {
      const rows = resumoRows(draft);
      const first: Msg[] = [{ id: nextId(), who: 'bot', text: 'Oi! Sou o Agente do Mané, uma inteligência artificial.' }];
      const rest: Msg[] = rows.length
        ? [{ id: nextId(), who: 'resumo', rows }, { id: nextId(), who: 'bot', text: 'Essa é a reserva que você está montando. Em que posso ajudar?' }]
        : [{ id: nextId(), who: 'bot', text: 'Posso ajudar a escolher casa, horário e ambiente, e a fechar sua reserva. O que você precisa?' }];
      setTyping(true);
      setTimeout(() => { setTyping(false); setMsgs(first); setTyping(true); setTimeout(() => { setTyping(false); setMsgs((m) => [...m, ...rest]); }, 600); }, 600);
    }
  };

  const enviar = (t: string) => {
    const clean = t.trim();
    if (!clean || typing) return;
    setText('');
    setMsgs((m) => [...m, { id: nextId(), who: 'me', text: clean }]);
    track('agent_message', { len: clean.length });
    setTyping(true);
    const respostas = demoReply(clean, draft, nextId);
    setTimeout(() => { setTyping(false); setMsgs((m) => [...m, ...respostas]); }, 650 + Math.min(900, clean.length * 12));
  };

  const aplicar = (payload: Record<string, unknown>) => {
    // Passo 3: aqui a sugestão preenche a jornada de verdade (reabre a pergunta certa com o valor).
    setMsgs((m) => [...m, { id: nextId(), who: 'bot', text: `Na versão final este botão preenche a reserva pra você (${Object.entries(payload).map(([k, v]) => `${k}: ${v}`).join(', ')}). Nesta demonstração ele só mostra o caminho.` }]);
  };

  const meta = metaFor((draft.unitSlug as any) || null);
  const humano = useMemo(() => {
    const r = resumo(draft);
    return conciergeLink(meta?.concierge || '61982850776', `Oi! Estava fazendo uma reserva pelo site${r ? ` (${r})` : ''} e preciso de ajuda de uma pessoa.`);
  }, [draft, meta]);

  const quick = ['Outro horário', 'Ambiente pra crianças', 'Tem mínimo de pessoas?', 'Quanto tempo segura a mesa?', 'Como altero depois?'];

  if (!visible || done) return null;

  return (
    <>
      {!open && hint && (
        <div className={`${s.hint} agente-hint`} role="status">
          <div>{hint}</div>
          <div className={s.hintRow}>
            <button type="button" className={`${s.hintBtn} ${s.hintNo}`} onClick={() => setHint(null)}>Agora não</button>
            <button type="button" className={`${s.hintBtn} ${s.hintYes}`} onClick={() => abrir('hint')}>Sim, me ajuda</button>
          </div>
        </div>
      )}
      {!open && (
        <button type="button" className={`${s.fab} agente-fab ${compact && !hint ? s.compact : ''}`} onClick={() => abrir('botao')} aria-label="Falar com o Agente do Mané, uma inteligência artificial">
          <span className={s.avatar} aria-hidden="true"><Spark /><span className={s.ia}>IA</span></span>
          <span className={s.fabText}>Agente do Mané<small>ajuda com sua reserva</small></span>
        </button>
      )}
      {open && (
        <>
          <div className={s.backdrop} onClick={() => setOpen(false)} />
          <section className={s.panel} role="dialog" aria-modal="true" aria-label="Agente do Mané">
            <header className={s.head}>
              <span className={s.avatar} aria-hidden="true"><Spark /><span className={s.ia}>IA</span></span>
              <div className={s.headText}>
                <strong>Agente do Mané</strong>
                <span>Inteligência artificial da casa. Responde em segundos. <span className={s.demo}>DEMO</span></span>
              </div>
              <button type="button" className={s.close} onClick={() => setOpen(false)} aria-label="Fechar">×</button>
            </header>
            <div className={s.log} ref={logRef}>
              {msgs.map((m) => m.who === 'card'
                ? <div key={m.id} className={s.card}><b>{m.title}</b><span>{m.text}</span><button type="button" className={s.cardBtn} onClick={() => aplicar(m.payload)}>{m.action}</button></div>
                : m.who === 'resumo'
                  ? <dl key={m.id} className={s.resumo}>{m.rows.map((r) => <div key={r.k}><dt>{r.k}</dt><dd>{r.v}</dd></div>)}</dl>
                  : <div key={m.id} className={`${s.msg} ${m.who === 'me' ? s.me : s.bot}`}>{m.text}</div>)}
              {typing && <div className={`${s.msg} ${s.bot} ${s.typing}`}><span /><span /><span /></div>}
            </div>
            <div className={s.quick}>
              {quick.map((q) => <button key={q} type="button" className={s.quickChip} onClick={() => enviar(q)}>{q}</button>)}
            </div>
            <form className={s.compose} onSubmit={(e) => { e.preventDefault(); enviar(text); }}>
              <input ref={inputRef} id="agente-input" className={s.input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Pergunte sobre horário, ambiente, grupo…" autoComplete="off" />
              <button type="submit" className={s.send} disabled={!text.trim() || typing} aria-label="Enviar"><SendIcon /></button>
            </form>
            <div className={s.foot}>
              <span>Sou uma IA e posso errar.</span>
              <a className={s.human} href={humano} target="_blank" rel="noopener" onClick={() => track('agent_handoff', { unit: draft.unitSlug })}>Falar com uma pessoa →</a>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function Spark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <path d="M12 7c.6 2.4 2.6 4.4 5 5-2.4.6-4.4 2.6-5 5-.6-2.4-2.6-4.4-5-5 2.4-.6 4.4-2.6 5-5z" fill="currentColor" stroke="none" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}
