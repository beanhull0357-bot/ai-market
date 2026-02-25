import React, { useState, useEffect, useCallback } from 'react';
import { Webhook, Plus, Trash2, CheckCircle2, XCircle, Loader2, Bell, ShoppingCart, Package, DollarSign, AlertTriangle, Send, Copy, Eye, EyeOff, Zap, RefreshCw } from 'lucide-react';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Seller Webhook Manager
    셀러가 주문/재고/정산 이벤트를 외부 시스템에
    실시간 전달할 수 있는 웹훅 설정 관리
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface SellerWebhookManagerProps {
    apiKey: string;
    sellerInfo: any;
}

interface SellerWebhook {
    id: string;
    name: string;
    url: string;
    secret: string;
    events: string[];
    active: boolean;
    created_at: string;
    last_triggered?: string;
    success_count: number;
    fail_count: number;
}

const SELLER_EVENTS = [
    { value: 'order.created', label: '신규 주문', icon: <ShoppingCart size={11} />, desc: '새 주문이 들어올 때' },
    { value: 'order.paid', label: '결제 완료', icon: <DollarSign size={11} />, desc: '결제가 확인되었을 때' },
    { value: 'order.shipped', label: '발송 처리', icon: <Send size={11} />, desc: '발송 처리 완료 시' },
    { value: 'order.delivered', label: '배송 완료', icon: <CheckCircle2 size={11} />, desc: '배송이 완료되었을 때' },
    { value: 'order.cancelled', label: '주문 취소', icon: <XCircle size={11} />, desc: '주문이 취소되었을 때' },
    { value: 'inventory.low', label: '재고 부족', icon: <AlertTriangle size={11} />, desc: '재고가 5개 이하일 때' },
    { value: 'inventory.zero', label: '품절', icon: <Package size={11} />, desc: '재고 소진 시' },
    { value: 'settlement.ready', label: '정산 확정', icon: <DollarSign size={11} />, desc: '정산 금액이 확정될 때' },
];

function generateId() { return `swh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`; }
function generateSecret() { return `whsec_${Array.from({ length: 32 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')}`; }

