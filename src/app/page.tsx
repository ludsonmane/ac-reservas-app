'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ensureAnalyticsReady } from '@/lib/analytics';

/* ─── tokens ──────────────────────────────────────────── */
const G = {
  dark: '#034c46', mid: '#0f6e63', light: '#e6f0ef',
  cream: '#FBF5E9', red: '#D94030', gold: '#C8902A', goldLight: '#F0C66A',
  white: '#ffffff',
  heroAccent: '#D7675E', // destaque do hero
  /* ─── Copa / Seleção Brasileira ─── */
  brVerde: '#009C3B',   // verde-bandeira
  brAmarelo: '#FFDF00', // amarelo-canarinho
  brAzul: '#002776',    // azul da bandeira
  brVerdeDark: '#00782d',
};
const serif = 'var(--font-merri), Merriweather, serif';
const sans = 'var(--font-comfortaa), Comfortaa, system-ui, sans-serif';

/* ─── hook: detecta mobile ────────────────────────────── */
function useIsMobile(bp = 768) {
  const [is, setIs] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp}px)`);
    setIs(mq.matches);
    const h = (e: MediaQueryListEvent) => setIs(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [bp]);
  return is;
}

/* ─── data ────────────────────────────────────────────── */
const STATS = [
  { num: '15', label: 'Restaurantes' },
  { num: '6', label: 'Bares' },
  { num: '4k m²', label: 'de Experiência' },
  { num: '✨', label: 'Atendimento na mesa' },
];
const OCASIOES = [
  {
    emoji: '🎂', label: 'Aniversários', featured: true,
    desc: 'Todo aniversário merece ser especial. Reserve, chame quem você ama e deixa o Mané cuidar do resto.'
  },
  {
    emoji: '🥂', label: 'Confraternizações', featured: false,
    desc: 'Final de ano, vitória ou só porque sim. Espaço amplo para grupos grandes com cardápios para todos.'
  },
  {
    emoji: '💼', label: 'Almoços Corporativos', featured: false,
    desc: 'Ambiente discreto, atendimento na mesa e comida de respeito. A reunião que todo mundo vai lembrar.'
  },
  {
    emoji: '💑', label: 'Momentos a Dois', featured: false,
    desc: 'Um ambiente acolhedor, boa comida e a companhia certa. Às vezes é tudo o que se precisa.'
  },
  {
    emoji: '👨‍👩‍👧‍👦', label: 'Família Toda', featured: false,
    desc: 'Brinquedoteca, cardápio diversificado e espaço de sobra. Todo mundo bem-vindo.'
  },
  {
    emoji: '🌟', label: 'Sem Ocasião', featured: false,
    desc: 'Às vezes não precisa de motivo. Chegue, escolha um prato, peça uma cerveja e aproveite.'
  },
];
const BENEFITS = [
  { icon: '🪑', title: 'Mesa garantida', desc: 'Sem fila, sem espera. Você chega e senta. Simples assim.' },
  { icon: '👤', title: 'Atendimento na mesa', desc: 'Peça de qualquer restaurante sem sair da cadeira. Os garçons cuidam de tudo.' },
  { icon: '⚡', title: 'Rápido e seguro', desc: 'Em minutos sua reserva está confirmada. Você recebe o código e pode planejar.' },
  { icon: '🔍', title: 'Consulta fácil', desc: 'Perdeu o código? Sem problema. Localize sua reserva a qualquer hora.' },
  { icon: '🎉', title: 'Perfeito para grupos', desc: 'Reserve e garanta espaço suficiente para a turma inteira.' },
  { icon: '🏆', title: 'Experiência garantida', desc: 'Quando você reserva, a experiência Mané começa antes de sair de casa.' },
];
const IMAGES = {
  sobre1: '/images/hero.jpg',
  sobre2: '/images/happy.jpg',
  sobre3: '/images/mane-famili.jpg',
  mos1: '/images/hero2.jpg',
  mos2: '/images/happyh.png',
  mos3: '/images/mane-sp.png',
  mos4: '/images/hero-aniversario.jpg',
  mos5: '/images/mane-aguas.png',
};

/* ─── main ────────────────────────────────────────────── */
export default function Home() {
  useEffect(() => { ensureAnalyticsReady(); }, []);

  // ✅ Meta Pixel (somente nesta página)
  useEffect(() => {
    const w = window as any;
    if (w.__MM_HOME_PIXEL_INIT__) return;

    const initAndTrack = () => {
      if (typeof w.fbq === 'function') {
        w.fbq('init', '1280990087419324');
        w.fbq('track', 'PageView');
        w.__MM_HOME_PIXEL_INIT__ = true;
        return true;
      }
      return false;
    };

    // tenta imediatamente
    if (initAndTrack()) return;

    // fallback: espera o fbq aparecer (bootstrap do layout)
    let tries = 0;
    const t = window.setInterval(() => {
      tries += 1;
      if (initAndTrack()) window.clearInterval(t);
      if (tries >= 20) window.clearInterval(t); // ~2s
    }, 100);

    return () => window.clearInterval(t);
  }, []);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setHydrated(true), 120); return () => clearTimeout(t); }, []);

  const [query, setQuery] = useState('');
  useEffect(() => { if (typeof window !== 'undefined') setQuery(window.location.search ?? ''); }, []);

  const withQuery = useMemo(() => (base: string) =>
    !query ? base : `${base}${base.includes('?') ? '&' : '?'}${query.replace(/^\?/, '')}`, [query]);

  /* FAB visibility: hide after scrolling past hero */
  const [fabVisible, setFabVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setFabVisible(window.scrollY > window.innerHeight * 0.6);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!hydrated) return <div style={{ minHeight: '100dvh', background: G.dark }} />;

  return (
    <>
      {/* ── global responsive CSS ────────────────────────── */}
      <style>{`
        @keyframes fadeUp   { from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none} }
        @keyframes fadeDown { from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:none} }
        @keyframes pulse    { 0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.4)} }
        @keyframes fabIn    { from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none} }

        /* hero animations */
        .hero-badge  { animation: fadeDown .7s ease forwards; }
        .hero-logo-w { animation: fadeDown .7s .1s ease forwards; opacity:0; }
        .hero-h1     { animation: fadeUp .9s .2s ease forwards; opacity:0; }
        .hero-sub    { animation: fadeUp .9s .35s ease forwards; opacity:0; }
        .hero-ctas   { animation: fadeUp .9s .5s ease forwards; opacity:0; }
        .hero-ribbon { animation: fadeUp .9s .65s ease forwards; opacity:0; }

        /* reveal on scroll */
        .rv { opacity:0; transform:translateY(28px); transition:opacity .7s ease, transform .7s ease; }
        .rv.in { opacity:1; transform:none; }
        .rv-l { opacity:0; transform:translateX(-36px); transition:opacity .7s ease, transform .7s ease; }
        .rv-l.in { opacity:1; transform:none; }
        .rv-r { opacity:0; transform:translateX(36px); transition:opacity .7s ease, transform .7s ease; }
        .rv-r.in { opacity:1; transform:none; }

        /* ── MOBILE ≤ 768px ── */
        @media (max-width:768px) {
          /* hero */
          .hero-h1-txt { font-size: clamp(1.8rem, 8vw, 2.6rem) !important; }
          .hero-sub-txt { font-size: .9rem !important; margin-top:12px !important; }
          .hero-ctas-wrap { flex-direction:column !important; padding:0 4px !important; margin-top:20px !important; }
          .hero-btn { width:100% !important; height:50px !important; justify-content:center !important; font-size:15px !important; }
          /* stats ribbon 2×2 */
          .stats-ribbon { grid-template-columns:repeat(2,1fr) !important; }
          .stat-0, .stat-2 { border-right:1px solid rgba(255,255,255,.12) !important; }
          .stat-0, .stat-1 { border-bottom:1px solid rgba(255,255,255,.1) !important; }
          /* sobre: stack */
          .sobre-grid { grid-template-columns:1fr !important; gap:32px !important; }
          .sobre-imgs { grid-template-rows:180px 180px !important; }
          /* ambiente: 2-col simples */
          .amb-grid { grid-template-columns:1fr 1fr !important; grid-template-rows:160px 160px !important; }
          .amb-cell { grid-column:auto !important; grid-row:auto !important; }
          .amb-cell-wide { display:none; }
          /* ocasioes: 1 col */
          .ocas-grid { grid-template-columns:1fr !important; }
          /* benefícios: 1 col */
          .benef-grid { grid-template-columns:1fr !important; }
          /* restaurantes */
          .rest-grid { grid-template-columns:repeat(2,1fr) !important; }
          /* chips */
          .chips-wrap { justify-content:flex-start !important; }
          /* cta final */
          .cta-btns { flex-direction:column !important; align-items:stretch !important; }
          .cta-tags { display:none !important; }
        }

        @media (max-width:480px) {
          .hero-h1-txt { font-size:1.75rem !important; }
          .sobre-imgs { grid-template-rows:140px 140px !important; }
          .amb-grid { grid-template-rows:140px 140px !important; }
          .rest-grid { grid-template-columns:1fr !important; }
        }

        /* FAB */
        .fab {
          position:fixed; bottom:24px; right:20px; z-index:999;
          display:flex;
          transition: opacity .3s ease, transform .3s ease;
        }
        .fab.hidden { opacity:0; pointer-events:none; transform:translateY(12px); }
        .fab a {
          display:flex; align-items:center; gap:10px;
          height:52px; padding:0 24px; border-radius:999px;
          background:${G.dark}; color:${G.cream};
          font-family:${sans}; font-weight:700; font-size:15px;
          text-decoration:none;
          box-shadow:0 6px 28px rgba(3,76,70,.55), 0 2px 8px rgba(0,0,0,.3);
          transition:transform .15s, box-shadow .15s;
          white-space:nowrap;
        }
        .fab a:active { transform:scale(.97); }

        /* only show FAB on mobile */
        @media (min-width:769px) { .fab { display:none !important; } }

        /* ── Copa: faixa rolante refinada ── */
        @keyframes copaMarquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .copa-bar-track { display:inline-flex; white-space:nowrap; animation: copaMarquee 32s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .copa-bar-track { animation: none; }
        }
      `}</style>

      <main style={{ fontFamily: sans, color: G.white, background: '#000' }}>

        {/* ══ FAIXA COPA (anúncio rolante — refinada) ════════ */}
        <div style={{
          position: 'relative', overflow: 'hidden', zIndex: 8,
          background: `linear-gradient(90deg, ${G.dark} 0%, #022d29 50%, ${G.dark} 100%)`,
          boxShadow: 'inset 0 1px 0 rgba(240,198,106,.18), 0 1px 0 rgba(0,0,0,.25)',
          padding: '9px 0',
        }}>
          {/* fio dourado no topo */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(240,198,106,.6), transparent)' }} />
          <div className="copa-bar-track">
            {[0, 1].map(rep => (
              <span key={rep} style={{ display: 'inline-flex', alignItems: 'center' }}>
                {['É Copa no Mané', 'Assista a Seleção no telão', 'Garanta sua mesa pros jogos', 'Cada gol é uma festa'].map((t, i) => (
                  <span key={t} style={{ display: 'inline-flex', alignItems: 'center', padding: '0 22px' }}>
                    {i === 0 && <span style={{ marginRight: 9, color: G.goldLight, display: 'inline-flex' }}><BallIcon size={13} /></span>}
                    <span style={{ color: G.cream, fontWeight: 600, fontSize: 11.5, letterSpacing: '.14em', textTransform: 'uppercase' }}>{t}</span>
                    <span style={{ marginLeft: 22, opacity: .85 }}><StarIcon size={8} color={G.gold} /></span>
                  </span>
                ))}
              </span>
            ))}
          </div>
          {/* filete tricolor discreto (referência à bandeira) */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${G.brVerde} 0 33%, ${G.brAmarelo} 33% 66%, ${G.brAzul} 66% 100%)`, opacity: .55 }} />
        </div>

        {/* ══ HERO ═══════════════════════════════════════════ */}
        <section style={{
          position: 'relative', minHeight: '100dvh',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', overflow: 'hidden',
          padding: 'clamp(56px,8vw,80px) clamp(16px,4vw,40px) clamp(108px,14vw,130px)',
        }}>
          {/* gradient bg fallback */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 0,
            background: `radial-gradient(ellipse 80% 60% at 20% 30%, rgba(3,76,70,.9) 0%, transparent 60%),
              radial-gradient(ellipse 60% 80% at 80% 70%, rgba(15,110,99,.85) 0%, transparent 60%), #0a0a0a`,
          }} />

          {/* YouTube background */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden', pointerEvents: 'none' }}>
            <iframe
              src="https://www.youtube.com/embed/pbBdn_I-7pk?si=1BoCdyoqFQx0yRBy&autoplay=1&mute=1&loop=1&playlist=pbBdn_I-7pk&controls=0&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1"
              allow="autoplay; fullscreen"
              title="Mané Mercado"
              style={{
                position: 'absolute', top: '50%', left: '50%',
                width: '100vw', height: '56.25vw',
                minHeight: '100vh', minWidth: '177.78vh',
                transform: 'translate(-50%,-50%)',
                opacity: .35, border: 'none',
              }}
            />
          </div>

          {/* overlays */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: 'rgba(0,0,0,.5)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: 0, right: 0, width: 160, height: 100, zIndex: 10, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 200, zIndex: 3, background: 'linear-gradient(to bottom,transparent,#000)', pointerEvents: 'none' }} />

          {/* content */}
          <div style={{
            position: 'relative', zIndex: 6,
            maxWidth: 820, width: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            {/* badge — Copa (glass premium, borda dourada) */}
            <div className="hero-badge" style={{
              display: 'inline-flex', alignItems: 'center', gap: 9,
              padding: '7px 18px', borderRadius: 999,
              border: '1px solid rgba(240,198,106,.5)',
              background: 'rgba(3,76,70,.4)', backdropFilter: 'blur(14px)',
              fontSize: 11, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase',
              color: G.goldLight, marginBottom: 22,
              boxShadow: '0 8px 28px rgba(0,0,0,.35), inset 0 1px 0 rgba(240,198,106,.18)',
            }}>
              <span style={{ display: 'inline-flex', color: G.goldLight }}><StarIcon size={11} /></span>
              É Copa no Mané · vem torcer com a gente
            </div>

            {/* Logo oficial Mané (mantida como estava antes: branca) */}
            <img
              className="hero-logo-w"
              src="/images/logo-mane.svg"
              alt="Mané Mercado"
              style={{
                height: 'clamp(48px,8vw,72px)',
                width: 'auto',
                display: 'block',
                marginBottom: 'clamp(20px,3vw,28px)',
                filter: 'none', // ✅ logo original (sem branco)
              } as React.CSSProperties}
            />

            {/* headline (copy nova + cor destaque) */}
            <h1 className="hero-h1 hero-h1-txt" style={{
              fontFamily: serif, fontWeight: 900,
              fontSize: 'clamp(2.2rem,6.5vw,4.4rem)',
              lineHeight: 1.05, letterSpacing: '-.02em',
              textShadow: '0 2px 30px rgba(0,0,0,.5)',
              margin: 0, width: '100%',
            }}>
              Sua mesa garantida<br />
              <span style={{ position: 'relative', display: 'inline-block' }}>
                <span style={{
                  backgroundImage: `linear-gradient(100deg, ${G.gold} 0%, ${G.goldLight} 45%, #FFE9A8 70%, ${G.goldLight} 100%)`,
                  WebkitBackgroundClip: 'text', backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent', color: G.goldLight,
                }}>pra viver a Copa no Mané</span>
                <span style={{
                  position: 'absolute', left: 0, right: 0, bottom: '-0.16em', height: 3, borderRadius: 3,
                  background: `linear-gradient(90deg, ${G.brVerde} 0 33%, ${G.brAmarelo} 33% 66%, ${G.brAzul} 66% 100%)`,
                  opacity: .85,
                }} />
              </span>
            </h1>

            {/* sub (copy nova) */}
            <p className="hero-sub hero-sub-txt" style={{
              fontSize: 'clamp(.9rem,2.5vw,1.15rem)',
              lineHeight: 1.65, opacity: .85,
              maxWidth: 520, marginTop: 20,
            }}>
              Telão, cerveja gelada e aquele clima de Seleção.
              {' '}15 restaurantes e 6 bares com atendimento na mesa — reserve e torça com a gente.
            </p>

            {/* CTAs */}
            <div className="hero-ctas hero-ctas-wrap" style={{
              display: 'flex', gap: 12, flexWrap: 'wrap',
              justifyContent: 'center', marginTop: 32, width: '100%',
            }}>
              <HeroBtn href={withQuery('/reservar')} primary>
                <CalIcon /> Reserve agora
              </HeroBtn>
              <HeroBtn href={withQuery('/consultar')} primary={false}>
                <SearchIcon /> Localizar Reserva
              </HeroBtn>
            </div>
          </div>

          {/* stats ribbon */}
          <div className="hero-ribbon stats-ribbon" style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 7,
            display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
            padding: '12px 16px',
            background: 'rgba(3,76,70,.72)', backdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255,255,255,.12)',
          }}>
            {STATS.map((s, i) => (
              <div key={s.label} className={`stat-${i}`} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '6px 8px',
                borderRight: i < 3 ? '1px solid rgba(255,255,255,.12)' : 'none',
              }}>
                <span style={{ fontFamily: serif, fontSize: 'clamp(1.1rem,3vw,1.7rem)', fontWeight: 900, color: G.goldLight, lineHeight: 1 }}>{s.num}</span>
                <span style={{ fontSize: 'clamp(9px,1.5vw,11px)', opacity: .65, textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 3, textAlign: 'center', lineHeight: 1.2 }}>{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ══ COPA ═══════════════════════════════════════════ */}
        <Copa withQuery={withQuery} />

        {/* ══ SOBRE ══════════════════════════════════════════ */}
        <Sobre withQuery={withQuery} />

        {/* ══ AMBIENTE ═══════════════════════════════════════ */}
        <Ambiente />

        {/* ══ OCASIÕES ═══════════════════════════════════════ */}
        <section style={{ background: G.dark, padding: 'clamp(56px,10vw,100px) clamp(16px,5vw,64px)' }}>
          <Rv style={{ textAlign: 'center', marginBottom: 44 }}>
            <Eyebrow color="#a8dbd4">Para toda ocasião</Eyebrow>
            <SecTitle>Não importa o motivo —<br />o Mané tem espaço pra você</SecTitle>
          </Rv>
          <div className="ocas-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
            {OCASIOES.map((o, i) => (
              <Rv key={o.label} delay={i * 60} style={{
                background: o.featured ? 'rgba(200,144,42,.15)' : 'rgba(255,255,255,.06)',
                border: `1.5px solid ${o.featured ? 'rgba(200,144,42,.35)' : 'rgba(255,255,255,.1)'}`,
                borderRadius: 18, overflow: 'hidden', textAlign: 'center',
              }}>
                {o.featured ? (
                  <div style={{ width: '100%', height: 180, overflow: 'hidden', marginBottom: 0 }}>
                    <img src="/images/hero-aniversario.jpg"
                      alt="Aniversário no Mané"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
                  </div>
                ) : (
                  <div style={{ fontSize: 44, marginBottom: 16, paddingTop: 28 }}>{o.emoji}</div>
                )}
                <div style={{ padding: o.featured ? '20px 22px 24px' : '0 22px 24px' }}>
                  <h3 style={{ fontFamily: serif, fontWeight: 900, fontSize: 19, color: o.featured ? G.goldLight : '#a8dbd4', marginBottom: 8 }}>{o.label}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.65, opacity: .7, margin: 0 }}>{o.desc}</p>
                </div>
              </Rv>
            ))}
          </div>
        </section>

        {/* ══ BENEFÍCIOS ═════════════════════════════════════ */}
        <section style={{ background: G.cream, color: G.dark, padding: 'clamp(56px,10vw,100px) clamp(16px,5vw,64px)' }}>
          <div style={{ maxWidth: 1140, margin: '0 auto' }}>
            <Rv style={{ marginBottom: 44 }}>
              <Eyebrow color={G.mid}>Por que reservar?</Eyebrow>
              <SecTitle dark>Sua experiência começa<br />antes mesmo de chegar</SecTitle>
              <p style={{ fontSize: 'clamp(.9rem,2vw,1.05rem)', lineHeight: 1.7, opacity: .7, maxWidth: 500 }}>
                O Mané está sempre cheio. Reserve e garanta que seu momento seja perfeito.
              </p>
            </Rv>
            <div className="benef-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
              {BENEFITS.map((b, i) => (
                <Rv key={b.title} delay={i * 60} style={{
                  background: G.white, borderRadius: 16, padding: '28px 24px',
                  border: `1.5px solid ${G.light}`,
                  boxShadow: '0 2px 20px rgba(3,76,70,.05)',
                }}>
                  <div style={{ fontSize: 34, marginBottom: 14 }}>{b.icon}</div>
                  <h3 style={{ fontFamily: serif, fontWeight: 900, fontSize: 18, color: G.dark, marginBottom: 8 }}>{b.title}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.65, color: '#555', margin: 0 }}>{b.desc}</p>
                </Rv>
              ))}
            </div>
          </div>
        </section>


        {/* ══ CTA FINAL ══════════════════════════════════════ */}
        <section style={{
          background: `linear-gradient(135deg, ${G.dark} 0%, ${G.mid} 100%)`,
          textAlign: 'center', position: 'relative', overflow: 'hidden',
          padding: 'clamp(72px,12vw,130px) clamp(16px,5vw,64px)',
        }}>
          <div style={{ position: 'absolute', borderRadius: '50%', border: '70px solid rgba(255,255,255,.04)', width: 560, height: 560, top: -200, right: -100, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', borderRadius: '50%', border: '70px solid rgba(255,255,255,.04)', width: 380, height: 380, bottom: -140, left: -80, pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 2, maxWidth: 580, margin: '0 auto' }}>
            <Rv>
              <img src="/images/logo-mane.svg" alt="Mané"
                style={{ height: 56, width: 'auto', display: 'block', margin: '0 auto 28px', filter: 'brightness(0) invert(1)' }} />
            </Rv>
            <Rv delay={80}>
              <h2 style={{ fontFamily: serif, fontWeight: 900, fontSize: 'clamp(1.8rem,5vw,3rem)', lineHeight: 1.1, marginBottom: 16 }}>
                Pronto para garantir<br />sua mesa?
              </h2>
            </Rv>
            <Rv delay={160}>
              <p style={{ fontSize: 'clamp(.9rem,2vw,1.1rem)', opacity: .8, marginBottom: 36, lineHeight: 1.65 }}>
                Reserve agora em segundos e chegue ao Mané sabendo que seu lugar está esperando.
              </p>
            </Rv>
            <Rv delay={240}>
              <div className="cta-btns" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                <CtaBtn href={withQuery('/reservar')} primary><CalIcon />Reserve agora</CtaBtn>
                <CtaBtn href={withQuery('/consultar')} primary={false}><SearchIcon />Localizar Reserva</CtaBtn>
              </div>
            </Rv>
            <Rv delay={320}>
              <div className="cta-tags" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 24 }}>
                {['⚽ Jogos da Copa', '🎂 Aniversários', '🥂 Confraternizações', '💼 Empresas', '👨‍👩‍👧 Famílias', '🍽️ Atendimento na mesa'].map(t => (
                  <span key={t} style={{ background: 'rgba(255,255,255,.1)', borderRadius: 999, padding: '5px 14px', fontSize: 12, fontWeight: 600, opacity: .75 }}>{t}</span>
                ))}
              </div>
            </Rv>
            <p style={{ marginTop: 32, fontSize: 12, opacity: .4 }}>Dúvidas? Procure nosso concierge no estabelecimento no dia da sua visita.</p>
          </div>
        </section>
      </main>

      {/* ══ FAB — botão flutuante mobile ════════════════════ */}
      <div className={`fab${fabVisible ? '' : ' hidden'}`}>
        <Link href={withQuery('/reservar')}>
          <CalIcon />
          Reserve agora
        </Link>
      </div>
    </>
  );
}

