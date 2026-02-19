import React, { useEffect, useState } from 'react';
import { Terminal, ShieldCheck, Zap, Code2, Lock, Activity, ArrowRight, Radio, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CodeBlock } from '../components/CodeBlock';
import { AgentReviewList } from '../components/AgentReviewList';
import { useProducts, useReviews } from '../hooks';
import { useLanguage } from '../context/LanguageContext';

/* ━━━ Legal Text Constants ━━━ */
const TERMS_TEXT = `제1조 (목적)
본 약관은 몬스터랩(이하 "회사")이 운영하는 JSONMart(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (정의)
1. "서비스"란 회사가 제공하는 AI 에이전트 전용 커머스 플랫폼을 말합니다.
2. "이용자"란 본 약관에 따라 서비스를 이용하는 회원 및 비회원을 말합니다.
3. "AI 에이전트"란 이용자를 대신하여 상품 검색, 주문, 결제 등을 수행하는 자동화된 소프트웨어를 말합니다.

제3조 (약관의 효력 및 변경)
1. 본 약관은 서비스 화면에 게시하거나 기타 방법으로 이용자에게 공지함으로써 효력이 발생합니다.
2. 회사는 관련 법령에 위배되지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 적용일자 7일 전부터 공지합니다.

제4조 (서비스의 제공)
1. 회사는 다음과 같은 서비스를 제공합니다:
   - AI 에이전트를 통한 상품 검색 및 주문
   - 상품 카탈로그 API 제공
   - 주문 관리 및 배송 추적
   - AI 에이전트 등록 및 관리
2. 서비스는 연중무휴 24시간 제공을 원칙으로 하며, 시스템 점검 등의 사유로 일시 중단될 수 있습니다.

제5조 (이용자의 의무)
1. 이용자는 관계 법령, 본 약관의 규정 등을 준수하여야 합니다.
2. 이용자는 타인의 정보를 도용하거나 허위 정보를 등록해서는 안 됩니다.
3. 이용자는 서비스를 통해 얻은 정보를 회사의 사전 승인 없이 상업적으로 이용해서는 안 됩니다.

제6조 (결제 및 환불)
1. 상품의 가격은 서비스에 표시된 금액에 따릅니다.
2. 결제는 회사가 지정한 PG(결제대행) 서비스를 통해 이루어집니다.
3. 환불은 전자상거래 등에서의 소비자보호에 관한 법률에 따릅니다.

제7조 (개인정보보호)
회사는 이용자의 개인정보를 개인정보처리방침에 따라 보호합니다.

제8조 (면책사항)
1. 회사는 천재지변, 전쟁 등 불가항력적인 사유로 서비스를 제공할 수 없는 경우 책임이 면제됩니다.
2. 회사는 이용자의 귀책사유로 인한 서비스 이용 장애에 대해 책임을 지지 않습니다.

제9조 (분쟁 해결)
1. 본 약관에 관한 분쟁은 대한민국 법률에 따라 해결합니다.
2. 서비스 이용과 관련하여 발생한 분쟁에 대해 회사의 본사 소재지를 관할하는 법원을 전속 관할법원으로 합니다.

부칙
본 약관은 2026년 2월 8일부터 시행합니다.`;

