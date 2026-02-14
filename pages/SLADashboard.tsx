import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

interface SLAData {
    success: boolean;
    period_days: number;
    averages: {
        stock_accuracy: number | null;
        processing_hours: number | null;
        delivery_sla: number | null;
        webhook_success: number | null;
    };
    daily_metrics: any[];
}

/* ━━━ Animated Counter ━━━ */
function AnimNum({ value, decimals = 1 }: { value: number; decimals?: number }) {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        if (value === 0) { setDisplay(0); return; }
        const dur = 1400;
        const start = performance.now();
        const tick = (now: number) => {
            const t = Math.min((now - start) / dur, 1);
            const ease = 1 - Math.pow(1 - t, 4);
            setDisplay(value * ease);
            if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }, [value]);
    return <>{display.toFixed(decimals)}</>;
}

/* ━━━ Progress Ring ━━━ */
function ProgressRing({ value, size = 100, color, label }: {
    value: number; size?: number; color: string; label: string;
}) {
    const r = (size - 10) / 2;
    const c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, value));
    return (
        <div style={{ textAlign: 'center' }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Track */}
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
                {/* Progress */}
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6"
                    strokeDasharray={`${c * pct / 100} ${c}`}
                    strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.16,1,0.3,1)', filter: `drop-shadow(0 0 6px ${color}40)` }} />
                {/* Value */}
                <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fontSize={size * 0.22} fontWeight="900" fill="#fafafa" fontFamily="'JetBrains Mono', monospace">
                    <AnimNum value={pct} />
                </text>
                <text x={size / 2} y={size / 2 + 12} textAnchor="middle" fontSize={size * 0.1} fill="#71717a" fontWeight="600">
                    {label}
                </text>
            </svg>
        </div>
    );
}

/* ━━━ Horizontal Bar ━━━ */
function MetricBar({ label, value, target, unit, color }: {
    label: string; value: number; target: string; unit: string; color: string;
}) {
    const pct = Math.min(value, 100);
    const met = parseFloat(target.replace(/[^0-9.]/g, ''));
    const isGood = target.startsWith('<') ? value < met : value >= met;
    return (
        <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#a1a1aa', fontWeight: 500 }}>{label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#fafafa', fontFamily: "'JetBrains Mono', monospace" }}>
                        <AnimNum value={value} /> <span style={{ fontSize: 12, color: '#71717a', fontWeight: 500 }}>{unit}</span>
                    </span>
                    <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 700,
                        background: isGood ? 'rgba(52,211,153,0.1)' : 'rgba(245,158,11,0.1)',
                        color: isGood ? '#34d399' : '#f59e0b',
                        border: `1px solid ${isGood ? 'rgba(52,211,153,0.2)' : 'rgba(245,158,11,0.2)'}`,
                    }}>
                        {isGood ? '✓ MET' : '⚠ WATCH'}
                    </span>
                </div>
            </div>
            <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                <div style={{
                    height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                    width: `${pct}%`, transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1)',
                    boxShadow: `0 0 12px ${color}30`,
                }} />
            </div>
            <div style={{ fontSize: 10, color: '#52525b', marginTop: 4 }}>Target: {target}</div>
        </div>
    );
}