/* ─── sub-pages ────────────────────────────────────────── */
function Copa({ withQuery }: { withQuery: (s: string) => string }) {
  const triColor = `linear-gradient(90deg, ${G.brVerde} 0 33%, ${G.brAmarelo} 33% 66%, ${G.brAzul} 66% 100%)`;
  const COPA_FEATS = [
    { Icon: TvIcon, title: 'Telão em alta', desc: 'Todos os jogos da Seleção ao vivo, no telão, com som de estádio.' },
    { Icon: CupIcon, title: 'Chope sempre gelado', desc: 'Atendimento direto na mesa: peça sem perder nenhum lance.' },
    { Icon: FlagWaveIcon, title: 'Clima de torcida', desc: 'Verde e amarelo por todo canto. Cada gol vira festa no Mané.' },
    { Icon: ChairIcon, title: 'Lugar garantido', desc: 'Dia de jogo lota. Reserve e chegue com sua mesa esperando.' },
  ];
  return (
    <section style={{
      position: 'relative', overflow: 'hidden',
      background: `radial-gradient(120% 80% at 50% -10%, #0a5249 0%, transparent 60%), linear-gradient(170deg, ${G.dark} 0%, #022d29 70%, #012623 100%)`,
      color: G.cream,
      padding: 'clamp(60px,10vw,104px) clamp(16px,5vw,64px)',
    }}>
      {/* fio tricolor no topo da seção */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: triColor, opacity: .8 }} />
      {/* brilho dourado decorativo */}
      <div style={{ position: 'absolute', top: -120, right: -80, width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,198,106,.10) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1140, margin: '0 auto' }}>
        <Rv style={{ textAlign: 'center', marginBottom: 46 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14, color: G.goldLight }}>
            <BallIcon size={15} />
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase' }}>Copa do Mundo 2026</span>
          </div>
          <h2 style={{
            fontFamily: serif, fontWeight: 900,
            fontSize: 'clamp(1.9rem,5vw,3rem)', lineHeight: 1.08, letterSpacing: '-.02em',
            marginBottom: 16, color: G.white, textShadow: '0 2px 24px rgba(0,0,0,.35)',
          }}>
            Viva a Copa no Mané<br />
            <span style={{
              backgroundImage: `linear-gradient(100deg, ${G.gold}, ${G.goldLight} 55%, #FFE9A8)`,
              WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: G.goldLight,
            }}>do jeito que o brasileiro gosta</span>
          </h2>
          <p style={{ fontSize: 'clamp(.92rem,2vw,1.08rem)', lineHeight: 1.7, opacity: .82, maxWidth: 560, margin: '0 auto' }}>
            Telão, torcida, churrasco e cerveja gelada. Reúna a turma, vista o verde e amarelo
            e garanta sua mesa pros dias de Seleção.
          </p>
        </Rv>

        <div className="benef-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16, marginBottom: 44 }}>
          {COPA_FEATS.map((f, i) => (
            <Rv key={f.title} delay={i * 70} style={{
              background: 'rgba(255,255,255,.05)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(240,198,106,.22)', borderRadius: 18,
              padding: '28px 22px', textAlign: 'center',
            }}>
              <div style={{
                width: 52, height: 52, margin: '0 auto 14px', borderRadius: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(240,198,106,.1)', border: '1px solid rgba(240,198,106,.3)', color: G.goldLight,
              }}>
                <f.Icon size={26} />
              </div>
              <h3 style={{ fontFamily: serif, fontWeight: 900, fontSize: 17, color: G.cream, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, opacity: .7, margin: 0 }}>{f.desc}</p>
            </Rv>
          ))}
        </div>

        <Rv style={{ textAlign: 'center' }}>
          <Link href={withQuery('/reservar')} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            height: 56, padding: '0 38px', borderRadius: 14,
            fontFamily: sans, fontWeight: 800, fontSize: 16,
            textDecoration: 'none', letterSpacing: '.01em',
            backgroundImage: `linear-gradient(100deg, ${G.gold}, ${G.goldLight})`,
            color: '#3a2a08',
            boxShadow: '0 12px 34px rgba(200,144,42,.35), inset 0 1px 0 rgba(255,255,255,.4)',
          }}>
            <BallIcon size={17} color="#3a2a08" />
            Reserve pra Copa
          </Link>
          <p style={{ marginTop: 14, fontSize: 12.5, opacity: .8 }}>
            Em dia de jogo o Mané lota — garanta seu lugar antes do apito inicial.
          </p>
        </Rv>
      </div>
    </section>
  );
}

