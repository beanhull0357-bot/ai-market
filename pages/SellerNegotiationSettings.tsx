import React, { useState, useCallback, useEffect } from 'react';
import {
    Shield, Settings, TrendingDown, CheckCircle2, XCircle, Clock,
    AlertTriangle, Zap, Package, MessageCircle, Send, ChevronDown,
    ChevronUp, BarChart3, Handshake, Eye, RefreshCw, Bell, Layers
} from 'lucide-react';
import {
    useSellerNegotiationPolicy, updateSellerNegotiationPolicy,
    useSellerNegotiations, sellerRespondNegotiation, useSellerNegotiationStats
} from '../hooks';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Seller Negotiation Settings & Management
    셀러 협상 정책 설정 + 진행 중 협상 수동 개입 UI
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const CONCESSION_STYLES = [
    { value: 'CONSERVATIVE', label: '보수적', desc: '최소 양보, 높은 마진 우선', icon: '🛡️', color: '#f59e0b' },
    { value: 'MODERATE', label: '균형적', desc: '적절한 양보, 거래 성사 밸런스', icon: '⚖️', color: '#06b6d4' },
    { value: 'AGGRESSIVE', label: '적극적', desc: '빠른 거래 성사 우선', icon: '⚡', color: '#a855f7' },
];

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string; icon: React.ReactNode }> = {
    AGREED: { bg: 'rgba(52,211,153,0.1)', color: '#34d399', label: '합의됨', icon: <CheckCircle2 size={12} /> },
    REJECTED: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', label: '거절됨', icon: <XCircle size={12} /> },
    PENDING_SELLER: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: '확인 대기', icon: <AlertTriangle size={12} /> },
    COUNTER: { bg: 'rgba(168,85,247,0.1)', color: '#a855f7', label: '역제안', icon: <MessageCircle size={12} /> },
    PENDING: { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', label: '대기', icon: <Clock size={12} /> },
    NEGOTIATING: { bg: 'rgba(34,211,238,0.1)', color: '#22d3ee', label: '협상 중', icon: <RefreshCw size={12} /> },
};

