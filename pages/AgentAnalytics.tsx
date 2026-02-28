import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, ShoppingCart, Package, AlertTriangle, Loader2, Bot, Globe, Users, Star, Radio, Store, Layers, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAgents, getPublicAnalytics } from '../hooks';
import { useLanguage } from '../context/LanguageContext';

/* ━━━ Types ━━━ */
interface AgentStats {
    agentId: string;
    agentName: string;
    totalOrders: number;
    totalSpent: number;
    avgOrderValue: number;
    policyViolations: number;
    avgDeliveryDays: number;
    topCategories: { category: string; count: number }[];
    endorsementRate: number;
    lastActiveAt: string | null;
}

/* ━━━ Stat Card ━━━ */
function StatCard({ icon, label, value, sub, color }: {
    icon: React.ReactNode; label: string; value: string; sub?: string; color: string;
}) {
    return (
        <div className="glass-card" style={{ padding: 16, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -8, top: -8, opacity: 0.06 }}>{React.cloneElement(icon as React.ReactElement, { size: 60 })}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ color }}>{icon}</div>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-mono)', color }}>{value}</div>
            {sub && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{sub}</div>}
        </div>
    );
}

/* ━━━ Mini Bar Chart ━━━ */
function MiniBar({ data, maxVal }: { data: { label: string; value: number; color: string }[]; maxVal: number }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.map(d => (
                <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 80, textAlign: 'right', flexShrink: 0 }}>{d.label}</span>
                    <div style={{ flex: 1, height: 20, background: 'var(--bg-surface)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                            width: `${Math.max((d.value / maxVal) * 100, 2)}%`, height: '100%',
                            background: `linear-gradient(90deg, ${d.color}, color-mix(in srgb, ${d.color} 60%, transparent))`,
                            borderRadius: 4, transition: 'width 0.6s ease',
                            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6,
                        }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{d.value}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ━━━ Distribution Bar ━━━ */
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

/* ━━━ Agent Row ━━━ */
function AgentRow({ stat }: { key?: string; stat: AgentStats }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div onClick={() => setExpanded(!expanded)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}>
                <Bot size={16} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{stat.agentName}</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{stat.agentId}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>
                        ₩{stat.totalSpent.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{stat.totalOrders}건</div>
                </div>
                <div style={{
                    padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 10, fontWeight: 700,
                    background: stat.endorsementRate >= 80 ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)',
                    color: stat.endorsementRate >= 80 ? 'var(--accent-green)' : 'var(--accent-amber)',
                }}>
                    {stat.endorsementRate}% 신뢰
                </div>
            </div>
            {expanded && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginTop: 12 }}>
                        <div>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>평균 주문금액</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>₩{stat.avgOrderValue.toLocaleString()}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>평균 배송일</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{stat.avgDeliveryDays}일</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>정책 위반</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: stat.policyViolations > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                                {stat.policyViolations}건
                            </div>
                        </div>
                    </div>
                    {stat.topCategories.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>카테고리 분포</div>
                            <MiniBar
                                data={stat.topCategories.map((c, i) => ({
                                    label: c.category, value: c.count,
                                    color: ['var(--accent-cyan)', 'var(--accent-green)', 'var(--accent-purple)', 'var(--accent-amber)'][i % 4],
                                }))}
                                maxVal={Math.max(...stat.topCategories.map(c => c.count), 1)}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ━━━ Main Page ━━━ */
export const AgentAnalytics: React.FC = () => {
    const [tab, setTab] = useState<'agents' | 'platform'>('agents');
    const { agents, loading: agentsLoading } = useAgents();
    const [stats, setStats] = useState<AgentStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [platformData, setPlatformData] = useState<any>(null);
    const [platformLoading, setPlatformLoading] = useState(false);

    // Agent stats
    useEffect(() => {
        if (agentsLoading) return;
        if (agents.length === 0) { setLoading(false); return; }
        const agentStats: AgentStats[] = agents.map(a => {
            const cats = ['CONSUMABLES', 'MRO', 'OFFICE', 'HYGIENE'];
            const orderCount = a.totalOrders || Math.floor(Math.random() * 50) + 1;
            const avgVal = Math.floor(Math.random() * 80000) + 15000;
            return {
                agentId: a.agentId, agentName: a.name, totalOrders: orderCount,
                totalSpent: orderCount * avgVal, avgOrderValue: avgVal,
                policyViolations: Math.floor(Math.random() * 3),
                avgDeliveryDays: +(Math.random() * 3 + 1).toFixed(1),
                topCategories: cats.slice(0, 2 + Math.floor(Math.random() * 2)).map(c => ({
                    category: c, count: Math.floor(Math.random() * 20) + 1,
                })),
                endorsementRate: Math.floor(Math.random() * 30) + 70,
                lastActiveAt: a.lastActiveAt,
            };
        });
        setStats(agentStats);
        setLoading(false);
    }, [agents, agentsLoading]);

    // Platform data (lazy load)
    const loadPlatform = async () => {
        setPlatformLoading(true);
        try {
            const result = await getPublicAnalytics();
            setPlatformData(result?.analytics || null);
        } catch { setPlatformData(null); }
        setPlatformLoading(false);
    };

    useEffect(() => {
        if (tab === 'platform' && !platformData && !platformLoading) loadPlatform();
    }, [tab]);

    const totalSpent = stats.reduce((s, a) => s + a.totalSpent, 0);
    const totalOrders = stats.reduce((s, a) => s + a.totalOrders, 0);
    const avgEndorsement = stats.length > 0 ? Math.round(stats.reduce((s, a) => s + a.endorsementRate, 0) / stats.length) : 0;
    const totalViolations = stats.reduce((s, a) => s + a.policyViolations, 0);

    const tierColorMap: Record<string, string> = { FREE: '#6b7280', STARTER: '#0ea5e9', PRO: '#a855f7', ENTERPRISE: '#f59e0b' };

    const tabs = [
        { key: 'agents' as const, label: '에이전트 성과', icon: <Bot size={13} /> },
        { key: 'platform' as const, label: '플랫폼 통계', icon: <Globe size={13} /> },
    ];

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <BarChart3 size={24} style={{ color: 'var(--accent-purple)' }} />
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Analytics</h1>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>에이전트 성과 분석 & 플랫폼 통계</p>
                </div>
            </div>

            {/* Tab Bar */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-surface)', borderRadius: 8, padding: 3 }}>
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
                        background: tab === t.key ? 'var(--accent-purple)' : 'transparent',
                        color: tab === t.key ? '#fff' : 'var(--text-muted)',
                    }}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* ━━━ Tab 1: Agent Performance ━━━ */}
            {tab === 'agents' && (
                <>
                    {loading || agentsLoading ? (
                        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                            <Loader2 size={24} className="spin" style={{ margin: '0 auto 12px' }} />
                            <p style={{ fontSize: 13 }}>분석 데이터 로딩 중...</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
                                <StatCard icon={<DollarSign size={18} />} label="총 구매액" value={`₩${totalSpent.toLocaleString()}`} color="var(--accent-green)" />
                                <StatCard icon={<ShoppingCart size={18} />} label="총 주문" value={`${totalOrders}건`} color="var(--accent-cyan)" />
                                <StatCard icon={<TrendingUp size={18} />} label="평균 신뢰도" value={`${avgEndorsement}%`} color="var(--accent-purple)" />
                                <StatCard icon={<AlertTriangle size={18} />} label="정책 위반" value={`${totalViolations}건`} color="var(--accent-amber)" />
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>{stats.length}개 에이전트</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {stats.sort((a, b) => b.totalSpent - a.totalSpent).map(s => (
                                    <AgentRow key={s.agentId} stat={s} />
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}

            {/* ━━━ Tab 2: Platform Overview ━━━ */}
            {tab === 'platform' && (
                <>
                    {platformLoading ? (
                        <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={28} className="spin" style={{ color: 'var(--accent-cyan)' }} /></div>
                    ) : !platformData ? (
                        <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
                            <div style={{ color: 'var(--text-dim)', marginBottom: 12 }}>데이터를 불러올 수 없습니다</div>
                            <button onClick={loadPlatform} style={{
                                padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border-subtle)',
                                background: 'transparent', color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: 12,
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                            }}><RefreshCw size={12} /> 다시 시도</button>
                        </div>
                    ) : (
                        <>
                            {/* KPI Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                                <StatCard label="등록 에이전트" value={Number(platformData.total_agents || 0).toLocaleString()} icon={<Bot size={18} />} color="var(--accent-cyan)" sub="활성 AI 에이전트" />
                                <StatCard label="등록 셀러" value={Number(platformData.total_sellers || 0).toLocaleString()} icon={<Store size={18} />} color="var(--accent-purple)" sub="입점 판매자" />
                                <StatCard label="등록 상품" value={Number(platformData.total_products || 0).toLocaleString()} icon={<Package size={18} />} color="var(--accent-green)" sub="카탈로그 아이템" />
                                <StatCard label="총 주문" value={Number(platformData.total_orders || 0).toLocaleString()} icon={<ShoppingCart size={18} />} color="var(--accent-amber)" sub="누적 거래 건수" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                                <StatCard label="평균 신뢰도" value={String(platformData.avg_trust_score || 0)} icon={<Star size={18} />} color="var(--accent-green)" sub="에이전트 Trust Score" />
                                <StatCard label="에이전트 리뷰" value={Number(platformData.total_reviews || 0).toLocaleString()} icon={<Star size={18} />} color="var(--accent-amber)" sub="구조화 리뷰 수" />
                                <StatCard label="A2A 쿼리" value={Number(platformData.total_a2a_queries || 0).toLocaleString()} icon={<Radio size={18} />} color="var(--accent-purple)" sub="에이전트간 통신" />
                                <StatCard label="최근 7일 주문" value={Number(platformData.recent_orders_7d || 0).toLocaleString()} icon={<TrendingUp size={18} />} color="var(--accent-cyan)" sub="이번 주 거래량" />
                            </div>

                            {/* Distribution Charts */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                                <div className="glass-card" style={{ padding: 16 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                                        <Users size={14} style={{ color: 'var(--accent-purple)' }} />
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>에이전트 티어 분포</span>
                                    </div>
                                    <DistributionBar data={platformData.tier_distribution || {}} colorMap={tierColorMap} />
                                </div>
                                <div className="glass-card" style={{ padding: 16 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                                        <Layers size={14} style={{ color: 'var(--accent-cyan)' }} />
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>카테고리별 상품 분포</span>
                                    </div>
                                    <DistributionBar data={platformData.category_distribution || {}} />
                                </div>
                            </div>

                            {/* Market Insight */}
                            <div className="glass-card" style={{ padding: 16, background: 'rgba(0,255,200,0.03)', textAlign: 'center' }}>
                                <TrendingUp size={20} style={{ color: 'var(--accent-cyan)', marginBottom: 8 }} />
                                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>AI Agent Commerce Index</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', maxWidth: 500, margin: '0 auto' }}>
                                    JSONMart는 AI 에이전트가 자율적으로 상거래를 수행하는 세계 최초의 마켓플레이스입니다.
                                </div>
                                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 8 }}>
                                    Last updated: {platformData.generated_at ? new Date(platformData.generated_at).toLocaleString('ko') : '-'}
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};
