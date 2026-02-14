import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../context/LanguageContext';

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

const ROLES: Record<string, { icon: string; label: string; gradient: string }> = {
    SOURCING: { icon: '🔍', label: 'Sourcing', gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)' },
    PRICING: { icon: '💰', label: 'Pricing', gradient: 'linear-gradient(135deg, #a78bfa, #7c3aed)' },
    OPS: { icon: '⚙️', label: 'Operations', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    SYSTEM: { icon: '🤖', label: 'System', gradient: 'linear-gradient(135deg, #6b7280, #4b5563)' },
    ORDER: { icon: '📦', label: 'Orders', gradient: 'linear-gradient(135deg, #34d399, #059669)' },
    REVIEW: { icon: '⭐', label: 'Reviews', gradient: 'linear-gradient(135deg, #60a5fa, #2563eb)' },
};

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
}

/* ━━━ Animated Counter ━━━ */
function AnimCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        if (value === 0) { setDisplay(0); return; }
        const duration = 1200;
        const start = performance.now();
        const tick = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - t, 4);
            setDisplay(Math.round(value * ease));
            if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }, [value]);
    return <>{display}{suffix}</>;
}

/* ━━━ Confidence Ring ━━━ */
function ConfidenceRing({ value }: { value: number }) {
    const r = 8; const c = 2 * Math.PI * r;
    const color = value >= 80 ? '#34d399' : value >= 50 ? '#f59e0b' : '#ef4444';
    return (
        <svg width="22" height="22" viewBox="0 0 22 22" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r={r} fill="none" stroke="#1f2937" strokeWidth="2.5" />
            <circle cx="11" cy="11" r={r} fill="none" stroke={color} strokeWidth="2.5"
                strokeDasharray={`${c * value / 100} ${c}`}
                strokeLinecap="round" transform="rotate(-90 11 11)"
                style={{ transition: 'stroke-dasharray 0.8s ease' }} />
            <text x="11" y="12" textAnchor="middle" fontSize="6" fontWeight="800" fill={color} fontFamily="monospace">
                {value}
            </text>
        </svg>
    );
}

