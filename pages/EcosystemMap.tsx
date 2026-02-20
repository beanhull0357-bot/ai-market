import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Globe, Bot, Store, Radio, ShieldCheck, Zap } from 'lucide-react';
import { useAgents, useSellers, useA2AQueries } from '../hooks';
import { useLanguage } from '../context/LanguageContext';

interface EcoNode {
    id: string;
    label: string;
    type: 'agent' | 'seller';
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    trust: number;
    orders: number;
    color: string;
}

interface EcoEdge {
    source: string;
    target: string;
    weight: number;
    type: 'order' | 'a2a' | 'review';
}

function trustToColor(trust: number): string {
    if (trust >= 80) return '#34d399';
    if (trust >= 60) return '#22d3ee';
    if (trust >= 40) return '#f59e0b';
    return '#ef4444';
}

export default function EcosystemMap() {
    const { t } = useLanguage();
    const { agents, loading: agentsLoading } = useAgents();
    const { sellers, loading: sellersLoading } = useSellers();
    const { queries: a2aQueries } = useA2AQueries('');
    const svgRef = useRef<SVGSVGElement>(null);
    const animRef = useRef<number>(0);
    const [nodes, setNodes] = useState<EcoNode[]>([]);
    const [edges, setEdges] = useState<EcoEdge[]>([]);
    const [hovered, setHovered] = useState<EcoNode | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [dimensions, setDimensions] = useState({ w: 800, h: 500 });

    // Build graph data from existing hooks
    useEffect(() => {
        if (agentsLoading || sellersLoading) return;

        const cx = dimensions.w / 2;
        const cy = dimensions.h / 2;
        const newNodes: EcoNode[] = [];
        const newEdges: EcoEdge[] = [];

        agents.forEach((a, i) => {
            const angle = (2 * Math.PI * i) / Math.max(agents.length, 1);
            const dist = 120 + Math.random() * 80;
            newNodes.push({
                id: a.agentId,
                label: a.name || a.agentId,
                type: 'agent',
                x: cx + Math.cos(angle) * dist,
                y: cy + Math.sin(angle) * dist,
                vx: 0, vy: 0,
                radius: Math.max(10, Math.min(24, 10 + a.totalOrders * 2)),
                trust: 75 + Math.random() * 25,
                orders: a.totalOrders,
                color: trustToColor(75 + Math.random() * 25),
            });
        });

        sellers.forEach((s, i) => {
            const angle = (2 * Math.PI * i) / Math.max(sellers.length, 1) + Math.PI / 4;
            const dist = 180 + Math.random() * 60;
            newNodes.push({
                id: s.sellerId,
                label: s.businessName || s.sellerId,
                type: 'seller',
                x: cx + Math.cos(angle) * dist,
                y: cy + Math.sin(angle) * dist,
                vx: 0, vy: 0,
                radius: Math.max(12, Math.min(22, 12 + (s.totalProducts || 0))),
                trust: s.trustScore || 70,
                orders: s.totalSales || 0,
                color: trustToColor(s.trustScore || 70),
            });
        });

        // Create edges between agents and sellers (simulated order relations)
        agents.forEach(a => {
            if (sellers.length > 0 && a.totalOrders > 0) {
                const sellerIdx = Math.abs(a.agentId.charCodeAt(a.agentId.length - 1)) % sellers.length;
                newEdges.push({
                    source: a.agentId,
                    target: sellers[sellerIdx].sellerId,
                    weight: a.totalOrders,
                    type: 'order',
                });
            }
        });

        // A2A edges between agents
        if (a2aQueries.length > 0 && agents.length > 1) {
            for (let i = 0; i < Math.min(a2aQueries.length, 6); i++) {
                const srcIdx = i % agents.length;
                const tgtIdx = (i + 1) % agents.length;
                newEdges.push({
                    source: agents[srcIdx].agentId,
                    target: agents[tgtIdx].agentId,
                    weight: 1,
                    type: 'a2a',
                });
            }
        }

        setNodes(newNodes);
        setEdges(newEdges);
    }, [agents, sellers, a2aQueries, agentsLoading, sellersLoading, dimensions]);

    // Simple force simulation
    useEffect(() => {
        if (nodes.length === 0) return;

        const cx = dimensions.w / 2;
        const cy = dimensions.h / 2;
        let n = [...nodes];

        const tick = () => {
            const alpha = 0.015;
            n = n.map(node => {
                let fx = 0, fy = 0;
                // Center gravity
                fx += (cx - node.x) * 0.003;
                fy += (cy - node.y) * 0.003;
                // Repel other nodes
                n.forEach(other => {
                    if (other.id === node.id) return;
                    const dx = node.x - other.x;
                    const dy = node.y - other.y;
                    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
                    const force = 800 / (dist * dist);
                    fx += (dx / dist) * force;
                    fy += (dy / dist) * force;
                });
                // Edge spring force
                edges.forEach(e => {
                    let other: EcoNode | undefined;
                    if (e.source === node.id) other = n.find(nn => nn.id === e.target);
                    if (e.target === node.id) other = n.find(nn => nn.id === e.source);
                    if (other) {
                        const dx = other.x - node.x;
                        const dy = other.y - node.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const idealDist = 140;
                        fx += (dx / dist) * (dist - idealDist) * 0.01;
                        fy += (dy / dist) * (dist - idealDist) * 0.01;
                    }
                });

                const newVx = (node.vx + fx) * 0.85;
                const newVy = (node.vy + fy) * 0.85;
                return {
                    ...node,
                    x: Math.max(node.radius, Math.min(dimensions.w - node.radius, node.x + newVx * alpha * 60)),
                    y: Math.max(node.radius, Math.min(dimensions.h - node.radius, node.y + newVy * alpha * 60)),
                    vx: newVx,
                    vy: newVy,
                };
            });
            setNodes([...n]);
            animRef.current = requestAnimationFrame(tick);
        };

        animRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(animRef.current);
        // Only run once when nodes are first created
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes.length, edges.length, dimensions]);

    // Responsiveness
    useEffect(() => {
        const handleResize = () => {
            const w = Math.min(window.innerWidth - 48, 1000);
            const h = Math.min(window.innerHeight - 300, 600);
            setDimensions({ w: Math.max(400, w), h: Math.max(300, h) });
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const getNodeById = useCallback((id: string) => nodes.find(n => n.id === id), [nodes]);
    const loading = agentsLoading || sellersLoading;

    return (
        <div className="page-enter" style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(16px, 4vw, 32px)' }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(167,139,250,0.15))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Globe size={20} style={{ color: 'var(--accent-cyan)' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>{t('ecosystem.title')}</h1>
                        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>{t('ecosystem.subtitle')}</p>
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }} className="grid-responsive-4">
                {[
                    { icon: <Bot size={16} />, label: t('ecosystem.agents'), value: agents.length, color: 'var(--accent-green)' },
                    { icon: <Store size={16} />, label: t('ecosystem.sellers'), value: sellers.length, color: 'var(--accent-purple)' },
                    { icon: <Radio size={16} />, label: t('ecosystem.connections'), value: edges.length, color: 'var(--accent-cyan)' },
                    { icon: <Zap size={16} />, label: t('ecosystem.liveNodes'), value: nodes.length, color: 'var(--accent-amber)' },
                ].map(s => (
                    <div key={s.label} style={{
                        padding: '14px 16px', borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <span style={{ color: s.color }}>{s.icon}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase' }}>{s.label}</span>
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-mono)', color: s.color }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Network Visualization */}
            <div style={{
                borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)', overflow: 'hidden', position: 'relative',
            }}>
                {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: dimensions.h, color: 'var(--text-muted)' }}>
                        Loading ecosystem data...
                    </div>
                ) : nodes.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: dimensions.h, color: 'var(--text-muted)', flexDirection: 'column', gap: 8 }}>
                        <Globe size={32} style={{ opacity: 0.3 }} />
                        <span>{t('ecosystem.noData')}</span>
                    </div>
                ) : (
                    <svg
                        ref={svgRef}
                        width={dimensions.w}
                        height={dimensions.h}
                        style={{ display: 'block', width: '100%', height: 'auto' }}
                        viewBox={`0 0 ${dimensions.w} ${dimensions.h}`}
                        onMouseMove={(e) => {
                            const rect = svgRef.current?.getBoundingClientRect();
                            if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                        }}
                    >
                        <defs>
                            <radialGradient id="bg-glow">
                                <stop offset="0%" stopColor="rgba(34,211,238,0.06)" />
                                <stop offset="100%" stopColor="transparent" />
                            </radialGradient>
                            <filter id="glow">
                                <feGaussianBlur stdDeviation="3" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>

                        {/* Background */}
                        <circle cx={dimensions.w / 2} cy={dimensions.h / 2} r={dimensions.h * 0.4} fill="url(#bg-glow)" />

                        {/* Edges */}
                        {edges.map((e, i) => {
                            const s = getNodeById(e.source);
                            const t = getNodeById(e.target);
                            if (!s || !t) return null;
                            return (
                                <line key={i}
                                    x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                                    stroke={e.type === 'a2a' ? 'rgba(167,139,250,0.3)' : 'rgba(34,211,238,0.2)'}
                                    strokeWidth={Math.max(1, e.weight * 0.5)}
                                    strokeDasharray={e.type === 'a2a' ? '4 4' : undefined}
                                />
                            );
                        })}

                        {/* Animated particles on edges */}
                        {edges.slice(0, 5).map((e, i) => {
                            const s = getNodeById(e.source);
                            const tgt = getNodeById(e.target);
                            if (!s || !tgt) return null;
                            return (
                                <circle key={`particle-${i}`} r={2}
                                    fill={e.type === 'a2a' ? 'var(--accent-purple)' : 'var(--accent-cyan)'}
                                    opacity={0.8}
                                >
                                    <animateMotion
                                        dur={`${3 + i}s`}
                                        repeatCount="indefinite"
                                        path={`M${s.x},${s.y} L${tgt.x},${tgt.y}`}
                                    />
                                </circle>
                            );
                        })}

                        {/* Nodes */}
                        {nodes.map(node => (
                            <g key={node.id}
                                onMouseEnter={() => setHovered(node)}
                                onMouseLeave={() => setHovered(null)}
                                style={{ cursor: 'pointer' }}
                            >
                                {/* Outer glow */}
                                <circle cx={node.x} cy={node.y} r={node.radius + 4}
                                    fill="none" stroke={node.color} strokeWidth={1.5} opacity={hovered?.id === node.id ? 0.6 : 0.15}
                                    filter="url(#glow)"
                                />
                                {/* Main circle */}
                                <circle cx={node.x} cy={node.y} r={node.radius}
                                    fill={`${node.color}22`}
                                    stroke={node.color}
                                    strokeWidth={hovered?.id === node.id ? 2.5 : 1.5}
                                    style={{ transition: 'stroke-width 200ms' }}
                                />
                                {/* Icon */}
                                <text x={node.x} y={node.y + 1} textAnchor="middle" dominantBaseline="middle"
                                    fontSize={node.radius * 0.8} fill={node.color}
                                >
                                    {node.type === 'agent' ? '⬡' : '◆'}
                                </text>
                                {/* Label */}
                                <text x={node.x} y={node.y + node.radius + 14} textAnchor="middle"
                                    fontSize={9} fontWeight={600} fill="var(--text-muted)"
                                    fontFamily="var(--font-mono)"
                                >
                                    {node.label.length > 14 ? node.label.slice(0, 12) + '…' : node.label}
                                </text>
                            </g>
                        ))}
                    </svg>
                )}

                {/* Tooltip */}
                {hovered && (
                    <div style={{
                        position: 'absolute', left: Math.min(mousePos.x + 16, dimensions.w - 200), top: Math.min(mousePos.y - 10, dimensions.h - 100),
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-md)', padding: '12px 16px', minWidth: 160,
                        pointerEvents: 'none', zIndex: 10,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: hovered.color, marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                            {hovered.label}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                            {hovered.type === 'agent' ? t('ecosystem.agents') : t('ecosystem.sellers')}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                <span style={{ color: 'var(--text-tertiary)' }}>{t('ecosystem.trustScore')}</span>
                                <span style={{ color: hovered.color, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{hovered.trust.toFixed(0)}%</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                <span style={{ color: 'var(--text-tertiary)' }}>{t('ecosystem.orders')}</span>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{hovered.orders}</span>
                            </div>
                        </div>
                        {/* Trust bar */}
                        <div style={{ marginTop: 8, height: 3, background: 'var(--border-subtle)', borderRadius: 2 }}>
                            <div style={{
                                height: '100%', borderRadius: 2, background: hovered.color,
                                width: `${Math.min(100, hovered.trust)}%`, transition: 'width 300ms',
                            }} />
                        </div>
                    </div>
                )}

                {/* Legend */}
                <div style={{
                    position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 16,
                    background: 'rgba(9,9,11,0.8)', backdropFilter: 'blur(8px)',
                    padding: '6px 14px', borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border-subtle)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                        <span style={{ color: 'var(--accent-green)' }}>⬡</span> {t('ecosystem.agents')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                        <span style={{ color: 'var(--accent-purple)' }}>◆</span> {t('ecosystem.sellers')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                        <span style={{ width: 12, height: 1, background: 'var(--accent-cyan)', display: 'inline-block' }} /> {t('ecosystem.orders')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                        <span style={{ width: 12, height: 0, borderTop: '1px dashed var(--accent-purple)', display: 'inline-block' }} /> A2A
                    </div>
                </div>
            </div>
        </div>
    );
}
