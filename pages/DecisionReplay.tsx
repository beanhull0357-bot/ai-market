import React, { useState, useCallback, useEffect } from 'react';
import { Brain, Search, Shield, ShoppingCart, CheckCircle2, XCircle, AlertTriangle, Bot, Clock, ChevronDown, ChevronUp, Radio, Zap, Eye, Play, Package, TrendingUp, Filter } from 'lucide-react';
import { useProducts } from '../hooks';
import { useLanguage } from '../context/LanguageContext';

// ━━━ Decision Replay Simulation Engine ━━━

const AGENT_NAMES = ['PROCURE-BOT-v2.1', 'SOURCING-AI-v1.0', 'AUTO-RESTOCK-v2', 'BULK-BUY-v3', 'SMART-PURCHASE-v1'];

type StepType = 'POLICY_LOAD' | 'CATALOG_SEARCH' | 'CANDIDATE_EVAL' | 'A2A_CROSSCHECK' | 'PRICE_NEGOTIATE' | 'RISK_ASSESS' | 'FINAL_DECISION';
type StepStatus = 'PASS' | 'FAIL' | 'WARN' | 'SKIP' | 'RUNNING' | 'PENDING';

interface CandidateProduct {
    sku: string;
    title: string;
    price: number;
    trust: number;
    stock: string;
    pass: boolean;
    failReason?: string;
}

interface DecisionStep {
    type: StepType;
    label: string;
    status: StepStatus;
    durationMs: number;
    details: string;
    data?: any;
}

interface DecisionSession {
    sessionId: string;
    agentId: string;
    orderId: string;
    createdAt: string;
    policy: { maxBudget: number; minTrust: number; maxDeliveryDays: number; allowedCategories: string[] };
    steps: DecisionStep[];
    finalChoice: { sku: string; title: string; price: number; qty: number; totalCost: number } | null;
    status: 'APPROVED' | 'REJECTED' | 'RUNNING' | 'PENDING';
}

