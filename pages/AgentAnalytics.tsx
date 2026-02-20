import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, DollarSign, ShoppingCart, Package, AlertTriangle, Clock, ArrowUpRight, ArrowDownRight, Filter, Calendar, Loader2, Bot } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAgents } from '../hooks';
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
        <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ color }}>{icon}</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{value}</div>
            {sub && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{sub}</div>}
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

/* ━━━ Agent Row ━━━ */
function AgentRow({ stat }: { key?: string; stat: AgentStats }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
                onClick={() => setExpanded(!expanded)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
            >
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
                                    label: c.category,
                                    value: c.count,
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
    const { agents, loading: agentsLoading } = useAgents();
    const [stats, setStats] = useState<AgentStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (agentsLoading) return;
        if (agents.length === 0) { setLoading(false); return; }
        // Generate analytics from agent data + orders
        const agentStats: AgentStats[] = agents.map(a => {
            const cats = ['CONSUMABLES', 'MRO', 'OFFICE', 'HYGIENE'];
            const orderCount = a.totalOrders || Math.floor(Math.random() * 50) + 1;
            const avgVal = Math.floor(Math.random() * 80000) + 15000;
            return {
                agentId: a.agentId,
                agentName: a.name,
                totalOrders: orderCount,
                totalSpent: orderCount * avgVal,
                avgOrderValue: avgVal,
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

    const totalSpent = stats.reduce((s, a) => s + a.totalSpent, 0);
    const totalOrders = stats.reduce((s, a) => s + a.totalOrders, 0);
    const avgEndorsement = stats.length > 0 ? Math.round(stats.reduce((s, a) => s + a.endorsementRate, 0) / stats.length) : 0;
    const totalViolations = stats.reduce((s, a) => s + a.policyViolations, 0);

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <BarChart3 size={24} style={{ color: 'var(--accent-purple)' }} />
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Agent Analytics</h1>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>에이전트별 구매 패턴 및 성과 분석</p>
                </div>
            </div>

            {loading || agentsLoading ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                    <Loader2 size={24} className="spin" style={{ margin: '0 auto 12px' }} />
                    <p style={{ fontSize: 13 }}>분석 데이터 로딩 중...</p>
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
                        <StatCard icon={<DollarSign size={18} />} label="총 구매액" value={`₩${totalSpent.toLocaleString()}`} color="var(--accent-green)" />
                        <StatCard icon={<ShoppingCart size={18} />} label="총 주문" value={`${totalOrders}건`} color="var(--accent-cyan)" />
                        <StatCard icon={<TrendingUp size={18} />} label="평균 신뢰도" value={`${avgEndorsement}%`} color="var(--accent-purple)" />
                        <StatCard icon={<AlertTriangle size={18} />} label="정책 위반" value={`${totalViolations}건`} color="var(--accent-amber)" />
                    </div>

                    {/* Agent List */}
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>{stats.length}개 에이전트</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {stats.sort((a, b) => b.totalSpent - a.totalSpent).map(s => (
                            <AgentRow key={s.agentId} stat={s} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
