import React, { useState, useEffect, useCallback } from 'react';
import { Handshake, Bot, CheckCircle2, XCircle, Clock, RefreshCw, Search, Loader2, TrendingDown, ArrowRight, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabaseClient';

/* ━━━ Types ━━━ */
interface NegotiationRecord {
    id: string;
    negotiation_id: string;
    sku: string;
    product_title: string;
    list_price: number;
    final_price: number | null;
    policy_budget: number | null;
    buyer_agent_id: string;
    seller_agent_id: string;
    status: string;
    rounds: any[];
    max_rounds: number;
    created_at: string;
}

/* ━━━ Status Badge ━━━ */
function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
        AGREED: { label: '합의', color: 'var(--accent-green)', bg: 'rgba(52,211,153,0.1)', icon: <CheckCircle2 size={10} /> },
        REJECTED: { label: '결렬', color: 'var(--accent-red)', bg: 'rgba(239,68,68,0.1)', icon: <XCircle size={10} /> },
        PENDING: { label: '대기', color: 'var(--accent-amber)', bg: 'rgba(251,191,36,0.1)', icon: <Clock size={10} /> },
        PENDING_SELLER: { label: '셀러 대기', color: 'var(--accent-amber)', bg: 'rgba(251,191,36,0.15)', icon: <AlertTriangle size={10} /> },
        NEGOTIATING: { label: '진행중', color: 'var(--accent-cyan)', bg: 'rgba(34,211,238,0.1)', icon: <ArrowRight size={10} /> },
        COUNTER: { label: '역제안', color: 'var(--accent-purple)', bg: 'rgba(168,85,247,0.1)', icon: <ArrowRight size={10} /> },
    };
    const s = map[status] || map.PENDING;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: s.bg, color: s.color, fontSize: 10, fontWeight: 700 }}>
            {s.icon} {s.label}
        </span>
    );
}

