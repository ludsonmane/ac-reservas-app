'use client';

import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import s from '../reserva.module.css';

export function StepHeader({ step, backHref }: { step: 1 | 2 | 3; backHref?: string }) {
  return (
    <header className={s.header}>
      {backHref ? (
        <Link href={backHref} className={s.back} aria-label="Voltar">
          <IconArrowLeft size={22} stroke={2.2} />
        </Link>
      ) : (
        <span />
      )}
      <div className={s.brand}>
        <img src="/images/1.png" alt="Mané Mercado" />
        <div className={s.steps} aria-label={`Etapa ${step} de 3`}>
          {[1, 2, 3].map((n) => (
            <i key={n} data-on={n < step} data-now={n === step} />
          ))}
        </div>
      </div>
      <span />
    </header>
  );
}
