'use client';
import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';

type Row = { name: string; url: string; ok: boolean | null; status?: number; detail?: string };

export default function DebugPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const base = (API_BASE || '').replace(/\/+$/, '');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    const tests: Row[] = [
      { name: 'health', url: `${base}/health`, ok: null },
      { name: 'units options', url: `${base}/v1/units/public/options/list`, ok: null },
      { name: 'availability sample (amanhã 18:00)', url: `${base}/v1/reservations/public/availability?unitId=test&date=2099-01-01&time=18:00`, ok: null },
    ];
    setRows(tests);

    (async () => {
      const updated: Row[] = [];
      for (const t of tests) {
        try {
          const r = await fetch(t.url, { cache: 'no-store' });
          const ct = r.headers.get('content-type') || '';
          let detail = '';
          if (ct.includes('application/json')) {
            const j = await r.json().catch(() => ({}));
            detail = (j?.message || j?.error?.message || JSON.stringify(j)).slice(0, 200);
          } else {
            const txt = await r.text().catch(() => '');
            detail = txt.slice(0, 200);
          }
          updated.push({ ...t, ok: r.ok, status: r.status, detail });
        } catch (e: any) {
          updated.push({ ...t, ok: false, status: -1, detail: e?.message || 'fetch error' });
        }
      }
      setRows(updated);
    })();
  }, [base]);

  const httpsWarn = typeof window !== 'undefined' && window.location.protocol === 'https:' && /^http:\/\//i.test(base);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 16 }}>
      <h1>Debug da API</h1>
      <p><b>API_BASE:</b> {base || '(vazio)'} </p>
      <p><b>Site origin:</b> {origin}</p>
      {httpsWarn && (
        <p style={{ color: 'red' }}>
          ⚠️ Sua página está em <b>HTTPS</b> mas a API_BASE está em <b>HTTP</b>. Isso costuma causar 502/mixed-content via proxy/CDN.
        </p>
      )}
      <table cellPadding={8} style={{ borderCollapse: 'collapse', marginTop: 12 }}>
        <thead>
          <tr>
            <th align="left">Teste</th>
            <th align="left">URL</th>
            <th align="left">OK</th>
            <th align="left">Status</th>
            <th align="left">Detalhe</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} style={{ borderTop: '1px solid #ddd' }}>
              <td>{r.name}</td>
              <td style={{ maxWidth: 520, wordBreak: 'break-all' }}>{r.url}</td>
              <td>{r.ok === null ? '...' : r.ok ? '✅' : '❌'}</td>
              <td>{r.status ?? ''}</td>
              <td style={{ maxWidth: 520, wordBreak: 'break-all' }}>{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 16, color: '#666' }}>
        Dica: se tudo aqui falhar com 502, o problema está na origem/Cloudflare ou URL base. Se o health passar e outras falharem, é rota/permisoes/CORS.
      </p>
    </div>
  );
}
