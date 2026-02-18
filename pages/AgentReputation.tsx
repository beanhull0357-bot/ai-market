import React, { useState } from 'react';
import { Shield, Bot, Star, TrendingUp, AlertTriangle, CheckCircle2, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { useAgents, useReviews } from '../hooks';

interface AgentRep { agentId: string; name: string; totalReviews: number; endorseRate: number; avgSpecCompliance: number; avgLatencyMs: number; trustLevel: 'TRUSTED' | 'NEUTRAL' | 'SUSPICIOUS'; score: number; }

function getLevelConfig(level: string) {
    if (level === 'TRUSTED') return { label: '신뢰', color: 'var(--accent-green)', bg: 'rgba(52,211,153,0.1)' };
    if (level === 'SUSPICIOUS') return { label: '주의', color: 'var(--accent-red)', bg: 'rgba(239,68,68,0.1)' };
    return { label: '보통', color: 'var(--accent-amber)', bg: 'rgba(251,191,36,0.1)' };
}

export const AgentReputation: React.FC = () => {
    const { agents } = useAgents();
    const reps: AgentRep[] = agents.map(a => {
        const reviews = a.totalReviews || Math.floor(Math.random() * 30) + 1;
        const endorseRate = Math.floor(Math.random() * 40) + 60;
        const specComp = +(Math.random() * 0.3 + 0.7).toFixed(2);
        const latency = Math.floor(Math.random() * 400) + 50;
        const score = Math.round(endorseRate * 0.4 + specComp * 100 * 0.35 + Math.max(0, 100 - latency / 5) * 0.25);
        return { agentId: a.agentId, name: a.name, totalReviews: reviews, endorseRate, avgSpecCompliance: specComp, avgLatencyMs: latency, trustLevel: score >= 80 ? 'TRUSTED' : score >= 60 ? 'NEUTRAL' : 'SUSPICIOUS', score };
    });

    const avgScore = reps.length ? Math.round(reps.reduce((s, r) => s + r.score, 0) / reps.length) : 0;
    const trusted = reps.filter(r => r.trustLevel === 'TRUSTED').length;

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <Shield size={24} style={{ color: 'var(--accent-green)' }} />
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Agent Reputation</h1>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>에이전트 간 거래 평판 네트워크</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent-green)' }}>{avgScore}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>평균 평판 점수</div></div>
                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent-cyan)' }}>{trusted}/{reps.length}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>신뢰 에이전트</div></div>
                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent-purple)' }}>{reps.reduce((s, r) => s + r.totalReviews, 0)}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>총 리뷰</div></div>
            </div>

            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
                평판 점수 = (지지율 × 0.4) + (스펙 일치도 × 0.35) + (속도 × 0.25)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reps.sort((a, b) => b.score - a.score).map(rep => {
                    const lv = getLevelConfig(rep.trustLevel);
                    return (
                        <div key={rep.agentId} className="glass-card" style={{ padding: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: '50%', background: lv.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span style={{ fontSize: 16, fontWeight: 900, color: lv.color }}>{rep.score}</span>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{rep.name}</span>
                                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: lv.bg, color: lv.color, fontWeight: 700 }}>{lv.label}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
                                        <span><ThumbsUp size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> 지지율 {rep.endorseRate}%</span>
                                        <span><CheckCircle2 size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> 일치도 {(rep.avgSpecCompliance * 100).toFixed(0)}%</span>
                                        <span>⚡ {rep.avgLatencyMs}ms</span>
                                        <span>📝 {rep.totalReviews}건</span>
                                    </div>
                                </div>
                                <div style={{ width: 100, height: 6, background: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                                    <div style={{ width: `${rep.score}%`, height: '100%', background: `linear-gradient(90deg, ${lv.color}, color-mix(in srgb, ${lv.color} 60%, transparent))`, borderRadius: 3 }} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
