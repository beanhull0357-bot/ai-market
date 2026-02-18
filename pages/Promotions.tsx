import React, { useState } from 'react';
import { Tag, Plus, Percent, Calendar, Package, Loader2, Trash2, Clock, CheckCircle2, XCircle, Zap } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

/* ━━━ Types ━━━ */
interface Promotion {
    id: string;
    name: string;
    type: 'PERCENT_OFF' | 'FIXED_OFF' | 'BULK_DISCOUNT';
    value: number;
    minQty: number;
    categories: string[];
    validFrom: string;
    validTo: string;
    active: boolean;
}

/* ━━━ Main Page ━━━ */
export const Promotions: React.FC = () => {
    const [promos, setPromos] = useState<Promotion[]>([
        { id: 'P-001', name: '소모품 10% 할인', type: 'PERCENT_OFF', value: 10, minQty: 5, categories: ['CONSUMABLES'], validFrom: '2026-02-01', validTo: '2026-03-31', active: true },
        { id: 'P-002', name: 'MRO 대량 구매 할인', type: 'BULK_DISCOUNT', value: 15, minQty: 20, categories: ['MRO'], validFrom: '2026-02-01', validTo: '2026-04-30', active: true },
        { id: 'P-003', name: '전 상품 ₩5,000 할인', type: 'FIXED_OFF', value: 5000, minQty: 1, categories: [], validFrom: '2026-01-15', validTo: '2026-02-15', active: false },
    ]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: '', type: 'PERCENT_OFF' as Promotion['type'], value: 0, minQty: 1, categories: '', validFrom: '', validTo: '' });

    const addPromo = () => {
        if (!form.name || !form.value) return;
        const newPromo: Promotion = {
            id: `P-${String(promos.length + 1).padStart(3, '0')}`,
            ...form,
            categories: form.categories ? form.categories.split(',').map(c => c.trim()) : [],
            active: true,
        };
        setPromos([newPromo, ...promos]);
        setShowForm(false);
        setForm({ name: '', type: 'PERCENT_OFF', value: 0, minQty: 1, categories: '', validFrom: '', validTo: '' });
    };

    const toggleActive = (id: string) => {
        setPromos(promos.map(p => p.id === id ? { ...p, active: !p.active } : p));
    };

    const deletePromo = (id: string) => {
        setPromos(promos.filter(p => p.id !== id));
    };

    const typeLabels: Record<string, { label: string; color: string }> = {
        PERCENT_OFF: { label: '% 할인', color: 'var(--accent-green)' },
        FIXED_OFF: { label: '₩ 할인', color: 'var(--accent-cyan)' },
        BULK_DISCOUNT: { label: '대량 할인', color: 'var(--accent-purple)' },
    };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Tag size={24} style={{ color: 'var(--accent-green)' }} />
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Promotions</h1>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>에이전트 대상 프로모션 관리</p>
                    </div>
                </div>
                <button onClick={() => setShowForm(!showForm)} className="btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}>
                    <Plus size={14} /> 새 프로모션
                </button>
            </div>

            {/* Create Form */}
            {showForm && (
                <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>새 프로모션 생성</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="프로모션 이름" className="input-field" />
                        <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })}
                            className="input-field" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: 13 }}>
                            <option value="PERCENT_OFF">비율 할인 (%)</option>
                            <option value="FIXED_OFF">정액 할인 (₩)</option>
                            <option value="BULK_DISCOUNT">대량 구매 할인</option>
                        </select>
                        <input type="number" value={form.value || ''} onChange={e => setForm({ ...form, value: +e.target.value })}
                            placeholder="할인값" className="input-field" />
                        <input type="number" value={form.minQty || ''} onChange={e => setForm({ ...form, minQty: +e.target.value })}
                            placeholder="최소 수량" className="input-field" />
                        <input value={form.categories} onChange={e => setForm({ ...form, categories: e.target.value })}
                            placeholder="카테고리 (콤마 구분)" className="input-field" />
                        <input type="date" value={form.validFrom} onChange={e => setForm({ ...form, validFrom: e.target.value })}
                            className="input-field" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: 13 }} />
                        <input type="date" value={form.validTo} onChange={e => setForm({ ...form, validTo: e.target.value })}
                            className="input-field" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: 13 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button onClick={addPromo} className="btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}>생성</button>
                        <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', fontSize: 12, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', cursor: 'pointer' }}>취소</button>
                    </div>
                </div>
            )}

            {/* Promo List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {promos.map(p => {
                    const tl = typeLabels[p.type];
                    const isExpired = new Date(p.validTo) < new Date();
                    return (
                        <div key={p.id} className="glass-card" style={{ padding: 16, opacity: p.active && !isExpired ? 1 : 0.6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Zap size={18} style={{ color: tl.color, flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</span>
                                        <span style={{
                                            fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                            background: `color-mix(in srgb, ${tl.color} 15%, transparent)`, color: tl.color, fontWeight: 700,
                                        }}>{tl.label}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                                        <span>할인: <b style={{ color: 'var(--text-primary)' }}>{p.type === 'FIXED_OFF' ? `₩${p.value.toLocaleString()}` : `${p.value}%`}</b></span>
                                        <span>최소 수량: <b>{p.minQty}개</b></span>
                                        <span>기간: {p.validFrom} ~ {p.validTo}</span>
                                        {p.categories.length > 0 && <span>카테고리: {p.categories.join(', ')}</span>}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                    <button onClick={() => toggleActive(p.id)} style={{
                                        padding: '4px 10px', fontSize: 10, fontWeight: 700, borderRadius: 'var(--radius-full)',
                                        border: 'none', cursor: 'pointer',
                                        background: p.active ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                                        color: p.active ? 'var(--accent-green)' : 'var(--accent-red)',
                                    }}>{p.active ? '활성' : '비활성'}</button>
                                    <button onClick={() => deletePromo(p.id)} style={{
                                        padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)',
                                    }}><Trash2 size={14} /></button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
