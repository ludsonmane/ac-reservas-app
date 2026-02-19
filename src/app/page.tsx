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
};
const serif = 'var(--font-merri), Merriweather, serif';
const sans  = 'var(--font-comfortaa), Comfortaa, system-ui, sans-serif';

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
  { num: '17+',   label: 'Restaurantes' },
  { num: '3',     label: 'Bares & Adega' },
  { num: '4k m²', label: 'de Experiência' },
  { num: '🐾',   label: 'Pet Friendly' },
];
const OCASIOES = [
  { emoji:'🎂', label:'Aniversários', featured:true,
    desc:'Todo aniversário merece ser especial. Reserve, chame quem você ama e deixa o Mané cuidar do resto.' },
  { emoji:'🥂', label:'Confraternizações', featured:false,
    desc:'Final de ano, vitória ou só porque sim. Espaço amplo para grupos grandes com cardápios para todos.' },
  { emoji:'💼', label:'Almoços Corporativos', featured:false,
    desc:'Ambiente discreto, atendimento na mesa e comida de respeito. A reunião que todo mundo vai lembrar.' },
  { emoji:'💑', label:'Momentos a Dois', featured:false,
    desc:'Um ambiente acolhedor, boa comida e a companhia certa. Às vezes é tudo o que se precisa.' },
  { emoji:'👨‍👩‍👧‍👦', label:'Família Toda', featured:false,
    desc:'Brinquedoteca, cardápio diversificado e espaço de sobra. Da vovó ao pet, todo mundo bem-vindo.' },
  { emoji:'🌟', label:'Sem Ocasião', featured:false,
    desc:'Às vezes não precisa de motivo. Chegue, escolha um prato, peça uma cerveja e aproveite Brasília.' },
];
const BENEFITS = [
  { icon:'🪑', title:'Mesa garantida',       desc:'Sem fila, sem espera. Você chega e senta. Simples assim.' },
  { icon:'👤', title:'Atendimento na mesa',  desc:'Peça de qualquer restaurante sem sair da cadeira. Os garçons cuidam de tudo.' },
  { icon:'⚡', title:'Rápido e seguro',      desc:'Em minutos sua reserva está confirmada. Você recebe o código e pode planejar.' },
  { icon:'🔍', title:'Consulta fácil',       desc:'Perdeu o código? Sem problema. Localize sua reserva a qualquer hora.' },
  { icon:'🎉', title:'Perfeito para grupos', desc:'Reserve e garanta espaço suficiente para a turma inteira.' },
  { icon:'🏆', title:'Experiência garantida',desc:'Quando você reserva, a experiência Mané começa antes de sair de casa.' },
];
const RESTAURANTS = [
  'Superquadra Bar','Casa Baco','Lima Cocina Peruana','Marzuk Empório Árabe',
  'Meu Galeto','Ricco Burger','Maré','Mahalo Poke','Tudo de Porco',
  'Strogonoff do Paulo Tarso','Italianíssimo','Café e um Chêro','Casa Doce',
  'Juá','Quintal do Coco','De Paulina','+ novidades',
];
const CHIPS = [
  { icon:'🕐', text:'Seg–Qui: 12h às 00h' },
  { icon:'🌙', text:'Sex–Sáb: 12h às 02h' },
  { icon:'☀️', text:'Dom: 11h às 23h' },
  { icon:'🐾', text:'Pet Friendly' },
  { icon:'🌿', text:'Vegano & Sem Glúten' },
  { icon:'🅿️', text:'Estacionamento R$10/3h' },
];
const IMAGES = {
  sobre1: 'https://mane.com.vc/wp-content/uploads/2025/04/Imagem-do-WhatsApp.jpg',
  sobre2: 'https://mane.com.vc/wp-content/uploads/2023/10/A91A1578-1.png',
  sobre3: 'https://mane.com.vc/wp-content/uploads/2023/10/A91A0040-3.png',
  mos1:   'https://mane.com.vc/wp-content/uploads/2025/04/Imagem-do-WhatsApp.jpg',
  mos2:   'https://mane.com.vc/wp-content/uploads/2023/03/Mask-group-5.png',
  mos3:   'https://mane.com.vc/wp-content/uploads/2023/03/Mask-group-3.png',
  mos4:   'https://mane.com.vc/wp-content/uploads/2023/10/A91A1578-1.png',
  mos5:   'https://mane.com.vc/wp-content/uploads/2023/10/A91A0040-3.png',
};

