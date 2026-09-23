import type { Metadata } from 'next';
import s from './reserva.module.css';
import AgenteMane from './_components/AgenteMane';

export const metadata: Metadata = {
  title: 'Reservar mesa • Mané Mercado',
  description: 'Guarde sua mesa no Mané em menos de um minuto.',
};

export default function ReservaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.shell}>
      <div className={s.container}>{children}</div>
      <AgenteMane />
    </div>
  );
}