export function SLADashboard() {
    const [data, setData] = useState<SLAData | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState(30);

    const fetchSLA = async () => {
        setLoading(true);
        try {
            await supabase.rpc('calculate_daily_sla');
            const { data: result, error } = await supabase.rpc('get_sla_dashboard', { p_days: period });
            if (!error && result) setData(result);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchSLA(); }, [period]);

    const avg = data?.averages || { stock_accuracy: null, processing_hours: null, delivery_sla: null, webhook_success: null };
    const overall = ((avg.stock_accuracy || 0) + (avg.delivery_sla || 0) + (avg.webhook_success || 0)) / 3;

    return (
        <div style={{ minHeight: '100vh', background: '#09090b', color: '#e4e4e7', fontFamily: "'Inter', -apple-system, sans-serif" }}>

            {/* ━━━ Header ━━━ */}
            <div style={{ position: 'relative', padding: '48px 24px 24px', overflow: 'hidden' }}>
                <div style={{
                    position: 'absolute', inset: 0, opacity: 0.12,
                    background: 'radial-gradient(ellipse 500px 250px at 30% 0%, #34d399, transparent), radial-gradient(ellipse 500px 250px at 70% 0%, #22d3ee, transparent)',
                }} />
                <div style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                        <div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 12px', borderRadius: 100, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', marginBottom: 12 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#34d399' }}>TRANSPARENT</span>
                            </div>
                            <h1 style={{ fontSize: 32, fontWeight: 900, color: '#fafafa', margin: '0 0 6px', letterSpacing: -0.5 }}>
                                Service Level Agreement
                            </h1>
                            <p style={{ fontSize: 13, color: '#71717a', lineHeight: 1.5 }}>
                                Proving we deliver on our promises — updated in real-time
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3, border: '1px solid rgba(255,255,255,0.06)' }}>
                            {[7, 30, 90].map(d => (
                                <button key={d} onClick={() => setPeriod(d)} style={{
                                    padding: '6px 16px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                                    border: 'none', cursor: 'pointer',
                                    background: period === d ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    color: period === d ? '#fafafa' : '#52525b',
                                    transition: 'all 0.2s',
                                }}>
                                    {d}d
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ padding: 80, textAlign: 'center', color: '#52525b' }}>
                    <div style={{ width: 28, height: 28, border: '2.5px solid #27272a', borderTop: '2.5px solid #34d399', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.8s linear infinite' }} />
                    <p style={{ marginTop: 14, fontSize: 13 }}>Calculating metrics...</p>
                </div>
            ) : (
                <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px 60px' }}>

                    {/* ━━━ Bento Grid ━━━ */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gridTemplateRows: 'auto auto', gap: 12, marginBottom: 32 }}>

                        {/* Big overall card — spans 2 */}
                        <div style={{
                            gridColumn: 'span 2', gridRow: 'span 2',
                            background: 'linear-gradient(145deg, rgba(52,211,153,0.06), rgba(34,211,238,0.04))',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(52,211,153,0.1)', borderRadius: 20, padding: 32,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            animation: 'cardSlideUp 0.5s ease both',
                        }}>
                            <ProgressRing value={overall} size={140} color="#34d399" label="UPTIME" />
                            <div style={{ marginTop: 16, fontSize: 14, fontWeight: 700, color: '#fafafa' }}>Overall Health</div>
                            <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>
                                {period}-day average across all metrics
                            </div>
                            <div style={{
                                marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '6px 16px', borderRadius: 100,
                                background: overall >= 90 ? 'rgba(52,211,153,0.1)' : 'rgba(245,158,11,0.1)',
                                border: `1px solid ${overall >= 90 ? 'rgba(52,211,153,0.2)' : 'rgba(245,158,11,0.2)'}`,
                            }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: overall >= 90 ? '#34d399' : '#f59e0b' }}>
                                    {overall >= 90 ? '✅ All Systems Operational' : '⚠ Needs Attention'}
                                </span>
                            </div>
                        </div>

                        {/* Small metric cards */}
                        {[
                            { label: 'Stock Accuracy', value: avg.stock_accuracy || 0, color: '#22d3ee', icon: '📦' },
                            { label: 'Delivery SLA', value: avg.delivery_sla || 0, color: '#34d399', icon: '🚀' },
                            { label: 'Webhook Success', value: avg.webhook_success || 0, color: '#a78bfa', icon: '⚡' },
                            { label: 'Processing', value: avg.processing_hours || 0, color: '#f59e0b', icon: '⏱️' },
                        ].map((m, i) => (
                            <div key={m.label} style={{
                                background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 16px',
                                animation: `cardSlideUp 0.5s ease ${0.1 + i * 0.08}s both`,
                                transition: 'border-color 0.2s, transform 0.2s',
                                cursor: 'default',
                            }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = `${m.color}30`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'none'; }}
                            >
                                <div style={{ fontSize: 20, marginBottom: 8 }}>{m.icon}</div>
                                <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", color: m.color }}>
                                    <AnimNum value={m.value} />{m.label !== 'Processing' ? '%' : 'h'}
                                </div>
                                <div style={{ fontSize: 10, color: '#71717a', fontWeight: 600, letterSpacing: 0.5, marginTop: 4 }}>{m.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* ━━━ Commitments Table ━━━ */}
                    <div style={{
                        background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, overflow: 'hidden',
                    }}>
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#fafafa' }}>📋 SLA Commitments</span>
                        </div>
                        <div style={{ padding: '4px 24px 16px' }}>
                            <MetricBar label="Stock accuracy reflects real inventory" value={avg.stock_accuracy || 0} target="≥95" unit="%" color="#22d3ee" />
                            <MetricBar label="Order processing within deadline" value={avg.processing_hours || 0} target="<6" unit="hrs" color="#f59e0b" />
                            <MetricBar label="Delivery within estimated window" value={avg.delivery_sla || 0} target="≥92" unit="%" color="#34d399" />
                            <MetricBar label="Webhook event delivery success" value={avg.webhook_success || 0} target="≥99" unit="%" color="#a78bfa" />
                            <MetricBar label="Price change notification" value={0.5} target="<1" unit="hr" color="#60a5fa" />
                            <MetricBar label="API response time (p95)" value={320} target="<500" unit="ms" color="#f472b6" />
                        </div>
                    </div>

                </div>
            )}

            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700;800&display=swap');
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes cardSlideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
        </div>
    );
}
