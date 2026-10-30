'use client';

import * as React from 'react';
import { IconCake, IconCheck, IconLock, IconMoodKid, IconUsers } from '@tabler/icons-react';
import s from './benefit.module.css';
import { BIRTHDAY_TIERS, GUEST_LIST_MIN, birthdayTier, fmtBRL, nextBirthdayTier } from '../_lib/benefits';

const MAX = BIRTHDAY_TIERS[BIRTHDAY_TIERS.length - 1].min; // 31: topo da barra
const TOP_BONUS = BIRTHDAY_TIERS[BIRTHDAY_TIERS.length - 1].bonus;

/**
 * Cartão do benefício da mesa (Mané), com movimento.
 * Aniversário: escada de bônus por faixa de convidados (R$100 / R$150 / R$200 em 8 / 16 / 30) com os mimos
 * da Brinquedoteca; barra até a última faixa, faixa conquistada em dourado, faíscas ao subir.
 * Outras ocasiões (ou ocasião ainda não escolhida): só a lista de convidados a partir de 8; o bônus em R$
 * aparece como convite "É aniversário?", nunca como conquistado. `onBirthday` liga/desliga a ocasião ali mesmo.
 */
export function BenefitCard({ people, occasion, compact, onBirthday }: {
  people: number; occasion?: string | null; compact?: boolean; onBirthday?: (on: boolean) => void;
}) {
  const aniv = occasion === 'ANIVERSARIO';
  const tier = aniv ? birthdayTier(people) : null;
  const next = aniv ? nextBirthdayTier(people) : null;
  const listWon = people >= GUEST_LIST_MIN;
  const key = aniv ? `a-${tier?.level ?? 0}` : `l-${listWon ? 1 : 0}`;

  // faíscas só quando sobe de faixa (não na primeira pintura)
  const prevLevel = React.useRef<number | null>(null);
  const [burst, setBurst] = React.useState(0);
  const level = aniv ? tier?.level ?? 0 : listWon ? 1 : 0;
  React.useEffect(() => {
    if (prevLevel.current !== null && level > prevLevel.current && level > 0) setBurst((b) => b + 1);
    prevLevel.current = level;
  }, [level]);

  const sparks = (
    <span key={burst} className={s.sparks} aria-hidden="true">
      {Array.from({ length: 10 }).map((_, k) => (
        <i key={k} style={{ ['--a' as any]: `${(k / 10) * 360}deg`, ['--d' as any]: `${38 + (k % 3) * 14}px`, animationDelay: `${(k % 4) * 30}ms` }} />
      ))}
    </span>
  );

  if (!aniv) {
    const missing = GUEST_LIST_MIN - people;
    return (
      <section className={`${s.card} ${compact ? s.compact : ''}`} aria-live="polite" aria-label="Benefício da mesa">
        <span className={s.shine} aria-hidden="true" />

        <header className={s.head}>
          <span className={s.kicker}>{listWon ? 'Sua mesa ganha' : 'Sua mesa pode ganhar'}</span>
          <strong key={key} className={`${s.big} ${s.flip}`}>
            Lista de convidados
            <small>{listWon
              ? 'Cada convidado confirma o nome pelo link e entra direto, sem fila.'
              : `A partir de ${GUEST_LIST_MIN} pessoas, em qualquer ocasião.`}</small>
          </strong>
          <span className={s.bar} aria-hidden="true">
            <span className={s.fill} style={{ transform: `scaleX(${Math.min(1, people / GUEST_LIST_MIN)})` }} />
            <i className={`${s.tick} ${listWon ? s.tickOn : ''}`} style={{ left: '100%' }} />
          </span>
          {listWon && burst > 0 && sparks}
        </header>

        {!listWon && (
          <p key={`f-${people}`} className={`${s.foot} ${s.footIn}`}>
            Faltam <b>{missing}</b> {missing === 1 ? 'pessoa' : 'pessoas'} para a lista de convidados.
          </p>
        )}

        <div className={s.bday}>
          <span className={s.bdayIcon} aria-hidden="true"><IconCake size={20} stroke={2} /></span>
          <span className={s.bdayText}>
            <b>{occasion ? 'Bônus em R$ é só para aniversário' : 'É aniversário?'}</b>
            <small>
              Reserva de aniversário com {GUEST_LIST_MIN}+ pessoas ganha {BIRTHDAY_TIERS.map((t) => fmtBRL(t.bonus)).join(', ').replace(/, ([^,]*)$/, ' ou $1')} de bônus,
              conforme o grupo, e Brinquedoteca para as crianças.
            </small>
          </span>
          {onBirthday && !occasion && (
            <button type="button" className={s.bdayBtn} onClick={() => onBirthday(true)}>Sim, é aniversário</button>
          )}
        </div>
      </section>
    );
  }

  const progress = Math.min(1, people / MAX);
  return (
    <section className={`${s.card} ${compact ? s.compact : ''}`} aria-live="polite" aria-label="Bônus de aniversário">
      <span className={s.shine} aria-hidden="true" />

      <header className={s.head}>
        <span className={s.kicker}>{tier ? 'Seu aniversário ganha' : 'Seu aniversário pode ganhar'}</span>
        <strong key={key} className={`${s.big} ${s.flip}`}>
          {tier
            ? <>{fmtBRL(tier.bonus)} de bônus <span className={s.plus}>+</span> lista de convidados <small>{tier.headline}. Bônus de aniversário creditado no dia da reserva.</small></>
            : <>até {fmtBRL(TOP_BONUS)} de bônus <small>a partir de {GUEST_LIST_MIN} pessoas, com lista de convidados.</small></>}
        </strong>
        <span className={s.bar} aria-hidden="true">
          <span className={s.fill} style={{ transform: `scaleX(${progress})` }} />
          {BIRTHDAY_TIERS.map((t) => <i key={t.min} className={`${s.tick} ${people >= t.min ? s.tickOn : ''}`} style={{ left: `${(t.min / MAX) * 100}%` }} />)}
        </span>
      </header>

      <ol className={s.perks}>
        {BIRTHDAY_TIERS.map((t, i) => {
          const won = people >= t.min;
          const current = tier?.level === t.level;
          return (
            <li key={t.level} className={`${s.perk} ${won ? s.won : ''} ${current ? s.current : ''}`} style={{ animationDelay: `${120 + i * 90}ms` }}>
              <span className={s.min}><small>{t.max ? 'de' : 'mais de'}</small><b>{t.max ? `${t.min}–${t.max}` : t.min - 1}</b></span>
              <span className={s.text}>
                <b>{fmtBRL(t.bonus)} de bônus</b>
                <small>{t.perks.map((p, k) => <span key={k}><IconMoodKid size={11} stroke={2.2} aria-hidden="true" /> {p} · </span>)}<span><IconUsers size={11} stroke={2.2} aria-hidden="true" /> lista de convidados</span></small>
              </span>
              {!won && <IconLock size={14} stroke={2.2} className={s.lock} aria-hidden="true" />}
              {current && <span className={s.now} aria-label="sua faixa atual"><IconCheck size={15} stroke={3} /></span>}
              {current && burst > 0 && sparks}
            </li>
          );
        })}
      </ol>

      <p key={`f-${key}-${people}`} className={`${s.foot} ${s.footIn}`}>
        {next
          ? <>Faltam <b>{next.min - people}</b> {next.min - people === 1 ? 'convidado' : 'convidados'} para <b>{fmtBRL(next.bonus)}</b>{tier ? '' : ', os mimos e a lista de convidados'}.</>
          : 'Faixa máxima. Bônus e mimos garantidos na chegada, no nome de quem faz aniversário.'}
        {onBirthday && <> <button type="button" className={s.bdayUndo} onClick={() => onBirthday(false)}>Não é aniversário</button></>}
      </p>
    </section>
  );
}