/* ─── main ────────────────────────────────────────────── */
export default function Home() {
  useEffect(() => { ensureAnalyticsReady(); }, []);

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

  if (!hydrated) return <div style={{ minHeight:'100dvh', background:G.dark }} />;

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
      `}</style>

      <main style={{ fontFamily:sans, color:G.white, background:'#000' }}>

        {/* ══ HERO ═══════════════════════════════════════════ */}
        <section style={{
          position:'relative', minHeight:'100dvh',
          display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center',
          textAlign:'center', overflow:'hidden',
          padding:'clamp(56px,8vw,80px) clamp(16px,4vw,40px) clamp(108px,14vw,130px)',
        }}>
          {/* gradient bg fallback */}
          <div style={{
            position:'absolute', inset:0, zIndex:0,
            background:`radial-gradient(ellipse 80% 60% at 20% 30%, rgba(3,76,70,.9) 0%, transparent 60%),
              radial-gradient(ellipse 60% 80% at 80% 70%, rgba(15,110,99,.85) 0%, transparent 60%), #0a0a0a`,
          }} />

          {/* YouTube background */}
          <div style={{ position:'absolute', inset:0, zIndex:1, overflow:'hidden', pointerEvents:'none' }}>
            <iframe
              src="https://www.youtube.com/embed/pbBdn_I-7pk?si=1BoCdyoqFQx0yRBy&autoplay=1&mute=1&loop=1&playlist=pbBdn_I-7pk&controls=0&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1"
              allow="autoplay; fullscreen"
              title="Mané Mercado"
              style={{
                position:'absolute', top:'50%', left:'50%',
                width:'100vw', height:'56.25vw',
                minHeight:'100vh', minWidth:'177.78vh',
                transform:'translate(-50%,-50%)',
                opacity:.35, border:'none',
              }}
            />
          </div>

          {/* overlays */}
          <div style={{ position:'absolute', inset:0, zIndex:2, background:'rgba(0,0,0,.5)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', top:0, right:0, width:160, height:100, zIndex:10, pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:200, zIndex:3, background:'linear-gradient(to bottom,transparent,#000)', pointerEvents:'none' }} />

          {/* content */}
          <div style={{
            position:'relative', zIndex:6,
            maxWidth:820, width:'100%',
            display:'flex', flexDirection:'column', alignItems:'center',
          }}>
            {/* badge */}
            <div className="hero-badge" style={{
              display:'inline-flex', alignItems:'center', gap:8,
              padding:'5px 14px', borderRadius:999,
              border:'1.5px solid rgba(255,255,255,.25)',
              background:'rgba(255,255,255,.08)', backdropFilter:'blur(12px)',
              fontSize:11, fontWeight:600, letterSpacing:'.1em', textTransform:'uppercase',
              color:'#a8dbd4', marginBottom:20,
            }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:G.goldLight, flexShrink:0, display:'inline-block' }} className="pulse-dot" />
              Mercado Vírgula · Brasília
            </div>

            {/* Logo oficial Mané */}
            <img
              className="hero-logo-w"
              src="https://mane.com.vc/wp-content/uploads/2023/03/Camada-1.svg"
              alt="Mané Mercado"
              style={{
                height:'clamp(48px,8vw,72px)', width:'auto', display:'block',
                marginBottom:'clamp(20px,3vw,28px)',
               
                dropShadow:'0 2px 16px rgba(0,0,0,.4)',
              } as React.CSSProperties}
            />

            {/* headline */}
            <h1 className="hero-h1 hero-h1-txt" style={{
              fontFamily:serif, fontWeight:900,
              fontSize:'clamp(2.2rem,6.5vw,4.4rem)',
              lineHeight:1.05, letterSpacing:'-.02em',
              textShadow:'0 2px 30px rgba(0,0,0,.5)',
              margin:0, width:'100%',
            }}>
              Sua mesa garantida<br/>
              <span style={{ color:'#a8dbd4' }}>num lugar que você<br className="mobile-br"/>não vai querer sair.</span>
            </h1>

            {/* sub */}
            <p className="hero-sub hero-sub-txt" style={{
              fontSize:'clamp(.9rem,2.5vw,1.15rem)',
              lineHeight:1.65, opacity:.85,
              maxWidth:500, marginTop:20,
            }}>
              17 restaurantes, 3 bares, adega e uma experiência gastronômica plural
              no coração de Brasília. Reserve e chegue direto.
            </p>

            {/* CTAs */}
            <div className="hero-ctas hero-ctas-wrap" style={{
              display:'flex', gap:12, flexWrap:'wrap',
              justifyContent:'center', marginTop:32, width:'100%',
            }}>
              <HeroBtn href={withQuery('/reservar')} primary>
                <CalIcon /> Reservar Mesa
              </HeroBtn>
              <HeroBtn href={withQuery('/consultar')} primary={false}>
                <SearchIcon /> Localizar Reserva
              </HeroBtn>
            </div>
          </div>

          {/* stats ribbon */}
          <div className="hero-ribbon stats-ribbon" style={{
            position:'absolute', bottom:0, left:0, right:0, zIndex:7,
            display:'grid', gridTemplateColumns:'repeat(4,1fr)',
            padding:'12px 16px',
            background:'rgba(3,76,70,.72)', backdropFilter:'blur(20px)',
            borderTop:'1px solid rgba(255,255,255,.12)',
          }}>
            {STATS.map((s, i) => (
              <div key={s.label} className={`stat-${i}`} style={{
                display:'flex', flexDirection:'column', alignItems:'center',
                padding:'6px 8px',
                borderRight: i < 3 ? '1px solid rgba(255,255,255,.12)' : 'none',
              }}>
                <span style={{ fontFamily:serif, fontSize:'clamp(1.1rem,3vw,1.7rem)', fontWeight:900, color:G.goldLight, lineHeight:1 }}>{s.num}</span>
                <span style={{ fontSize:'clamp(9px,1.5vw,11px)', opacity:.65, textTransform:'uppercase', letterSpacing:'.08em', marginTop:3, textAlign:'center', lineHeight:1.2 }}>{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ══ SOBRE ══════════════════════════════════════════ */}
        <Sobre withQuery={withQuery} />

        {/* ══ AMBIENTE ═══════════════════════════════════════ */}
        <Ambiente />

        {/* ══ OCASIÕES ═══════════════════════════════════════ */}
        <section style={{ background:G.dark, padding:'clamp(56px,10vw,100px) clamp(16px,5vw,64px)' }}>
          <Rv style={{ textAlign:'center', marginBottom:44 }}>
            <Eyebrow color="#a8dbd4">Para toda ocasião</Eyebrow>
            <SecTitle>Não importa o motivo —<br/>o Mané tem espaço pra você</SecTitle>
          </Rv>
          <div className="ocas-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:14 }}>
            {OCASIOES.map((o, i) => (
              <Rv key={o.label} delay={i*60} style={{
                background: o.featured ? 'rgba(200,144,42,.15)' : 'rgba(255,255,255,.06)',
                border:`1.5px solid ${o.featured ? 'rgba(200,144,42,.35)' : 'rgba(255,255,255,.1)'}`,
                borderRadius:18, overflow:'hidden', textAlign:'center',
              }}>
                {o.featured ? (
                  <div style={{ width:'100%', height:180, overflow:'hidden', marginBottom:0 }}>
                    <img src="https://mane.com.vc/wp-content/uploads/2023/03/Group-205.png"
                      alt="Aniversário no Mané"
                      style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
                  </div>
                ) : (
                  <div style={{ fontSize:44, marginBottom:16, paddingTop:28 }}>{o.emoji}</div>
                )}
                <div style={{ padding: o.featured ? '20px 22px 24px' : '0 22px 24px' }}>
                  <h3 style={{ fontFamily:serif, fontWeight:900, fontSize:19, color: o.featured ? G.goldLight : '#a8dbd4', marginBottom:8 }}>{o.label}</h3>
                  <p style={{ fontSize:14, lineHeight:1.65, opacity:.7, margin:0 }}>{o.desc}</p>
                </div>
              </Rv>
            ))}
          </div>
        </section>

        {/* ══ BENEFÍCIOS ═════════════════════════════════════ */}
        <section style={{ background:G.cream, color:G.dark, padding:'clamp(56px,10vw,100px) clamp(16px,5vw,64px)' }}>
          <div style={{ maxWidth:1140, margin:'0 auto' }}>
            <Rv style={{ marginBottom:44 }}>
              <Eyebrow color={G.mid}>Por que reservar?</Eyebrow>
              <SecTitle dark>Sua experiência começa<br/>antes mesmo de chegar</SecTitle>
              <p style={{ fontSize:'clamp(.9rem,2vw,1.05rem)', lineHeight:1.7, opacity:.7, maxWidth:500 }}>
                O Mané está sempre cheio. Reserve e garanta que seu momento seja perfeito.
              </p>
            </Rv>
            <div className="benef-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16 }}>
              {BENEFITS.map((b, i) => (
                <Rv key={b.title} delay={i*60} style={{
                  background:G.white, borderRadius:16, padding:'28px 24px',
                  border:`1.5px solid ${G.light}`,
                  boxShadow:'0 2px 20px rgba(3,76,70,.05)',
                }}>
                  <div style={{ fontSize:34, marginBottom:14 }}>{b.icon}</div>
                  <h3 style={{ fontFamily:serif, fontWeight:900, fontSize:18, color:G.dark, marginBottom:8 }}>{b.title}</h3>
                  <p style={{ fontSize:14, lineHeight:1.65, color:'#555', margin:0 }}>{b.desc}</p>
                </Rv>
              ))}
            </div>
          </div>
        </section>

        {/* ══ RESTAURANTES ═══════════════════════════════════ */}
        <section style={{ background:'#111', padding:'clamp(56px,10vw,100px) clamp(16px,5vw,64px)' }}>
          <div style={{ maxWidth:1140, margin:'0 auto' }}>
            <Rv style={{ textAlign:'center', marginBottom:44 }}>
              <Eyebrow color="#a8dbd4">17+ operações</Eyebrow>
              <SecTitle>Uma pluralidade de sabores<br/>em um só lugar</SecTitle>
              <p style={{ fontSize:'clamp(.9rem,2vw,1.05rem)', lineHeight:1.7, opacity:.7, maxWidth:500, margin:'0 auto' }}>
                Chefs renomados de Brasília assinam cada operação.
              </p>
            </Rv>
            <Rv>
              <div className="rest-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10 }}>
                {RESTAURANTS.map(r => (
                  <div key={r} style={{
                    background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.1)',
                    borderRadius:999, padding:'11px 18px', fontSize:13, fontWeight:600,
                    textAlign:'center', color:'rgba(255,255,255,.75)',
                  }}>{r}</div>
                ))}
              </div>
            </Rv>
            <Rv>
              <div className="chips-wrap" style={{ display:'flex', flexWrap:'wrap', gap:10, marginTop:44, justifyContent:'center' }}>
                {CHIPS.map(c => (
                  <div key={c.text} style={{
                    display:'flex', alignItems:'center', gap:8,
                    background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)',
                    borderRadius:12, padding:'9px 16px', fontSize:13, fontWeight:600,
                    color:'rgba(255,255,255,.7)',
                  }}>
                    <span style={{ fontSize:16 }}>{c.icon}</span>{c.text}
                  </div>
                ))}
              </div>
            </Rv>
          </div>
        </section>

        {/* ══ CTA FINAL ══════════════════════════════════════ */}
        <section style={{
          background:`linear-gradient(135deg, ${G.dark} 0%, ${G.mid} 100%)`,
          textAlign:'center', position:'relative', overflow:'hidden',
          padding:'clamp(72px,12vw,130px) clamp(16px,5vw,64px)',
        }}>
          <div style={{ position:'absolute', borderRadius:'50%', border:'70px solid rgba(255,255,255,.04)', width:560, height:560, top:-200, right:-100, pointerEvents:'none' }} />
          <div style={{ position:'absolute', borderRadius:'50%', border:'70px solid rgba(255,255,255,.04)', width:380, height:380, bottom:-140, left:-80, pointerEvents:'none' }} />
          <div style={{ position:'relative', zIndex:2, maxWidth:580, margin:'0 auto' }}>
            <Rv>
              <img src="https://mane.com.vc/wp-content/uploads/2023/03/Camada-1.svg" alt="Mané"
                style={{ height:56, width:'auto', display:'block', margin:'0 auto 28px', filter:'brightness(0) invert(1)' }} />
            </Rv>
            <Rv delay={80}>
              <h2 style={{ fontFamily:serif, fontWeight:900, fontSize:'clamp(1.8rem,5vw,3rem)', lineHeight:1.1, marginBottom:16 }}>
                Pronto para garantir<br/>sua mesa?
              </h2>
            </Rv>
            <Rv delay={160}>
              <p style={{ fontSize:'clamp(.9rem,2vw,1.1rem)', opacity:.8, marginBottom:36, lineHeight:1.65 }}>
                Reserve agora em segundos e chegue ao Mané sabendo que seu lugar está esperando.
              </p>
            </Rv>
            <Rv delay={240}>
              <div className="cta-btns" style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center' }}>
                <CtaBtn href={withQuery('/reservar')} primary><CalIcon />Reservar Mesa</CtaBtn>
                <CtaBtn href={withQuery('/consultar')} primary={false}><SearchIcon />Localizar Reserva</CtaBtn>
              </div>
            </Rv>
            <Rv delay={320}>
              <div className="cta-tags" style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center', marginTop:24 }}>
                {['🎂 Aniversários','🥂 Confraternizações','💼 Empresas','👨‍👩‍👧 Famílias','🐾 Pet Friendly'].map(t => (
                  <span key={t} style={{ background:'rgba(255,255,255,.1)', borderRadius:999, padding:'5px 14px', fontSize:12, fontWeight:600, opacity:.75 }}>{t}</span>
                ))}
              </div>
            </Rv>
            <p style={{ marginTop:32, fontSize:12, opacity:.4 }}>Dúvidas? Procure nosso concierge no estabelecimento no dia da sua visita.</p>
          </div>
        </section>
      </main>

      {/* ══ FAB — botão flutuante mobile ════════════════════ */}
      <div className={`fab${fabVisible ? '' : ' hidden'}`}>
        <Link href={withQuery('/reservar')}>
          <CalIcon />
          Reservar Mesa
        </Link>
      </div>
    </>
  );
}