function Sobre({ withQuery }: { withQuery: (s: string) => string }) {
  const refL = useRef<HTMLDivElement>(null);
  const refR = useRef<HTMLDivElement>(null);
  const [vL, setVL] = useState(false);
  const [vR, setVR] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.target === refL.current && e.isIntersecting) { setVL(true); }
        if (e.target === refR.current && e.isIntersecting) { setVR(true); }
      });
    }, { threshold: .1 });
    if (refL.current) obs.observe(refL.current);
    if (refR.current) obs.observe(refR.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section style={{ background: G.cream, color: G.dark, padding: 'clamp(56px,10vw,100px) clamp(16px,5vw,64px)' }}>
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>
        <div className="sobre-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }}>
          {/* foto grid */}
          <div ref={refL} className="sobre-imgs" style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '220px 220px', gap: 10,
            borderRadius: 20, overflow: 'hidden',
            opacity: vL ? 1 : 0, transform: vL ? 'none' : 'translateX(-36px)',
            transition: 'opacity .7s ease, transform .7s ease',
          }}>
            <img src={IMAGES.sobre1} alt="Mané interior" style={{ gridRow: 'span 2', width: '100%', height: '100%', objectFit: 'cover' }} />
            <img src={IMAGES.sobre2} alt="Gastronomia" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <img src={IMAGES.sobre3} alt="Pratos" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          {/* texto */}
          <div ref={refR} style={{
            opacity: vR ? 1 : 0, transform: vR ? 'none' : 'translateX(36px)',
            transition: 'opacity .7s ease, transform .7s ease',
          }}>
            <Eyebrow color={G.mid}>O que é o Mané?</Eyebrow>
            <SecTitle dark>É restaurante, é bar, é perene. É o Mané.</SecTitle>
            <p style={{ fontSize: 'clamp(.9rem,2vw,1rem)', lineHeight: 1.7, opacity: .75, marginBottom: 24 }}>
              O Mané nasceu de um sonho sonhado em viagens pelo mundo. Dos lugares, das pessoas e, principalmente, das comidas. É um lugar plural, pra família e pros amigos. É cultura, diversão e diversidade.
            </p>
            {[
              { icon: '📍', text: 'Brasília (Arena Mané Garrincha), Águas Claras e São Paulo (Perdizes). Três unidades, uma experiência.' },
              { icon: '🍽️', text: 'De gelato a cuscuz, de hambúrguer a frutos do mar, de massa a churrasco. Aqui tem pra todo mundo.' },
              { icon: '🎵', text: 'Música ao vivo, programação cultural e diversão da tarde até de madrugada.' },
              { icon: '🪑', text: 'Atendimento na mesa: peça de qualquer restaurante direto com os garçons, sem sair do lugar.' },
            ].map(item => (
              <div key={item.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <span style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, background: G.dark, color: G.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, marginTop: 1 }}>{item.icon}</span>
                <span style={{ fontSize: 'clamp(.85rem,2vw,.95rem)', lineHeight: 1.55 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Ambiente() {
  return (
    <section style={{ background: '#0a0a0a', padding: 'clamp(56px,10vw,100px) clamp(16px,5vw,64px)' }}>
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>
        <Rv style={{ textAlign: 'center', marginBottom: 48 }}>
          <Eyebrow color="#a8dbd4">O espaço</Eyebrow>
          <SecTitle>Um lugar plural,<br />pra todo mundo</SecTitle>
          <p style={{ fontSize: 'clamp(.9rem,2vw,1.05rem)', lineHeight: 1.7, opacity: .7, maxWidth: 520, margin: '0 auto' }}>
            Com 15 restaurantes, 6 bares e brinquedoteca — o Mané é restaurante, é bar, é feira, é cultura.
          </p>
        </Rv>
        <Rv>
          <div className="amb-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12,1fr)',
            gridTemplateRows: '220px 220px',
            gap: 10,
          }}>
            {[
              { col: '1/6', row: '1/2', src: IMAGES.mos1, cap: 'É restaurante, é bar, é perene', cls: 'amb-cell' },
              { col: '6/9', row: '1/2', src: IMAGES.mos2, cap: 'De todos os gostos e culturas', cls: 'amb-cell' },
              { col: '9/13', row: '1/3', src: IMAGES.mos3, cap: 'Chefs renomados', cls: 'amb-cell amb-cell-wide' },
              { col: '1/4', row: '2/3', src: IMAGES.mos4, cap: 'Perfeito para comemorar', cls: 'amb-cell' },
              { col: '4/9', row: '2/3', src: IMAGES.mos5, cap: '6 bares', cls: 'amb-cell' },
            ].map(m => (
              <div key={m.cap} className={m.cls} style={{ gridColumn: m.col, gridRow: m.row, borderRadius: 14, overflow: 'hidden', position: 'relative' }}>
                <img src={m.src} alt={m.cap} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .5s ease' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.06)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; }}
                />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 16px', background: 'linear-gradient(to top,rgba(0,0,0,.8),transparent)', fontSize: 12, fontWeight: 600 }}>{m.cap}</div>
              </div>
            ))}
          </div>
        </Rv>
      </div>
    </section>
  );
}

/* ─── atoms ────────────────────────────────────────────── */
function Eyebrow({ children, color }: { children: React.ReactNode; color: string }) {
  return <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', color, marginBottom: 12 }}>{children}</p>;
}
function SecTitle({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return <h2 style={{ fontFamily: serif, fontWeight: 900, fontSize: 'clamp(1.7rem,4.5vw,2.8rem)', lineHeight: 1.1, letterSpacing: '-.02em', marginBottom: 16, color: dark ? G.dark : G.white }}>{children}</h2>;
}

function Rv({ children, style, delay = 0 }: { children: React.ReactNode; style?: React.CSSProperties; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); obs.disconnect(); } }, { threshold: .1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ opacity: v ? 1 : 0, transform: v ? 'none' : 'translateY(24px)', transition: `opacity .7s ease ${delay}ms, transform .7s ease ${delay}ms`, ...style }}>
      {children}
    </div>
  );
}

