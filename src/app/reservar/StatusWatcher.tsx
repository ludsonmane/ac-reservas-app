'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE } from '@/lib/api';

type Status = 'AWAITING_CHECKIN' | 'CHECKED_IN' | 'ERROR';

function normalizeBase(u?: string | null) {
  const s = (u || '').trim();
  if (!s) {
    if (typeof window !== 'undefined') return window.location.origin; // fallback seguro
    return '';
  }
  try {
    const url = new URL(s);
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.protocol === 'http:') {
      url.protocol = 'https:'; // evita mixed content
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    return s.replace(/\/+$/, '');
  }
}

export default function StatusWatcher({ id }: { id: string }) {
  const [status, setStatus] = useState<Status>('AWAITING_CHECKIN');

  const base = useMemo(() => normalizeBase(API_BASE), []);
  const url = useMemo(() => `${base}/v1/reservations/${encodeURIComponent(id)}/status`, [base, id]);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;

    async function tick() {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!alive) return;

        if (!res.ok) {
          // Não derruba para ERROR definitivo – apenas sinaliza reconexão
          setStatus('ERROR');
          return;
        }

        const json = (await res.json().catch(() => ({}))) as { status?: Status };
        if (json?.status === 'CHECKED_IN') {
          setStatus('CHECKED_IN');
          // para o polling quando confirmar
          if (timerRef.current) window.clearInterval(timerRef.current);
          timerRef.current = null;
        } else {
          // volta para aguardando se voltar a responder
          setStatus('AWAITING_CHECKIN');
        }
      } catch {
        if (!alive) return;
        setStatus('ERROR');
      }
    }

    // primeira chamada imediata
    tick();
    // polling a cada 5s
    timerRef.current = window.setInterval(tick, 5000);

    return () => {
      alive = false;
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [url]);

  if (status === 'CHECKED_IN') return <p className="text-green-400 mt-3">Check-in confirmado! ✔️</p>;
  if (status === 'ERROR') return <p className="text-yellow-400 mt-3">Reconectando…</p>;
  return <p className="muted mt-3">Aguardando leitura do QR…</p>;
}
