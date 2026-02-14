import React, { useEffect, useState } from 'react';
import { Terminal, ShieldCheck, Zap, Code2, Lock, Activity, ArrowRight, Radio, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CodeBlock } from '../components/CodeBlock';
import { AgentReviewList } from '../components/AgentReviewList';
import { useProducts, useReviews } from '../hooks';
import { useLanguage } from '../context/LanguageContext';

/* ━━━ Animated Counter ━━━ */
function Counter({ to, duration = 1600 }: { to: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (to === 0) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setVal(Math.round(to * (1 - Math.pow(1 - t, 4))));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [to, duration]);
  return <>{val}</>;
}

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { products, loading: productsLoading } = useProducts();
  const { reviews: tissueReviews, loading: reviewsLoading } = useReviews('TISSUE-70x20');

  const firstProduct = products[0];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-root)', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>

      {/* ━━━ Hero ━━━ */}
      <div style={{ position: 'relative', overflow: 'hidden', padding: '80px 24px 60px', textAlign: 'center' }}>
        {/* Background mesh gradient */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.12,
          background: `
            radial-gradient(ellipse 800px 400px at 30% 20%, var(--accent-green), transparent),
            radial-gradient(ellipse 600px 300px at 70% 30%, var(--accent-cyan), transparent),
            radial-gradient(ellipse 500px 250px at 50% 80%, var(--accent-purple), transparent)
          `,
        }} />
        {/* Grid pattern */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.03,
          backgroundImage: 'linear-gradient(var(--text-dim) 1px, transparent 1px), linear-gradient(90deg, var(--text-dim) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 800, margin: '0 auto' }}>
          {/* Status pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 16px', borderRadius: 'var(--radius-full)',
            background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
            marginBottom: 24,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-green)',
              boxShadow: 'var(--shadow-glow-green)', animation: 'livePulse 2s infinite',
            }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--accent-green)' }}>
              {t('landing.systemOnline')}
            </span>
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: 'clamp(36px, 6vw, 72px)', fontWeight: 900, lineHeight: 1.05, margin: '0 0 16px', letterSpacing: -1 }}>
            <span style={{ display: 'block', color: 'var(--text-primary)' }}>{t('landing.heroTitle1')}</span>
            <span style={{ display: 'block', background: 'linear-gradient(135deg, var(--accent-green), var(--accent-cyan))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {t('landing.heroTitle2')}
            </span>
          </h1>

          <p style={{ maxWidth: 520, margin: '0 auto 32px', fontSize: 16, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
            {t('landing.heroSubtitle')}
          </p>

          {/* CTA Buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
            <button
              onClick={() => navigate('/agent-console')}
              className="btn-primary"
              style={{ padding: '14px 28px', fontSize: 15 }}
            >
              <Zap size={18} />
              {t('landing.btnConnect')}
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => document.getElementById('store-as-code')?.scrollIntoView({ behavior: 'smooth' })}
              className="btn-secondary"
              style={{ padding: '14px 28px', fontSize: 15 }}
            >
              <Code2 size={18} />
              {t('landing.btnViewCode')}
            </button>
          </div>

          {/* Live Stats */}
          <div style={{
            display: 'inline-flex', gap: 32, padding: '16px 32px', borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', backdropFilter: 'blur(12px)',
          }}>
            {[
              { label: 'Products', value: products.length, color: 'var(--accent-cyan)' },
              { label: 'AI Agents Ready', value: 6, color: 'var(--accent-green)' },
              { label: 'SLA Uptime', value: 99, suffix: '%', color: 'var(--accent-purple)' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-mono)', color: s.color }}>
                  <Counter to={s.value} />{s.suffix || ''}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ━━━ Trust Badges ━━━ */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, padding: '0 24px 48px', flexWrap: 'wrap' }}>
        {[
          { icon: <ShieldCheck size={14} />, label: 'ACP Compatible', color: 'var(--accent-green)' },
          { icon: <Radio size={14} />, label: '99.5% SLA', color: 'var(--accent-cyan)' },
          { icon: <Globe size={14} />, label: 'MCP Ready', color: 'var(--accent-purple)' },
          { icon: <Lock size={14} />, label: 'RLS Secured', color: 'var(--accent-amber)' },
        ].map(b => (
          <div key={b.label} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 600,
            color: b.color,
          }}>
            {b.icon} {b.label}
          </div>
        ))}
      </div>

      {/* ━━━ Feature Cards ━━━ */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 64px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }} className="grid-responsive-4">
          {[
            { icon: <Code2 size={24} />, title: t('landing.feature1Title'), desc: t('landing.feature1Desc'), color: 'var(--accent-cyan)' },
            { icon: <Lock size={24} />, title: t('landing.feature2Title'), desc: t('landing.feature2Desc'), color: 'var(--accent-red)' },
            { icon: <ShieldCheck size={24} />, title: t('landing.feature3Title'), desc: t('landing.feature3Desc'), color: 'var(--accent-amber)' },
          ].map(f => (
            <div key={f.title} className="glass-card" style={{ padding: 24 }}>
              <div style={{ color: f.color, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ━━━ Catalog Preview ━━━ */}
      <div id="store-as-code" style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 64px' }}>
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 48 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }} className="grid-responsive-4">
            <div>
              <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>{t('landing.catalogPreview')}</h2>
              <p style={{ color: 'var(--text-tertiary)', marginBottom: 24, lineHeight: 1.6 }}>{t('landing.catalogDesc')}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
                {[t('landing.list1'), t('landing.list2'), t('landing.list3')].map(item => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 10 }}>
                    <span style={{ color: 'var(--accent-green)' }}>✓</span> {item}
                  </li>
                ))}
              </ul>

              {/* Reviews */}
              <div className="glass-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Activity size={16} style={{ color: 'var(--accent-purple)' }} />
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{t('landing.agentReviews')}</h3>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{t('landing.agentReviewsDesc')}</p>
                {reviewsLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="skeleton" style={{ height: 16, width: '80%' }} />
                    <div className="skeleton" style={{ height: 16, width: '60%' }} />
                    <div className="skeleton" style={{ height: 16, width: '70%' }} />
                  </div>
                ) : (
                  <AgentReviewList reviews={tissueReviews} />
                )}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                GET /api/v1/catalog/consumables?limit=1
              </div>
              {productsLoading ? (
                <div className="glass-card" style={{ padding: 20 }}>
                  <div className="skeleton" style={{ height: 200 }} />
                </div>
              ) : firstProduct ? (
                <CodeBlock data={firstProduct} />
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>No products found</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ━━━ Footer ━━━ */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t('landing.footerCopyright')}</p>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{t('landing.footerPrivacy')}</p>
      </footer>

      <style>{`
        @keyframes livePulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
      `}</style>
    </div>
  );
};