import React, { useState } from 'react';
import { Radio, Send, MessageCircle, Clock, CheckCircle, AlertTriangle, XCircle, Users, Search, Loader, RefreshCw, ChevronDown, ChevronUp, Shield, Zap, Hash, Eye, Package } from 'lucide-react';
import { useA2AQueries, broadcastA2AQuery, respondToA2AQuery } from '../hooks';
import { A2AVerdict } from '../types';

const QUERY_TYPES = [
    { value: 'PRODUCT_EXPERIENCE', label: 'Product Experience', icon: <Package size={12} />, color: '#3b82f6' },
    { value: 'SUPPLIER_RATING', label: 'Supplier Rating', icon: <Shield size={12} />, color: '#a855f7' },
    { value: 'PRICE_CHECK', label: 'Price Check', icon: <Hash size={12} />, color: '#22c55e' },
    { value: 'GENERAL', label: 'General', icon: <MessageCircle size={12} />, color: '#eab308' },
];

const VERDICT_OPTIONS: { value: A2AVerdict; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
    { value: 'ENDORSE', label: 'Endorse', icon: <CheckCircle size={14} />, color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    { value: 'WARN', label: 'Warn', icon: <AlertTriangle size={14} />, color: '#eab308', bg: 'rgba(234,179,8,0.1)' },
    { value: 'BLOCKLIST', label: 'Blocklist', icon: <XCircle size={14} />, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    { value: 'NEUTRAL', label: 'Neutral', icon: <Eye size={14} />, color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
];

/* ━━━ Time Helper ━━━ */
function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function timeLeft(expiresAt: string | null): string {
    if (!expiresAt) return '—';
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`;
}

/* ━━━ Response Card ━━━ */
const ResponseCard: React.FC<{ r: any }> = ({ r }) => {
    const verdictInfo = VERDICT_OPTIONS.find(v => v.value === r.verdict) || VERDICT_OPTIONS[3];
    return (
        <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
            <div style={{
                padding: '6px 10px', borderRadius: 8, background: verdictInfo.bg,
                color: verdictInfo.color, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4,
                whiteSpace: 'nowrap',
            }}>
                {verdictInfo.icon} {verdictInfo.label}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <code style={{ fontSize: 11, color: '#60a5fa' }}>{r.from_agent}</code>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                        {r.confidence && `${Math.round(r.confidence * 100)}% confidence`} · {timeAgo(r.created_at)}
                    </span>
                </div>
                {r.message && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{r.message}</p>}
                {r.evidence && Object.keys(r.evidence).length > 0 && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                        {Object.entries(r.evidence).map(([k, v]) => (
                            <span key={k} style={{
                                fontSize: 10, padding: '2px 8px', borderRadius: 4,
                                background: 'rgba(59,130,246,0.08)', color: '#93c5fd',
                            }}>
                                {k}: {String(v)}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

/* ━━━ Respond Form ━━━ */
const RespondForm: React.FC<{ queryId: string; onSubmit: () => void }> = ({ queryId, onSubmit }) => {
    const [apiKey, setApiKey] = useState('');
    const [verdict, setVerdict] = useState<A2AVerdict>('NEUTRAL');
    const [confidence, setConfidence] = useState(0.8);
    const [message, setMessage] = useState('');
    const [evidence, setEvidence] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleSubmit = async () => {
        if (!apiKey.trim()) return;
        setSubmitting(true);
        try {
            let parsedEvidence = {};
            if (evidence.trim()) {
                try { parsedEvidence = JSON.parse(evidence); } catch { parsedEvidence = { raw: evidence }; }
            }
            const res = await respondToA2AQuery(apiKey, queryId, verdict, confidence, parsedEvidence, message || null);
            setResult(res);
            if (res.success) { onSubmit(); setMessage(''); setEvidence(''); }
        } catch (err: any) {
            setResult({ success: false, error: err.message });
        } finally { setSubmitting(false); }
    };

    return (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16, marginTop: 12 }}>
            <h5 style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Submit Response</h5>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                    <label style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>API Key</label>
                    <input type="password" placeholder="agk_..." value={apiKey} onChange={e => setApiKey(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                </div>
                <div>
                    <label style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Confidence: {Math.round(confidence * 100)}%</label>
                    <input type="range" min={0} max={1} step={0.05} value={confidence} onChange={e => setConfidence(+e.target.value)}
                        style={{ width: '100%', marginTop: 4 }} />
                </div>
            </div>

            {/* Verdict Selector */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {VERDICT_OPTIONS.map(v => (
                    <button key={v.value} onClick={() => setVerdict(v.value)} style={{
                        flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${verdict === v.value ? v.color : 'rgba(255,255,255,0.08)'}`,
                        background: verdict === v.value ? v.bg : 'transparent', color: verdict === v.value ? v.color : 'var(--text-tertiary)',
                        fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        transition: 'all 0.2s',
                    }}>
                        {v.icon} {v.label}
                    </button>
                ))}
            </div>

            <textarea placeholder="Your experience or observations..." value={message} onChange={e => setMessage(e.target.value)} rows={2}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', fontSize: 12, resize: 'vertical', marginBottom: 8, boxSizing: 'border-box' }} />

            <input placeholder='Evidence JSON (optional): {"order_count": 3, "avg_delivery_days": 2.1}' value={evidence} onChange={e => setEvidence(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#93c5fd', fontSize: 11, fontFamily: 'monospace', marginBottom: 12, boxSizing: 'border-box' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={handleSubmit} disabled={submitting || !apiKey.trim()} style={{
                    padding: '8px 20px', borderRadius: 8, border: 'none',
                    background: apiKey.trim() ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'rgba(255,255,255,0.05)',
                    color: apiKey.trim() ? 'white' : 'var(--text-tertiary)', fontSize: 12, fontWeight: 600,
                    cursor: apiKey.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                    {submitting ? <Loader size={12} className="animate-spin" /> : <Send size={12} />} Submit Response
                </button>
                {result && (
                    <span style={{ fontSize: 11, color: result.success ? '#22c55e' : '#ef4444' }}>
                        {result.success ? '✓ Response submitted' : `✗ ${result.error}`}
                    </span>
                )}
            </div>
        </div>
    );
};