function generateSession(products: any[]): DecisionSession {
    const agentId = AGENT_NAMES[Math.floor(Math.random() * AGENT_NAMES.length)];
    const maxBudget = 30000 + Math.floor(Math.random() * 50000);
    const minTrust = 60 + Math.floor(Math.random() * 30);
    const maxDeliveryDays = 2 + Math.floor(Math.random() * 4);
    const categories = ['CONSUMABLES', 'MRO'];
    const allowedCats = Math.random() > 0.3 ? categories : [categories[Math.floor(Math.random() * categories.length)]];

    const candidates: CandidateProduct[] = products.map(p => {
        const trust = p.qualitySignals?.sellerTrust || Math.floor(Math.random() * 40 + 60);
        const pass = p.offer.price <= maxBudget && trust >= minTrust && (p.offer.etaDays || 3) <= maxDeliveryDays && allowedCats.includes(p.category);
        let failReason = '';
        if (p.offer.price > maxBudget) failReason = `Price ₩${p.offer.price.toLocaleString()} > budget ₩${maxBudget.toLocaleString()}`;
        else if (trust < minTrust) failReason = `Trust ${trust} < min ${minTrust}`;
        else if ((p.offer.etaDays || 3) > maxDeliveryDays) failReason = `ETA ${p.offer.etaDays}d > max ${maxDeliveryDays}d`;
        else if (!allowedCats.includes(p.category)) failReason = `Category ${p.category} not allowed`;
        return { sku: p.sku, title: p.title, price: p.offer.price, trust, stock: p.offer.stockStatus || 'unknown', pass, failReason };
    });

    const passed = candidates.filter(c => c.pass);
    const chosen = passed.length > 0 ? passed.reduce((a, b) => a.price < b.price ? a : b) : null;

    const a2aEndorseCount = chosen ? 1 + Math.floor(Math.random() * 3) : 0;
    const a2aBlockCount = Math.random() > 0.8 ? 1 : 0;
    const negotiatedPrice = chosen ? Math.round(chosen.price * (0.92 + Math.random() * 0.06)) : 0;
    const qty = 1 + Math.floor(Math.random() * 4);

    const riskScore = chosen ? (chosen.trust > 85 ? 'LOW' : chosen.trust > 70 ? 'MEDIUM' : 'HIGH') : 'N/A';

    const steps: DecisionStep[] = [
        {
            type: 'POLICY_LOAD', label: 'Policy Load', status: 'PASS', durationMs: 2 + Math.floor(Math.random() * 8),
            details: `Loaded agent policy — Budget: ₩${maxBudget.toLocaleString()}, Min Trust: ${minTrust}, Max ETA: ${maxDeliveryDays}d`,
            data: { maxBudget, minTrust, maxDeliveryDays, allowedCategories: allowedCats },
        },
        {
            type: 'CATALOG_SEARCH', label: 'Catalog Search', status: 'PASS', durationMs: 30 + Math.floor(Math.random() * 120),
            details: `Queried catalog — ${products.length} products found, ${candidates.length} evaluated`,
            data: { totalProducts: products.length, categoriesSearched: allowedCats },
        },
        {
            type: 'CANDIDATE_EVAL', label: 'Candidate Evaluation', status: passed.length > 0 ? 'PASS' : 'FAIL',
            durationMs: 15 + Math.floor(Math.random() * 40),
            details: `${passed.length}/${candidates.length} candidates passed policy filters`,
            data: { candidates, passedCount: passed.length },
        },
        {
            type: 'A2A_CROSSCHECK', label: 'A2A Cross-check', status: a2aBlockCount > 0 ? 'WARN' : chosen ? 'PASS' : 'SKIP',
            durationMs: chosen ? 200 + Math.floor(Math.random() * 500) : 0,
            details: chosen ? `Received ${a2aEndorseCount} ENDORSE, ${a2aBlockCount} BLOCKLIST from peer agents` : 'Skipped — no candidates',
            data: { endorseCount: a2aEndorseCount, blockCount: a2aBlockCount },
        },
        {
            type: 'PRICE_NEGOTIATE', label: 'Price Negotiation', status: chosen ? 'PASS' : 'SKIP',
            durationMs: chosen ? 400 + Math.floor(Math.random() * 800) : 0,
            details: chosen ? `Negotiated ${chosen.sku}: ₩${chosen.price.toLocaleString()} → ₩${negotiatedPrice.toLocaleString()} (${((1 - negotiatedPrice / chosen.price) * 100).toFixed(1)}% savings)` : 'Skipped',
            data: chosen ? { originalPrice: chosen.price, negotiatedPrice, savingsPct: ((1 - negotiatedPrice / chosen.price) * 100).toFixed(1) } : null,
        },
        {
            type: 'RISK_ASSESS', label: 'Risk Assessment', status: riskScore === 'HIGH' ? 'WARN' : chosen ? 'PASS' : 'SKIP',
            durationMs: chosen ? 5 + Math.floor(Math.random() * 15) : 0,
            details: chosen ? `Risk level: ${riskScore} — Trust: ${chosen.trust}, Stock: ${chosen.stock}` : 'Skipped',
            data: { riskScore },
        },
        {
            type: 'FINAL_DECISION', label: 'Final Decision', status: chosen ? 'PASS' : 'FAIL',
            durationMs: 1,
            details: chosen ? `APPROVED: ${chosen.sku} × ${qty} = ₩${(negotiatedPrice * qty).toLocaleString()}` : 'REJECTED: No candidates passed all filters',
            data: chosen ? { sku: chosen.sku, qty, unitPrice: negotiatedPrice, total: negotiatedPrice * qty } : null,
        },
    ];

    return {
        sessionId: `DEC-${Date.now().toString(36).toUpperCase()}`,
        agentId,
        orderId: `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
        createdAt: new Date().toISOString(),
        policy: { maxBudget, minTrust, maxDeliveryDays, allowedCategories: allowedCats },
        steps,
        finalChoice: chosen ? { sku: chosen.sku, title: chosen.title, price: negotiatedPrice, qty, totalCost: negotiatedPrice * qty } : null,
        status: chosen ? 'APPROVED' : 'REJECTED',
    };
}

// ━━━ Sub-components ━━━

function StepIcon({ type, status }: { type: StepType; status: StepStatus }) {
    const iconMap: Record<StepType, React.ReactNode> = {
        POLICY_LOAD: <Shield size={14} />,
        CATALOG_SEARCH: <Search size={14} />,
        CANDIDATE_EVAL: <Filter size={14} />,
        A2A_CROSSCHECK: <Radio size={14} />,
        PRICE_NEGOTIATE: <TrendingUp size={14} />,
        RISK_ASSESS: <AlertTriangle size={14} />,
        FINAL_DECISION: <ShoppingCart size={14} />,
    };
    const colorMap: Record<StepStatus, string> = {
        PASS: 'var(--accent-green)', FAIL: 'var(--accent-red)', WARN: 'var(--accent-amber)',
        SKIP: 'var(--text-dim)', RUNNING: 'var(--accent-cyan)', PENDING: 'var(--text-dim)',
    };
    return (
        <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: `color-mix(in srgb, ${colorMap[status]} 12%, transparent)`,
            border: `1.5px solid ${colorMap[status]}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: colorMap[status], transition: 'all 300ms',
        }}>
            {iconMap[type]}
        </div>
    );
}

