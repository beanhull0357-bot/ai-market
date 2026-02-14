import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Activity, Bot, Package, DollarSign, CheckCircle, AlertTriangle, RefreshCw, Eye, Radio } from 'lucide-react';

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

const ROLE_ICONS: Record<string, { icon: string; color: string }> = {
    SOURCING: { icon: '🔍', color: '#22d3ee' },
    PRICING: { icon: '💰', color: '#a78bfa' },
    OPS: { icon: '⚙️', color: '#f59e0b' },
    SYSTEM: { icon: '🤖', color: '#6b7280' },
    ORDER: { icon: '📦', color: '#34d399' },
    REVIEW: { icon: '⭐', color: '#60a5fa' },
};

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function maskValue(val: string): string {
    if (!val) return '';
    if (val.length <= 4) return '****';
    return val.substring(0, 2) + '***' + val.substring(val.length - 2);
}

export function LiveFeed() {
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isLive, setIsLive] = useState(true);
    const [count, setCount] = useState(0);
    const feedRef = useRef<HTMLDivElement>(null);

    const fetchActivities = async () => {
        try {
            const { data, error } = await supabase.rpc('get_agent_activity_log', { p_limit: 50, p_role: null });
            if (!error && data?.activities) {
                setActivities(data.activities);
                setCount(data.activities.length);
            }
        } catch (e) {
            console.error('Failed to fetch activities:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchActivities(); }, []);
    useEffect(() => {
        if (!isLive) return;
        const interval = setInterval(fetchActivities, 8000);
        return () => clearInterval(interval);
    }, [isLive]);

    return (
        <div style={{
            minHeight: '100vh', background: '#000', color: '#e5e7eb',
            fontFamily: "'Inter', -apple-system, sans-serif",
        }}>
            {/* Hero Header */}
            <div style={{
                padding: '40px 24px 24px', textAlign: 'center',
                background: 'linear-gradient(180deg, #0a0a1a 0%, #000 100%)',
                borderBottom: '1px solid #1f2937',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: isLive ? '#34d399' : '#ef4444',
                        boxShadow: isLive ? '0 0 12px #34d399, 0 0 24px rgba(52,211,153,0.3)' : 'none',
                        animation: isLive ? 'pulse 2s infinite' : 'none',
                    }} />
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: isLive ? '#34d399' : '#ef4444', textTransform: 'uppercase' }}>
                        {isLive ? 'LIVE' : 'PAUSED'}
                    </span>
                </div>
                <h1 style={{
                    fontSize: 32, fontWeight: 900, color: '#fff', margin: '0 0 8px',
                    background: 'linear-gradient(135deg, #22d3ee, #a78bfa, #f59e0b)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                    JSONMart AI Operations
                </h1>
                <p style={{ fontSize: 14, color: '#6b7280', maxWidth: 500, margin: '0 auto' }}>
                    Real-time proof that AI agents are actively sourcing, pricing, and managing operations.
                    Every decision is logged and transparent.
                </p>

                {/* Live Stats */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 24 }}>
                    {[
                        { label: 'Events (24h)', value: count, color: '#22d3ee' },
                        { label: 'Active Agents', value: new Set(activities.map(a => a.agent_role)).size, color: '#a78bfa' },
                        { label: 'Auto Decisions', value: activities.filter(a => a.decision === 'AUTO').length, color: '#34d399' },
                    ].map(s => (
                        <div key={s.label} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>
                                {s.value}
                            </div>
                            <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, letterSpacing: 1 }}>
                                {s.label.toUpperCase()}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Feed */}
            <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px 16px 80px' }} ref={feedRef}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>
                        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
                        <p style={{ marginTop: 8 }}>Loading agent activity...</p>
                    </div>
                ) : activities.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>
                        <Bot size={48} style={{ opacity: 0.3, margin: '0 auto' }} />
                        <p style={{ marginTop: 12 }}>No activity yet. Agents will appear here when active.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {activities.map((a, i) => {
                            const role = ROLE_ICONS[a.agent_role] || ROLE_ICONS.SYSTEM;
                            return (
                                <div key={a.id} style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 12,
                                    padding: '12px 16px', borderRadius: 8,
                                    background: i === 0 ? 'rgba(34,211,238,0.05)' : 'transparent',
                                    borderLeft: i === 0 ? '3px solid #22d3ee' : '3px solid transparent',
                                    transition: 'all 0.3s ease',
                                    animation: i === 0 ? 'fadeInDown 0.5s ease' : 'none',
                                }}>
                                    <div style={{ fontSize: 20, width: 32, textAlign: 'center', flexShrink: 0 }}>
                                        {role.icon}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{
                                                fontSize: 10, fontWeight: 800, color: role.color,
                                                textTransform: 'uppercase', letterSpacing: 1.5,
                                            }}>
                                                {a.agent_role}
                                            </span>
                                            <span style={{ fontSize: 11, color: '#4b5563' }}>•</span>
                                            <span style={{ fontSize: 11, color: '#6b7280' }}>{timeAgo(a.created_at)}</span>
                                        </div>
                                        <div style={{ fontSize: 13, color: '#e5e7eb', marginTop: 3, fontWeight: 500 }}>
                                            {a.action}
                                            {a.target_sku && (
                                                <span style={{ color: '#22d3ee', marginLeft: 6, fontSize: 12 }}>
                                                    [{a.target_sku}]
                                                </span>
                                            )}
                                        </div>
                                        {a.confidence !== null && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                                <div style={{ width: 50, height: 3, borderRadius: 2, background: '#1f2937', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${a.confidence}%`, height: '100%',
                                                        background: a.confidence >= 80 ? '#34d399' : a.confidence >= 50 ? '#f59e0b' : '#ef4444',
                                                        borderRadius: 2,
                                                    }} />
                                                </div>
                                                <span style={{ fontSize: 10, color: '#9ca3af' }}>
                                                    confidence: {a.confidence}%
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                padding: '12px 24px', background: 'rgba(0,0,0,0.9)',
                borderTop: '1px solid #1f2937',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
                backdropFilter: 'blur(8px)',
            }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>
                    Powered by <span style={{ fontWeight: 800, color: '#fff' }}>JSONMart</span> AI
                </span>
                <span style={{ fontSize: 11, color: '#374151' }}>•</span>
                <span style={{ fontSize: 11, color: '#6b7280' }}>
                    ACP + UCP Compatible
                </span>
                <span style={{ fontSize: 11, color: '#374151' }}>•</span>
                <button onClick={() => setIsLive(!isLive)} style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 4,
                    border: `1px solid ${isLive ? '#34d399' : '#ef4444'}`,
                    background: 'transparent',
                    color: isLive ? '#34d399' : '#ef4444',
                    cursor: 'pointer',
                }}>
                    {isLive ? '⏸ Pause' : '▶ Resume'}
                </button>
            </div>

            <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
}
