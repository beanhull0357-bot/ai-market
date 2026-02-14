import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Activity, Bot, Package, DollarSign, AlertTriangle, CheckCircle, XCircle, Clock, RefreshCw, TrendingUp } from 'lucide-react';

interface ActivityItem {
    id: string;
    agent_role: string;
    action: string;
    target_sku: string | null;
    details: any;
    confidence: number | null;
    decision: string;
    created_at: string;
}

interface ProductCandidate {
    id: string;
    source_name: string;
    normalized_pack: any;
    confidence_score: number;
    confidence_factors: any;
    decision: string;
    reason: string;
    suggested_price: number;
    status: string;
    created_at: string;
}

const ROLE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    SOURCING: { icon: <Package size={14} />, color: '#22d3ee', label: 'Sourcing' },
    PRICING: { icon: <DollarSign size={14} />, color: '#a78bfa', label: 'Pricing' },
    OPS: { icon: <Activity size={14} />, color: '#f59e0b', label: 'Ops' },
    SYSTEM: { icon: <Bot size={14} />, color: '#6b7280', label: 'System' },
    ORDER: { icon: <Package size={14} />, color: '#34d399', label: 'Order' },
    REVIEW: { icon: <CheckCircle size={14} />, color: '#60a5fa', label: 'Review' },
};

