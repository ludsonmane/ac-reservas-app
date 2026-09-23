'use client';

import * as React from 'react';
import { IconCheck, IconPencil } from '@tabler/icons-react';
import s from '../reserva.module.css';

/**
 * Uma pergunta da jornada. Três estados:
 * - ativa: expandida, com os controles;
 * - respondida: linha compacta com a resposta e "alterar";
 * - futura: não aparece ainda.
 * A linha e o bloco vivem juntos e trocam de lugar com transição de altura e opacidade,
 * para "alterar" abrir de forma suave (e não seca).
 */
export function Question({
  id, index, title, aside, answer, state, onEdit, children,
}: {
  id: string;
  index: number;
  title: string;
  aside?: string;
  answer: string | null;
  state: 'active' | 'done' | 'locked';
  onEdit: () => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLElement>(null);
  const prev = React.useRef<typeof state | null>(null);

  // quando PASSA a ser ativa (não na abertura da página), rola até ela depois da animação começar
  React.useEffect(() => {
    const was = prev.current; prev.current = state;
    if (state !== 'active' || was === null || was === 'active' || !ref.current) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => {
      ref.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }, 120);
    return () => window.clearTimeout(t);
  }, [state]);

  if (state === 'locked') return null;

  return (
    <section ref={ref} className={`${s.qWrap} ${s.reveal}`} aria-labelledby={`q-${id}`} style={{ scrollMarginTop: 16 }} data-step={index}>
      {/* linha compacta (respondida) */}
      <div className={s.fold} data-open={state === 'done'} aria-hidden={state !== 'done'}>
        <div className={s.foldInner}>
          <div className={s.done}>
            <span className={s.stepBadge} aria-hidden="true"><IconCheck size={15} stroke={3} /></span>
            <span className={s.doneText}>
              <small>{title}</small>
              <b>{answer}</b>
            </span>
            <button type="button" className={s.doneEdit} onClick={onEdit} aria-label={`Alterar: ${title}`} tabIndex={state === 'done' ? 0 : -1}>
              <IconPencil size={15} stroke={2.2} /> alterar
            </button>
          </div>
        </div>
      </div>

      {/* bloco aberto (ativa) */}
      <div className={s.fold} data-open={state === 'active'} aria-hidden={state !== 'active'}>
        <div className={s.foldInner}>
          <div className={s.block}>
            <h2 className={s.q} id={`q-${id}`}>
              <span className={s.qTitle}><span className={s.stepBadge} aria-hidden="true">{index}</span>{title}</span>
              {aside && <small>{aside}</small>}
            </h2>
            {state === 'active' ? children : null}
          </div>
        </div>
      </div>
    </section>
  );
}