export function LiveFeed() {
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isLive, setIsLive] = useState(true);
    const [filter, setFilter] = useState<string | null>(null);
    const { t } = useLanguage();

    const fetchActivities = useCallback(async () => {
        try {
            const { data, error } = await supabase.rpc('get_agent_activity_log', { p_limit: 50, p_role: filter });
            if (!error && data?.activities) setActivities(data.activities);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [filter]);

    useEffect(() => { fetchActivities(); }, [fetchActivities]);
    useEffect(() => {
        if (!isLive) return;
        const id = setInterval(fetchActivities, 6000);
        return () => clearInterval(id);
    }, [isLive, fetchActivities]);

    const roleCounts = activities.reduce<Record<string, number>>((acc, a) => {
        acc[a.agent_role] = (acc[a.agent_role] || 0) + 1; return acc;
    }, {});
    const autoCount = activities.filter(a => a.decision === 'AUTO').length;
    const avgConf = activities.filter(a => a.confidence != null).reduce((s, a) => s + (a.confidence || 0), 0)
        / (activities.filter(a => a.confidence != null).length || 1);

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-root)', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>

            {/* ━━━ Hero ━━━ */}
            <div style={{
                position: 'relative', padding: '48px 24px 32px', textAlign: 'center', overflow: 'hidden',
            }}>
                {/* Background mesh */}
                <div style={{
                    position: 'absolute', inset: 0, opacity: 0.15,
                    background: 'radial-gradient(ellipse 600px 300px at 50% 0%, #22d3ee, transparent), radial-gradient(ellipse 400px 200px at 20% 50%, #a78bfa, transparent), radial-gradient(ellipse 400px 200px at 80% 50%, #34d399, transparent)',
                }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 14px', borderRadius: 100, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', marginBottom: 16 }}>
                        <div style={{
                            width: 8, height: 8, borderRadius: '50%', background: isLive ? '#34d399' : '#ef4444',
                            boxShadow: isLive ? '0 0 8px #34d399' : 'none',
                            animation: isLive ? 'livePulse 2s infinite' : 'none',
                        }} />
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: isLive ? '#34d399' : '#ef4444' }}>
                            {isLive ? 'LIVE' : 'PAUSED'}
                        </span>
                    </div>
                    <h1 style={{ fontSize: 36, fontWeight: 900, color: '#fafafa', margin: '0 0 8px', letterSpacing: -0.5 }}>
                        {t('live.title')}
                    </h1>
                    <p style={{ fontSize: 14, color: '#71717a', maxWidth: 460, margin: '0 auto', lineHeight: 1.6 }}>
                        {t('live.subtitle')}
                    </p>
                </div>
            </div>

            {/* ━━━ Bento Stats ━━━ */}
            <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 20px 20px' }}>
                <div className="grid-responsive-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                    {[
                        { label: t('live.totalEvents'), value: activities.length, suffix: '', color: '#22d3ee' },
                        { label: t('live.activeRoles'), value: Object.keys(roleCounts).length, suffix: '', color: '#a78bfa' },
                        { label: t('live.autoDecisions'), value: autoCount, suffix: '', color: '#34d399' },
                        { label: t('live.avgConfidence'), value: Math.round(avgConf), suffix: '%', color: '#f59e0b' },
                    ].map((s, i) => (
                        <div key={s.label} style={{
                            background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 16px',
                            textAlign: 'center',
                            animation: `cardSlideUp 0.5s ease ${i * 0.08}s both`,
                        }}>
                            <div style={{ fontSize: 30, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", color: s.color, marginBottom: 4 }}>
                                <AnimCounter value={s.value} suffix={s.suffix} />
                            </div>
                            <div style={{ fontSize: 10, color: '#71717a', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* ━━━ Role Filters ━━━ */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button onClick={() => setFilter(null)} style={{
                        padding: '5px 14px', fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${!filter ? 'rgba(250,250,250,0.2)' : 'rgba(255,255,255,0.06)'}`,
                        background: !filter ? 'rgba(250,250,250,0.08)' : 'transparent',
                        color: !filter ? '#fafafa' : '#71717a',
                        transition: 'all 0.2s',
                    }}>{t('live.allFilter')}</button>
                    {Object.entries(ROLES).map(([key, r]) => (
                        <button key={key} onClick={() => setFilter(key)} style={{
                            padding: '5px 14px', fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
                            border: `1px solid ${filter === key ? 'rgba(250,250,250,0.2)' : 'rgba(255,255,255,0.06)'}`,
                            background: filter === key ? 'rgba(250,250,250,0.08)' : 'transparent',
                            color: filter === key ? '#fafafa' : '#71717a',
                            transition: 'all 0.2s',
                        }}>
                            {r.icon} {r.label}
                        </button>
                    ))}
                </div>

                {/* ━━━ Activity Stream ━━━ */}
                <div style={{
                    background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, overflow: 'hidden',
                }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>{t('live.activityStream')}</span>
                        <button onClick={() => setIsLive(!isLive)} style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', fontSize: 11,
                            borderRadius: 6, cursor: 'pointer',
                            border: `1px solid ${isLive ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`,
                            background: isLive ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)',
                            color: isLive ? '#34d399' : '#ef4444', fontWeight: 600,
                        }}>
                            {isLive ? `⏸ ${t('live.pause')}` : `▶ ${t('live.resume')}`}
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {[...Array(6)].map((_, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <div className="skeleton" style={{ height: 10, width: '30%', marginBottom: 6 }} />
                                        <div className="skeleton" style={{ height: 14, width: '70%' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : activities.length === 0 ? (
                        <div style={{ padding: 60, textAlign: 'center', color: '#52525b' }}>
                            <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.3 }}>🤖</div>
                            <p style={{ fontSize: 13 }}>No activity yet</p>
                        </div>
                    ) : (
                        <div>
                            {activities.map((a, i) => {
                                const role = ROLES[a.agent_role] || ROLES.SYSTEM;
                                return (
                                    <div key={a.id} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 12,
                                        padding: '14px 20px',
                                        borderBottom: i < activities.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                        animation: `rowFadeIn 0.4s ease ${Math.min(i * 0.04, 0.8)}s both`,
                                        transition: 'background 0.2s',
                                    }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        {/* Role badge */}
                                        <div style={{
                                            width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: role.gradient, fontSize: 15, flexShrink: 0,
                                            boxShadow: `0 4px 12px ${role.gradient.includes('#06b6d4') ? 'rgba(6,182,212,0.2)' : 'rgba(0,0,0,0.3)'}`,
                                        }}>
                                            {role.icon}
                                        </div>
                                        {/* Content */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                                <span style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', letterSpacing: 1 }}>{a.agent_role}</span>
                                                <span style={{ fontSize: 10, color: '#3f3f46' }}>•</span>
                                                <span style={{ fontSize: 10, color: '#52525b' }}>{timeAgo(a.created_at)} {t('live.ago')}</span>
                                                {a.decision === 'AUTO' && (
                                                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(52,211,153,0.1)', color: '#34d399', fontWeight: 700 }}>AUTO</span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 13, color: '#e4e4e7', fontWeight: 500, lineHeight: 1.4 }}>
                                                {a.action}
                                                {a.target_sku && (
                                                    <span style={{
                                                        marginLeft: 6, fontSize: 11, padding: '1px 6px', borderRadius: 4,
                                                        background: 'rgba(34,211,238,0.08)', color: '#22d3ee', fontWeight: 600,
                                                    }}>{a.target_sku}</span>
                                                )}
                                            </div>
                                        </div>
                                        {/* Confidence */}
                                        {a.confidence != null && <ConfidenceRing value={a.confidence} />}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ━━━ Footer ━━━ */}
            <div style={{ textAlign: 'center', padding: '32px 24px 24px', color: '#3f3f46', fontSize: 11 }}>
                {t('live.footer')}
            </div>

            <style>{`
        @keyframes livePulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes cardSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes rowFadeIn { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:translateX(0); } }
      `}</style>
        </div>
    );
}
