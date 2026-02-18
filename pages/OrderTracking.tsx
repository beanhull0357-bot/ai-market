import React, { useState, useEffect } from 'react';
import { Truck, Package, CheckCircle2, Clock, AlertTriangle, MapPin, ArrowRight, Loader2, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useOrders } from '../hooks';

/* ━━━ Timeline Step ━━━ */
function TimelineStep({ label, time, active, completed, last }: {
    key?: string; label: string; time?: string; active: boolean; completed: boolean; last?: boolean;
}) {
    return (
        <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: completed ? 'var(--accent-green)' : active ? 'var(--accent-cyan)' : 'var(--bg-surface)',
                    border: `2px solid ${completed ? 'var(--accent-green)' : active ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: active ? '0 0 12px rgba(34,211,238,0.3)' : 'none',
                }}>
                    {completed ? <CheckCircle2 size={12} style={{ color: '#fff' }} /> :
                        active ? <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} /> : null}
                </div>
                {!last && (
                    <div style={{
                        width: 2, height: 32, background: completed ? 'var(--accent-green)' : 'var(--border-subtle)',
                    }} />
                )}
            </div>
            <div style={{ paddingTop: 2, paddingBottom: last ? 0 : 20 }}>
                <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: completed || active ? 'var(--text-primary)' : 'var(--text-dim)',
                }}>{label}</div>
                {time && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{time}</div>}
            </div>
        </div>
    );
}

/* ━━━ Order Tracking Card ━━━ */
function TrackingCard({ order }: { key?: string; order: any }) {
    const [expanded, setExpanded] = useState(false);
    const steps = [
        { key: 'ORDER_CREATED', label: '주문 생성' },
        { key: 'PAYMENT_AUTHORIZED', label: '결제 승인' },
        { key: 'PROCUREMENT_PENDING', label: '조달 대기' },
        { key: 'PROCUREMENT_SENT', label: '조달 발송' },
        { key: 'SHIPPED', label: '배송 중' },
        { key: 'DELIVERED', label: '배송 완료' },
    ];
    const currentIdx = steps.findIndex(s => s.key === order.status);
    const isVoided = order.status === 'VOIDED';

    return (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
                onClick={() => setExpanded(!expanded)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
            >
                {isVoided ? (
                    <AlertTriangle size={18} style={{ color: 'var(--accent-red)', flexShrink: 0 }} />
                ) : currentIdx >= 5 ? (
                    <CheckCircle2 size={18} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                ) : (
                    <Truck size={18} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                        {order.orderId}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {new Date(order.createdAt).toLocaleDateString('ko-KR')}
                    </div>
                </div>
                <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: isVoided ? 'rgba(239,68,68,0.1)' : currentIdx >= 5 ? 'rgba(52,211,153,0.1)' : 'rgba(34,211,238,0.1)',
                    color: isVoided ? 'var(--accent-red)' : currentIdx >= 5 ? 'var(--accent-green)' : 'var(--accent-cyan)',
                }}>
                    {isVoided ? '취소됨' : steps[currentIdx]?.label || order.status}
                </span>
                {expanded ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
            </div>

            {expanded && !isVoided && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ paddingTop: 16 }}>
                        {steps.map((s, i) => (
                            <TimelineStep
                                key={s.key}
                                label={s.label}
                                time={i <= currentIdx ? new Date(Date.now() - (currentIdx - i) * 86400000).toLocaleString('ko-KR') : undefined}
                                completed={i < currentIdx}
                                active={i === currentIdx}
                                last={i === steps.length - 1}
                            />
                        ))}
                    </div>
                    <div style={{
                        marginTop: 12, padding: 10, borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-surface)', fontSize: 11, color: 'var(--text-muted)',
                    }}>
                        💡 에이전트 API: <code style={{ color: 'var(--accent-cyan)' }}>get_order_events(order_id: "{order.orderId}")</code>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ━━━ Main Page ━━━ */
export const OrderTracking: React.FC = () => {
    const { orders, loading } = useOrders();
    const [search, setSearch] = useState('');

    const filtered = search
        ? orders.filter(o => o.orderId.toLowerCase().includes(search.toLowerCase()))
        : orders;

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Truck size={24} style={{ color: 'var(--accent-cyan)' }} />
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Order Tracking</h1>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>주문 상태 추적 타임라인</p>
                    </div>
                </div>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                }}>
                    <Search size={14} style={{ color: 'var(--text-muted)' }} />
                    <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="주문번호 검색..."
                        style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13 }}
                    />
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                    <Loader2 size={24} className="spin" style={{ margin: '0 auto 12px' }} />
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
                    <Truck size={40} style={{ color: 'var(--text-dim)', margin: '0 auto 12px' }} />
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>주문 내역이 없습니다</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{filtered.length}건</div>
                    {filtered.map(o => <TrackingCard key={o.orderId} order={o} />)}
                </div>
            )}
        </div>
    );
};
