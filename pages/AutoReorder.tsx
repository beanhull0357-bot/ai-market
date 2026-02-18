import React, { useState } from 'react';
import { RefreshCw, Plus, Trash2, Package, Pause, Play } from 'lucide-react';
import { useProducts } from '../hooks';

interface ReorderRule {
    id: string; sku: string; productName: string; quantity: number;
    intervalDays: number; nextOrderDate: string; enabled: boolean;
    priceThreshold: number | null; totalExecuted: number;
}

export const AutoReorder: React.FC = () => {
    const { products } = useProducts();
    const [rules, setRules] = useState<ReorderRule[]>([
        { id: 'AR-001', sku: '', productName: '물티슈 80매', quantity: 20, intervalDays: 14, nextOrderDate: '2026-03-04', enabled: true, priceThreshold: 3000, totalExecuted: 8 },
        { id: 'AR-002', sku: '', productName: 'A4 복사용지', quantity: 10, intervalDays: 30, nextOrderDate: '2026-03-18', enabled: true, priceThreshold: null, totalExecuted: 3 },
        { id: 'AR-003', sku: '', productName: '커피믹스 100입', quantity: 5, intervalDays: 7, nextOrderDate: '2026-02-25', enabled: false, priceThreshold: 15000, totalExecuted: 12 },
    ]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ sku: '', quantity: 10, intervalDays: 14, priceThreshold: '' });

    const addRule = () => {
        const product = products.find(p => p.sku === form.sku);
        if (!form.sku || !product) return;
        const next = new Date(); next.setDate(next.getDate() + form.intervalDays);
        setRules([{ id: `AR-${String(rules.length + 1).padStart(3, '0')}`, sku: form.sku, productName: product.title, quantity: form.quantity, intervalDays: form.intervalDays, nextOrderDate: next.toISOString().slice(0, 10), enabled: true, priceThreshold: form.priceThreshold ? +form.priceThreshold : null, totalExecuted: 0 }, ...rules]);
        setShowForm(false);
        setForm({ sku: '', quantity: 10, intervalDays: 14, priceThreshold: '' });
    };

    const toggleRule = (id: string) => setRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
    const deleteRule = (id: string) => setRules(rules.filter(r => r.id !== id));
    const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <RefreshCw size={24} style={{ color: 'var(--accent-green)' }} />
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Auto Reorder</h1>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>소모품 정기 재구매 자동화</p>
                    </div>
                </div>
                <button onClick={() => setShowForm(!showForm)} className="btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}><Plus size={14} /> 새 규칙</button>
            </div>

            {showForm && (
                <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: 'var(--text-primary)' }}>재구매 규칙 생성</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                        <select value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: 13 }}>
                            <option value="">상품 선택...</option>
                            {products.map(p => <option key={p.sku} value={p.sku}>{p.title}</option>)}
                        </select>
                        <input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: +e.target.value })} placeholder="수량" className="input-field" />
                        <select value={form.intervalDays} onChange={e => setForm({ ...form, intervalDays: +e.target.value })} style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: 13 }}>
                            <option value={7}>매주</option><option value={14}>2주마다</option><option value={30}>매월</option><option value={90}>분기별</option>
                        </select>
                        <input type="number" value={form.priceThreshold} onChange={e => setForm({ ...form, priceThreshold: e.target.value })} placeholder="가격 상한 (₩, 선택)" className="input-field" />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button onClick={addRule} className="btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}>생성</button>
                        <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', fontSize: 12, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', cursor: 'pointer' }}>취소</button>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent-green)' }}>{rules.filter(r => r.enabled).length}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>활성 규칙</div></div>
                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent-cyan)' }}>{rules.reduce((s, r) => s + r.totalExecuted, 0)}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>총 실행</div></div>
                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent-amber)' }}>{rules.filter(r => r.enabled && daysUntil(r.nextOrderDate) <= 3).length}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>3일 내 주문</div></div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rules.map(rule => {
                    const days = daysUntil(rule.nextOrderDate); return (
                        <div key={rule.id} className="glass-card" style={{ padding: 16, opacity: rule.enabled ? 1 : 0.5 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Package size={18} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{rule.productName}</div>
                                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                                        <span>수량: <b>{rule.quantity}개</b></span><span>주기: <b>{rule.intervalDays}일</b></span><span>실행: <b>{rule.totalExecuted}회</b></span>
                                        {rule.priceThreshold && <span>상한: <b>₩{rule.priceThreshold.toLocaleString()}</b></span>}
                                    </div>
                                </div>
                                {rule.enabled && <div style={{ textAlign: 'right', flexShrink: 0 }}><div style={{ fontSize: 12, fontWeight: 700, color: days <= 3 ? 'var(--accent-amber)' : 'var(--accent-green)' }}>{days <= 0 ? '오늘' : `${days}일 후`}</div><div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{rule.nextOrderDate}</div></div>}
                                <button onClick={() => toggleRule(rule.id)} style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer', background: rule.enabled ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)', color: rule.enabled ? 'var(--accent-green)' : 'var(--accent-red)' }}>{rule.enabled ? <Play size={10} /> : <Pause size={10} />}</button>
                                <button onClick={() => deleteRule(rule.id)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}><Trash2 size={14} /></button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