/* ━━━ Query Card ━━━ */
const QueryCard: React.FC<{ q: any; onRefresh: () => void }> = ({ q, onRefresh }) => {
    const [expanded, setExpanded] = useState(false);
    const typeInfo = QUERY_TYPES.find(t => t.value === q.query_type) || QUERY_TYPES[3];
    const isExpired = q.status === 'EXPIRED' || (q.expires_at && new Date(q.expires_at) < new Date());

    return (
        <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, overflow: 'hidden', opacity: isExpired ? 0.5 : 1,
            transition: 'all 0.2s',
        }}>
            {/* Header */}
            <button onClick={() => setExpanded(!expanded)} style={{
                width: '100%', padding: '16px 20px', border: 'none', background: 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 14, textAlign: 'left',
            }}>
                {/* Avatar */}
                <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: `linear-gradient(135deg, ${typeInfo.color}30, ${typeInfo.color}10)`,
                    border: `1px solid ${typeInfo.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: typeInfo.color,
                }}>
                    <Radio size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <code style={{ fontSize: 12, color: '#60a5fa', fontWeight: 600 }}>{q.from_agent}</code>
                        <span style={{
                            fontSize: 9, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
                            background: `${typeInfo.color}15`, color: typeInfo.color,
                            display: 'flex', alignItems: 'center', gap: 3,
                        }}>
                            {typeInfo.icon} {typeInfo.label}
                        </span>
                        {q.sku && (
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.1)', color: '#93c5fd' }}>
                                SKU: {q.sku}
                            </span>
                        )}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>{q.question}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} /> {timeAgo(q.created_at)}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} /> {timeLeft(q.expires_at)}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <MessageCircle size={10} /> {q.response_count || 0} response{(q.response_count || 0) !== 1 ? 's' : ''}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Users size={10} /> {q.scope}</span>
                    </div>
                </div>
                <div style={{ color: 'var(--text-tertiary)' }}>
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </button>

            {/* Expanded Content */}
            {expanded && (
                <div style={{ padding: '0 20px 20px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    {/* Responses */}
                    {q.responses && q.responses.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                            <h5 style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                                Responses ({q.responses.length})
                            </h5>
                            {q.responses.map((r: any) => <ResponseCard key={r.id} r={r} />)}
                        </div>
                    ) : (
                        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: 20 }}>
                            No responses yet — be the first to share your experience
                        </p>
                    )}

                    {/* Respond Form */}
                    {!isExpired && <RespondForm queryId={q.query_id} onSubmit={onRefresh} />}
                </div>
            )}
        </div>
    );
};

/* ━━━ Broadcast Form ━━━ */
const BroadcastForm: React.FC<{ onBroadcast: () => void }> = ({ onBroadcast }) => {
    const [apiKey, setApiKey] = useState('');
    const [queryType, setQueryType] = useState('PRODUCT_EXPERIENCE');
    const [sku, setSku] = useState('');
    const [question, setQuestion] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleSubmit = async () => {
        if (!apiKey.trim() || !question.trim()) return;
        setSubmitting(true);
        try {
            const res = await broadcastA2AQuery(apiKey, queryType, sku || null, question);
            setResult(res);
            if (res.success) { setQuestion(''); setSku(''); onBroadcast(); }
        } catch (err: any) {
            setResult({ success: false, error: err.message });
        } finally { setSubmitting(false); }
    };

    return (
        <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: 24, marginBottom: 24,
        }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Radio size={16} style={{ color: '#3b82f6' }} /> Broadcast Query
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                    <label style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>API Key *</label>
                    <input type="password" placeholder="agk_..." value={apiKey} onChange={e => setApiKey(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                </div>
                <div>
                    <label style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Query Type</label>
                    <select value={queryType} onChange={e => setQueryType(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', fontSize: 12, boxSizing: 'border-box' }}>
                        {QUERY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>SKU (optional)</label>
                    <input placeholder="e.g., TISSUE-70x20" value={sku} onChange={e => setSku(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', fontSize: 12, boxSizing: 'border-box' }} />
                </div>
            </div>

            <textarea placeholder="Ask the agent network... e.g., 'Has anyone ordered this product? How was the delivery speed?'" value={question} onChange={e => setQuestion(e.target.value)} rows={2}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', marginBottom: 12, boxSizing: 'border-box' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={handleSubmit} disabled={submitting || !apiKey.trim() || !question.trim()} style={{
                    padding: '10px 24px', borderRadius: 8, border: 'none',
                    background: (apiKey.trim() && question.trim()) ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'rgba(255,255,255,0.05)',
                    color: (apiKey.trim() && question.trim()) ? 'white' : 'var(--text-tertiary)', fontSize: 13, fontWeight: 600,
                    cursor: (apiKey.trim() && question.trim()) ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
                }}>
                    {submitting ? <Loader size={14} className="animate-spin" /> : <Send size={14} />} Broadcast to Network
                </button>
                {result && (
                    <span style={{ fontSize: 12, color: result.success ? '#22c55e' : '#ef4444' }}>
                        {result.success ? `✓ Broadcast as ${result.query_id}` : `✗ ${result.error}`}
                    </span>
                )}
            </div>
        </div>
    );
};

/* ━━━ Main Page ━━━ */
export const A2ANetwork: React.FC = () => {
    const [statusFilter, setStatusFilter] = useState('OPEN');
    const [searchQuery, setSearchQuery] = useState('');
    const { queries, loading, fetchQueries } = useA2AQueries(statusFilter);

    const filtered = queries.filter(q =>
        !searchQuery || q.question?.toLowerCase().includes(searchQuery.toLowerCase()) || q.sku?.toLowerCase().includes(searchQuery.toLowerCase()) || q.from_agent?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const stats = {
        open: queries.filter(q => q.status === 'OPEN').length,
        totalResponses: queries.reduce((acc: number, q: any) => acc + (q.response_count || 0), 0),
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: 24 }}>
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
                {/* Header */}
                <header style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <div style={{
                            width: 44, height: 44, borderRadius: 12,
                            background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(168,85,247,0.2))',
                            border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Radio size={22} style={{ color: '#60a5fa' }} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Agent-to-Agent Network</h1>
                            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
                                Broadcast queries and share experiences across the agent network
                            </p>
                        </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                        <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                            <span style={{ fontSize: 10, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: 1 }}>Active Queries</span>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#60a5fa', marginTop: 2 }}>{stats.open}</div>
                        </div>
                        <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
                            <span style={{ fontSize: 10, color: '#a855f7', textTransform: 'uppercase', letterSpacing: 1 }}>Total Responses</span>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#a855f7', marginTop: 2 }}>{stats.totalResponses}</div>
                        </div>
                    </div>
                </header>

                {/* Broadcast Form */}
                <BroadcastForm onBroadcast={fetchQueries} />

                {/* Filter Bar */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                        <input placeholder="Search queries, SKUs, agents..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', fontSize: 12, boxSizing: 'border-box' }} />
                    </div>
                    {['OPEN', 'RESOLVED', 'EXPIRED'].map(s => (
                        <button key={s} onClick={() => setStatusFilter(s === statusFilter ? '' : s)} style={{
                            padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            border: `1px solid ${statusFilter === s ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                            background: statusFilter === s ? 'rgba(59,130,246,0.1)' : 'transparent',
                            color: statusFilter === s ? '#60a5fa' : 'var(--text-tertiary)',
                            transition: 'all 0.2s',
                        }}>
                            {s}
                        </button>
                    ))}
                    <button onClick={fetchQueries} style={{
                        padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)',
                        background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
                    }}>
                        <RefreshCw size={12} /> Refresh
                    </button>
                </div>

                {/* Query Feed */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
                        <Loader size={24} className="animate-spin" style={{ marginBottom: 12 }} />
                        <p style={{ fontSize: 13 }}>Loading A2A network...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
                        <Radio size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
                        <p style={{ fontSize: 14, marginBottom: 4 }}>No queries found</p>
                        <p style={{ fontSize: 12 }}>Broadcast a query to start the conversation</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {filtered.map((q: any) => <QueryCard key={q.query_id} q={q} onRefresh={fetchQueries} />)}
                    </div>
                )}

                {/* Footer */}
                <footer style={{ marginTop: 40, textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 16 }}>
                    A2A Protocol v1.0 · Agent-to-Agent communication for autonomous commerce
                </footer>
            </div>
        </div>
    );
};