export default function SellerNegotiationSettings() {
    const [sellerApiKey, setSellerApiKey] = useState(() => localStorage.getItem('seller_api_key') || '');
    const [activeTab, setActiveTab] = useState<'policy' | 'negotiations' | 'stats'>('policy');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');

    const { policy, loading: policyLoading, refetch: refetchPolicy } = useSellerNegotiationPolicy(sellerApiKey || null);
    const { negotiations, pendingCount, loading: negLoading, refetch: refetchNegs } = useSellerNegotiations(sellerApiKey || null, statusFilter || undefined);
    const { stats, loading: statsLoading } = useSellerNegotiationStats(sellerApiKey || null);

    // Editable policy state
    const [editPolicy, setEditPolicy] = useState<any>(null);
    useEffect(() => { if (policy) setEditPolicy({ ...policy }); }, [policy]);

    // Respond to negotiation
    const [respondingId, setRespondingId] = useState<string | null>(null);
    const [respondAction, setRespondAction] = useState<'ACCEPT' | 'REJECT' | 'COUNTER'>('ACCEPT');
    const [counterPrice, setCounterPrice] = useState('');
    const [respondMessage, setRespondMessage] = useState('');
    const [expandedNeg, setExpandedNeg] = useState<string | null>(null);

    const handleSavePolicy = useCallback(async () => {
        if (!sellerApiKey || !editPolicy) return;
        setSaving(true);
        setSaveMsg('');
        try {
            await updateSellerNegotiationPolicy(sellerApiKey, {
                minAcceptMargin: editPolicy.min_accept_margin,
                autoAcceptAbove: editPolicy.auto_accept_above,
                autoRejectBelow: editPolicy.auto_reject_below,
                maxAutoRounds: editPolicy.max_auto_rounds,
                concessionStyle: editPolicy.concession_style,
                initialCounterPct: editPolicy.initial_counter_pct,
                bulkDiscountTiers: editPolicy.bulk_discount_tiers,
                manualReviewAbove: editPolicy.manual_review_above,
                notifyOnStart: editPolicy.notify_on_start,
                notifyOnPending: editPolicy.notify_on_pending,
                isActive: editPolicy.is_active,
            });
            setSaveMsg('✅ 정책이 저장되었습니다');
            refetchPolicy();
        } catch (err: any) {
            setSaveMsg('❌ 저장 실패: ' + (err.message || 'Unknown error'));
        } finally {
            setSaving(false);
            setTimeout(() => setSaveMsg(''), 3000);
        }
    }, [sellerApiKey, editPolicy, refetchPolicy]);

    const handleRespond = useCallback(async (negId: string) => {
        if (!sellerApiKey) return;
        try {
            await sellerRespondNegotiation(
                sellerApiKey, negId, respondAction,
                respondAction === 'COUNTER' ? parseInt(counterPrice) || undefined : undefined,
                respondMessage || undefined
            );
            setRespondingId(null);
            setCounterPrice('');
            setRespondMessage('');
            refetchNegs();
        } catch (err: any) {
            alert('응답 실패: ' + (err.message || ''));
        }
    }, [sellerApiKey, respondAction, counterPrice, respondMessage, refetchNegs]);

    const handleApiKeyChange = (key: string) => {
        setSellerApiKey(key);
        localStorage.setItem('seller_api_key', key);
    };

    const cardStyle: React.CSSProperties = {
        borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: 20,
    };

    // ━━━ RENDER ━━━
    return (
        <div className="page-enter" style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(16px, 4vw, 32px)' }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(168,85,247,0.15))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Shield size={22} style={{ color: 'var(--accent-amber)' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                            협상 에이전트 위임 설정
                        </h1>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                            AI 에이전트에게 가격 협상을 위임하고, 필요시 직접 개입하세요
                        </p>
                    </div>
                </div>

                {/* Seller API Key Input */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
                    <input
                        type="text"
                        value={sellerApiKey}
                        onChange={e => handleApiKeyChange(e.target.value)}
                        placeholder="셀러 API 키 입력 (slk_...)"
                        style={{
                            flex: 1, maxWidth: 360, padding: '8px 12px', borderRadius: 8,
                            border: '1px solid var(--border-medium)', background: 'var(--bg-elevated)',
                            color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none',
                        }}
                    />
                    {pendingCount > 0 && (
                        <span style={{
                            padding: '4px 10px', borderRadius: 20,
                            background: 'rgba(251,191,36,0.15)', color: '#fbbf24',
                            fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                            <AlertTriangle size={12} /> {pendingCount}건 확인 대기
                        </span>
                    )}
                </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
                {([
                    { id: 'policy' as const, label: '정책 설정', icon: <Settings size={14} /> },
                    { id: 'negotiations' as const, label: '협상 관리', icon: <Handshake size={14} />, badge: pendingCount },
                    { id: 'stats' as const, label: '통계', icon: <BarChart3 size={14} /> },
                ]).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 16px', borderRadius: 8, border: 'none',
                            background: activeTab === tab.id ? 'rgba(245,158,11,0.12)' : 'transparent',
                            color: activeTab === tab.id ? 'var(--accent-amber)' : 'var(--text-muted)',
                            fontWeight: activeTab === tab.id ? 700 : 500, fontSize: 13, cursor: 'pointer',
                            transition: 'all 150ms',
                        }}
                    >
                        {tab.icon} {tab.label}
                        {tab.badge ? (
                            <span style={{
                                minWidth: 18, height: 18, borderRadius: 9, background: '#fbbf24', color: '#000',
                                fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>{tab.badge}</span>
                        ) : null}
                    </button>
                ))}
            </div>

            {/* ━━━ TAB: Policy Settings ━━━ */}
            {activeTab === 'policy' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }} className="grid-responsive-bento">
                    {policyLoading || !editPolicy ? (
                        <div style={{ ...cardStyle, gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                            {!sellerApiKey ? '셀러 API 키를 입력하세요' : '로딩 중...'}
                        </div>
                    ) : (
                        <>
                            {/* Price Thresholds */}
                            <div style={cardStyle}>
                                <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <TrendingDown size={16} style={{ color: 'var(--accent-green)' }} /> 가격 자동 판정 범위
                                </h3>

                                {/* Visual Range Bar */}
                                <div style={{ marginBottom: 20, padding: '12px 0' }}>
                                    <div style={{ position: 'relative', height: 28, borderRadius: 14, overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${editPolicy.auto_reject_below}%`, background: 'rgba(239,68,68,0.2)', borderRadius: '14px 0 0 14px' }} />
                                        <div style={{ position: 'absolute', left: `${editPolicy.auto_reject_below}%`, top: 0, bottom: 0, width: `${editPolicy.auto_accept_above - editPolicy.auto_reject_below}%`, background: 'rgba(168,85,247,0.15)' }} />
                                        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${100 - editPolicy.auto_accept_above}%`, background: 'rgba(52,211,153,0.2)', borderRadius: '0 14px 14px 0' }} />
                                        <div style={{ position: 'absolute', top: 4, left: '2%', fontSize: 9, color: '#ef4444', fontWeight: 700 }}>자동 거절</div>
                                        <div style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: '#a855f7', fontWeight: 700 }}>AI 카운터</div>
                                        <div style={{ position: 'absolute', top: 4, right: '2%', fontSize: 9, color: '#34d399', fontWeight: 700 }}>자동 수락</div>
                                    </div>
                                </div>

                                {[
                                    { key: 'auto_accept_above', label: '자동 수락 기준 (정가 대비 %)', color: 'var(--accent-green)', min: 80, max: 100 },
                                    { key: 'auto_reject_below', label: '자동 거절 기준 (정가 대비 %)', color: 'var(--accent-red)', min: 40, max: 90 },
                                    { key: 'min_accept_margin', label: '최소 수락 마진율 (%)', color: 'var(--accent-amber)', min: 0, max: 50 },
                                    { key: 'initial_counter_pct', label: '첫 카운터 할인율 (%)', color: 'var(--accent-purple)', min: 0, max: 30 },
                                ].map(field => (
                                    <div key={field.key} style={{ marginBottom: 14 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>{field.label}</label>
                                            <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color: field.color }}>
                                                {editPolicy[field.key]}%
                                            </span>
                                        </div>
                                        <input type="range" min={field.min} max={field.max} step={0.5}
                                            value={editPolicy[field.key]}
                                            onChange={e => setEditPolicy({ ...editPolicy, [field.key]: parseFloat(e.target.value) })}
                                            style={{ width: '100%', accentColor: field.color }}
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Concession Strategy & Rounds */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={cardStyle}>
                                    <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Zap size={16} style={{ color: 'var(--accent-amber)' }} /> 양보 전략
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {CONCESSION_STYLES.map(style => (
                                            <div key={style.value}
                                                onClick={() => setEditPolicy({ ...editPolicy, concession_style: style.value })}
                                                style={{
                                                    padding: 12, borderRadius: 8, cursor: 'pointer',
                                                    background: editPolicy.concession_style === style.value ? `${style.color}10` : 'transparent',
                                                    border: editPolicy.concession_style === style.value ? `1px solid ${style.color}40` : '1px solid var(--border-subtle)',
                                                    transition: 'all 150ms',
                                                }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: 18 }}>{style.icon}</span>
                                                    <div>
                                                        <div style={{ fontSize: 12, fontWeight: 700, color: editPolicy.concession_style === style.value ? style.color : 'var(--text-primary)' }}>{style.label}</div>
                                                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{style.desc}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div style={cardStyle}>
                                    <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Bell size={16} style={{ color: 'var(--accent-cyan)' }} /> 수동 개입 설정
                                    </h3>
                                    <div style={{ marginBottom: 12 }}>
                                        <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>수동 확인 금액 한도 (₩)</label>
                                        <input type="number" value={editPolicy.manual_review_above}
                                            onChange={e => setEditPolicy({ ...editPolicy, manual_review_above: parseInt(e.target.value) || 0 })}
                                            style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-medium)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none' }}
                                        />
                                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>이 총액 초과 시 셀러 수동 확인이 필요합니다</div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {[
                                            { key: 'notify_on_start', label: '협상 시작 시 알림' },
                                            { key: 'notify_on_pending', label: '수동 확인 대기 시 알림' },
                                            { key: 'is_active', label: '정책 활성화' },
                                        ].map(toggle => (
                                            <div key={toggle.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{toggle.label}</span>
                                                <div onClick={() => setEditPolicy({ ...editPolicy, [toggle.key]: !editPolicy[toggle.key] })}
                                                    style={{
                                                        width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
                                                        background: editPolicy[toggle.key] ? 'var(--accent-green)' : 'var(--border-medium)',
                                                        position: 'relative', transition: 'background 200ms',
                                                    }}>
                                                    <div style={{
                                                        width: 16, height: 16, borderRadius: 8, background: '#fff',
                                                        position: 'absolute', top: 2, left: editPolicy[toggle.key] ? 18 : 2,
                                                        transition: 'left 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                                    }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Bulk Discount Tiers */}
                            <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
                                <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Layers size={16} style={{ color: 'var(--accent-purple)' }} /> 대량 할인 티어
                                </h3>
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    {(editPolicy.bulk_discount_tiers || []).map((tier: any, i: number) => (
                                        <div key={i} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', display: 'flex', gap: 12, alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>최소 수량</div>
                                                <input type="number" value={tier.min_qty} min={1}
                                                    onChange={e => {
                                                        const tiers = [...editPolicy.bulk_discount_tiers];
                                                        tiers[i] = { ...tiers[i], min_qty: parseInt(e.target.value) || 1 };
                                                        setEditPolicy({ ...editPolicy, bulk_discount_tiers: tiers });
                                                    }}
                                                    style={{ width: 60, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none' }}
                                                />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>할인율 (%)</div>
                                                <input type="number" value={tier.discount_pct} min={0} max={50} step={0.5}
                                                    onChange={e => {
                                                        const tiers = [...editPolicy.bulk_discount_tiers];
                                                        tiers[i] = { ...tiers[i], discount_pct: parseFloat(e.target.value) || 0 };
                                                        setEditPolicy({ ...editPolicy, bulk_discount_tiers: tiers });
                                                    }}
                                                    style={{ width: 60, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--accent-purple)', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, outline: 'none' }}
                                                />
                                            </div>
                                            <button onClick={() => {
                                                const tiers = editPolicy.bulk_discount_tiers.filter((_: any, j: number) => j !== i);
                                                setEditPolicy({ ...editPolicy, bulk_discount_tiers: tiers });
                                            }} style={{ border: 'none', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', padding: 4 }}>
                                                <XCircle size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    <button onClick={() => {
                                        const tiers = [...(editPolicy.bulk_discount_tiers || []), { min_qty: 10, discount_pct: 5 }];
                                        setEditPolicy({ ...editPolicy, bulk_discount_tiers: tiers });
                                    }} style={{
                                        padding: '10px 14px', borderRadius: 8, border: '1px dashed var(--border-medium)',
                                        background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12,
                                    }}>+ 티어 추가</button>
                                </div>
                            </div>

                            {/* Save Button */}
                            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
                                {saveMsg && <span style={{ fontSize: 12, color: saveMsg.startsWith('✅') ? 'var(--accent-green)' : 'var(--accent-red)' }}>{saveMsg}</span>}
                                <button onClick={handleSavePolicy} disabled={saving}
                                    style={{
                                        padding: '10px 28px', borderRadius: 8, border: 'none',
                                        background: saving ? 'var(--border-subtle)' : 'linear-gradient(135deg, var(--accent-amber), #d97706)',
                                        color: saving ? 'var(--text-dim)' : '#000', fontWeight: 800, fontSize: 14, cursor: saving ? 'default' : 'pointer',
                                        transition: 'all 200ms',
                                    }}>
                                    {saving ? '저장 중...' : '정책 저장'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ━━━ TAB: Negotiations Management ━━━ */}
            {activeTab === 'negotiations' && (
                <div>
                    {/* Filter Bar */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                        {['', 'PENDING_SELLER', 'COUNTER', 'AGREED', 'REJECTED'].map(s => (
                            <button key={s} onClick={() => setStatusFilter(s)}
                                style={{
                                    padding: '6px 14px', borderRadius: 20, border: 'none',
                                    background: statusFilter === s ? 'rgba(245,158,11,0.12)' : 'var(--bg-elevated)',
                                    color: statusFilter === s ? 'var(--accent-amber)' : 'var(--text-muted)',
                                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                }}>
                                {s === '' ? '전체' : (STATUS_CONFIG[s]?.label || s)}
                                {s === 'PENDING_SELLER' && pendingCount > 0 && (
                                    <span style={{ marginLeft: 4, fontWeight: 800, color: '#fbbf24' }}>({pendingCount})</span>
                                )}
                            </button>
                        ))}
                        <button onClick={() => refetchNegs()} style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                            <RefreshCw size={12} /> 새로고침
                        </button>
                    </div>

                    {!sellerApiKey ? (
                        <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>셀러 API 키를 입력하세요</div>
                    ) : negLoading ? (
                        <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>로딩 중...</div>
                    ) : negotiations.length === 0 ? (
                        <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
                            <Handshake size={32} style={{ color: 'var(--text-dim)', marginBottom: 8 }} />
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>협상 기록이 없습니다</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {negotiations.map((neg: any) => {
                                const sc = STATUS_CONFIG[neg.status] || STATUS_CONFIG.PENDING;
                                const isExpanded = expandedNeg === neg.negotiation_id;
                                const isPending = neg.status === 'PENDING_SELLER' || neg.status === 'COUNTER';
                                const isResponding = respondingId === neg.negotiation_id;

                                return (
                                    <div key={neg.negotiation_id} style={{
                                        ...cardStyle, padding: 0, overflow: 'hidden',
                                        border: isPending ? `1px solid ${sc.color}40` : '1px solid var(--border-subtle)',
                                    }}>
                                        {/* Row Header */}
                                        <div onClick={() => setExpandedNeg(isExpanded ? null : neg.negotiation_id)}
                                            style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                                    padding: '3px 10px', borderRadius: 20, background: sc.bg, color: sc.color,
                                                    fontSize: 10, fontWeight: 700,
                                                }}>{sc.icon} {sc.label}</span>
                                                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{neg.negotiation_id}</span>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {neg.product_title}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>정가</div>
                                                    <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>₩{(neg.list_price || 0).toLocaleString()}</div>
                                                </div>
                                                {neg.final_price && (
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>합의가</div>
                                                        <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>₩{neg.final_price.toLocaleString()}</div>
                                                    </div>
                                                )}
                                                {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--text-dim)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-dim)' }} />}
                                            </div>
                                        </div>

                                        {/* Expanded Detail */}
                                        {isExpanded && (
                                            <div style={{ padding: '0 20px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                                                {/* Rounds Timeline */}
                                                <div style={{ marginTop: 12, marginBottom: 12 }}>
                                                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>협상 타임라인</div>
                                                    {(neg.rounds || []).map((r: any, i: number) => {
                                                        const isBuyer = r.proposedBy === 'buyer';
                                                        return (
                                                            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, paddingLeft: 4 }}>
                                                                <div style={{
                                                                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                                                                    background: isBuyer ? 'rgba(52,211,153,0.12)' : r.manual ? 'rgba(251,191,36,0.15)' : 'rgba(168,85,247,0.12)',
                                                                    border: `1px solid ${isBuyer ? '#34d399' : r.manual ? '#fbbf24' : '#a855f7'}40`,
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                }}>
                                                                    <span style={{ fontSize: 9, fontWeight: 700, color: isBuyer ? '#34d399' : r.manual ? '#fbbf24' : '#a855f7' }}>
                                                                        {isBuyer ? 'B' : r.manual ? 'S' : 'AI'}
                                                                    </span>
                                                                </div>
                                                                <div style={{ flex: 1 }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <span style={{ fontSize: 10, fontWeight: 600, color: isBuyer ? '#34d399' : r.manual ? '#fbbf24' : '#a855f7' }}>
                                                                            {isBuyer ? '구매 에이전트' : r.manual ? '셀러 (수동)' : '셀러 AI'}
                                                                        </span>
                                                                        <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-mono)', color: isBuyer ? '#34d399' : '#a855f7' }}>₩{(r.price || 0).toLocaleString()}</span>
                                                                    </div>
                                                                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{r.message}</div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Manual Intervention Actions */}
                                                {isPending && (
                                                    <div style={{
                                                        marginTop: 12, padding: 16, borderRadius: 8,
                                                        background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)',
                                                    }}>
                                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <AlertTriangle size={14} /> 셀러 응답 필요
                                                        </div>

                                                        {!isResponding ? (
                                                            <div style={{ display: 'flex', gap: 8 }}>
                                                                <button onClick={() => { setRespondingId(neg.negotiation_id); setRespondAction('ACCEPT'); }}
                                                                    style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', background: 'rgba(52,211,153,0.15)', color: '#34d399', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                                                    <CheckCircle2 size={14} /> 수락
                                                                </button>
                                                                <button onClick={() => { setRespondingId(neg.negotiation_id); setRespondAction('COUNTER'); }}
                                                                    style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', background: 'rgba(168,85,247,0.15)', color: '#a855f7', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                                                    <MessageCircle size={14} /> 역제안
                                                                </button>
                                                                <button onClick={() => { setRespondingId(neg.negotiation_id); setRespondAction('REJECT'); }}
                                                                    style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                                                    <XCircle size={14} /> 거절
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                                <div style={{ display: 'flex', gap: 8 }}>
                                                                    {(['ACCEPT', 'COUNTER', 'REJECT'] as const).map(a => (
                                                                        <button key={a} onClick={() => setRespondAction(a)}
                                                                            style={{
                                                                                padding: '4px 12px', borderRadius: 4, border: 'none',
                                                                                background: respondAction === a ? (a === 'ACCEPT' ? '#34d399' : a === 'REJECT' ? '#ef4444' : '#a855f7') : 'var(--bg-elevated)',
                                                                                color: respondAction === a ? '#000' : 'var(--text-muted)',
                                                                                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                                                            }}>{a === 'ACCEPT' ? '수락' : a === 'REJECT' ? '거절' : '역제안'}</button>
                                                                    ))}
                                                                </div>
                                                                {respondAction === 'COUNTER' && (
                                                                    <input type="number" placeholder="역제안 단가 (₩)" value={counterPrice}
                                                                        onChange={e => setCounterPrice(e.target.value)}
                                                                        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-medium)', background: 'var(--bg-elevated)', color: 'var(--accent-purple)', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none' }}
                                                                    />
                                                                )}
                                                                <input type="text" placeholder="메시지 (선택)" value={respondMessage}
                                                                    onChange={e => setRespondMessage(e.target.value)}
                                                                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-medium)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}
                                                                />
                                                                <div style={{ display: 'flex', gap: 8 }}>
                                                                    <button onClick={() => handleRespond(neg.negotiation_id)}
                                                                        style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', background: 'linear-gradient(135deg, var(--accent-amber), #d97706)', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                                                        <Send size={12} /> 응답 전송
                                                                    </button>
                                                                    <button onClick={() => { setRespondingId(null); setCounterPrice(''); setRespondMessage(''); }}
                                                                        style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>취소</button>
                                                                </div>
                                                            </div>
                                                        )}
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
            )}

            {/* ━━━ TAB: Stats ━━━ */}
            {activeTab === 'stats' && (
                <div>
                    {!sellerApiKey ? (
                        <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>셀러 API 키를 입력하세요</div>
                    ) : statsLoading || !stats ? (
                        <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>로딩 중...</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }} className="grid-responsive-4">
                            {[
                                { label: '총 협상', value: stats.total, color: 'var(--text-secondary)', icon: <Handshake size={18} /> },
                                { label: '합의 성사', value: stats.agreed, color: 'var(--accent-green)', icon: <CheckCircle2 size={18} /> },
                                { label: '성사율', value: `${stats.successRate}%`, color: 'var(--accent-cyan)', icon: <BarChart3 size={18} /> },
                                { label: '평균 할인율', value: `${stats.avgDiscount}%`, color: 'var(--accent-purple)', icon: <TrendingDown size={18} /> },
                            ].map(c => (
                                <div key={c.label} style={{
                                    ...cardStyle, textAlign: 'center',
                                    background: 'var(--bg-card)',
                                }}>
                                    <div style={{ marginBottom: 8, opacity: 0.5 }}>{c.icon}</div>
                                    <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-mono)', color: c.color }}>{c.value}</div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{c.label}</div>
                                </div>
                            ))}
                            <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
                                <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px' }}>상태별 분포</h3>
                                <div style={{ display: 'flex', gap: 20 }}>
                                    {[
                                        { label: '확인 대기', value: stats.pending, color: '#fbbf24' },
                                        { label: '역제안 중', value: stats.counter, color: '#a855f7' },
                                        { label: '거절됨', value: stats.rejected, color: '#ef4444' },
                                    ].map(item => (
                                        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color }} />
                                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.label}</span>
                                            <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-mono)', color: item.color }}>{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