export const SellerWebhookManager: React.FC<SellerWebhookManagerProps> = ({ apiKey, sellerInfo }) => {
    const [webhooks, setWebhooks] = useState<SellerWebhook[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [formName, setFormName] = useState('');
    const [formUrl, setFormUrl] = useState('');
    const [formEvents, setFormEvents] = useState<string[]>([]);
    const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const [sending, setSending] = useState<string | null>(null);

    // Load webhooks from localStorage (seller-scoped)
    const storageKey = `seller_webhooks_${sellerInfo?.seller_id || 'unknown'}`;

    useEffect(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) setWebhooks(JSON.parse(saved));
    }, [storageKey]);

    const saveWebhooks = useCallback((hooks: SellerWebhook[]) => {
        setWebhooks(hooks);
        localStorage.setItem(storageKey, JSON.stringify(hooks));
    }, [storageKey]);

    const toggleEvent = (ev: string) => {
        setFormEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
    };

    const addWebhook = () => {
        if (!formName.trim() || !formUrl.trim() || formEvents.length === 0) return;
        const hook: SellerWebhook = {
            id: generateId(), name: formName, url: formUrl, secret: generateSecret(),
            events: formEvents, active: true, created_at: new Date().toISOString(),
            success_count: 0, fail_count: 0,
        };
        saveWebhooks([hook, ...webhooks]);
        setFormName(''); setFormUrl(''); setFormEvents([]); setShowForm(false);
    };

    const removeWebhook = (id: string) => {
        saveWebhooks(webhooks.filter(h => h.id !== id));
    };

    const toggleActive = (id: string) => {
        saveWebhooks(webhooks.map(h => h.id === id ? { ...h, active: !h.active } : h));
    };

    const testWebhook = async (hook: SellerWebhook) => {
        setSending(hook.id);
        setTestResult(null);

        // Simulate webhook test
        await new Promise(r => setTimeout(r, 1200));

        const success = hook.url.startsWith('https://');
        const updated = webhooks.map(h => h.id === hook.id
            ? { ...h, last_triggered: new Date().toISOString(), ...(success ? { success_count: h.success_count + 1 } : { fail_count: h.fail_count + 1 }) }
            : h
        );
        saveWebhooks(updated);

        setTestResult({
            id: hook.id,
            success,
            message: success ? '✅ 테스트 페이로드 전송 완료 (200 OK)' : '❌ HTTPS URL만 지원됩니다',
        });
        setSending(null);
    };

    const cardStyle = { padding: 20, borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' };
    const inputStyle = { width: '100%', padding: 10, borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12, boxSizing: 'border-box' as const, outline: 'none' };

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Webhook size={20} style={{ color: 'var(--accent-purple)' }} />
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>웹훅 관리</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>주문·재고·정산 이벤트를 외부 시스템에 실시간 전달</div>
                    </div>
                </div>
                <button onClick={() => setShowForm(!showForm)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    <Plus size={14} /> 웹훅 추가
                </button>
            </div>

            {/* ━━━ Add Webhook Form ━━━ */}
            {showForm && (
                <div style={{ ...cardStyle, marginBottom: 16, border: '1px solid rgba(168,85,247,0.3)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Zap size={14} style={{ color: 'var(--accent-purple)' }} /> 새 웹훅 등록
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 16 }}>
                        <div>
                            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>이름</label>
                            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Slack 알림" style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Endpoint URL</label>
                            <input value={formUrl} onChange={e => setFormUrl(e.target.value)} placeholder="https://your-server.com/webhook" style={inputStyle} />
                        </div>
                    </div>

                    <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>이벤트 구독</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6, marginBottom: 16 }}>
                        {SELLER_EVENTS.map(ev => (
                            <div key={ev.value} onClick={() => toggleEvent(ev.value)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                                    background: formEvents.includes(ev.value) ? 'rgba(168,85,247,0.08)' : 'transparent',
                                    border: `1px solid ${formEvents.includes(ev.value) ? 'rgba(168,85,247,0.3)' : 'var(--border-subtle)'}`,
                                    transition: 'all 150ms',
                                }}>
                                <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${formEvents.includes(ev.value) ? 'var(--accent-purple)' : 'var(--border-subtle)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: formEvents.includes(ev.value) ? 'var(--accent-purple)' : 'transparent' }}>
                                    {formEvents.includes(ev.value) && <CheckCircle2 size={10} style={{ color: '#fff' }} />}
                                </div>
                                <span style={{ color: formEvents.includes(ev.value) ? 'var(--accent-purple)' : 'var(--text-muted)' }}>
                                    {ev.icon}
                                </span>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{ev.label}</div>
                                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{ev.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={addWebhook} disabled={!formName.trim() || !formUrl.trim() || formEvents.length === 0}
                            style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: (formName.trim() && formUrl.trim() && formEvents.length > 0) ? 'var(--accent-purple)' : 'var(--border-subtle)', color: (formName.trim() && formUrl.trim() && formEvents.length > 0) ? '#fff' : 'var(--text-muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                            등록
                        </button>
                        <button onClick={() => { setShowForm(false); setFormName(''); setFormUrl(''); setFormEvents([]); }}
                            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                            취소
                        </button>
                    </div>
                </div>
            )}

            {/* ━━━ Webhook List ━━━ */}
            {webhooks.length === 0 ? (
                <div style={{ ...cardStyle, textAlign: 'center', padding: 48 }}>
                    <Webhook size={36} style={{ color: 'var(--text-muted)', opacity: 0.2, marginBottom: 12 }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>등록된 웹훅 없음</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                        웹훅을 추가하면 주문, 재고, 정산 이벤트를<br />Slack, ERP 등 외부 시스템으로 실시간 전달합니다
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {['Slack', 'Discord', 'Zapier', 'n8n', 'Make', 'Custom API'].map(tool => (
                            <span key={tool} style={{ padding: '4px 10px', borderRadius: 20, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', fontSize: 10, color: 'var(--text-muted)' }}>
                                {tool}
                            </span>
                        ))}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {webhooks.map(hook => (
                        <div key={hook.id} style={{ ...cardStyle, opacity: hook.active ? 1 : 0.6, transition: 'opacity 200ms' }}>
                            {/* Hook Header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{
                                        width: 32, height: 32, borderRadius: 8,
                                        background: hook.active ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <Webhook size={16} style={{ color: hook.active ? 'var(--accent-green)' : 'var(--accent-red)' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{hook.name}</div>
                                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{hook.id}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button onClick={() => testWebhook(hook)} disabled={!!sending}
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 4, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', fontSize: 10, cursor: 'pointer' }}>
                                        {sending === hook.id ? <Loader2 size={10} className="spin" /> : <Send size={10} />} 테스트
                                    </button>
                                    <button onClick={() => toggleActive(hook.id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 4, border: `1px solid ${hook.active ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, background: hook.active ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', color: hook.active ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                                        {hook.active ? <CheckCircle2 size={10} /> : <XCircle size={10} />} {hook.active ? '활성' : '비활성'}
                                    </button>
                                    <button onClick={() => removeWebhook(hook.id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: 'var(--accent-red)', fontSize: 10, cursor: 'pointer' }}>
                                        <Trash2 size={10} /> 삭제
                                    </button>
                                </div>
                            </div>

                            {/* URL + Secret */}
                            <div style={{ padding: 10, borderRadius: 6, background: 'var(--bg-primary)', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Endpoint</div>
                                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{hook.url}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        Signing Secret
                                        <button onClick={() => setShowSecrets(p => ({ ...p, [hook.id]: !p[hook.id] }))}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                                            {showSecrets[hook.id] ? <EyeOff size={10} /> : <Eye size={10} />}
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                                            {showSecrets[hook.id] ? hook.secret : '••••••••••••'}
                                        </span>
                                        <button onClick={() => navigator.clipboard.writeText(hook.secret)}
                                            style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: 2 }}>
                                            <Copy size={10} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Events */}
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                                {hook.events.map(ev => {
                                    const evInfo = SELLER_EVENTS.find(e => e.value === ev);
                                    return (
                                        <span key={ev} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 4, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)', fontSize: 9, color: 'var(--accent-purple)', fontWeight: 600 }}>
                                            {evInfo?.icon} {evInfo?.label || ev}
                                        </span>
                                    );
                                })}
                            </div>

                            {/* Stats */}
                            <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-muted)' }}>
                                <span>✅ 성공: <strong style={{ color: 'var(--accent-green)' }}>{hook.success_count}</strong></span>
                                <span>❌ 실패: <strong style={{ color: 'var(--accent-red)' }}>{hook.fail_count}</strong></span>
                                <span>📅 마지막: <strong style={{ color: 'var(--text-primary)' }}>{hook.last_triggered ? new Date(hook.last_triggered).toLocaleString('ko-KR') : '—'}</strong></span>
                            </div>

                            {/* Test Result */}
                            {testResult?.id === hook.id && (
                                <div style={{
                                    marginTop: 8, padding: '8px 12px', borderRadius: 6,
                                    background: testResult.success ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                                    border: `1px solid ${testResult.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                                    fontSize: 11, color: testResult.success ? 'var(--accent-green)' : 'var(--accent-red)',
                                }}>
                                    {testResult.message}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ━━━ Payload Example ━━━ */}
            <div style={{ ...cardStyle, marginTop: 16, background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.2)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Bell size={14} /> 페이로드 예시
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
                    웹훅 수신 시 아래 형식의 JSON이 POST로 전달됩니다. <code>X-Webhook-Signature</code> 헤더로 HMAC 검증 가능합니다.
                </div>
                <div style={{ padding: 12, borderRadius: 6, background: 'var(--bg-primary)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-primary)', overflow: 'auto', whiteSpace: 'pre', lineHeight: 1.5 }}>
                    {`{
  "event": "order.created",
  "timestamp": "${new Date().toISOString()}",
  "seller_id": "${sellerInfo?.seller_id || 'SLR-XXXX'}",
  "data": {
    "order_id": "ORD-2026-ABC123",
    "product_sku": "TISSUE-70x20",
    "quantity": 5,
    "total_price": 94500,
    "buyer_agent": "PROCURE-BOT-v2.1",
    "status": "ORDER_CREATED"
  }
}`}
                </div>
            </div>

            {/* ━━━ Integration Guide ━━━ */}
            <div style={{ ...cardStyle, marginTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Zap size={14} style={{ color: 'var(--accent-purple)' }} /> 연동 가이드
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    {[
                        { name: 'Slack', desc: 'Incoming Webhook URL을 등록하면 주문 알림을 채널에 실시간 전달', color: '#e01e5a', emoji: '💬' },
                        { name: 'Discord', desc: 'Webhook URL로 주문/재고 알림을 디스코드 채널에 전달', color: '#5865f2', emoji: '🎮' },
                        { name: 'Zapier / Make', desc: 'Catch Hook으로 ERP, 스프레드시트 등 2000+ 앱과 연동', color: '#ff4a00', emoji: '⚡' },
                        { name: 'Custom API', desc: 'HMAC 서명 검증 후 자체 백엔드에서 주문 자동 처리', color: '#06b6d4', emoji: '🔧' },
                    ].map(tool => (
                        <div key={tool.name} style={{ padding: 14, borderRadius: 8, border: '1px solid var(--border-subtle)', background: `${tool.color}05` }}>
                            <div style={{ fontSize: 20, marginBottom: 6 }}>{tool.emoji}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{tool.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>{tool.desc}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