/* ━━━ Main Component ━━━ */
export default function NegotiationCenter() {
    const [negotiations, setNegotiations] = useState<NegotiationRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'AGREED' | 'REJECTED' | 'PENDING'>('ALL');
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('negotiations')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);
            if (!error && data) setNegotiations(data);
            else setNegotiations([]);
        } catch { setNegotiations([]); }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = negotiations.filter(n => {
        if (filter !== 'ALL' && n.status !== filter) return false;
        if (search) {
            const s = search.toLowerCase();
            return n.negotiation_id?.toLowerCase().includes(s)
                || n.sku?.toLowerCase().includes(s)
                || n.product_title?.toLowerCase().includes(s)
                || n.buyer_agent_id?.toLowerCase().includes(s);
        }
        return true;
    });

    const counts = {
        ALL: negotiations.length,
        AGREED: negotiations.filter(n => n.status === 'AGREED').length,
        REJECTED: negotiations.filter(n => n.status === 'REJECTED').length,
        PENDING: negotiations.filter(n => !['AGREED', 'REJECTED'].includes(n.status)).length,
    };

    const avgDiscount = negotiations.filter(n => n.status === 'AGREED' && n.final_price && n.list_price)
        .reduce((acc, n, _, arr) => acc + ((1 - n.final_price! / n.list_price) * 100) / arr.length, 0);

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.15))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Handshake size={20} style={{ color: 'var(--accent-amber)' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Negotiation Monitor</h1>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>에이전트 가격 협상 이력 — 관리자 전용</p>
                    </div>
                </div>
                <button onClick={load} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                    borderRadius: 6, border: '1px solid var(--border-subtle)',
                    background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12,
                }}>
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{counts.ALL}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>총 협상</div>
                </div>
                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>{counts.AGREED}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>합의</div>
                </div>
                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>{counts.REJECTED}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>결렬</div>
                </div>
                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent-purple)', fontFamily: 'var(--font-mono)' }}>{avgDiscount.toFixed(1)}%</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>평균 할인율</div>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                    <Search size={14} style={{ color: 'var(--text-dim)' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="검색 (SKU, 에이전트, 협상ID)..."
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 12 }} />
                </div>
                {(['ALL', 'AGREED', 'REJECTED', 'PENDING'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{
                        padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        fontSize: 11, fontWeight: 600,
                        background: filter === f ? (f === 'AGREED' ? 'var(--accent-green)' : f === 'REJECTED' ? 'var(--accent-red)' : f === 'PENDING' ? 'var(--accent-amber)' : 'var(--accent-cyan)') : 'var(--bg-surface)',
                        color: filter === f ? '#000' : 'var(--text-muted)',
                    }}>
                        {f === 'ALL' ? '전체' : f === 'AGREED' ? '합의' : f === 'REJECTED' ? '결렬' : '진행중'}
                        {counts[f] > 0 && <span style={{ marginLeft: 4, opacity: 0.7 }}>({counts[f]})</span>}
                    </button>
                ))}
            </div>

            {/* Negotiation List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                    <Loader2 size={24} className="spin" style={{ margin: '0 auto 12px' }} />
                    <p style={{ fontSize: 13 }}>협상 이력 로딩 중...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
                    <Handshake size={32} style={{ color: 'var(--text-dim)', margin: '0 auto 12px' }} />
                    <div style={{ color: 'var(--text-dim)', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>협상 이력 없음</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                        에이전트가 MCP <code style={{ color: 'var(--accent-amber)' }}>negotiate_price</code> tool로 협상하면 여기에 기록됩니다
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filtered.map(neg => {
                        const discount = neg.final_price && neg.list_price ? ((1 - neg.final_price / neg.list_price) * 100).toFixed(1) : null;
                        const isExpanded = expandedId === neg.negotiation_id;
                        return (
                            <div key={neg.negotiation_id || neg.id} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                                <div onClick={() => setExpandedId(isExpanded ? null : neg.negotiation_id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}>
                                    <Handshake size={16} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{neg.product_title || neg.sku}</span>
                                            <StatusBadge status={neg.status} />
                                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '1px 6px', borderRadius: 'var(--radius-full)', background: 'rgba(168,85,247,0.1)', color: 'var(--accent-purple)' }}>
                                                {neg.sku}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                                            <span><Bot size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> {neg.buyer_agent_id}</span>
                                            <span>정가 ₩{neg.list_price?.toLocaleString()}</span>
                                            {neg.final_price && <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>→ ₩{neg.final_price.toLocaleString()} ({discount}% ↓)</span>}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                                            {new Date(neg.created_at).toLocaleString('ko', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                                            {(neg.rounds?.length || 0)} rounds
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded: Round Timeline */}
                                {isExpanded && neg.rounds && neg.rounds.length > 0 && (
                                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 12, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>협상 과정</div>
                                        {neg.rounds.map((r: any, i: number) => {
                                            const isBuyer = r.proposedBy === 'buyer' || r.proposed_by === 'buyer';
                                            return (
                                                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                                                    <div style={{
                                                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                                                        background: isBuyer ? 'rgba(52,211,153,0.1)' : 'rgba(168,85,247,0.1)',
                                                        border: `1px solid ${isBuyer ? 'var(--accent-green)' : 'var(--accent-purple)'}`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    }}>
                                                        <Bot size={11} style={{ color: isBuyer ? 'var(--accent-green)' : 'var(--accent-purple)' }} />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span style={{ fontSize: 10, fontWeight: 700, color: isBuyer ? 'var(--accent-green)' : 'var(--accent-purple)' }}>
                                                                {isBuyer ? '구매 에이전트' : '셀러 에이전트'} · R{r.round}
                                                            </span>
                                                            <span style={{ fontSize: 13, fontWeight: 900, fontFamily: 'var(--font-mono)', color: isBuyer ? 'var(--accent-green)' : 'var(--accent-purple)' }}>
                                                                ₩{r.price?.toLocaleString()}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{r.message}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Final result */}
                                        {(neg.status === 'AGREED' || neg.status === 'REJECTED') && (
                                            <div style={{
                                                padding: '10px 14px', borderRadius: 8, textAlign: 'center', marginTop: 8,
                                                background: neg.status === 'AGREED' ? 'rgba(52,211,153,0.06)' : 'rgba(239,68,68,0.06)',
                                                border: `1px solid ${neg.status === 'AGREED' ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)'}`,
                                            }}>
                                                <div style={{ fontSize: 13, fontWeight: 900, color: neg.status === 'AGREED' ? 'var(--accent-green)' : 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                                    {neg.status === 'AGREED' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                                    {neg.status === 'AGREED' ? '합의 완료' : '협상 결렬'}
                                                    {neg.final_price && <span style={{ fontFamily: 'var(--font-mono)' }}> — ₩{neg.final_price.toLocaleString()} ({discount}% 할인)</span>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
