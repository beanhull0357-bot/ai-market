import React, { useState } from 'react';
import { Webhook, Plus, Trash2, CheckCircle2, XCircle, Send, Loader2, Globe, Bell, ShoppingCart, Bot, MessageSquare } from 'lucide-react';

interface WebhookRule {
    id: string; url: string; events: string[]; active: boolean;
    secret: string; createdAt: string; lastTriggered: string | null; failCount: number;
}

const EVENT_OPTIONS = [
    { value: 'order.created', label: '주문 생성', icon: <ShoppingCart size={10} /> },
    { value: 'order.approved', label: '주문 승인', icon: <CheckCircle2 size={10} /> },
    { value: 'order.voided', label: '주문 취소', icon: <XCircle size={10} /> },
    { value: 'agent.registered', label: '에이전트 등록', icon: <Bot size={10} /> },
    { value: 'qa.created', label: '질문 등록', icon: <MessageSquare size={10} /> },
    { value: 'qa.answered', label: '질문 답변', icon: <MessageSquare size={10} /> },
];

export const WebhookConfig: React.FC = () => {
    const [hooks, setHooks] = useState<WebhookRule[]>([
        { id: 'WH-001', url: 'https://example.com/webhooks/jsonmart', events: ['order.created', 'order.approved'], active: true, secret: 'whsec_abc123...', createdAt: '2026-02-15', lastTriggered: '2026-02-18', failCount: 0 },
        { id: 'WH-002', url: 'https://slack.com/api/webhooks/T01/B01', events: ['qa.created'], active: true, secret: 'whsec_def456...', createdAt: '2026-02-16', lastTriggered: '2026-02-17', failCount: 1 },
    ]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ url: '', events: [] as string[] });
    const [testing, setTesting] = useState<string | null>(null);

    const addHook = () => {
        if (!form.url || form.events.length === 0) return;
        setHooks([{ id: `WH-${String(hooks.length + 1).padStart(3, '0')}`, url: form.url, events: form.events, active: true, secret: `whsec_${Math.random().toString(36).slice(2, 10)}...`, createdAt: new Date().toISOString().slice(0, 10), lastTriggered: null, failCount: 0 }, ...hooks]);
        setShowForm(false);
        setForm({ url: '', events: [] });
    };

    const toggleEvent = (ev: string) => {
        setForm(f => ({ ...f, events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev] }));
    };

    const toggleActive = (id: string) => setHooks(hooks.map(h => h.id === id ? { ...h, active: !h.active } : h));
    const deleteHook = (id: string) => setHooks(hooks.filter(h => h.id !== id));

    const testHook = async (id: string) => {
        setTesting(id);
        await new Promise(r => setTimeout(r, 1500));
        setTesting(null);
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
                        <button onClick={addHook} className="btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}>생성</button>
                        <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', fontSize: 12, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', cursor: 'pointer' }}>취소</button>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {hooks.map(hook => (
                    <div key={hook.id} className="glass-card" style={{ padding: 16, opacity: hook.active ? 1 : 0.5 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <Globe size={18} style={{ color: 'var(--accent-purple)', flexShrink: 0, marginTop: 2 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', marginBottom: 4, wordBreak: 'break-all' }}>{hook.url}</div>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                                    {hook.events.map(ev => {
                                        const opt = EVENT_OPTIONS.find(o => o.value === ev);
                                        return <span key={ev} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--bg-surface)', color: 'var(--text-muted)', fontWeight: 600 }}>{opt?.label || ev}</span>;
                                    })}
                                </div>
                                <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-dim)' }}>
                                    <span>생성: {hook.createdAt}</span>
                                    <span>마지막: {hook.lastTriggered || '-'}</span>
                                    {hook.failCount > 0 && <span style={{ color: 'var(--accent-red)' }}>실패: {hook.failCount}회</span>}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                <button onClick={() => testHook(hook.id)} disabled={testing === hook.id} style={{ padding: '4px 10px', fontSize: 10, fontWeight: 600, borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer', background: 'rgba(34,211,238,0.1)', color: 'var(--accent-cyan)' }}>
                                    {testing === hook.id ? <Loader2 size={10} className="spin" /> : <><Send size={10} /> 테스트</>}
                                </button>
                                <button onClick={() => toggleActive(hook.id)} style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer', background: hook.active ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)', color: hook.active ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                    {hook.active ? '활성' : '비활성'}
                                </button>
                                <button onClick={() => deleteHook(hook.id)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}><Trash2 size={14} /></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Payload Example */}
            <div className="glass-card" style={{ padding: 16, marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>페이로드 예시</div>
                <pre style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 12, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', overflow: 'auto', lineHeight: 1.6, margin: 0 }}>{`{
  "event": "order.created",
  "timestamp": "2026-02-19T00:55:00Z",
  "data": {
    "orderId": "ORD-20260219-A1B2C",
    "agentId": "agent-gpt-001",
    "sku": "WW-001",
    "quantity": 10,
    "totalPrice": 25000
  }
}`}</pre>
            </div>
        </div>
    );
};