const DECISION_BADGE: Record<string, { bg: string; text: string }> = {
    RECOMMEND: { bg: 'rgba(34,211,238,0.15)', text: '#22d3ee' },
    SKIP: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
    FLAG: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
    AUTO: { bg: 'rgba(167,139,250,0.15)', text: '#a78bfa' },
    HUMAN_APPROVED: { bg: 'rgba(52,211,153,0.15)', text: '#34d399' },
    HUMAN_REJECTED: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
    INFO: { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa' },
};

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function ActivityFeed({ activities, loading }: { activities: ActivityItem[]; loading: boolean }) {
    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#6b7280' }}>
                <RefreshCw size={20} className="animate-spin" style={{ marginRight: 8 }} /> Loading...
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
                <Bot size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <p>No agent activity yet</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>Activity will appear here when agents take actions</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {activities.map((a) => {
                const role = ROLE_CONFIG[a.agent_role] || ROLE_CONFIG.SYSTEM;
                const badge = DECISION_BADGE[a.decision] || DECISION_BADGE.INFO;
                return (
                    <div key={a.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 16px',
                        borderBottom: '1px solid #1f2937', transition: 'background 0.2s',
                    }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#111827')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                        <div style={{
                            width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: `${role.color}20`, color: role.color, flexShrink: 0, marginTop: 2,
                        }}>
                            {role.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: role.color, textTransform: 'uppercase', letterSpacing: 1 }}>
                                    {role.label}
                                </span>
                                <span style={{
                                    fontSize: 10, padding: '1px 6px', borderRadius: 4,
                                    background: badge.bg, color: badge.text, fontWeight: 600,
                                }}>
                                    {a.decision}
                                </span>
                                <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 'auto' }}>
                                    {timeAgo(a.created_at)}
                                </span>
                            </div>
                            <div style={{ fontSize: 13, color: '#e5e7eb' }}>
                                <span style={{ fontWeight: 600 }}>{a.action}</span>
                                {a.target_sku && (
                                    <span style={{ color: '#22d3ee', marginLeft: 6 }}>
                                        [{a.target_sku}]
                                    </span>
                                )}
                            </div>
                            {a.details && Object.keys(a.details).length > 0 && (
                                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3, fontFamily: 'monospace' }}>
                                    {typeof a.details === 'object' ? (
                                        Object.entries(a.details).slice(0, 4).map(([k, v]) => (
                                            <span key={k} style={{ marginRight: 12 }}>
                                                {k}: <span style={{ color: '#d1d5db' }}>{String(v)}</span>
                                            </span>
                                        ))
                                    ) : String(a.details)}
                                </div>
                            )}
                            {a.confidence !== null && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                    <div style={{
                                        width: 60, height: 4, borderRadius: 2, background: '#1f2937', overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            width: `${a.confidence}%`, height: '100%', borderRadius: 2,
                                            background: a.confidence >= 80 ? '#34d399' : a.confidence >= 50 ? '#f59e0b' : '#ef4444',
                                        }} />
                                    </div>
                                    <span style={{ fontSize: 10, color: '#9ca3af' }}>{a.confidence}%</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function StatsCards({ activities }: { activities: ActivityItem[] }) {
    const today = new Date().toDateString();
    const todayActivities = activities.filter(a => new Date(a.created_at).toDateString() === today);
    const orders = todayActivities.filter(a => a.agent_role === 'ORDER').length;
    const ops = todayActivities.filter(a => a.agent_role === 'OPS').length;
    const autoDecisions = todayActivities.filter(a => a.decision === 'AUTO').length;

    const cards = [
        { label: 'Today Activities', value: todayActivities.length, icon: <Activity size={18} />, color: '#22d3ee' },
        { label: 'Orders', value: orders, icon: <Package size={18} />, color: '#34d399' },
        { label: 'Ops Actions', value: ops, icon: <Bot size={18} />, color: '#f59e0b' },
        { label: 'Auto Decisions', value: autoDecisions, icon: <TrendingUp size={18} />, color: '#a78bfa' },
    ];

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {cards.map((c) => (
                <div key={c.label} style={{
                    background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: '16px 20px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{c.label}</span>
                        <div style={{ color: c.color, opacity: 0.7 }}>{c.icon}</div>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>
                        {c.value}
                    </div>
                </div>
            ))}
        </div>
    );
}

export function AIOps() {
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchActivities = async () => {
        try {
            const { data, error } = await supabase.rpc('get_agent_activity_log', {
                p_limit: 100,
                p_role: filter,
            });
            if (!error && data?.activities) {
                setActivities(data.activities);
            }
        } catch (e) {
            console.error('Failed to fetch activities:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActivities();
    }, [filter]);

    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchActivities, 10000); // every 10s
        return () => clearInterval(interval);
    }, [autoRefresh, filter]);

    const roles = [null, 'SOURCING', 'PRICING', 'OPS', 'ORDER', 'REVIEW', 'SYSTEM'];

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Bot size={24} style={{ color: '#22d3ee' }} />
                        AI Operations
                    </h1>
                    <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                        Real-time AI agent activity — sourcing, pricing, orders, and ops
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '6px 12px', fontSize: 12, borderRadius: 6,
                            border: `1px solid ${autoRefresh ? '#22d3ee' : '#374151'}`,
                            background: autoRefresh ? 'rgba(34,211,238,0.1)' : 'transparent',
                            color: autoRefresh ? '#22d3ee' : '#6b7280',
                            cursor: 'pointer',
                        }}
                    >
                        <RefreshCw size={12} className={autoRefresh ? 'animate-spin' : ''} />
                        {autoRefresh ? 'Live' : 'Paused'}
                    </button>
                    <button
                        onClick={() => { setLoading(true); fetchActivities(); }}
                        style={{
                            padding: '6px 12px', fontSize: 12, borderRadius: 6,
                            border: '1px solid #374151', background: 'transparent',
                            color: '#9ca3af', cursor: 'pointer',
                        }}
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats */}
            <StatsCards activities={activities} />

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #1f2937', paddingBottom: 8 }}>
                {roles.map((role) => {
                    const isActive = filter === role;
                    const config = role ? ROLE_CONFIG[role] : null;
                    return (
                        <button
                            key={role || 'all'}
                            onClick={() => setFilter(role)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '4px 10px', fontSize: 11, borderRadius: 4,
                                border: 'none', cursor: 'pointer', fontWeight: 600,
                                background: isActive ? (config?.color || '#22d3ee') + '20' : 'transparent',
                                color: isActive ? (config?.color || '#22d3ee') : '#6b7280',
                            }}
                        >
                            {config?.icon || <Activity size={12} />}
                            {config?.label || 'All'}
                        </button>
                    );
                })}
            </div>

            {/* Activity Feed */}
            <div style={{
                background: '#0d1117', border: '1px solid #1f2937', borderRadius: 8, overflow: 'hidden',
            }}>
                <div style={{
                    padding: '10px 16px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: autoRefresh ? '#34d399' : '#6b7280',
                        boxShadow: autoRefresh ? '0 0 8px #34d399' : 'none',
                    }} />
                    <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>
                        Agent Activity Feed
                    </span>
                    <span style={{ fontSize: 11, color: '#4b5563', marginLeft: 'auto' }}>
                        {activities.length} events
                    </span>
                </div>
                <ActivityFeed activities={activities} loading={loading} />
            </div>
        </div>
    );
}
