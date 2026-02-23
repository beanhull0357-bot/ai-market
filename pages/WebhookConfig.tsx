import React, { useState } from 'react';
import { Webhook, Plus, Trash2, CheckCircle2, XCircle, Loader2, Globe, Bell, ShoppingCart, Bot, MessageSquare } from 'lucide-react';
import { useWebhooks, saveWebhook, updateWebhook, deleteWebhook } from '../hooks';

const EVENT_OPTIONS = [
    { value: 'order.created', label: '주문 생성', icon: <ShoppingCart size={10} /> },
    { value: 'order.approved', label: '주문 승인', icon: <CheckCircle2 size={10} /> },
    { value: 'order.voided', label: '주문 취소', icon: <XCircle size={10} /> },
    { value: 'agent.registered', label: '에이전트 등록', icon: <Bot size={10} /> },
    { value: 'qa.created', label: '질문 등록', icon: <MessageSquare size={10} /> },
    { value: 'qa.answered', label: '질문 답변', icon: <MessageSquare size={10} /> },
];

export const WebhookConfig: React.FC = () => {
    const [agentId, setAgentId] = useState('');
    const [agentInput, setAgentInput] = useState('');
    const { webhooks, loading, refetch } = useWebhooks(agentId || undefined);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ url: '', events: [] as string[] });
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const toggleEvent = (ev: string) =>
        setForm(f => ({ ...f, events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev] }));

    const addHook = async () => {
        if (!form.url || form.events.length === 0) return;
        setSaving(true); setError(null);
        try {
            await saveWebhook({ agentId: agentId || undefined, url: form.url, events: form.events });
            setShowForm(false);
            setForm({ url: '', events: [] });
            refetch();
        } catch (e: any) {
            setError(e.message || '저장 실패');
        } finally { setSaving(false); }
    };

    const toggleActive = async (id: string, current: boolean) => {
        try { await updateWebhook(id, { active: !current }); refetch(); } catch (e: any) { setError(e.message); }
    };

    const removeHook = async (id: string) => {
        setDeletingId(id);
        try { await deleteWebhook(id); refetch(); } catch (e: any) { setError(e.message); }
        finally { setDeletingId(null); }
    };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Webhook size={24} style={{ color: 'var(--accent-purple)' }} />
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Webhooks</h1>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>이벤트 발생 시 외부 URL로 알림 전송</p>
                    </div>
                </div>
                <button onClick={() => setShowForm(!showForm)} className="btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}><Plus size={14} /> 새 웹훅</button>
            </div>

            {/* Agent ID 필터 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                    value={agentInput} onChange={e => setAgentInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && setAgentId(agentInput)}
                    placeholder="에이전트 ID로 필터 (Enter)" className="input-field"
                    style={{ flex: 1, maxWidth: 320 }}
                />
                <button onClick={() => setAgentId(agentInput)} style={{ padding: '8px 14px', fontSize: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-secondary)' }}>적용</button>
                {agentId && <button onClick={() => { setAgentId(''); setAgentInput(''); }} style={{ padding: '8px 14px', fontSize: 12, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-dim)' }}>전체</button>}
            </div>

            {error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)', color: 'var(--accent-red)', fontSize: 12, marginBottom: 12 }}>{error}</div>}

            {showForm && (
                <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: 'var(--text-primary)' }}>웹훅 생성</h3>
                    <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://your-server.com/webhook" className="input-field" style={{ width: '100%', marginBottom: 12 }} />
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 8 }}>이벤트 선택</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                        {EVENT_OPTIONS.map(ev => (
                            <button key={ev.value} onClick={() => toggleEvent(ev.value)} style={{
                                display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', fontSize: 11, fontWeight: 600,
                                borderRadius: 'var(--radius-full)', cursor: 'pointer', border: 'none',
                                background: form.events.includes(ev.value) ? 'rgba(34,211,238,0.15)' : 'var(--bg-surface)',
                                color: form.events.includes(ev.value) ? 'var(--accent-cyan)' : 'var(--text-muted)',
                            }}>{ev.icon} {ev.label}</button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={addHook} disabled={saving} className="btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}>
                            {saving ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> 저장 중...</> : '생성'}
                        </button>
                        <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', fontSize: 12, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', cursor: 'pointer' }}>취소</button>
                    </div>
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-dim)' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
            ) : webhooks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
                    <Bell size={28} style={{ opacity: 0.2, marginBottom: 8 }} />
                    <div style={{ fontSize: 13 }}>등록된 웹훅이 없습니다</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {webhooks.map(hook => (
                        <div key={hook.id} className="glass-card" style={{ padding: 16, opacity: hook.active ? 1 : 0.5 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                <Globe size={18} style={{ color: 'var(--accent-purple)', flexShrink: 0, marginTop: 2 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', marginBottom: 4, wordBreak: 'break-all' }}>{hook.url}</div>
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                                        {hook.events?.map((ev: string) => {
                                            const opt = EVENT_OPTIONS.find(o => o.value === ev);
                                            return <span key={ev} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--bg-surface)', color: 'var(--text-muted)', fontWeight: 600 }}>{opt?.label || ev}</span>;
                                        })}
                                    </div>
                                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-dim)' }}>
                                        <span>생성: {hook.created_at?.slice(0, 10)}</span>
                                        <span>마지막: {hook.last_triggered ? hook.last_triggered.slice(0, 10) : '-'}</span>
                                        {hook.fail_count > 0 && <span style={{ color: 'var(--accent-red)' }}>실패: {hook.fail_count}회</span>}
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)' }}>{hook.webhook_id}</span>
                                    </div>
                                    <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 4, userSelect: 'all' }}>{hook.secret}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                    <button onClick={() => toggleActive(hook.id, hook.active)} style={{
                                        padding: '4px 10px', fontSize: 10, fontWeight: 700, borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
                                        background: hook.active ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                                        color: hook.active ? 'var(--accent-green)' : 'var(--accent-red)',
                                    }}>{hook.active ? '활성' : '비활성'}</button>
                                    <button onClick={() => removeHook(hook.id)} disabled={deletingId === hook.id} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}>
                                        {deletingId === hook.id ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