/* ─── sub-pages ────────────────────────────────────────── */
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
    }, { threshold:.1 });
    if (refL.current) obs.observe(refL.current);
    if (refR.current) obs.observe(refR.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section style={{ background:G.cream, color:G.dark, padding:'clamp(56px,10vw,100px) clamp(16px,5vw,64px)' }}>
      <div style={{ maxWidth:1140, margin:'0 auto' }}>
        <div className="sobre-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:56, alignItems:'center' }}>
          {/* foto grid */}
          <div ref={refL} className="sobre-imgs" style={{
            display:'grid', gridTemplateColumns:'1fr 1fr',
            gridTemplateRows:'220px 220px', gap:10,
            borderRadius:20, overflow:'hidden',
            opacity: vL?1:0, transform: vL?'none':'translateX(-36px)',
            transition:'opacity .7s ease, transform .7s ease',
          }}>
            <img src={IMAGES.sobre1} alt="Mané interior" style={{ gridRow:'span 2', width:'100%', height:'100%', objectFit:'cover' }} />
            <img src={IMAGES.sobre2} alt="Gastronomia" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            <img src={IMAGES.sobre3} alt="Pratos" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          </div>
          {/* texto */}
          <div ref={refR} style={{
            opacity: vR?1:0, transform: vR?'none':'translateX(36px)',
            transition:'opacity .7s ease, transform .7s ease',
          }}>
            <Eyebrow color={G.mid}>O que é o Mané?</Eyebrow>
            <SecTitle dark>Um mercado feito de sonhos, sabores e Brasília</SecTitle>
            <p style={{ fontSize:'clamp(.9rem,2vw,1rem)', lineHeight:1.7, opacity:.75, marginBottom:24 }}>
              O Mané nasceu de viagens pelo mundo e do desejo de reunir o melhor da gastronomia
              da capital num espaço semi-aberto, vibrante e plural.
            </p>
            {[
              { icon:'📍', text:'Ao lado do Estádio Mané Garrincha, no Eixo Monumental da Asa Norte' },
              { icon:'🍽️', text:'Árabe, peruana, sertaneja, italiana, churrasco, frutos do mar e muito mais' },
              { icon:'🎵', text:'Música ao vivo, programação cultural e atmosfera da tarde à madrugada' },
              { icon:'🐾', text:'Pet friendly — cachorro, gato, periquito, todo mundo bem-vindo' },
              { icon:'🌱', text:'Horta urbana, espaço semi-aberto com iluminação e ventilação naturais' },
            ].map(item => (
              <div key={item.text} style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:12 }}>
                <span style={{ flexShrink:0, width:32, height:32, borderRadius:10, background:G.dark, color:G.cream, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, marginTop:1 }}>{item.icon}</span>
                <span style={{ fontSize:'clamp(.85rem,2vw,.95rem)', lineHeight:1.55 }}>{item.text}</span>
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
    <section style={{ background:'#0a0a0a', padding:'clamp(56px,10vw,100px) clamp(16px,5vw,64px)' }}>
      <div style={{ maxWidth:1140, margin:'0 auto' }}>
        <Rv style={{ textAlign:'center', marginBottom:48 }}>
          <Eyebrow color="#a8dbd4">O espaço</Eyebrow>
          <SecTitle>Um lugar que inspira</SecTitle>
          <p style={{ fontSize:'clamp(.9rem,2vw,1.05rem)', lineHeight:1.7, opacity:.7, maxWidth:500, margin:'0 auto' }}>
            Estrutura reaproveitada dos Jogos Pan-Americanos de 2007, transformada
            em 4.000m² de experiência gastronômica com alma brasiliense.
          </p>
        </Rv>
        <Rv>
          <div className="amb-grid" style={{
            display:'grid',
            gridTemplateColumns:'repeat(12,1fr)',
            gridTemplateRows:'220px 220px',
            gap:10,
          }}>
            {[
              { col:'1/6',  row:'1/2', src:IMAGES.mos1, cap:'Espaço semi-aberto de 4.000m²', cls:'amb-cell' },
              { col:'6/9',  row:'1/2', src:IMAGES.mos2, cap:'Gastronomia de todos os sotaques', cls:'amb-cell' },
              { col:'9/13', row:'1/3', src:IMAGES.mos3, cap:'Chefs renomados de Brasília', cls:'amb-cell amb-cell-wide' },
              { col:'1/4',  row:'2/3', src:IMAGES.mos4, cap:'Perfeito para celebrar', cls:'amb-cell' },
              { col:'4/9',  row:'2/3', src:IMAGES.mos5, cap:'3 bares + adega especial', cls:'amb-cell' },
            ].map(m => (
              <div key={m.cap} className={m.cls} style={{ gridColumn:m.col, gridRow:m.row, borderRadius:14, overflow:'hidden', position:'relative' }}>
                <img src={m.src} alt={m.cap} style={{ width:'100%', height:'100%', objectFit:'cover', transition:'transform .5s ease' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='scale(1.06)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform='none'; }}
                />
                <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'14px 16px', background:'linear-gradient(to top,rgba(0,0,0,.8),transparent)', fontSize:12, fontWeight:600 }}>{m.cap}</div>
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
  return <p style={{ fontSize:12, fontWeight:700, letterSpacing:'.15em', textTransform:'uppercase', color, marginBottom:12 }}>{children}</p>;
}
function SecTitle({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return <h2 style={{ fontFamily:serif, fontWeight:900, fontSize:'clamp(1.7rem,4.5vw,2.8rem)', lineHeight:1.1, letterSpacing:'-.02em', marginBottom:16, color: dark ? G.dark : G.white }}>{children}</h2>;
}

function Rv({ children, style, delay=0 }: { children: React.ReactNode; style?: React.CSSProperties; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); obs.disconnect(); } }, { threshold:.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ opacity:v?1:0, transform:v?'none':'translateY(24px)', transition:`opacity .7s ease ${delay}ms, transform .7s ease ${delay}ms`, ...style }}>
      {children}
    </div>
  );
}

function HeroBtn({ href, children, primary }: { href:string; children:React.ReactNode; primary:boolean }) {
  return (
    <Link href={href} className="hero-btn" style={{
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
      height:52, padding:'0 28px', borderRadius:13,
      fontFamily:sans, fontWeight:700, fontSize:15,
      textDecoration:'none', letterSpacing:'.01em', whiteSpace:'nowrap',
      ...(primary
        ? { background:G.cream, color:G.dark, boxShadow:'0 6px 24px rgba(0,0,0,.3)' }
        : { background:'transparent', color:G.white, border:'2px solid rgba(255,255,255,.45)' }),
    }}>
      {children}
    </Link>
  );
}

function CtaBtn({ href, children, primary }: { href:string; children:React.ReactNode; primary:boolean }) {
  return (
    <Link href={href} style={{
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
      height:54, padding:'0 32px', borderRadius:14,
      fontFamily:sans, fontWeight:700, fontSize:16,
      textDecoration:'none', letterSpacing:'.01em', whiteSpace:'nowrap', flex:'1 1 auto', maxWidth:280,
      ...(primary
        ? { background:G.cream, color:G.dark, boxShadow:'0 8px 28px rgba(0,0,0,.3)' }
        : { background:'transparent', color:G.white, border:'2px solid rgba(255,255,255,.4)' }),
    }}>
      {children}
    </Link>
  );
}

function CalIcon() {
  return (
    <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink:0 }}>
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink:0 }}>
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}
