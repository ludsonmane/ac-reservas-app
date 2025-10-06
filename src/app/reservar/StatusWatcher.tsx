'use client';
import { useEffect, useState } from 'react';

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export default function StatusWatcher({ id }: { id: string }) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';
  const url = `${apiBase}/v1/reservations/${id}/status`;
  const [status, setStatus] = useState<'AWAITING_CHECKIN'|'CHECKED_IN'|'ERROR'>('AWAITING_CHECKIN');

  useEffect(() => {
    let alive = true;
    (async () => {
      while (alive) {
        try {
          const r = await fetch(url, { cache: 'no-store' });
          if (!r.ok) throw new Error(String(r.status));
          const json = await r.json();
          if (json?.status === 'CHECKED_IN') {
            setStatus('CHECKED_IN');
            break;
          }
        } catch {
            setStatus('ERROR');
        }
        await sleep(5000);
      }
    })();
    return () => { alive = false; };
  }, [url]);

  if (status === 'CHECKED_IN') return <p className="text-green-400 mt-3">Check-in confirmado! ✔️</p>;
  if (status === 'ERROR') return <p className="text-yellow-400 mt-3">Reconectando…</p>;
  return <p className="muted mt-3">Aguardando leitura do QR…</p>;
}