const PRIVACY_TEXT = `몬스터랩(이하 "회사")은 개인정보보호법에 따라 이용자의 개인정보를 보호하고 이와 관련한 고충을 처리하기 위하여 다음과 같은 개인정보 처리방침을 수립·공개합니다.

1. 수집하는 개인정보 항목
회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다:
- 필수항목: 이메일 주소, 비밀번호
- 주문 시: 수령자명, 연락처, 배송주소, 우편번호
- 자동수집: 접속 IP, 접속 일시, 서비스 이용 기록

2. 개인정보의 수집·이용 목적
- 회원 가입 및 관리
- 상품 주문, 결제, 배송 서비스 제공
- 서비스 개선 및 신규 서비스 개발
- 법령에 따른 의무 이행

3. 개인정보의 보유 및 이용 기간
- 회원 탈퇴 시까지 (관련 법령에 따른 보존 기간이 있는 경우 해당 기간까지)
- 전자상거래법에 의한 거래기록: 5년
- 소비자 불만 또는 분쟁 처리 기록: 3년
- 접속 기록: 3개월

4. 개인정보의 제3자 제공
회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의 경우는 예외로 합니다:
- 이용자가 사전에 동의한 경우
- 법령에 의한 경우
- 배송업무를 위해 배송업체에 최소한의 정보 제공

5. 개인정보의 파기
회사는 개인정보 보유기간이 경과하거나 처리 목적이 달성된 경우 지체 없이 해당 개인정보를 파기합니다.
- 전자적 파일: 복원이 불가능한 방법으로 영구 삭제
- 서면: 분쇄기로 분쇄하거나 소각

6. 이용자의 권리
이용자는 언제든지 자신의 개인정보를 조회, 수정, 삭제할 수 있으며, 처리 정지를 요구할 수 있습니다.

7. 개인정보 보호책임자
성명: 진성호
연락처: 010-2606-0357
이메일: support@jsonmart.xyz

8. 개인정보 처리방침 변경
본 방침은 시행일로부터 적용되며, 변경 사항이 있을 경우 서비스 내 공지를 통해 고지합니다.

시행일: 2026년 2월 8일`;

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
  const [footerModal, setFooterModal] = useState<'terms' | 'privacy' | null>(null);

  const firstProduct = products[0];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-root)', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>

      {/* ━━━ Hero ━━━ */}
      <div style={{ position: 'relative', overflow: 'hidden', padding: 'clamp(40px, 10vw, 80px) clamp(12px, 4vw, 24px) clamp(32px, 8vw, 60px)', textAlign: 'center' }}>
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
            display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 'clamp(12px, 4vw, 32px)',
            padding: '16px clamp(12px, 3vw, 32px)', borderRadius: 'var(--radius-lg)',
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
      <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(8px, 2vw, 20px)', padding: '0 clamp(12px, 4vw, 24px) 48px', flexWrap: 'wrap' }}>
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
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 clamp(12px, 4vw, 24px) 64px' }}>
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
      <div id="store-as-code" style={{ maxWidth: 900, margin: '0 auto', padding: '0 clamp(12px, 4vw, 24px) 64px' }}>
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
      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '32px clamp(16px, 4vw, 24px) 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {/* Business Info */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
            gap: 24, marginBottom: 24, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.8,
          }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, fontSize: 13 }}>사업자 정보</div>
              <div>상호명: <span style={{ color: 'var(--text-secondary)' }}>몬스터랩</span></div>
              <div>대표자: <span style={{ color: 'var(--text-secondary)' }}>진성호</span></div>
              <div>사업자등록번호: <span style={{ color: 'var(--text-secondary)' }}>521-39-01355</span></div>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, fontSize: 13 }}>연락처</div>
              <div>전화: <span style={{ color: 'var(--text-secondary)' }}>010-2606-0357</span></div>
              <div>이메일: <span style={{ color: 'var(--text-secondary)' }}>support@jsonmart.xyz</span></div>
              <div style={{ marginTop: 4 }}>주소: 경기도 남양주시 진접읍 해밀예당1로189번길 3, 2102동 301호</div>
            </div>
          </div>

          {/* Terms & Privacy Links */}
          <div style={{
            display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap',
            marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)',
          }}>
            {[
              { key: 'terms', label: '이용약관' },
              { key: 'privacy', label: '개인정보처리방침' },
            ].map(item => (
              <button
                key={item.key}
                onClick={() => setFooterModal(item.key as any)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
                  textDecoration: 'underline', textUnderlineOffset: 3,
                  padding: '4px 0',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t('landing.footerCopyright')}</p>
          </div>
        </div>
      </footer>

      {/* ━━━ Terms / Privacy Modal ━━━ */}
      {footerModal && (
        <div
          onClick={() => setFooterModal(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 680, maxHeight: '80vh',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)',
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {footerModal === 'terms' ? '이용약관' : '개인정보처리방침'}
              </h2>
              <button
                onClick={() => setFooterModal(null)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-tertiary)', fontSize: 20, lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
            <div style={{
              padding: 20, overflowY: 'auto', fontSize: 13,
              color: 'var(--text-secondary)', lineHeight: 1.8,
              whiteSpace: 'pre-wrap',
            }}>
              {footerModal === 'terms' ? TERMS_TEXT : PRIVACY_TEXT}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes livePulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
      `}</style>
    </div>
  );
};