import React, { useState } from 'react';
import { User, ShoppingCart, Star, Gift, Webhook, Key, Shield, Loader, LogIn, TrendingUp, Clock, CheckCircle, XCircle, Award, Hash, ExternalLink } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../supabaseClient';

type Tab = 'profile' | 'orders' | 'reviews' | 'rewards' | 'webhooks';

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
        transition: 'all 0.2s',
    }}>
        {icon} {label}
    </button>
);

/* ━━━ Orders Tab ━━━ */
const OrdersTab: React.FC<{ agentId: string }> = ({ agentId }) => {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        (async () => {
            try {
                const { data } = await supabase.from('orders').select('*').eq('agent_id', agentId).order('created_at', { ascending: false }).limit(20);
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
            {orders.map((o: any) => (
                <div key={o.order_id || o.id} style={{
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16,
                }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{o.order_id}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>SKU: {o.sku} × {o.qty}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#60a5fa' }}>₩{(o.amount || 0).toLocaleString()}</div>
                        <span style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                            background: o.status === 'DELIVERED' ? 'rgba(34,197,94,0.15)' : o.status === 'VOIDED' ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)',
                            color: o.status === 'DELIVERED' ? '#22c55e' : o.status === 'VOIDED' ? '#ef4444' : '#eab308',
                        }}>{o.status}</span>
                    </div>
                </div>
            ))}
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
            <p style={{ fontSize: 12, marginTop: 4 }}>Submit reviews via POST /v1/reviews</p>
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
                        <code style={{ fontSize: 12, color: '#60a5fa' }}>{r.sku}</code>
                        <span style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
                            background: r.verdict === 'ENDORSE' ? 'rgba(34,197,94,0.15)' : r.verdict === 'WARN' ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
                            color: r.verdict === 'ENDORSE' ? '#22c55e' : r.verdict === 'WARN' ? '#eab308' : '#ef4444',
                        }}>{r.verdict || 'N/A'}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, display: 'flex', gap: 16 }}>
                        {r.spec_compliance != null && <span>Spec: {Math.round(r.spec_compliance * 100)}%</span>}
                        {r.fulfillment_delta != null && <span>Δ{r.fulfillment_delta}h</span>}
                        {r.api_latency_ms != null && <span>{r.api_latency_ms}ms</span>}
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
            <p style={{ fontSize: 12, marginTop: 4 }}>Complete more orders to unlock rewards</p>
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
            <p style={{ fontSize: 12, marginTop: 4 }}>Register via POST /v1/webhooks</p>
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

/* ━━━ Main Agent Portal ━━━ */
export const AgentPortal: React.FC = () => {
    const { t } = useLanguage();
    const [apiKey, setApiKey] = useState('');
    const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<Tab>('profile');

    const handleAuth = async () => {
        if (!apiKey.trim()) return;
        setLoading(true);
        setError('');
        const { data, error: err } = await supabase.rpc('authenticate_agent', { p_api_key: apiKey });
        if (err) { setError(err.message); setLoading(false); return; }
        if (data?.success) {
            setAgentInfo(data);
        } else {
            setError(data?.error || 'Authentication failed');
        }
        setLoading(false);
    };

    const handleLogout = () => {
        setAgentInfo(null);
        setApiKey('');
        setActiveTab('profile');
    };

    /* ━━━ Login Screen ━━━ */
    if (!agentInfo) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <div style={{
                    width: '100%', maxWidth: 440, background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 40,
                }}>
                    {/* Logo */}
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
                            background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(168,85,247,0.2))',
                            border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <User size={28} style={{ color: '#60a5fa' }} />
                        </div>
                        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Agent Portal</h1>
                        <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Sign in with your API key to access your dashboard</p>
                    </div>

                    {/* API Key Input */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                            <Key size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> API Key
                        </label>
                        <input
                            type="password"
                            placeholder="agk_..."
                            value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
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
                        transition: 'all 0.2s',
                    }}>
                        {loading ? <Loader size={16} className="animate-spin" /> : <LogIn size={16} />}
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>

                    {/* Quick Links */}
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
            <div style={{ maxWidth: 960, margin: '0 auto' }}>
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

                {/* Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
                    <StatCard icon={<ShoppingCart size={18} />} label="Total Orders" value={agentInfo.total_orders || 0} color="#3b82f6" />
                    <StatCard icon={<Star size={18} />} label="Total Reviews" value={agentInfo.total_reviews || 0} color="#a855f7" />
                    <StatCard icon={<Shield size={18} />} label="Trust Score" value={agentInfo.trust_score || 'N/A'} color="#22c55e" />
                    <StatCard icon={<Key size={18} />} label="Policy" value={agentInfo.policy_id || 'DEFAULT'} color="#eab308" />
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
                    <TabBtn active={activeTab === 'profile'} icon={<User size={14} />} label="Profile" onClick={() => setActiveTab('profile')} />
                    <TabBtn active={activeTab === 'orders'} icon={<ShoppingCart size={14} />} label="Orders" onClick={() => setActiveTab('orders')} />
                    <TabBtn active={activeTab === 'reviews'} icon={<Star size={14} />} label="Reviews" onClick={() => setActiveTab('reviews')} />
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
                                    { label: 'Capabilities', value: (agentInfo.capabilities || []).join(', ') || 'None specified' },
                                ].map(item => (
                                    <div key={item.label} style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 10 }}>
                                        <span style={{ width: 140, fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>{item.label}</span>
                                        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{item.value}</span>
                                    </div>
                                ))}
                            </div>

                            {/* API Key Info */}
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
                    {activeTab === 'reviews' && <ReviewsTab agentId={agentInfo.agent_id} />}
                    {activeTab === 'rewards' && <RewardsTab apiKey={apiKey} />}
                    {activeTab === 'webhooks' && <WebhooksTab agentId={agentInfo.agent_id} />}
                </div>
            </div>
        </div>
    );
};
