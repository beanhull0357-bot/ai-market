import React, { useState, useEffect, useCallback } from 'react';
import { Radio, RefreshCw, Search, Clock, CheckCircle2, XCircle, Loader2, Bot, MessageSquare } from 'lucide-react';
import { supabase } from '../supabaseClient';

/* ━━━ Types ━━━ */
interface A2AQuery {
    id: string;
    from_agent: string;
    query_type: string;
    sku: string | null;
    message: string;
    status: 'OPEN' | 'RESOLVED' | 'EXPIRED';
    responses: A2AResponse[];
    created_at: string;
}

interface A2AResponse {
    id: string;
    from_agent: string;
    message: string;
    created_at: string;
}

/* ━━━ Status Badge ━━━ */
function StatusBadge({ status }: { status: string }) {
    const config = status === 'OPEN'
        ? { label: 'OPEN', color: 'var(--accent-cyan)', bg: 'rgba(34,211,238,0.1)', icon: <Clock size={10} /> }
        : status === 'RESOLVED'
            ? { label: 'RESOLVED', color: 'var(--accent-green)', bg: 'rgba(52,211,153,0.1)', icon: <CheckCircle2 size={10} /> }
            : { label: 'EXPIRED', color: 'var(--text-dim)', bg: 'rgba(107,114,128,0.1)', icon: <XCircle size={10} /> };
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 'var(--radius-full)',
            background: config.bg, color: config.color,
            fontSize: 10, fontWeight: 700,
        }}>
            {config.icon} {config.label}
        </span>
    );
}

/* ━━━ Main Page ━━━ */
export function A2AMarket() {
    const [queries, setQueries] = useState<A2AQuery[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED' | 'EXPIRED'>('ALL');
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const loadQueries = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('a2a_queries')
                .select('*, a2a_responses(*)')
                .order('created_at', { ascending: false })
                .limit(100);
            if (!error && data) {
                setQueries(data.map((q: any) => ({
                    id: q.id,
                    from_agent: q.from_agent || q.agent_id || 'unknown',
                    query_type: q.query_type || 'general',
                    sku: q.sku || null,
                    message: q.message || q.content || '',
                    status: q.status || 'OPEN',
                    responses: (q.a2a_responses || []).map((r: any) => ({
                        id: r.id,
                        from_agent: r.from_agent || r.agent_id || 'unknown',
                        message: r.message || r.content || '',
                        created_at: r.created_at,
                    })),
                    created_at: q.created_at,
                })));
            } else {
                setQueries([]);
            }
        } catch {
            setQueries([]);
        }
        setLoading(false);
    }, []);

    useEffect(() => { loadQueries(); }, [loadQueries]);

    const filtered = queries.filter(q => {
        if (filter !== 'ALL' && q.status !== filter) return false;
        if (search) {
            const s = search.toLowerCase();
            return q.from_agent.toLowerCase().includes(s)
                || q.message.toLowerCase().includes(s)
                || (q.sku && q.sku.toLowerCase().includes(s))
                || q.query_type.toLowerCase().includes(s);
        }
        return true;
    });

    const counts = {
        ALL: queries.length,
        OPEN: queries.filter(q => q.status === 'OPEN').length,
        RESOLVED: queries.filter(q => q.status === 'RESOLVED').length,
        EXPIRED: queries.filter(q => q.status === 'EXPIRED').length,
    };

    const totalResponses = queries.reduce((sum, q) => sum + q.responses.length, 0);

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(168,85,247,0.15))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Radio size={20} style={{ color: 'var(--accent-cyan)' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>A2A Network Monitor</h1>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>에이전트 간 통신 모니터링 — 관리자 전용</p>
                    </div>
                </div>
                <button onClick={loadQueries} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                    borderRadius: 6, border: '1px solid var(--border-subtle)',
                    background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12,
                }}>
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{counts.ALL}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>총 쿼리</div>
                </div>
                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>{totalResponses}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>총 응답</div>
                </div>
                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>{counts.OPEN}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>대기중</div>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                    <Search size={14} style={{ color: 'var(--text-dim)' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search queries, SKUs, agents..."
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 12 }} />
                </div>
                {(['ALL', 'OPEN', 'RESOLVED', 'EXPIRED'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{
                        padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        fontSize: 11, fontWeight: 600,
                        background: filter === f ? (f === 'OPEN' ? 'var(--accent-cyan)' : f === 'RESOLVED' ? 'var(--accent-green)' : f === 'EXPIRED' ? 'var(--text-dim)' : 'var(--accent-purple)') : 'var(--bg-surface)',
                        color: filter === f ? '#000' : 'var(--text-muted)',
                    }}>
                        {f} {counts[f] > 0 && <span style={{ marginLeft: 4, opacity: 0.7 }}>({counts[f]})</span>}
                    </button>
                ))}
            </div>

            {/* Query List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                    <Loader2 size={24} className="spin" style={{ margin: '0 auto 12px' }} />
                    <p style={{ fontSize: 13 }}>쿼리 로딩 중...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
                    <Radio size={32} style={{ color: 'var(--text-dim)', margin: '0 auto 12px' }} />
                    <div style={{ color: 'var(--text-dim)', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>A2A 쿼리 없음</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                        에이전트가 MCP <code style={{ color: 'var(--accent-cyan)' }}>a2a_broadcast</code> tool로 쿼리를 보내면 여기에 표시됩니다
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filtered.map(q => (
                        <div key={q.id} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                            <div onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}>
                                <Bot size={16} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{q.from_agent}</span>
                                        <StatusBadge status={q.status} />
                                        {q.sku && (
                                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '1px 6px', borderRadius: 'var(--radius-full)', background: 'rgba(168,85,247,0.1)', color: 'var(--accent-purple)' }}>
                                                {q.sku}
                                            </span>
                                        )}
                                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 'var(--radius-full)', background: 'rgba(251,191,36,0.1)', color: 'var(--accent-amber)' }}>
                                            {q.query_type}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {q.message}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-purple)', fontFamily: 'var(--font-mono)' }}>
                                        <MessageSquare size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> {q.responses.length}
                                    </div>
                                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                                        {new Date(q.created_at).toLocaleString('ko', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>

                            {/* Expanded: Responses */}
                            {expandedId === q.id && q.responses.length > 0 && (
                                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 12, marginBottom: 8, fontWeight: 600 }}>응답 ({q.responses.length})</div>
                                    {q.responses.map(r => (
                                        <div key={r.id} style={{ padding: '8px 12px', marginBottom: 6, borderRadius: 6, background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.1)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-purple)' }}>{r.from_agent}</span>
                                                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{new Date(r.created_at).toLocaleString('ko')}</span>
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.message}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
