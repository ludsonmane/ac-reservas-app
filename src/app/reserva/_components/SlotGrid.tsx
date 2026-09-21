'use client';

import s from '../reserva.module.css';
import { ALLOWED_SLOTS, dayWindow, slotBlockReason, type RecurringRule } from '../_lib/rules';

const REASON_LABEL: Record<string, string> = {
  fechado: '', passou: 'passou', antecedencia: 'encerrou', bloqueado: 'fechado', lotou: 'lotou',
};

/**
 * Grade de horários de 30 em 30 minutos, só os da janela do dia.
 * Horários que não dão aparecem riscados com o motivo, em vez de sumir.
 */
export function SlotGrid({
  dateYMD, sp, rules, fullSlots, value, onChange,
}: {
  dateYMD: string;
  sp: boolean;
  rules: RecurringRule[];
  fullSlots: Set<string>;
  value: string | null;
  onChange: (hhmm: string) => void;
}) {
  const win = dayWindow(dateYMD, sp);
  if (!win) return null;
  const slots = ALLOWED_SLOTS.filter((t) => t >= win.open && t <= win.close);

  return (
    <div className={s.slots} role="radiogroup" aria-label="Que horas vocês chegam">
      {slots.map((t) => {
        const reason = slotBlockReason({ dateYMD, hhmm: t, sp, rules }) || (fullSlots.has(t) ? 'lotou' : null);
        const on = value === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={!!reason}
            className={s.slot}
            onClick={() => onChange(t)}
            title={reason ? REASON_LABEL[reason] : undefined}
          >
            {t.replace(':00', 'h').replace(':30', 'h30')}
            {reason && REASON_LABEL[reason] ? <span>{REASON_LABEL[reason]}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
