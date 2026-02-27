import React, { useState } from 'react';
import { User, ShoppingCart, Star, Gift, Webhook, Key, Shield, Loader, LogIn, TrendingUp, Clock, CheckCircle, XCircle, Award, Hash, ExternalLink, Wallet, Truck, Radio, Activity, BarChart3, ArrowUpCircle, ArrowDownCircle, MessageSquare, Package } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../supabaseClient';

type Tab = 'profile' | 'orders' | 'reviews' | 'rewards' | 'webhooks' | 'wallet' | 'a2a' | 'activity';

interface AgentInfo {
    agent_id: string;
    name: string;
    status: string;
    policy_id: string;
    trust_score: number;
    total_orders: number;
    total_reviews: number;
    tier?: string;
    created_at?: string;
    capabilities?: string[];
    success: boolean;
}

/* ━━━ Stat Card ━━━ */
const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; color: string }> = ({ icon, label, value, color }) => (
    <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
    }}>
        <div style={{ padding: 10, borderRadius: 10, background: `${color}15`, color }}>{icon}</div>
        <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{value}</div>
        </div>
    </div>
);

/* ━━━ Tab Button ━━━ */
const TabBtn: React.FC<{ active: boolean; icon: React.ReactNode; label: string; onClick: () => void }> = ({ active, icon, label, onClick }) => (
    <button onClick={onClick} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8,
        border: active ? '1px solid rgba(59,130,246,0.5)' : '1px solid transparent',
        background: active ? 'rgba(59,130,246,0.1)' : 'transparent',
        color: active ? '#60a5fa' : 'var(--text-tertiary)',
        cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400,
        transition: 'all 0.2s', whiteSpace: 'nowrap',
    }}>
        {icon} {label}
    </button>
);

const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; fg: string }> = {
        DELIVERED: { bg: 'rgba(34,197,94,0.15)', fg: '#22c55e' },
        SHIPPED: { bg: 'rgba(59,130,246,0.15)', fg: '#60a5fa' },
        CONFIRMED: { bg: 'rgba(34,197,94,0.15)', fg: '#22c55e' },
        VOIDED: { bg: 'rgba(239,68,68,0.15)', fg: '#ef4444' },
        CANCELLED: { bg: 'rgba(239,68,68,0.15)', fg: '#ef4444' },
    };
    const c = colors[status] || { bg: 'rgba(234,179,8,0.15)', fg: '#eab308' };
    return { fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600 as const, background: c.bg, color: c.fg };
};

