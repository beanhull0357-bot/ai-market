import React, { useState, useCallback } from 'react';
import { Handshake, Bot, TrendingDown, Zap, CheckCircle2, XCircle, Clock, ArrowRight, Play, RotateCcw, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import { useProducts, saveNegotiationToDB, policyBasedNegotiate } from '../hooks';
import { useLanguage } from '../context/LanguageContext';
import type { Negotiation, NegotiationRound } from '../types';

// ━━━ AI Negotiation Engine (fully client-side simulation) ━━━

const BUYER_AGENTS = ['PROCURE-BOT-v2.1', 'SOURCING-AI-v1.0', 'AUTO-RESTOCK-v2'];
const SELLER_AGENTS = ['SUPPLIER-AI-v1.0', 'WHOLESALE-BOT-v3', 'VENDOR-AGENT-v2'];

/** 시드 기반 결정론적 해시 (Math.random 대체) */
function seededHash(seed: string): number {
    let h = 0xdeadbeef;
    for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 0x9e3779b9);
        h ^= h >>> 16;
    }
    return (h >>> 0) / 0xffffffff; // 0~1 범위
}

function sellerResponse(listPrice: number, buyerOffer: number, round: number, maxRounds: number, seed: string): { price: number; message: string; accept: boolean } {
    const spread = listPrice - buyerOffer;
    const progress = round / maxRounds;
    const urgency = progress > 0.7 ? 0.6 : progress > 0.4 ? 0.4 : 0.2;
    // Math.random() 제거: 시드 기반 양보율 (0.6~1.0 고정)
    const concessionFactor = 0.6 + seededHash(`${seed}-seller-${round}`) * 0.4;
    const concession = spread * urgency * concessionFactor;
    const counterPrice = Math.round(listPrice - concession);

    if (buyerOffer >= listPrice * 0.95 || round >= maxRounds - 1) {
        return { price: buyerOffer, message: `Terms acceptable at \u20a9${buyerOffer.toLocaleString()}. Deal confirmed.`, accept: true };
    }
    if (buyerOffer < listPrice * 0.5) {
        return { price: counterPrice, message: `Offer too low. Minimum counter: \u20a9${counterPrice.toLocaleString()}. This is ${((1 - counterPrice / listPrice) * 100).toFixed(1)}% below list.`, accept: false };
    }
    return {
        price: counterPrice,
        message: `Counter-proposal: \u20a9${counterPrice.toLocaleString()} (${((1 - counterPrice / listPrice) * 100).toFixed(1)}% discount). Bulk order may improve terms.`,
        accept: false,
    };
}

function buyerOffer(listPrice: number, currentSellerPrice: number, round: number, maxRounds: number, policyBudget: number | null, seed: string): { price: number; message: string; accept: boolean } {
    const budget = policyBudget ?? listPrice;
    const progress = round / maxRounds;
    // Math.random() 제거: 시드 기반 초기 오퍼율 (0.60~0.70 구간)
    const startRatio = 0.60 + seededHash(`${seed}-buyer-${round}`) * 0.10;
    const startOffer = listPrice * startRatio;
    const targetDelta = (currentSellerPrice - startOffer) * (progress * 0.7 + 0.2);
    const offer = Math.round(startOffer + targetDelta);

    if (currentSellerPrice <= budget * 0.98) {
        return { price: currentSellerPrice, message: `Price \u20a9${currentSellerPrice.toLocaleString()} within policy budget. Accepting.`, accept: true };
    }
    if (round >= maxRounds - 1) {
        const finalOffer = Math.min(offer, budget);
        return { price: finalOffer, message: `Final round. Maximum offer: \u20a9${finalOffer.toLocaleString()} (policy limit: \u20a9${budget.toLocaleString()}).`, accept: false };
    }
    return {
        price: Math.min(offer, budget),
        message: `Offering \u20a9${Math.min(offer, budget).toLocaleString()}. Spec compliance verified. Awaiting counter.`,
        accept: false,
    };
}

