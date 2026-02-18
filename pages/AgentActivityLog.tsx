import React, { useState } from 'react';
import { Activity, Search, Bot, ShoppingCart, Star, MessageSquare, Key, Filter, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useAgents, useOrders, useReviews } from '../hooks';

/* ━━━ Types ━━━ */
type EventType = 'ORDER' | 'REVIEW' | 'QUESTION' | 'AUTH' | 'CATALOG' | 'POLICY';

interface LogEntry {
    id: string; agentName: string; agentId: string;
    type: EventType; action: string; detail: string;
    timestamp: string; statusCode: number;
}

const TYPE_CONFIG: Record<EventType, { icon: React.ReactNode; color: string; label: string }> = {
    ORDER: { icon: <ShoppingCart size={12} />, color: 'var(--accent-green)', label: '주문' },
    REVIEW: { icon: <Star size={12} />, color: 'var(--accent-amber)', label: '리뷰' },
    QUESTION: { icon: <MessageSquare size={12} />, color: 'var(--accent-cyan)', label: 'Q&A' },
    AUTH: { icon: <Key size={12} />, color: 'var(--accent-purple)', label: '인증' },
    CATALOG: { icon: <Bot size={12} />, color: 'var(--text-muted)', label: '카탈로그' },
    POLICY: { icon: <Filter size={12} />, color: 'var(--accent-red)', label: '정책' },
};

function generateLogs(agents: any[], orders: any[]): LogEntry[] {
    const logs: LogEntry[] = [];
    let id = 0;
    const now = Date.now();
    agents.forEach(a => {
        logs.push({ id: `L-${++id}`, agentName: a.name, agentId: a.agentId, type: 'AUTH', action: 'authenticate_agent', detail: `API 키 인증 성공`, timestamp: new Date(now - Math.random() * 3600000).toISOString(), statusCode: 200 });
        logs.push({ id: `L-${++id}`, agentName: a.name, agentId: a.agentId, type: 'CATALOG', action: 'get_product_feed', detail: `카탈로그 조회`, timestamp: new Date(now - Math.random() * 7200000).toISOString(), statusCode: 200 });
    });
    orders.slice(0, 10).forEach(o => {
        const a = agents.find(ag => ag.agentId === o.agentId) || { name: o.agentId || 'Unknown', agentId: o.agentId || '' };
        logs.push({ id: `L-${++id}`, agentName: a.name, agentId: a.agentId, type: 'ORDER', action: 'agent_create_order', detail: `주문 ${o.orderId} 생성 (₩${(o.totalPrice || 0).toLocaleString()})`, timestamp: o.createdAt || new Date(now - Math.random() * 86400000).toISOString(), statusCode: 200 });
    });
    agents.slice(0, 3).forEach(a => {
        logs.push({ id: `L-${++id}`, agentName: a.name, agentId: a.agentId, type: 'REVIEW', action: 'agent_create_review', detail: `리뷰 제출 (ENDORSE)`, timestamp: new Date(now - Math.random() * 86400000).toISOString(), statusCode: 200 });
    });
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/* ━━━ Main Page ━━━ */
export const AgentActivityLog: React.FC = () => {
    const { agents } = useAgents();
    const { orders } = useOrders();
    const [filterType, setFilterType] = useState<EventType | ''>('');
    const [search, setSearch] = useState('');

    const logs = generateLogs(agents, orders);
    const filtered = logs.filter(l =>
        (!filterType || l.type === filterType) &&
        (!search || l.agentName.toLowerCase().includes(search.toLowerCase()) || l.action.includes(search) || l.detail.toLowerCase().includes(search.toLowerCase()))
    );

    const timeSince = (d: string) => {
        const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
        if (s < 60) return `${s}초 전`;
        if (s < 3600) return `${Math.floor(s / 60)}분 전`;
        if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
        return `${Math.floor(s / 86400)}일 전`;
    };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Activity size={24} style={{ color: 'var(--accent-cyan)' }} />
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Activity Log</h1>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>에이전트 API 호출 이력</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                        <Search size={14} style={{ color: 'var(--text-muted)' }} />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="검색..." style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 12, width: 120 }} />
                    </div>
                    <select value={filterType} onChange={e => setFilterType(e.target.value as any)} style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '6px 10px', fontSize: 11 }}>
                        <option value="">전체 유형</option>
                        {(Object.keys(TYPE_CONFIG) as EventType[]).map(t => <option key={t} value={t}>{TYPE_CONFIG[t].label}</option>)}
                    </select>
                </div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>{filtered.length}건</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filtered.map(log => {
                    const tc = TYPE_CONFIG[log.type];
                    return (
                        <div key={log.id} className="glass-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `color-mix(in srgb, ${tc.color} 12%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tc.color, flexShrink: 0 }}>{tc.icon}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{log.agentName}</span>
                                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 'var(--radius-full)', background: `color-mix(in srgb, ${tc.color} 12%, transparent)`, color: tc.color, fontWeight: 600 }}>{tc.label}</span>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    <code style={{ color: 'var(--accent-cyan)', fontSize: 10 }}>{log.action}</code> — {log.detail}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: log.statusCode < 400 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{log.statusCode}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{timeSince(log.timestamp)}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
