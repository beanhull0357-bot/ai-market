import React, { useState, useEffect } from 'react';
import { Zap, Crown, Rocket, Building2, Check, X, Star, Shield, Loader2, TrendingUp, Gift, Bot, Gauge } from 'lucide-react';
import { useTiers, getWalletInfo } from '../hooks';

const TIER_COLORS: Record<string, string> = { FREE: '#6b7280', STARTER: '#0ea5e9', PRO: '#a855f7', ENTERPRISE: '#f59e0b' };
const TIER_ICONS: Record<string, React.ReactNode> = { FREE: <Zap size={20} />, STARTER: <Rocket size={20} />, PRO: <Crown size={20} />, ENTERPRISE: <Building2 size={20} /> };
const TIER_LABELS: Record<string, string> = { FREE: '무료', STARTER: '스타터', PRO: '프로', ENTERPRISE: '엔터프라이즈' };

function FeatureRow({ label, value, color }: { label: string; value: boolean | string; color?: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
            {typeof value === 'boolean' ? (
                value ? <Check size={14} style={{ color: 'var(--accent-green)' }} /> : <X size={14} style={{ color: 'var(--text-dim)' }} />
            ) : (
                <span style={{ fontSize: 11, fontWeight: 700, color: color || 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</span>
            )}
        </div>
    );
}

export const UsageTiers: React.FC = () => {
    const { tiers, loading } = useTiers();
    const [apiKey, setApiKey] = useState('');
    const [currentTier, setCurrentTier] = useState<any>(null);
    const [walletLoading, setWalletLoading] = useState(false);

    const loadCurrent = async () => {
        if (!apiKey) return;
        setWalletLoading(true);
        try {
            const data = await getWalletInfo(apiKey);
            setCurrentTier(data?.tier);
        } catch { setCurrentTier(null); }
        setWalletLoading(false);
    };

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
                    <Gauge size={24} style={{ color: 'var(--accent-purple)' }} />
                    <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Usage Tiers & Pricing</h1>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>AI 에이전트를 위한 요금제 — 더 많은 API 호출, 더 많은 혜택</p>
            </div>

            {/* Current Tier Check */}
            <div className="glass-card" style={{ padding: 12, marginBottom: 20, display: 'flex', gap: 8, maxWidth: 500, margin: '0 auto 20px' }}>
                <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="내 API 키로 현재 티어 확인..."
                    style={{ flex: 1, border: 'none', background: 'var(--bg-surface)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }} />
                <button onClick={loadCurrent} disabled={!apiKey || walletLoading}
                    style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: 'var(--accent-purple)', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                    {walletLoading ? <Loader2 size={12} className="spin" /> : '확인'}
                </button>
            </div>

            {currentTier && (
                <div className="glass-card" style={{ padding: 12, marginBottom: 20, maxWidth: 500, margin: '0 auto 20px', textAlign: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>현재 티어: </span>
                    <span style={{ fontSize: 16, fontWeight: 900, color: TIER_COLORS[currentTier.name] || 'var(--text-primary)' }}>{currentTier.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 12 }}>
                        API: {currentTier.monthly_calls_used?.toLocaleString()} / {currentTier.calls_per_month?.toLocaleString()}
                    </span>
                    {/* Usage bar */}
                    <div style={{ marginTop: 8, height: 6, background: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, ((currentTier.monthly_calls_used || 0) / (currentTier.calls_per_month || 1)) * 100)}%`, height: '100%', background: TIER_COLORS[currentTier.name], borderRadius: 3, transition: 'width 0.6s ease' }} />
                    </div>
                </div>
            )}

            {/* Tier Cards */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={28} className="spin" style={{ color: 'var(--accent-cyan)' }} /></div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {tiers.map((t: any) => {
                        const color = TIER_COLORS[t.tier_name] || '#6b7280';
                        const isCurrent = currentTier?.name === t.tier_name;
                        const features = t.features || {};
                        const perks = t.perks || {};
                        return (
                            <div key={t.id} className="glass-card" style={{ padding: 20, position: 'relative', border: isCurrent ? `2px solid ${color}` : '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                                {isCurrent && <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 8, fontWeight: 800, padding: '2px 8px', borderRadius: 3, background: color, color: '#000' }}>현재</div>}
                                {t.tier_name === 'PRO' && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, var(--accent-cyan))` }} />}

                                {/* Icon + Name */}
                                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                                    <div style={{ color, marginBottom: 6 }}>{TIER_ICONS[t.tier_name]}</div>
                                    <div style={{ fontSize: 14, fontWeight: 900, color }}>{TIER_LABELS[t.tier_name] || t.tier_name}</div>
                                </div>

                                {/* Price */}
                                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                                    {t.price_krw === 0 ? (
                                        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)' }}>{t.tier_name === 'ENTERPRISE' ? '별도 협의' : '무료'}</div>
                                    ) : (
                                        <div>
                                            <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>₩{t.price_krw.toLocaleString()}</span>
                                            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>/월</span>
                                        </div>
                                    )}
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                                        {t.calls_per_month >= 999999 ? '무제한' : `${t.calls_per_month.toLocaleString()} calls/월`}
                                    </div>
                                </div>

                                {/* Features */}
                                <div style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>기능</div>
                                    <FeatureRow label="샌드박스" value={features.sandbox ?? false} />
                                    <FeatureRow label="실 주문" value={features.real_orders ?? false} />
                                    <FeatureRow label="Webhook" value={features.webhooks === false ? false : features.webhooks === true ? true : String(features.webhooks)} />
                                    <FeatureRow label="A2A 네트워크" value={features.a2a ?? false} />
                                    <FeatureRow label="우선 처리" value={features.priority ?? false} />
                                    {features.sla_guarantee && <FeatureRow label="SLA 보장" value={true} />}
                                    {features.dedicated_support && <FeatureRow label="전담 지원" value={true} />}
                                </div>

                                {/* Agent-Specific Perks */}
                                <div>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>🤖 에이전트 혜택</div>
                                    {perks.welcome_bonus > 0 && <FeatureRow label="가입 보너스" value={`₩${Number(perks.welcome_bonus).toLocaleString()}`} color="var(--accent-green)" />}
                                    <FeatureRow label="적립률" value={perks.loyalty_rate > 0 ? `${perks.loyalty_rate}%` : '-'} color="var(--accent-amber)" />
                                    {perks.bulk_discount > 0 && <FeatureRow label="대량구매 할인" value={`${perks.bulk_discount}%`} color="var(--accent-cyan)" />}
                                    {perks.early_access && <FeatureRow label="신상품 우선 열람" value={true} />}
                                    {perks.negotiation_boost > 0 && <FeatureRow label="협상 부스트" value={`+${perks.negotiation_boost}%`} color="var(--accent-purple)" />}
                                    {perks.custom_api && <FeatureRow label="커스텀 API" value={true} />}
                                    <FeatureRow label="지원" value={perks.support || 'community'} />
                                </div>

                                {/* CTA */}
                                <button style={{ width: '100%', marginTop: 14, padding: '10px 0', borderRadius: 8, border: isCurrent ? `1px solid ${color}` : 'none', background: isCurrent ? 'transparent' : color, color: isCurrent ? color : '#000', fontWeight: 800, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s' }}>
                                    {isCurrent ? '현재 요금제' : t.tier_name === 'ENTERPRISE' ? '문의하기' : '업그레이드'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Agent-Specific Info Section */}
            <div className="glass-card" style={{ padding: 16, marginTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-cyan)', marginBottom: 10 }}>🤖 에이전트 쇼핑몰만의 특별 혜택</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div style={{ padding: 12, background: 'rgba(34,197,94,0.05)', borderRadius: 8 }}>
                        <Bot size={16} style={{ color: 'var(--accent-green)', marginBottom: 4 }} />
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>자동 쿠폰 적용</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>에이전트가 주문 시 최적 쿠폰 자동 검색·적용. 사람이 쿠폰을 찾을 필요 없음</div>
                    </div>
                    <div style={{ padding: 12, background: 'rgba(168,85,247,0.05)', borderRadius: 8 }}>
                        <Star size={16} style={{ color: 'var(--accent-purple)', marginBottom: 4 }} />
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>신뢰 기반 등급</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>거래 이력, 리뷰 품질, A2A 활동을 반영한 Trust Score로 자동 등급 산정</div>
                    </div>
                    <div style={{ padding: 12, background: 'rgba(14,165,233,0.05)', borderRadius: 8 }}>
                        <TrendingUp size={16} style={{ color: 'var(--accent-cyan)', marginBottom: 4 }} />
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>예측 구매 리워드</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>AI가 예측한 시점에 주문하면 추가 포인트 적립. 정기적 구매 = 할인 증가</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