function HeroBtn({ href, children, primary }: { href: string; children: React.ReactNode; primary: boolean }) {
  return (
    <Link href={href} className="hero-btn" style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      height: 52, padding: '0 28px', borderRadius: 13,
      fontFamily: sans, fontWeight: 700, fontSize: 15,
      textDecoration: 'none', letterSpacing: '.01em', whiteSpace: 'nowrap',
      ...(primary
        ? { background: G.cream, color: G.dark, boxShadow: '0 6px 24px rgba(0,0,0,.3)' }
        : { background: 'transparent', color: G.white, border: '2px solid rgba(255,255,255,.45)' }),
    }}>
      {children}
    </Link>
  );
}

function CtaBtn({ href, children, primary }: { href: string; children: React.ReactNode; primary: boolean }) {
  return (
    <Link href={href} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      height: 54, padding: '0 32px', borderRadius: 14,
      fontFamily: sans, fontWeight: 700, fontSize: 16,
      textDecoration: 'none', letterSpacing: '.01em', whiteSpace: 'nowrap', flex: '1 1 auto', maxWidth: 280,
      ...(primary
        ? { background: G.cream, color: G.dark, boxShadow: '0 8px 28px rgba(0,0,0,.3)' }
        : { background: 'transparent', color: G.white, border: '2px solid rgba(255,255,255,.4)' }),
    }}>
      {children}
    </Link>
  );
}