/* ━━━ Orders Tab (Enhanced with Delivery Tracking) ━━━ */
const OrdersTab: React.FC<{ agentId: string }> = ({ agentId }) => {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);

    React.useEffect(() => {
        (async () => {
            try {
                const { data } = await supabase.from('orders')
                    .select('*, domeggook_order_map(dome_order_no, dome_status, dome_tracking_company_name, dome_tracking_code, updated_at)')
                    .eq('agent_id', agentId)
                    .order('created_at', { ascending: false }).limit(30);
                setOrders(data || []);
            } finally { setLoading(false); }
        })();
    }, [agentId]);

    if (loading) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}><Loader size={20} className="animate-spin" /></div>;
    if (orders.length === 0) return (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
            <ShoppingCart size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>No orders yet</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Create your first order via the API</p>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {orders.map((o: any) => {
                const dm = o.domeggook_order_map?.[0];
                const isExpanded = expanded === o.order_id;
                return (
                    <div key={o.order_id || o.id} style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 10, padding: '14px 18px', cursor: 'pointer',
                    }} onClick={() => setExpanded(isExpanded ? null : o.order_id)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{o.order_id}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                    SKU: {o.sku} × {o.qty} · {new Date(o.created_at).toLocaleDateString()}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#60a5fa' }}>₩{(o.amount || 0).toLocaleString()}</div>
                                <span style={statusBadge(o.status)}>{o.status}</span>
                            </div>
                        </div>

                        {/* Expanded: Order Details & Delivery Tracking */}
                        {isExpanded && (
                            <div style={{
                                marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)',
                                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12,
                            }}>
                                {/* ── 공통 주문 정보 (모든 상품) ── */}
                                <div>
                                    <span style={{ color: 'var(--text-tertiary)' }}>상품출처: </span>
                                    <span style={{
                                        padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                        background: o.source === 'domeggook' ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)',
                                        color: o.source === 'domeggook' ? '#eab308' : '#22c55e',
                                    }}>{o.source === 'domeggook' ? '도매꾹 위탁' : o.seller_id ? '셀러 직접' : '직접 등록'}</span>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--text-tertiary)' }}>결제방식: </span>
                                    <span style={{ color: 'var(--text-primary)' }}>{o.payment_method || 'payapp'}</span>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--text-tertiary)' }}>발주상태: </span>
                                    <span style={{
                                        color: o.procurement_status === 'delivered' ? '#22c55e'
                                            : o.procurement_status === 'shipped' ? '#60a5fa'
                                                : o.procurement_status === 'ordered' ? '#a855f7'
                                                    : o.procurement_status === 'cancelled' || o.procurement_status === 'error' ? '#ef4444'
                                                        : '#eab308',
                                        fontWeight: 600,
                                    }}>
                                        {o.procurement_status === 'pending' ? '처리대기'
                                            : o.procurement_status === 'exported' ? '발주준비'
                                                : o.procurement_status === 'ordered' ? '발주완료'
                                                    : o.procurement_status === 'shipped' ? '배송중'
                                                        : o.procurement_status === 'delivered' ? '배송완료'
                                                            : o.procurement_status === 'cancelled' ? '취소됨'
                                                                : o.procurement_status === 'error' ? '오류'
                                                                    : o.procurement_status || '대기중'}
                                    </span>
                                </div>
                                {o.recipient_name && (
                                    <div>
                                        <span style={{ color: 'var(--text-tertiary)' }}>수령인: </span>
                                        <span style={{ color: 'var(--text-primary)' }}>{o.recipient_name}</span>
                                    </div>
                                )}

                                {/* ── 공통 운송장 (셀러 직접 등록 or 도매꾹 동기화) ── */}
                                {o.tracking_number && (
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <Truck size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', color: '#60a5fa' }} />
                                        <span style={{ color: 'var(--text-tertiary)' }}>운송장: </span>
                                        <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                            {o.carrier ? `${o.carrier} ` : ''}{o.tracking_number}
                                        </span>
                                    </div>
                                )}

                                {/* ── 도매꾹 전용 정보 (도매꾹 위탁 상품인 경우에만) ── */}
                                {dm && (
                                    <div style={{
                                        gridColumn: '1 / -1', marginTop: 4, padding: '8px 12px', borderRadius: 8,
                                        background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.1)',
                                    }}>
                                        <div style={{ fontSize: 10, color: '#eab308', fontWeight: 600, marginBottom: 6 }}>
                                            도매꾹 발주 정보
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                            <div>
                                                <span style={{ color: 'var(--text-tertiary)' }}>주문번호: </span>
                                                <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{dm.dome_order_no}</span>
                                            </div>
                                            <div>
                                                <span style={{ color: 'var(--text-tertiary)' }}>상태: </span>
                                                <span style={statusBadge(dm.dome_status || 'PENDING')}>{dm.dome_status || '처리중'}</span>
                                            </div>
                                            {dm.dome_tracking_code && (
                                                <div style={{ gridColumn: '1 / -1' }}>
                                                    <Truck size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', color: '#eab308' }} />
                                                    <span style={{ color: 'var(--text-primary)' }}>
                                                        {dm.dome_tracking_company_name} {dm.dome_tracking_code}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

/* ━━━ Reviews Tab ━━━ */
const ReviewsTab: React.FC<{ agentId: string }> = ({ agentId }) => {
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        (async () => {
            try {
                const { data } = await supabase.from('agent_reviews').select('*').eq('agent_id', agentId).order('created_at', { ascending: false }).limit(20);
                setReviews(data || []);
            } finally { setLoading(false); }
        })();
    }, [agentId]);

    if (loading) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}><Loader size={20} className="animate-spin" /></div>;
    if (reviews.length === 0) return (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
            <Star size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>No reviews submitted</p>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reviews.map((r: any) => (
                <div key={r.id || r.review_id} style={{
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10, padding: '14px 18px',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <code style={{ fontSize: 12, color: '#60a5fa' }}>{r.target_sku || r.sku}</code>
                        <span style={statusBadge(r.verdict === 'ENDORSE' ? 'CONFIRMED' : r.verdict === 'WARN' ? 'PENDING' : 'VOIDED')}>
                            {r.verdict || 'N/A'}
                        </span>
                    </div>
                    {r.review_text && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{r.review_text.slice(0, 100)}</div>}
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, display: 'flex', gap: 16 }}>
                        {r.spec_compliance != null && <span>Spec: {Math.round(r.spec_compliance * 100)}%</span>}
                        {r.fulfillment_delta != null && <span>Δ{r.fulfillment_delta}h</span>}
                        <span>{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

/* ━━━ Rewards Tab ━━━ */
const RewardsTab: React.FC<{ apiKey: string }> = ({ apiKey }) => {
    const [rewards, setRewards] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        (async () => {
            try {
                const { data } = await supabase.rpc('get_agent_rewards', { p_api_key: apiKey });
                setRewards(data);
            } finally { setLoading(false); }
        })();
    }, [apiKey]);

    if (loading) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}><Loader size={20} className="animate-spin" /></div>;
    if (!rewards || !rewards.success) return (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
            <Gift size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>Loyalty rewards not available yet</p>
        </div>
    );

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            <StatCard icon={<Award size={18} />} label="Tier" value={rewards.tier || 'Standard'} color="#a855f7" />
            <StatCard icon={<Gift size={18} />} label="Credits" value={`₩${(rewards.credits || 0).toLocaleString()}`} color="#22c55e" />
            <StatCard icon={<TrendingUp size={18} />} label="Discount" value={`${rewards.discount_pct || 0}%`} color="#3b82f6" />
            <StatCard icon={<Hash size={18} />} label="Referral Code" value={rewards.referral_code || 'N/A'} color="#eab308" />
        </div>
    );
};

/* ━━━ Webhooks Tab ━━━ */
const WebhooksTab: React.FC<{ agentId: string }> = ({ agentId }) => {
    const [webhooks, setWebhooks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        (async () => {
            try {
                const { data } = await supabase.from('agent_webhooks').select('*').eq('agent_id', agentId).order('created_at', { ascending: false });
                setWebhooks(data || []);
            } finally { setLoading(false); }
        })();
    }, [agentId]);

    if (loading) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}><Loader size={20} className="animate-spin" /></div>;
    if (webhooks.length === 0) return (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
            <Webhook size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>No webhook subscriptions</p>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {webhooks.map((w: any) => (
                <div key={w.id} style={{
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10, padding: '14px 18px',
                }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: w.active ? '#22c55e' : '#ef4444' }}>
                        {w.active ? <CheckCircle size={12} style={{ display: 'inline', marginRight: 4 }} /> : <XCircle size={12} style={{ display: 'inline', marginRight: 4 }} />}
                        {w.callback_url}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(w.events || []).map((e: string) => (
                            <span key={e} style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>{e}</span>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

/* ━━━ NEW: Wallet Tab ━━━ */
const WalletTab: React.FC<{ apiKey: string }> = ({ apiKey }) => {
    const [wallet, setWallet] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        (async () => {
            try {
                const { data } = await supabase.rpc('get_wallet_info', { p_api_key: apiKey });
                setWallet(data);
            } finally { setLoading(false); }
        })();
    }, [apiKey]);

    if (loading) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}><Loader size={20} className="animate-spin" /></div>;
    if (!wallet || !wallet.success) return (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
            <Wallet size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>Wallet not activated yet</p>
        </div>
    );

    return (
        <div>
            {/* Balance Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
                <StatCard icon={<Wallet size={18} />} label="Balance" value={`₩${(wallet.balance || 0).toLocaleString()}`} color="#22c55e" />
                <StatCard icon={<ArrowDownCircle size={18} />} label="Total Deposited" value={`₩${(wallet.total_deposited || 0).toLocaleString()}`} color="#3b82f6" />
                <StatCard icon={<ArrowUpCircle size={18} />} label="Total Spent" value={`₩${(wallet.total_spent || 0).toLocaleString()}`} color="#ef4444" />
            </div>

            {/* Recent Transactions */}
            <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Recent Transactions</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(wallet.recent_transactions || []).length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: 20 }}>No transactions yet</div>
                ) : (wallet.recent_transactions || []).map((tx: any, i: number) => (
                    <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8,
                    }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: tx.type === 'deposit' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        }}>
                            {tx.type === 'deposit'
                                ? <ArrowDownCircle size={14} style={{ color: '#22c55e' }} />
                                : <ArrowUpCircle size={14} style={{ color: '#ef4444' }} />
                            }
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{tx.description || tx.type}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{new Date(tx.created_at).toLocaleString()}</div>
                        </div>
                        <div style={{
                            fontSize: 13, fontWeight: 700,
                            color: tx.type === 'deposit' ? '#22c55e' : '#ef4444',
                        }}>
                            {tx.type === 'deposit' ? '+' : '-'}₩{Math.abs(tx.amount || 0).toLocaleString()}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ━━━ NEW: A2A Activity Tab ━━━ */
const A2ATab: React.FC<{ agentId: string }> = ({ agentId }) => {
    const [queries, setQueries] = useState<any[]>([]);
    const [responses, setResponses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        (async () => {
            try {
                const [qRes, rRes] = await Promise.all([
                    supabase.from('a2a_queries').select('*').eq('author_id', agentId).order('created_at', { ascending: false }).limit(15),
                    supabase.from('a2a_responses').select('*, a2a_queries(question, query_type)').eq('responder_id', agentId).order('created_at', { ascending: false }).limit(15),
                ]);
                setQueries(qRes.data || []);
                setResponses(rRes.data || []);
            } finally { setLoading(false); }
        })();
    }, [agentId]);

    if (loading) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}><Loader size={20} className="animate-spin" /></div>;
    if (queries.length === 0 && responses.length === 0) return (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
            <Radio size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>No A2A activity yet</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Broadcast a question or respond to other agents' queries</p>
        </div>
    );

    return (
        <div>
            {/* My Questions */}
            {queries.length > 0 && (
                <>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MessageSquare size={14} /> My Questions ({queries.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
                        {queries.map((q: any) => (
                            <div key={q.id} style={{
                                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 10, padding: '12px 16px',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(59,130,246,0.1)', color: '#60a5fa', fontWeight: 600 }}>
                                        {q.query_type || 'GENERAL'}
                                    </span>
                                    <span style={statusBadge(q.status === 'OPEN' ? 'PENDING' : q.status === 'RESOLVED' ? 'CONFIRMED' : 'VOIDED')}>
                                        {q.status}
                                    </span>
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{q.question}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
                                    {q.response_count || 0} responses · {new Date(q.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* My Responses */}
            {responses.length > 0 && (
                <>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Radio size={14} /> My Responses ({responses.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {responses.map((r: any) => (
                            <div key={r.id} style={{
                                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 10, padding: '12px 16px',
                            }}>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                                    Re: {r.a2a_queries?.question?.slice(0, 60) || 'Query'}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={statusBadge(r.verdict === 'ENDORSE' ? 'CONFIRMED' : r.verdict === 'WARN' ? 'PENDING' : 'VOIDED')}>
                                        {r.verdict}
                                    </span>
                                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                        Confidence: {Math.round((r.confidence || 0) * 100)}%
                                    </span>
                                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                                        {new Date(r.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                {r.message && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{r.message}</div>}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

/* ━━━ NEW: Activity Timeline Tab ━━━ */
const ActivityTab: React.FC<{ agentId: string }> = ({ agentId }) => {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        (async () => {
            try {
                // Combine order events and activity log
                const [evtRes, logRes] = await Promise.all([
                    supabase.from('order_events').select('*').eq('agent_id', agentId).order('created_at', { ascending: false }).limit(30),
                    supabase.from('agent_activity_log').select('*').eq('agent_id', agentId).order('created_at', { ascending: false }).limit(30),
                ]);
                const allEvents = [
                    ...(evtRes.data || []).map((e: any) => ({ ...e, source: 'order' })),
                    ...(logRes.data || []).map((e: any) => ({ ...e, source: 'activity', event_type: e.action_type })),
                ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .slice(0, 50);
                setEvents(allEvents);
            } finally { setLoading(false); }
        })();
    }, [agentId]);

    if (loading) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}><Loader size={20} className="animate-spin" /></div>;
    if (events.length === 0) return (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
            <Activity size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>No activity recorded yet</p>
        </div>
    );

    const iconFor = (type: string) => {
        if (type?.includes('ORDER')) return <ShoppingCart size={12} style={{ color: '#60a5fa' }} />;
        if (type?.includes('REVIEW')) return <Star size={12} style={{ color: '#a855f7' }} />;
        if (type?.includes('LOGIN') || type?.includes('AUTH')) return <Key size={12} style={{ color: '#eab308' }} />;
        if (type?.includes('WEBHOOK')) return <Webhook size={12} style={{ color: '#22c55e' }} />;
        if (type?.includes('PAYMENT') || type?.includes('WALLET')) return <Wallet size={12} style={{ color: '#22c55e' }} />;
        return <Activity size={12} style={{ color: 'var(--text-tertiary)' }} />;
    };

    let lastDate = '';
    return (
        <div style={{ position: 'relative' }}>
            {events.map((ev: any, i: number) => {
                const date = new Date(ev.created_at).toLocaleDateString();
                const showDate = date !== lastDate;
                lastDate = date;
                return (
                    <React.Fragment key={i}>
                        {showDate && (
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', padding: '12px 0 6px', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                                {date}
                            </div>
                        )}
                        <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 0',
                            borderLeft: '2px solid rgba(255,255,255,0.06)', marginLeft: 8, paddingLeft: 16,
                        }}>
                            <div style={{
                                width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(255,255,255,0.05)', flexShrink: 0,
                            }}>
                                {iconFor(ev.event_type)}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {ev.event_type || ev.action_type || 'Event'}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                    {ev.order_id && <span style={{ marginRight: 8 }}>{ev.order_id}</span>}
                                    {ev.detail && <span>{typeof ev.detail === 'object' ? JSON.stringify(ev.detail).slice(0, 80) : String(ev.detail).slice(0, 80)}</span>}
                                </div>
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {new Date(ev.created_at).toLocaleTimeString()}
                            </div>
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
};

/* ━━━ Main Agent Portal ━━━ */
export const AgentPortal: React.FC = () => {
    const { t } = useLanguage();
    const [apiKey, setApiKey] = useState('');
    const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<Tab>('profile');
    const [spendingStats, setSpendingStats] = useState<{ thisMonth: number; lastMonth: number; avgOrder: number } | null>(null);

    const handleAuth = async () => {
        if (!apiKey.trim()) return;
        setLoading(true);
        setError('');
        const { data, error: err } = await supabase.rpc('authenticate_agent', { p_api_key: apiKey });
        if (err) { setError(err.message); setLoading(false); return; }
        if (data?.success) {
            setAgentInfo(data);
            // Load spending stats
            loadSpendingStats(data.agent_id);
        } else {
            setError(data?.error || 'Authentication failed');
        }
        setLoading(false);
    };

    const loadSpendingStats = async (agentId: string) => {
        try {
            const now = new Date();
            const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

            const { data: allOrders } = await supabase.from('orders')
                .select('amount, created_at')
                .eq('agent_id', agentId)
                .not('status', 'eq', 'VOIDED');

            if (allOrders && allOrders.length > 0) {
                const thisMonth = allOrders.filter(o => o.created_at >= thisMonthStart).reduce((s, o) => s + (o.amount || 0), 0);
                const lastMonth = allOrders.filter(o => o.created_at >= lastMonthStart && o.created_at < thisMonthStart).reduce((s, o) => s + (o.amount || 0), 0);
                const avg = Math.round(allOrders.reduce((s, o) => s + (o.amount || 0), 0) / allOrders.length);
                setSpendingStats({ thisMonth, lastMonth, avgOrder: avg });
            }
        } catch { /* silent */ }
    };

    const handleLogout = () => {
        setAgentInfo(null);
        setApiKey('');
        setActiveTab('profile');
        setSpendingStats(null);
    };

    /* ━━━ Login Screen ━━━ */
    if (!agentInfo) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <div style={{
                    width: '100%', maxWidth: 440, background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 40,
                }}>
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
                            background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(168,85,247,0.2))',
                            border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <User size={28} style={{ color: '#60a5fa' }} />
                        </div>
                        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Agent Portal</h1>
                        <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Sign in with your API key to view your agent's dashboard</p>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                            <Key size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> API Key
                        </label>
                        <input
                            type="password" placeholder="agk_..."
                            value={apiKey} onChange={e => setApiKey(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAuth()}
                            style={{
                                width: '100%', padding: '12px 16px', borderRadius: 10,
                                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                                color: 'var(--text-primary)', fontSize: 14, fontFamily: 'monospace',
                                outline: 'none', boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {error && (
                        <div style={{ fontSize: 12, color: '#ef4444', padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', marginBottom: 16, border: '1px solid rgba(239,68,68,0.2)' }}>
                            {error}
                        </div>
                    )}

                    <button onClick={handleAuth} disabled={loading || !apiKey.trim()} style={{
                        width: '100%', padding: '12px 0', borderRadius: 10,
                        background: apiKey.trim() ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'rgba(255,255,255,0.05)',
                        border: 'none', color: apiKey.trim() ? 'white' : 'var(--text-tertiary)',
                        fontSize: 14, fontWeight: 600, cursor: apiKey.trim() ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                        {loading ? <Loader size={16} className="animate-spin" /> : <LogIn size={16} />}
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>

                    <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'center', gap: 16 }}>
                        <a href="/#/agent/docs" style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                            <ExternalLink size={10} /> API Docs
                        </a>
                        <a href="/#/playground" style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                            <ExternalLink size={10} /> Playground
                        </a>
                        <a href="/#/swagger" style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                            <ExternalLink size={10} /> Swagger
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    /* ━━━ Dashboard ━━━ */
    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: 24 }}>
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 12,
                                background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(168,85,247,0.2))',
                                border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <User size={20} style={{ color: '#60a5fa' }} />
                            </div>
                            <div>
                                <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{agentInfo.name}</h1>
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{agentInfo.agent_id}</div>
                            </div>
                        </div>
                    </div>
                    <button onClick={handleLogout} style={{
                        padding: '8px 16px', borderRadius: 8,
                        border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)',
                        color: '#ef4444', fontSize: 12, cursor: 'pointer',
                    }}>Sign Out</button>
                </div>

                {/* Stats Grid (Enhanced) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
                    <StatCard icon={<ShoppingCart size={18} />} label="Total Orders" value={agentInfo.total_orders || 0} color="#3b82f6" />
                    <StatCard icon={<Star size={18} />} label="Reviews" value={agentInfo.total_reviews || 0} color="#a855f7" />
                    <StatCard icon={<Shield size={18} />} label="Trust Score" value={agentInfo.trust_score || 'N/A'} color="#22c55e" />
                    {spendingStats && (
                        <>
                            <StatCard icon={<BarChart3 size={18} />} label="This Month" value={`₩${spendingStats.thisMonth.toLocaleString()}`} color="#60a5fa" />
                            <StatCard icon={<TrendingUp size={18} />} label="Last Month" value={`₩${spendingStats.lastMonth.toLocaleString()}`} color="#eab308" />
                            <StatCard icon={<Package size={18} />} label="Avg Order" value={`₩${spendingStats.avgOrder.toLocaleString()}`} color="#f472b6" />
                        </>
                    )}
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
                    <TabBtn active={activeTab === 'profile'} icon={<User size={14} />} label="Profile" onClick={() => setActiveTab('profile')} />
                    <TabBtn active={activeTab === 'orders'} icon={<ShoppingCart size={14} />} label="Orders" onClick={() => setActiveTab('orders')} />
                    <TabBtn active={activeTab === 'wallet'} icon={<Wallet size={14} />} label="Wallet" onClick={() => setActiveTab('wallet')} />
                    <TabBtn active={activeTab === 'reviews'} icon={<Star size={14} />} label="Reviews" onClick={() => setActiveTab('reviews')} />
                    <TabBtn active={activeTab === 'a2a'} icon={<Radio size={14} />} label="A2A" onClick={() => setActiveTab('a2a')} />
                    <TabBtn active={activeTab === 'activity'} icon={<Activity size={14} />} label="Activity" onClick={() => setActiveTab('activity')} />
                    <TabBtn active={activeTab === 'rewards'} icon={<Gift size={14} />} label="Rewards" onClick={() => setActiveTab('rewards')} />
                    <TabBtn active={activeTab === 'webhooks'} icon={<Webhook size={14} />} label="Webhooks" onClick={() => setActiveTab('webhooks')} />
                </div>

                {/* Tab Content */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 24 }}>
                    {activeTab === 'profile' && (
                        <div>
                            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Agent Profile</h3>
                            <div style={{ display: 'grid', gap: 12 }}>
                                {[
                                    { label: 'Agent ID', value: agentInfo.agent_id },
                                    { label: 'Name', value: agentInfo.name },
                                    { label: 'Status', value: agentInfo.status || 'ACTIVE' },
                                    { label: 'Policy ID', value: agentInfo.policy_id || 'POL-DEFAULT' },
                                    { label: 'Trust Score', value: agentInfo.trust_score || 'N/A' },
                                    { label: 'Tier', value: agentInfo.tier || 'Standard' },
                                    { label: 'Registered', value: agentInfo.created_at ? new Date(agentInfo.created_at).toLocaleDateString() : 'N/A' },
                                    { label: 'Capabilities', value: (agentInfo.capabilities || []).join(', ') || 'None specified' },
                                ].map(item => (
                                    <div key={item.label} style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 10 }}>
                                        <span style={{ width: 140, fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>{item.label}</span>
                                        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{item.value}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: 24, padding: 16, borderRadius: 10, background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.15)' }}>
                                <div style={{ fontSize: 11, color: '#eab308', fontWeight: 600, marginBottom: 6 }}>
                                    <Key size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> YOUR API KEY
                                </div>
                                <code style={{ fontSize: 12, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                                    {apiKey.slice(0, 8)}{'•'.repeat(20)}{apiKey.slice(-4)}
                                </code>
                            </div>
                        </div>
                    )}
                    {activeTab === 'orders' && <OrdersTab agentId={agentInfo.agent_id} />}
                    {activeTab === 'wallet' && <WalletTab apiKey={apiKey} />}
                    {activeTab === 'reviews' && <ReviewsTab agentId={agentInfo.agent_id} />}
                    {activeTab === 'a2a' && <A2ATab agentId={agentInfo.agent_id} />}
                    {activeTab === 'activity' && <ActivityTab agentId={agentInfo.agent_id} />}
                    {activeTab === 'rewards' && <RewardsTab apiKey={apiKey} />}
                    {activeTab === 'webhooks' && <WebhooksTab agentId={agentInfo.agent_id} />}
                </div>
            </div>
        </div>
    );
};
