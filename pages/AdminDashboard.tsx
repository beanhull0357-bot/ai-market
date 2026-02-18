import React from 'react';
import { BarChart3, ShoppingCart, Bot, Package, TrendingUp, AlertTriangle, DollarSign, Clock, ArrowUpRight, ArrowDownRight, Activity, Loader2 } from 'lucide-react';
import { useOrders, useAgents, useProducts, useReviews } from '../hooks';

/* ━━━ KPI Card ━━━ */
function KpiCard({ label, value, sub, icon, color, trend }: {
    key?: string; label: string; value: string; sub?: string;
    icon: React.ReactNode; color: string; trend?: { value: string; up: boolean };
}) {
    return (
        <div className="glass-card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</div>
                    {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
                    {trend && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11, fontWeight: 700, color: trend.up ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {trend.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {trend.value}
                        </div>
                    )}
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${color} 12%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
                    {icon}
                </div>
            </div>
        </div>
    );
}

/* ━━━ Activity Item ━━━ */
function ActivityItem({ icon, text, time, color }: { key?: string; icon: React.ReactNode; text: string; time: string; color: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `color-mix(in srgb, ${color} 12%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>{icon}</div>
            <div style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)' }}>{text}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>{time}</div>
        </div>
    );
}

/* ━━━ Bar (simple horizontal) ━━━ */
function HBar({ label, value, max, color }: { key?: string; label: string; value: number; max: number; color: string }) {
    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${(value / max) * 100}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
            </div>
        </div>
    );
}

/* ━━━ Main Page ━━━ */
export const AdminDashboard: React.FC = () => {
    const { orders, loading: ol } = useOrders();
    const { agents, loading: al } = useAgents();
    const { products, loading: pl } = useProducts();
    const { reviews } = useReviews();

    if (ol || al || pl) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
            <Loader2 size={28} className="spin" style={{ color: 'var(--accent-cyan)' }} />
        </div>
    );

    const totalRevenue = orders.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const pendingOrders = orders.filter(o => o.status === 'ORDER_CREATED').length;
    const avgTrust = agents.length ? (agents.reduce((s, a) => s + (a.trustScore || 0), 0) / agents.length).toFixed(1) : '0';

    const catCounts: Record<string, number> = {};
    orders.forEach(o => { const c = o.category || 'OTHER'; catCounts[c] = (catCounts[c] || 0) + 1; });
    const maxCat = Math.max(...Object.values(catCounts), 1);

    const recentActivity = [
        { icon: <ShoppingCart size={12} />, text: `새 주문 ${pendingOrders}건 대기 중`, time: '방금', color: 'var(--accent-green)' },
        { icon: <Bot size={12} />, text: `등록 에이전트 ${agents.length}개 활성`, time: '오늘', color: 'var(--accent-cyan)' },
        { icon: <Package size={12} />, text: `카탈로그 상품 ${products.length}개`, time: '오늘', color: 'var(--accent-purple)' },
        { icon: <Activity size={12} />, text: `리뷰 ${reviews.length}건 누적`, time: '전체', color: 'var(--accent-amber)' },
    ];

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <BarChart3 size={24} style={{ color: 'var(--accent-cyan)' }} />
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Dashboard</h1>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>JSONMart 운영 현황 한눈에 보기</p>
                </div>
            </div>

            {/* KPI Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
                <KpiCard label="총 매출" value={`₩${totalRevenue.toLocaleString()}`} icon={<DollarSign size={18} />} color="var(--accent-green)" trend={{ value: '+12.5%', up: true }} />
                <KpiCard label="총 주문" value={`${orders.length}`} sub={`대기 ${pendingOrders}건`} icon={<ShoppingCart size={18} />} color="var(--accent-cyan)" trend={{ value: '+8건', up: true }} />
                <KpiCard label="활성 에이전트" value={`${agents.length}`} sub={`평균 신뢰도 ${avgTrust}`} icon={<Bot size={18} />} color="var(--accent-purple)" />
                <KpiCard label="카탈로그" value={`${products.length}`} sub="상품" icon={<Package size={18} />} color="var(--accent-amber)" />
            </div>

            {/* Two columns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                {/* Recent Activity */}
                <div className="glass-card" style={{ padding: 18 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📋 최근 활동</div>
                    {recentActivity.map((a, i) => <ActivityItem key={String(i)} {...a} />)}
                    {pendingOrders > 0 && (
                        <div style={{ marginTop: 12, padding: 10, borderRadius: 'var(--radius-md)', background: 'rgba(251,191,36,0.08)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--accent-amber)' }}>
                            <AlertTriangle size={14} /> 승인 대기 주문 {pendingOrders}건
                        </div>
                    )}
                </div>

                {/* Category Distribution */}
                <div className="glass-card" style={{ padding: 18 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📊 카테고리별 주문</div>
                    {Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([cat, cnt]) => (
                        <HBar key={cat} label={cat} value={cnt} max={maxCat} color="var(--accent-cyan)" />
                    ))}
                    {Object.keys(catCounts).length === 0 && (
                        <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-dim)', fontSize: 12 }}>주문 데이터가 없습니다</div>
                    )}
                </div>
            </div>
        </div>
    );
};