export default function NegotiationCenter() {
    const { t } = useLanguage();
    const { products } = useProducts();
    const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const [isAutoRunning, setIsAutoRunning] = useState(false);
    const [negotiationMode, setNegotiationMode] = useState<'SIMULATION' | 'LIVE'>('SIMULATION');
    const [buyerApiKey, setBuyerApiKey] = useState(() => localStorage.getItem('agent_api_key') || '');

    // Form state
    const [formSku, setFormSku] = useState('');
    const [formMaxRounds, setFormMaxRounds] = useState(5);
    const [formQty, setFormQty] = useState(1);

    const startNegotiation = useCallback(async () => {
        const product = products.find(p => p.sku === formSku);
        if (!product) return;

        // ── LIVE MODE: call DB-backed policy_based_negotiate ──
        if (negotiationMode === 'LIVE') {
            if (!buyerApiKey) { alert('구매 에이전트 API 키를 입력하세요'); return; }
            setIsAutoRunning(true);
            try {
                const offerPrice = Math.round(product.offer.price * 0.85);
                const result = await policyBasedNegotiate(buyerApiKey, formSku, formQty, offerPrice);
                if (result?.success) {
                    const neg: Negotiation = {
                        negotiationId: result.negotiation_id,
                        sku: product.sku,
                        productTitle: product.title,
                        listPrice: result.list_price,
                        buyerAgentId: buyerApiKey.slice(0, 16) + '...',
                        sellerAgentId: 'SELLER-POLICY-AI',
                        status: result.status === 'AGREED' ? 'AGREED' : result.status === 'REJECTED' ? 'REJECTED' : result.status,
                        rounds: [
                            { round: 1, proposedBy: 'buyer' as const, price: offerPrice, message: `Offering ₩${offerPrice.toLocaleString()} (${formQty} units)`, timestamp: new Date().toISOString() },
                            { round: 1, proposedBy: 'seller' as const, price: result.counter_price, message: result.message, timestamp: new Date().toISOString() },
                        ],
                        finalPrice: result.status === 'AGREED' ? offerPrice : null,
                        maxRounds: formMaxRounds,
                        policyBudget: offerPrice,
                        createdAt: new Date().toISOString(),
                    };
                    setNegotiations(prev => [neg, ...prev]);
                    setSelectedIdx(0);
                } else {
                    alert('협상 요청 실패: ' + (result?.error || 'Unknown'));
                }
            } catch (err: any) {
                alert('협상 오류: ' + (err.message || ''));
            } finally {
                setIsAutoRunning(false);
            }
            return;
        }

        // ── SIMULATION MODE: original client-side logic ──
        const seed = `${formSku}-${formMaxRounds}-${Date.now().toString(36)}`;
        const buyerIdx = Math.floor(seededHash(`${seed}-buyer`) * BUYER_AGENTS.length);
        const sellerIdx = Math.floor(seededHash(`${seed}-seller`) * SELLER_AGENTS.length);
        // policyBudget: 80%~87% 구간으로 결정론적 선택
        const budgetRatio = 0.80 + seededHash(`${seed}-budget`) * 0.07;

        const neg: Negotiation = {
            negotiationId: `NEG-${Date.now().toString(36).toUpperCase()}`,
            sku: product.sku,
            productTitle: product.title,
            listPrice: product.offer.price,
            buyerAgentId: BUYER_AGENTS[buyerIdx],
            sellerAgentId: SELLER_AGENTS[sellerIdx],
            status: 'PENDING',
            rounds: [],
            finalPrice: null,
            maxRounds: formMaxRounds,
            policyBudget: product.offer.price * budgetRatio,
            createdAt: new Date().toISOString(),
        };

        setNegotiations(prev => [neg, ...prev]);
        setSelectedIdx(0);
    }, [products, formSku, formMaxRounds, formQty, negotiationMode, buyerApiKey]);

    const runAutoNegotiation = useCallback(async (negIdx: number) => {
        setIsAutoRunning(true);
        const neg = { ...negotiations[negIdx] };
        neg.status = 'NEGOTIATING';
        const rounds: NegotiationRound[] = [];

        let currentSellerPrice = neg.listPrice;

        for (let r = 1; r <= neg.maxRounds; r++) {
            // Buyer proposes
            const bOffer = buyerOffer(neg.listPrice, currentSellerPrice, r, neg.maxRounds, neg.policyBudget, neg.negotiationId);
            rounds.push({
                round: r, proposedBy: 'buyer', price: bOffer.price,
                message: bOffer.message, timestamp: new Date().toISOString(),
            });

            if (bOffer.accept) {
                neg.status = 'AGREED';
                neg.finalPrice = bOffer.price;
                neg.rounds = rounds;
                break;
            }

            // Seller responds
            const sResp = sellerResponse(neg.listPrice, bOffer.price, r, neg.maxRounds, neg.negotiationId);
            currentSellerPrice = sResp.price;
            rounds.push({
                round: r, proposedBy: 'seller', price: sResp.price,
                message: sResp.message, timestamp: new Date().toISOString(),
            });

            if (sResp.accept) {
                neg.status = 'AGREED';
                neg.finalPrice = sResp.price;
                neg.rounds = rounds;
                break;
            }

            neg.rounds = [...rounds];

            // Update state with delay
            await new Promise(resolve => setTimeout(resolve, 400));
            setNegotiations(prev => prev.map((n, i) => i === negIdx ? { ...neg, rounds: [...rounds] } : n));
        }

        if (neg.status !== 'AGREED') {
            neg.status = 'REJECTED';
            neg.finalPrice = null;
        }

        neg.rounds = rounds;
        setNegotiations(prev => prev.map((n, i) => i === negIdx ? { ...neg } : n));
        setIsAutoRunning(false);

        // DB에 협상 결과 저장 (fire-and-forget)
        saveNegotiationToDB({
            negotiationId: neg.negotiationId,
            sku: neg.sku,
            productTitle: neg.productTitle,
            listPrice: neg.listPrice,
            finalPrice: neg.finalPrice,
            policyBudget: neg.policyBudget,
            buyerAgentId: neg.buyerAgentId,
            sellerAgentId: neg.sellerAgentId,
            status: neg.status,
            rounds: rounds,
            maxRounds: neg.maxRounds,
        }).catch(() => { /* 저장 실패 시 UI에 영향 없음 */ });
    }, [negotiations]);

    const selected = selectedIdx !== null ? negotiations[selectedIdx] : null;

    const statusBadge = (status: string) => {
        const map: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
            PENDING: { bg: 'rgba(241,196,15,0.1)', color: '#f59e0b', icon: <Clock size={11} /> },
            NEGOTIATING: { bg: 'rgba(34,211,238,0.1)', color: '#22d3ee', icon: <RotateCcw size={11} /> },
            AGREED: { bg: 'rgba(52,211,153,0.1)', color: '#34d399', icon: <CheckCircle2 size={11} /> },
            REJECTED: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', icon: <XCircle size={11} /> },
            PENDING_SELLER: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', icon: <AlertTriangle size={11} /> },
            COUNTER: { bg: 'rgba(168,85,247,0.1)', color: '#a855f7', icon: <ArrowRight size={11} /> },
        };
        const s = map[status] || map.PENDING;
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: 'var(--radius-full)',
                background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
            }}>
                {s.icon} {t(`negotiate.${status.toLowerCase()}`)}
            </span>
        );
    };

    return (
        <div className="page-enter" style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(16px, 4vw, 32px)' }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.15))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Handshake size={20} style={{ color: 'var(--accent-amber)' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>{t('negotiate.title')}</h1>
                        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>{t('negotiate.subtitle')}</p>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }} className="grid-responsive-bento">
                {/* Left Panel: Form + List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* New Negotiation Form */}
                    <div style={{
                        padding: 20, borderRadius: 'var(--radius-lg)',
                        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                    }}>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Zap size={14} style={{ color: 'var(--accent-amber)' }} />
                            {t('negotiate.startNew')}
                        </h3>

                        {/* Mode Toggle */}
                        <div style={{ marginBottom: 14, display: 'flex', gap: 4, padding: 3, borderRadius: 8, background: 'var(--bg-elevated)' }}>
                            {(['SIMULATION', 'LIVE'] as const).map(mode => (
                                <button key={mode} onClick={() => setNegotiationMode(mode)}
                                    style={{
                                        flex: 1, padding: '6px 0', borderRadius: 6, border: 'none',
                                        background: negotiationMode === mode ? (mode === 'LIVE' ? 'rgba(52,211,153,0.15)' : 'rgba(168,85,247,0.15)') : 'transparent',
                                        color: negotiationMode === mode ? (mode === 'LIVE' ? 'var(--accent-green)' : 'var(--accent-purple)') : 'var(--text-dim)',
                                        fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'all 150ms',
                                    }}>
                                    {mode === 'SIMULATION' ? '🎮 시뮬레이션' : '🔴 실제 협상'}
                                </button>
                            ))}
                        </div>

                        {/* Buyer API Key (LIVE mode) */}
                        {negotiationMode === 'LIVE' && (
                            <div style={{ marginBottom: 12 }}>
                                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                                    구매 에이전트 API 키
                                </label>
                                <input type="text" value={buyerApiKey}
                                    onChange={e => { setBuyerApiKey(e.target.value); localStorage.setItem('agent_api_key', e.target.value); }}
                                    placeholder="ak_..."
                                    style={{
                                        width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                                        background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)',
                                        color: 'var(--accent-green)', fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none',
                                    }}
                                />
                            </div>
                        )}

                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                            {t('negotiate.selectProduct')}
                        </label>
                        <select value={formSku} onChange={e => setFormSku(e.target.value)} style={{
                            width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)',
                            color: 'var(--text-secondary)', fontSize: 12, marginBottom: 12, outline: 'none',
                        }}>
                            <option value="">— {t('negotiate.selectProduct')} —</option>
                            {products.map(p => (
                                <option key={p.sku} value={p.sku}>{p.sku} — {p.title} (₩{p.offer.price.toLocaleString()})</option>
                            ))}
                        </select>

                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                            {t('negotiate.maxRounds')}
                        </label>
                        <input type="number" min={2} max={10} value={formMaxRounds} onChange={e => setFormMaxRounds(Number(e.target.value))} style={{
                            width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)',
                            color: 'var(--text-secondary)', fontSize: 12, marginBottom: 16, outline: 'none',
                        }} />

                        <button onClick={startNegotiation} disabled={!formSku || isAutoRunning} style={{
                            width: '100%', padding: '10px', borderRadius: 'var(--radius-md)',
                            background: formSku && !isAutoRunning ? 'linear-gradient(135deg, var(--accent-amber), #d97706)' : 'var(--border-subtle)',
                            color: formSku && !isAutoRunning ? '#000' : 'var(--text-dim)', border: 'none',
                            fontWeight: 700, fontSize: 13, cursor: formSku && !isAutoRunning ? 'pointer' : 'default',
                            transition: 'all 200ms',
                        }}>
                            {isAutoRunning ? '협상 중...' : negotiationMode === 'LIVE' ? '🔴 실제 협상 시작' : t('negotiate.startNew')}
                        </button>
                    </div>

                    {/* Negotiation List */}
                    <div style={{
                        borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)', maxHeight: 400, overflowY: 'auto',
                    }}>
                        {negotiations.length === 0 ? (
                            <div style={{ padding: 32, textAlign: 'center' }}>
                                <Handshake size={28} style={{ color: 'var(--text-dim)', marginBottom: 8 }} />
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>{t('negotiate.noNegotiations')}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{t('negotiate.noNegotiationsDesc')}</div>
                            </div>
                        ) : negotiations.map((neg, idx) => (
                            <div key={neg.negotiationId}
                                onClick={() => setSelectedIdx(idx)}
                                style={{
                                    padding: '12px 16px', cursor: 'pointer',
                                    borderBottom: '1px solid var(--border-subtle)',
                                    background: selectedIdx === idx ? 'rgba(34,211,238,0.04)' : 'transparent',
                                    transition: 'background 150ms',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                                        {neg.negotiationId}
                                    </span>
                                    {statusBadge(neg.status)}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                    {neg.productTitle} • {neg.rounds.length}/{neg.maxRounds} {t('negotiate.round').toLowerCase()}s
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Panel: Negotiation Detail */}
                <div style={{
                    borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)', minHeight: 500,
                }}>
                    {!selected ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 500, color: 'var(--text-dim)', flexDirection: 'column', gap: 8 }}>
                            <Handshake size={36} style={{ opacity: 0.2 }} />
                            <span style={{ fontSize: 13 }}>{t('negotiate.noNegotiationsDesc')}</span>
                        </div>
                    ) : (
                        <div style={{ padding: 24 }}>
                            {/* Header Info */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                                <div>
                                    <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>{selected.productTitle}</h2>
                                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                                        {selected.sku} • {selected.negotiationId}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    {statusBadge(selected.status)}
                                    {selected.status === 'PENDING' && (
                                        <button onClick={() => selectedIdx !== null && runAutoNegotiation(selectedIdx)} disabled={isAutoRunning} style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none',
                                            background: isAutoRunning ? 'var(--border-subtle)' : 'linear-gradient(135deg, var(--accent-green), #059669)',
                                            color: isAutoRunning ? 'var(--text-dim)' : '#000', fontWeight: 700, fontSize: 11, cursor: isAutoRunning ? 'default' : 'pointer',
                                        }}>
                                            <Play size={12} /> {t('negotiate.autoNegotiate')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Price Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }} className="grid-responsive-4">
                                {[
                                    { label: t('negotiate.listPrice'), value: `₩${selected.listPrice.toLocaleString()}`, color: 'var(--text-secondary)' },
                                    { label: t('negotiate.policyLimit'), value: selected.policyBudget ? `₩${Math.round(selected.policyBudget).toLocaleString()}` : '—', color: 'var(--accent-amber)' },
                                    { label: t('negotiate.finalPrice'), value: selected.finalPrice ? `₩${selected.finalPrice.toLocaleString()}` : '—', color: selected.status === 'AGREED' ? 'var(--accent-green)' : 'var(--text-muted)' },
                                    { label: t('negotiate.savings'), value: selected.finalPrice ? `${((1 - selected.finalPrice / selected.listPrice) * 100).toFixed(1)}%` : '—', color: 'var(--accent-cyan)' },
                                ].map(c => (
                                    <div key={c.label} style={{
                                        padding: '12px', borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border-subtle)', textAlign: 'center',
                                    }}>
                                        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.5, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
                                        <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'var(--font-mono)', color: c.color }}>{c.value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Price Bar Chart */}
                            {selected.rounds.length > 0 && (
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.5, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
                                        {t('negotiate.priceDelta')}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
                                        {selected.rounds.map((r, i) => {
                                            const minP = Math.min(...selected.rounds.map(rr => rr.price));
                                            const maxP = selected.listPrice;
                                            const heightPct = maxP > minP ? ((r.price - minP) / (maxP - minP)) * 100 : 50;
                                            return (
                                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                                    <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                                                        ₩{(r.price / 1000).toFixed(0)}k
                                                    </span>
                                                    <div style={{
                                                        width: '100%', maxWidth: 24,
                                                        height: `${Math.max(8, heightPct * 0.5)}px`,
                                                        borderRadius: '3px 3px 0 0',
                                                        background: r.proposedBy === 'buyer'
                                                            ? 'linear-gradient(to top, var(--accent-green), rgba(52,211,153,0.3))'
                                                            : 'linear-gradient(to top, var(--accent-purple), rgba(167,139,250,0.3))',
                                                        transition: 'height 400ms var(--ease-out)',
                                                    }} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 6 }}>
                                        <span style={{ fontSize: 9, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-green)', display: 'inline-block' }} /> {t('negotiate.buyerAgent')}
                                        </span>
                                        <span style={{ fontSize: 9, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-purple)', display: 'inline-block' }} /> {t('negotiate.sellerAgent')}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Timeline */}
                            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.5, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
                                {t('negotiate.timeline')}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                {selected.rounds.map((r, i) => {
                                    const isBuyer = r.proposedBy === 'buyer';
                                    return (
                                        <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 16, position: 'relative' }}>
                                            {/* Connector line */}
                                            {i < selected.rounds.length - 1 && (
                                                <div style={{
                                                    position: 'absolute', left: 13, top: 24, bottom: 0, width: 1,
                                                    background: 'var(--border-subtle)',
                                                }} />
                                            )}
                                            {/* Dot */}
                                            <div style={{
                                                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                                background: isBuyer ? 'rgba(52,211,153,0.12)' : 'rgba(167,139,250,0.12)',
                                                border: `1.5px solid ${isBuyer ? 'var(--accent-green)' : 'var(--accent-purple)'}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                <Bot size={13} style={{ color: isBuyer ? 'var(--accent-green)' : 'var(--accent-purple)' }} />
                                            </div>
                                            {/* Content */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: isBuyer ? 'var(--accent-green)' : 'var(--accent-purple)', fontFamily: 'var(--font-mono)' }}>
                                                        {isBuyer ? selected.buyerAgentId : selected.sellerAgentId}
                                                    </span>
                                                    <span style={{ fontSize: 18, fontWeight: 900, fontFamily: 'var(--font-mono)', color: isBuyer ? 'var(--accent-green)' : 'var(--accent-purple)' }}>
                                                        ₩{r.price.toLocaleString()}
                                                    </span>
                                                </div>
                                                <div style={{
                                                    fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5,
                                                    padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                                                    background: isBuyer ? 'rgba(52,211,153,0.04)' : 'rgba(167,139,250,0.04)',
                                                    border: `1px solid ${isBuyer ? 'rgba(52,211,153,0.1)' : 'rgba(167,139,250,0.1)'}`,
                                                }}>
                                                    {r.message}
                                                </div>
                                                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                                                    {t('negotiate.round')} {r.round} • {isBuyer ? t('negotiate.propose') : t('negotiate.counter')}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Final Status */}
                                {(selected.status === 'AGREED' || selected.status === 'REJECTED') && (
                                    <div style={{
                                        padding: '14px 16px', borderRadius: 'var(--radius-md)', textAlign: 'center',
                                        background: selected.status === 'AGREED' ? 'rgba(52,211,153,0.06)' : 'rgba(239,68,68,0.06)',
                                        border: `1px solid ${selected.status === 'AGREED' ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)'}`,
                                    }}>
                                        <div style={{
                                            fontSize: 14, fontWeight: 900,
                                            color: selected.status === 'AGREED' ? 'var(--accent-green)' : 'var(--accent-red)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                        }}>
                                            {selected.status === 'AGREED' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                            {t(`negotiate.${selected.status.toLowerCase()}`)}
                                            {selected.finalPrice && (
                                                <span style={{ fontFamily: 'var(--font-mono)' }}> — ₩{selected.finalPrice.toLocaleString()}</span>
                                            )}
                                        </div>
                                        {selected.status === 'AGREED' && selected.finalPrice && (
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                                {t('negotiate.savings')}: {((1 - selected.finalPrice / selected.listPrice) * 100).toFixed(1)}% ({t('negotiate.listPrice')}: ₩{selected.listPrice.toLocaleString()} → ₩{selected.finalPrice.toLocaleString()})
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