/* ─── Copa icons (SVG — sem emoji) ─────────────────────── */
function BallIcon({ size = 15, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 6.4l3.9 2.8-1.5 4.6h-4.8L8.1 9.2 12 6.4z" />
      <path d="M12 6.4V3.2M15.9 9.2l3-1M14.4 13.8l1.9 2.6M9.6 13.8l-1.9 2.6M8.1 9.2l-3-1" />
    </svg>
  );
}
function StarIcon({ size = 12, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
      <path d="M12 2.5l2.6 5.9 6.4.6-4.8 4.2 1.4 6.3L12 16.9l-5.6 3.3 1.4-6.3-4.8-4.2 6.4-.6L12 2.5z" />
    </svg>
  );
}
/* ícones de linha para os cards da seção Copa (stroke 1.6, consistentes) */
const lineProps = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
function TvIcon({ size = 26 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" {...lineProps}><rect x="2.5" y="5" width="19" height="12.5" rx="2" /><path d="M8 21h8M12 17.5V21M8.5 9.8l3.2 2-3.2 2v-4z" /></svg>);
}
function CupIcon({ size = 26 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" {...lineProps}><path d="M6 9h9v8a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V9z" /><path d="M15 11h2.2a2 2 0 0 1 0 4H15M7.5 5.5c.5-.6.5-1.4 0-2M10.5 6c.5-.6.5-1.4 0-2M13 5.5c.5-.6.5-1.4 0-2" /></svg>);
}
function FlagWaveIcon({ size = 26 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" {...lineProps}><path d="M5 21V4M5 5c3-2 6 2 9 0s5-1 5-1v8s-2-1-5 1-6-2-9 0" /></svg>);
}
function ChairIcon({ size = 26 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" {...lineProps}><path d="M6 4v8M18 4v8M6 12h12M5 12l1 8M19 12l-1 8M8 16h8" /></svg>);
}

function CalIcon() {
  return (
    <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
