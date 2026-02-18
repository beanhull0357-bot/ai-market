import React, { useState } from 'react';
import { Users, Plus, Bot, Shield, ChevronDown, ChevronUp, Trash2, Settings, Loader2 } from 'lucide-react';
import { useAgents } from '../hooks';

/* ━━━ Types ━━━ */
interface AgentGroup {
    id: string;
    name: string;
    description: string;
    policyId: string | null;
    budgetLimit: number;
    memberIds: string[];
    createdAt: string;
}

/* ━━━ Main Page ━━━ */
export const AgentGroups: React.FC = () => {
    const { agents } = useAgents();
    const [groups, setGroups] = useState<AgentGroup[]>([
        { id: 'GRP-001', name: '구매팀 A', description: '소모품 구매 전담 에이전트 그룹', policyId: 'POL-001', budgetLimit: 5000000, memberIds: [], createdAt: new Date().toISOString() },
        { id: 'GRP-002', name: 'MRO 관리', description: 'MRO 용품 자동 구매', policyId: null, budgetLimit: 10000000, memberIds: [], createdAt: new Date().toISOString() },
    ]);
    const [showForm, setShowForm] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: '', description: '', budgetLimit: 0 });

    const addGroup = () => {
        if (!form.name) return;
        setGroups([{
            id: `GRP-${String(groups.length + 1).padStart(3, '0')}`,
            name: form.name, description: form.description,
            policyId: null, budgetLimit: form.budgetLimit,
            memberIds: [], createdAt: new Date().toISOString(),
        }, ...groups]);
        setShowForm(false);
        setForm({ name: '', description: '', budgetLimit: 0 });
    };

    const addMember = (groupId: string, agentId: string) => {
        setGroups(groups.map(g =>
            g.id === groupId && !g.memberIds.includes(agentId)
                ? { ...g, memberIds: [...g.memberIds, agentId] }
                : g
        ));
    };

    const removeMember = (groupId: string, agentId: string) => {
        setGroups(groups.map(g =>
            g.id === groupId ? { ...g, memberIds: g.memberIds.filter(id => id !== agentId) } : g
        ));
    };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Users size={24} style={{ color: 'var(--accent-purple)' }} />
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Agent Groups</h1>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>에이전트 그룹 관리 및 정책 일괄 적용</p>
                    </div>
                </div>
                <button onClick={() => setShowForm(!showForm)} className="btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}>
                    <Plus size={14} /> 새 그룹
                </button>
            </div>

            {showForm && (
                <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: 'var(--text-primary)' }}>새 그룹 생성</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="그룹 이름" className="input-field" />
                        <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                            placeholder="설명" className="input-field" />
                        <input type="number" value={form.budgetLimit || ''} onChange={e => setForm({ ...form, budgetLimit: +e.target.value })}
                            placeholder="예산 한도 (₩)" className="input-field" />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button onClick={addGroup} className="btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}>생성</button>
                        <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', fontSize: 12, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', cursor: 'pointer' }}>취소</button>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {groups.map(group => {
                    const isExpanded = expandedId === group.id;
                    const availableAgents = agents.filter(a => !group.memberIds.includes(a.agentId));
                    return (
                        <div key={group.id} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                            <div onClick={() => setExpandedId(isExpanded ? null : group.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}>
                                <Users size={18} style={{ color: 'var(--accent-purple)', flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{group.name}</span>
                                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--bg-surface)', color: 'var(--text-muted)', fontWeight: 700 }}>
                                            {group.memberIds.length}명
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{group.description}</div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>
                                        ₩{group.budgetLimit.toLocaleString()}
                                    </div>
                                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>예산 한도</div>
                                </div>
                                {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                            </div>

                            {isExpanded && (
                                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>멤버</div>
                                    {group.memberIds.length === 0 ? (
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>멤버가 없습니다</div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                                            {group.memberIds.map(mid => {
                                                const agent = agents.find(a => a.agentId === mid);
                                                return (
                                                    <span key={mid} style={{
                                                        display: 'flex', alignItems: 'center', gap: 4,
                                                        fontSize: 11, padding: '4px 10px', borderRadius: 'var(--radius-full)',
                                                        background: 'rgba(34,211,238,0.08)', color: 'var(--accent-cyan)',
                                                    }}>
                                                        <Bot size={10} /> {agent?.name || mid}
                                                        <button onClick={() => removeMember(group.id, mid)} style={{
                                                            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0, marginLeft: 4,
                                                        }}><Trash2 size={10} /></button>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {availableAgents.length > 0 && (
                                        <select onChange={e => { if (e.target.value) addMember(group.id, e.target.value); e.target.value = ''; }}
                                            style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '6px 10px', fontSize: 11 }}>
                                            <option value="">에이전트 추가...</option>
                                            {availableAgents.map(a => <option key={a.agentId} value={a.agentId}>{a.name}</option>)}
                                        </select>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