function StatusPill({ status }: { status: StepStatus }) {
    const map: Record<StepStatus, { bg: string; color: string; label: string }> = {
        PASS: { bg: 'rgba(52,211,153,0.1)', color: '#34d399', label: 'PASS' },
        FAIL: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', label: 'FAIL' },
        WARN: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', label: 'WARN' },
        SKIP: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280', label: 'SKIP' },
        RUNNING: { bg: 'rgba(34,211,238,0.1)', color: '#22d3ee', label: 'RUN' },
        PENDING: { bg: 'rgba(107,114,128,0.08)', color: '#6b7280', label: '...' },
    };
    const s = map[status];
    return (
        <span style={{
            padding: '2px 8px', borderRadius: 'var(--radius-full)',
            background: s.bg, color: s.color, fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
        }}>
            {s.label}
        </span>
    );
}

function CandidateTable({ candidates }: { candidates: CandidateProduct[] }) {
    return (
        <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {['SKU', 'Price', 'Trust', 'Stock', 'Result'].map(h => (
                            <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: 0.5, textTransform: 'uppercase' }}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {candidates.map(c => (
                        <tr key={c.sku} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: c.pass ? 1 : 0.5 }}>
                            <td style={{ padding: '6px 8px', color: 'var(--accent-cyan)', fontWeight: 600 }}>{c.sku}</td>
                            <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>₩{c.price.toLocaleString()}</td>
                            <td style={{ padding: '6px 8px', color: c.trust >= 80 ? 'var(--accent-green)' : c.trust >= 60 ? 'var(--accent-amber)' : 'var(--accent-red)' }}>{c.trust}</td>
                            <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{c.stock}</td>
                            <td style={{ padding: '6px 8px' }}>
                                {c.pass ? (
                                    <span style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} /> Pass</span>
                                ) : (
                                    <span style={{ color: 'var(--accent-red)', fontSize: 10 }} title={c.failReason}><XCircle size={12} style={{ verticalAlign: 'middle', marginRight: 2 }} />{c.failReason}</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ━━━ Main Page ━━━

export function DecisionReplay() {
    const { t } = useLanguage();
    const { products } = useProducts();
    const [sessions, setSessions] = useState<DecisionSession[]>([]);
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
    const [isReplaying, setIsReplaying] = useState(false);
    const [replayProgress, setReplayProgress] = useState(0);

    const generateReplay = useCallback(() => {
        if (products.length === 0) return;
        const session = generateSession(products);
        setSessions(prev => [session, ...prev]);
        setSelectedIdx(0);
        setExpandedSteps(new Set());
    }, [products]);

    const runAnimatedReplay = useCallback(async (idx: number) => {
        setIsReplaying(true);
        setReplayProgress(0);
        const s = sessions[idx];
        const totalSteps = s.steps.length;
        // Animate steps one by one
        for (let i = 0; i < totalSteps; i++) {
            setReplayProgress(i + 1);
            setExpandedSteps(prev => new Set([...prev, i]));
            await new Promise(r => setTimeout(r, 300 + s.steps[i].durationMs * 0.5));
        }
        setIsReplaying(false);
    }, [sessions]);

    const selected = selectedIdx !== null ? sessions[selectedIdx] : null;
    const totalDuration = selected ? selected.steps.reduce((a, s) => a + s.durationMs, 0) : 0;

    const toggleStep = (idx: number) => {
        setExpandedSteps(prev => {
            const next = new Set(prev);
            next.has(idx) ? next.delete(idx) : next.add(idx);
            return next;
        });
    };

    return (
        <div className="page-enter" style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(16px, 4vw, 32px)' }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(34,211,238,0.15))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Brain size={20} style={{ color: 'var(--accent-purple)' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Agent Decision Replay</h1>
                        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>AI 에이전트의 구매 의사결정 전 과정을 투명하게 재현합니다</p>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }} className="grid-responsive-bento">
                {/* Left Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Generate Button */}
                    <button onClick={generateReplay} disabled={products.length === 0} style={{
                        width: '100%', padding: '14px', borderRadius: 'var(--radius-md)',
                        background: products.length > 0 ? 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))' : 'var(--border-subtle)',
                        color: products.length > 0 ? '#fff' : 'var(--text-dim)', border: 'none',
                        fontWeight: 800, fontSize: 13, cursor: products.length > 0 ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        transition: 'all 200ms', letterSpacing: 0.3,
                    }}>
                        <Brain size={16} /> Generate Decision Replay
                    </button>

                    {/* Session List */}
                    <div style={{
                        borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)', maxHeight: 500, overflowY: 'auto',
                    }}>
                        {sessions.length === 0 ? (
                            <div style={{ padding: 40, textAlign: 'center' }}>
                                <Brain size={32} style={{ color: 'var(--text-dim)', marginBottom: 8, opacity: 0.3 }} />
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>No replays yet</div>
                                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Generate a decision replay to see how AI agents think</div>
                            </div>
                        ) : sessions.map((s, idx) => (
                            <div key={s.sessionId}
                                onClick={() => { setSelectedIdx(idx); setExpandedSteps(new Set()); }}
                                style={{
                                    padding: '12px 16px', cursor: 'pointer',
                                    borderBottom: '1px solid var(--border-subtle)',
                                    background: selectedIdx === idx ? 'rgba(139,92,246,0.04)' : 'transparent',
                                    transition: 'background 150ms',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                                        {s.sessionId}
                                    </span>
                                    <span style={{
                                        padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 9, fontWeight: 700,
                                        background: s.status === 'APPROVED' ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                                        color: s.status === 'APPROVED' ? '#34d399' : '#ef4444',
                                    }}>
                                        {s.status}
                                    </span>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                    <Bot size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                    {s.agentId} • {s.steps.filter(st => st.status === 'PASS').length}/{s.steps.length} steps passed
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Panel: Replay Detail */}
                <div style={{
                    borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)', minHeight: 500,
                }}>
                    {!selected ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 500, color: 'var(--text-dim)', flexDirection: 'column', gap: 8 }}>
                            <Brain size={40} style={{ opacity: 0.15 }} />
                            <span style={{ fontSize: 13 }}>Select or generate a replay to inspect</span>
                        </div>
                    ) : (
                        <div style={{ padding: 24 }}>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                                <div>
                                    <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Bot size={18} style={{ color: 'var(--accent-cyan)' }} />
                                        {selected.agentId}
                                    </h2>
                                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                                        {selected.sessionId} • {selected.orderId}
                                    </div>
                                </div>
                                <button onClick={() => selectedIdx !== null && runAnimatedReplay(selectedIdx)} disabled={isReplaying} style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none',
                                    background: isReplaying ? 'var(--border-subtle)' : 'linear-gradient(135deg, var(--accent-green), #059669)',
                                    color: isReplaying ? 'var(--text-dim)' : '#000', fontWeight: 700, fontSize: 11,
                                    cursor: isReplaying ? 'default' : 'pointer',
                                }}>
                                    <Play size={12} /> {isReplaying ? 'Replaying...' : 'Replay Animation'}
                                </button>
                            </div>

                            {/* Summary Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }} className="grid-responsive-4">
                                {[
                                    { label: 'Budget', value: `₩${selected.policy.maxBudget.toLocaleString()}`, color: 'var(--accent-cyan)' },
                                    { label: 'Min Trust', value: `${selected.policy.minTrust}`, color: 'var(--accent-amber)' },
                                    { label: 'Total Time', value: `${totalDuration}ms`, color: 'var(--accent-purple)' },
                                    { label: 'Result', value: selected.finalChoice ? `₩${selected.finalChoice.totalCost.toLocaleString()}` : 'REJECTED', color: selected.finalChoice ? 'var(--accent-green)' : 'var(--accent-red)' },
                                ].map(c => (
                                    <div key={c.label} style={{ padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                                        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.5, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
                                        <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'var(--font-mono)', color: c.color }}>{c.value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Progress Bar */}
                            {isReplaying && (
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ height: 3, borderRadius: 2, background: 'var(--border-subtle)', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', borderRadius: 2,
                                            background: 'linear-gradient(90deg, var(--accent-purple), var(--accent-cyan))',
                                            width: `${(replayProgress / selected.steps.length) * 100}%`,
                                            transition: 'width 300ms var(--ease-out)',
                                        }} />
                                    </div>
                                </div>
                            )}

                            {/* Decision Timeline */}
                            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.5, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Eye size={12} /> Decision Pipeline ({selected.steps.length} steps)
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                {selected.steps.map((step, i) => {
                                    const visible = !isReplaying || i < replayProgress;
                                    const expanded = expandedSteps.has(i);
                                    return (
                                        <div key={i} style={{
                                            opacity: visible ? 1 : 0.15,
                                            transform: visible ? 'translateY(0)' : 'translateY(8px)',
                                            transition: 'all 400ms var(--ease-out)',
                                        }}>
                                            <div style={{ display: 'flex', gap: 12, position: 'relative' }}>
                                                {/* Connector */}
                                                {i < selected.steps.length - 1 && (
                                                    <div style={{
                                                        position: 'absolute', left: 15, top: 32, bottom: expanded ? -8 : -4, width: 1,
                                                        background: visible ? 'var(--border-medium)' : 'var(--border-subtle)',
                                                        transition: 'background 300ms',
                                                    }} />
                                                )}
                                                {/* Icon */}
                                                <StepIcon type={step.type} status={visible ? step.status : 'PENDING'} />
                                                {/* Content */}
                                                <div style={{ flex: 1, minWidth: 0, paddingBottom: 16 }}>
                                                    <div
                                                        onClick={() => toggleStep(i)}
                                                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: 2 }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{step.label}</span>
                                                            <StatusPill status={visible ? step.status : 'PENDING'} />
                                                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{step.durationMs}ms</span>
                                                        </div>
                                                        {expanded ? <ChevronUp size={14} style={{ color: 'var(--text-dim)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-dim)' }} />}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                                                        {step.details}
                                                    </div>

                                                    {/* Expanded Detail */}
                                                    {expanded && step.data && (
                                                        <div style={{
                                                            marginTop: 8, padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                                                            background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                                                            fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                                                            lineHeight: 1.6, animation: 'fadeIn 200ms',
                                                        }}>
                                                            {step.type === 'CANDIDATE_EVAL' && step.data.candidates ? (
                                                                <CandidateTable candidates={step.data.candidates} />
                                                            ) : step.type === 'POLICY_LOAD' ? (
                                                                <div>
                                                                    <div>maxBudget: <span style={{ color: 'var(--accent-cyan)' }}>₩{step.data.maxBudget?.toLocaleString()}</span></div>
                                                                    <div>minTrust: <span style={{ color: 'var(--accent-amber)' }}>{step.data.minTrust}</span></div>
                                                                    <div>maxDeliveryDays: <span style={{ color: 'var(--accent-green)' }}>{step.data.maxDeliveryDays}d</span></div>
                                                                    <div>categories: <span style={{ color: 'var(--accent-purple)' }}>[{step.data.allowedCategories?.join(', ')}]</span></div>
                                                                </div>
                                                            ) : step.type === 'A2A_CROSSCHECK' ? (
                                                                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                        <CheckCircle2 size={12} style={{ color: 'var(--accent-green)' }} />
                                                                        <span>ENDORSE: {step.data.endorseCount}</span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                        <XCircle size={12} style={{ color: 'var(--accent-red)' }} />
                                                                        <span>BLOCKLIST: {step.data.blockCount}</span>
                                                                    </div>
                                                                </div>
                                                            ) : step.type === 'PRICE_NEGOTIATE' && step.data ? (
                                                                <div>
                                                                    <div>Original: ₩{step.data.originalPrice?.toLocaleString()}</div>
                                                                    <div>Negotiated: <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>₩{step.data.negotiatedPrice?.toLocaleString()}</span></div>
                                                                    <div>Savings: <span style={{ color: 'var(--accent-cyan)' }}>{step.data.savingsPct}%</span></div>
                                                                </div>
                                                            ) : (
                                                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(step.data, null, 2)}</pre>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Final Result Card */}
                            {selected.finalChoice && (
                                <div style={{
                                    marginTop: 8, padding: '16px', borderRadius: 'var(--radius-md)',
                                    background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)',
                                    textAlign: 'center',
                                }}>
                                    <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
                                        <CheckCircle2 size={16} /> PURCHASE APPROVED
                                    </div>
                                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 4 }}>
                                        {selected.finalChoice.sku} × {selected.finalChoice.qty}
                                    </div>
                                    <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>
                                        ₩{selected.finalChoice.totalCost.toLocaleString()}
                                    </div>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                                        Unit: ₩{selected.finalChoice.price.toLocaleString()} • Total pipeline: {totalDuration}ms
                                    </div>
                                </div>
                            )}

                            {!selected.finalChoice && (
                                <div style={{
                                    marginTop: 8, padding: '16px', borderRadius: 'var(--radius-md)',
                                    background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                                    textAlign: 'center',
                                }}>
                                    <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                        <XCircle size={16} /> PURCHASE REJECTED
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                        No candidates passed all policy filters
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}
