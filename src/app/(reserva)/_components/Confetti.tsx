'use client';

import * as React from 'react';

/**
 * Explosão de confete em canvas, sem biblioteca: dois estouros do rodapé para cima nas cores do Mané
 * (verde, dourado, vermelho da vírgula, creme), com gravidade, rotação e queda. Some sozinho em ~3 s.
 * Ignora "reduzir movimento" de propósito (é a comemoração da reserva; pedido do dono).
 */
export function Confetti({ fire, colors = ['#034c46', '#f5c64a', '#ffe08a', '#e23b3b', '#fbf5e9', '#0f6e63'] }: { fire: boolean; colors?: string[] }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    if (!fire || done) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => { canvas.width = window.innerWidth * dpr; canvas.height = window.innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize();
    window.addEventListener('resize', resize);

    type P = { x: number; y: number; vx: number; vy: number; w: number; h: number; r: number; vr: number; c: string; shape: 0 | 1 | 2; wob: number; life: number };
    const parts: P[] = [];
    const W = () => window.innerWidth, H = () => window.innerHeight;
    const burst = (ox: number, oy: number, n: number, spread: number, power: number) => {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * spread;
        const v = power * (0.55 + Math.random() * 0.75);
        parts.push({
          x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          w: 7 + Math.random() * 7, h: 9 + Math.random() * 10, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
          c: colors[Math.floor(Math.random() * colors.length)], shape: (Math.floor(Math.random() * 3) as 0 | 1 | 2), wob: Math.random() * Math.PI * 2, life: 1,
        });
      }
    };
    // estouro central + dois laterais um pouco depois
    burst(W() / 2, H() * 0.8, 150, 1.5, 25);
    const t1 = window.setTimeout(() => { burst(W() * 0.1, H() * 0.88, 70, 1.0, 21); burst(W() * 0.9, H() * 0.88, 70, 1.0, 21); }, 220);

    let raf = 0; let last = performance.now(); const start = last;
    const tick = (now: number) => {
      const dt = Math.min(32, now - last) / 16.67; last = now;
      ctx.clearRect(0, 0, W(), H());
      const elapsed = now - start;
      for (const p of parts) {
        p.vy += 0.42 * dt;               // gravidade
        p.vx *= Math.pow(0.985, dt);      // arrasto
        p.vy *= Math.pow(0.992, dt);
        p.wob += 0.12 * dt;
        p.x += (p.vx + Math.sin(p.wob) * 0.9) * dt;
        p.y += p.vy * dt;
        p.r += p.vr * dt;
        if (elapsed > 1900) p.life = Math.max(0, p.life - 0.03 * dt);
        if (p.life <= 0 || p.y > H() + 30) continue;
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        const sx = Math.cos(p.wob * 1.7); // "vira" a fita
        if (p.shape === 0) ctx.fillRect(-p.w / 2, -p.h / 2, p.w * Math.abs(sx) + 1, p.h);
        else if (p.shape === 1) { ctx.beginPath(); ctx.ellipse(0, 0, p.w / 2, (p.w / 2) * Math.abs(sx) + 0.5, 0, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(0, -p.h / 2); ctx.lineTo(p.w / 2, p.h / 2); ctx.lineTo(-p.w / 2, p.h / 2); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      }
      if (elapsed < 3200 && parts.some((p) => p.life > 0 && p.y < H() + 30)) raf = requestAnimationFrame(tick);
      else { ctx.clearRect(0, 0, W(), H()); setDone(true); }
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(t1); window.removeEventListener('resize', resize); };
  }, [fire, done, colors]);

  if (!fire || done) return null;
  return <canvas ref={ref} aria-hidden="true" style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 80 }} />;
}
