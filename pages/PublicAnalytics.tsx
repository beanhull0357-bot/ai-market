import React, { useState, useEffect } from 'react';
import { Globe, BarChart3, Users, Package, ShoppingCart, TrendingUp, Bot, Star, Radio, Loader2, RefreshCw, Store, Layers } from 'lucide-react';
import { getPublicAnalytics } from '../hooks';

function KpiCard({ label, value, icon, color, sub }: { label: string; value: string; icon: React.ReactNode; color: string; sub?: string }) {
    return (
        <div className="glass-card" style={{ padding: 16, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -8, top: -8, opacity: 0.06 }}>{React.cloneElement(icon as React.ReactElement, { size: 60 })}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
            {sub && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{sub}</div>}
        </div>
    );
}

function DistributionBar({ data, colorMap }: { data: Record<string, number>; colorMap?: Record<string, string> }) {
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    if (total === 0) return <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>데이터 없음</div>;
    const defaultColors = ['#00ffc8', '#a855f7', '#0ea5e9', '#f59e0b', '#ef4444', '#22c55e', '#6366f1'];
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);

    return (
        <div>
            <div style={{ display: 'flex', height: 24, borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
                {entries.map(([key, val], i) => (
                    <div key={key} title={`${key}: ${val}`}
                        style={{ width: `${(val / total) * 100}%`, background: colorMap?.[key] || defaultColors[i % defaultColors.length], minWidth: val > 0 ? 4 : 0, transition: 'width 0.6s ease' }} />
                ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                {entries.map(([key, val], i) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: colorMap?.[key] || defaultColors[i % defaultColors.length] }} />
                        <span style={{ color: 'var(--text-muted)' }}>{key}</span>
                        <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{val}</span>
                        <span style={{ color: 'var(--text-dim)' }}>({((val / total) * 100).toFixed(0)}%)</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export const PublicAnalytics: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const result = await getPublicAnalytics();
            setData(result?.analytics || null);
        } catch { setData(null); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    const tierColorMap: Record<string, string> = { FREE: '#6b7280', STARTER: '#0ea5e9', PRO: '#a855f7', ENTERPRISE: '#f59e0b' };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Globe size={24} style={{ color: 'var(--accent-cyan)' }} />
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Agent Commerce Analytics</h1>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>AI 에이전트 커머스 시장 바로미터 — 실시간 공개 통계</p>
                    </div>
                </div>
                <button onClick={loadData} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <RefreshCw size={14} />
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={28} className="spin" style={{ color: 'var(--accent-cyan)' }} /></div>
            ) : !data ? (
                <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>데이터를 불러올 수 없습니다</div>
            ) : (
                <>
                    {/* KPI Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                        <KpiCard label="등록 에이전트" value={Number(data.total_agents || 0).toLocaleString()} icon={<Bot />} color="var(--accent-cyan)" sub="활성 AI 에이전트" />
                        <KpiCard label="등록 셀러" value={Number(data.total_sellers || 0).toLocaleString()} icon={<Store />} color="var(--accent-purple)" sub="입점 판매자" />
                        <KpiCard label="등록 상품" value={Number(data.total_products || 0).toLocaleString()} icon={<Package />} color="var(--accent-green)" sub="카탈로그 아이템" />
                        <KpiCard label="총 주문" value={Number(data.total_orders || 0).toLocaleString()} icon={<ShoppingCart />} color="var(--accent-amber)" sub="누적 거래 건수" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                        <KpiCard label="평균 신뢰도" value={String(data.avg_trust_score || 0)} icon={<Star />} color="var(--accent-green)" sub="에이전트 Trust Score" />
                        <KpiCard label="에이전트 리뷰" value={Number(data.total_reviews || 0).toLocaleString()} icon={<Star />} color="var(--accent-amber)" sub="구조화 리뷰 수" />
                        <KpiCard label="A2A 쿼리" value={Number(data.total_a2a_queries || 0).toLocaleString()} icon={<Radio />} color="var(--accent-purple)" sub="에이전트간 통신" />
                        <KpiCard label="최근 7일 주문" value={Number(data.recent_orders_7d || 0).toLocaleString()} icon={<TrendingUp />} color="var(--accent-cyan)" sub="이번 주 거래량" />
                    </div>

                    {/* Distribution Charts */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div className="glass-card" style={{ padding: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                                <Users size={14} style={{ color: 'var(--accent-purple)' }} />
                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>에이전트 티어 분포</span>
                            </div>
                            <DistributionBar data={data.tier_distribution || {}} colorMap={tierColorMap} />
                        </div>
                        <div className="glass-card" style={{ padding: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                                <Layers size={14} style={{ color: 'var(--accent-cyan)' }} />
                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>카테고리별 상품 분포</span>
                            </div>
                            <DistributionBar data={data.category_distribution || {}} />
                        </div>
                    </div>

                    {/* Market Insight */}
                    <div className="glass-card" style={{ padding: 16, background: 'rgba(0,255,200,0.03)', textAlign: 'center' }}>
                        <TrendingUp size={20} style={{ color: 'var(--accent-cyan)', marginBottom: 8 }} />
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>AI Agent Commerce Index</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', maxWidth: 500, margin: '0 auto' }}>
                            JSONMart는 AI 에이전트가 자율적으로 상거래를 수행하는 세계 최초의 마켓플레이스입니다.
                            이 대시보드는 AI 에이전트 커머스 생태계의 성장을 실시간으로 추적합니다.
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 8 }}>
                            Last updated: {data.generated_at ? new Date(data.generated_at).toLocaleString('ko') : '-'}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
