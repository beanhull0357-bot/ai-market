import React, { useState } from 'react';
import { Tag, Plus, Percent, Calendar, Loader2, Trash2, Zap } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { usePromotions, savePromotion, togglePromotion, deletePromotion } from '../hooks';

const typeLabels: Record<string, { label: string; color: string }> = {
    PERCENT_OFF: { label: '% 할인', color: 'var(--accent-green)' },
    FIXED_OFF: { label: '₩ 할인', color: 'var(--accent-cyan)' },
    BULK_DISCOUNT: { label: '대량 할인', color: 'var(--accent-purple)' },
};

export const Promotions: React.FC = () => {
    const { promotions, loading, refetch } = usePromotions();
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: '', type: 'PERCENT_OFF', value: '' as string | number, minQty: 1, categories: '', validFrom: '', validTo: '' });
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const addPromo = async () => {
        if (!form.name || !form.value) return;
        setSaving(true); setError(null);
        try {
            await savePromotion({
                name: form.name, type: form.type, value: +form.value, minQty: form.minQty,
                categories: form.categories ? form.categories.split(',').map(c => c.trim()).filter(Boolean) : [],
                validFrom: form.validFrom || new Date().toISOString().slice(0, 10),
                validTo: form.validTo || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
            });
            setShowForm(false);
            setForm({ name: '', type: 'PERCENT_OFF', value: '', minQty: 1, categories: '', validFrom: '', validTo: '' });
            refetch();
        } catch (e: any) { setError(e.message || '저장 실패'); }
        finally { setSaving(false); }
    };

    const doToggle = async (id: string, active: boolean) => {
        try { await togglePromotion(id, !active); refetch(); } catch (e: any) { setError(e.message); }
    };

    const doDelete = async (id: string) => {
        setDeletingId(id);
        try { await deletePromotion(id); refetch(); } catch (e: any) { setError(e.message); }
        finally { setDeletingId(null); }
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

            {error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)', color: 'var(--accent-red)', fontSize: 12, marginBottom: 12 }}>{error}</div>}

            {showForm && (
                <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>새 프로모션 생성</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="프로모션 이름" className="input-field" />
                        <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="input-field" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: 13 }}>
                            <option value="PERCENT_OFF">비율 할인 (%)</option>
                            <option value="FIXED_OFF">정액 할인 (₩)</option>
                            <option value="BULK_DISCOUNT">대량 구매 할인</option>
                        </select>
                        <input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder="할인값" className="input-field" />
                        <input type="number" value={form.minQty} onChange={e => setForm({ ...form, minQty: +e.target.value })} placeholder="최소 수량" className="input-field" />
                        <input value={form.categories} onChange={e => setForm({ ...form, categories: e.target.value })} placeholder="카테고리 (콤마 구분)" className="input-field" />
                        <input type="date" value={form.validFrom} onChange={e => setForm({ ...form, validFrom: e.target.value })} className="input-field" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: 13 }} />
                        <input type="date" value={form.validTo} onChange={e => setForm({ ...form, validTo: e.target.value })} className="input-field" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: 13 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button onClick={addPromo} disabled={saving} className="btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}>
                            {saving ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> 저장 중...</> : '생성'}
                        </button>
                        <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', fontSize: 12, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', cursor: 'pointer' }}>취소</button>
                    </div>
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-dim)' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
            ) : promotions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
                    <Tag size={28} style={{ opacity: 0.2, marginBottom: 8 }} />
                    <div style={{ fontSize: 13 }}>등록된 프로모션이 없습니다</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {promotions.map((p: any) => {
                        const tl = typeLabels[p.type] || { label: p.type, color: 'var(--text-muted)' };
                        const isExpired = new Date(p.valid_to) < new Date();
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
                                            {isExpired && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 'var(--radius-full)', background: 'rgba(239,68,68,0.1)', color: 'var(--accent-red)', fontWeight: 700 }}>만료</span>}
                                        </div>
                                        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                                            <span>할인: <b style={{ color: 'var(--text-primary)' }}>{p.type === 'FIXED_OFF' ? `₩${Number(p.value).toLocaleString()}` : `${p.value}%`}</b></span>
                                            <span>최소 수량: <b>{p.min_qty}개</b></span>
                                            <span>기간: {p.valid_from} ~ {p.valid_to}</span>
                                            {p.categories?.length > 0 && <span>카테고리: {p.categories.join(', ')}</span>}
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)' }}>{p.promo_id}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                        <button onClick={() => doToggle(p.id, p.active)} style={{
                                            padding: '4px 10px', fontSize: 10, fontWeight: 700, borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
                                            background: p.active ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                                            color: p.active ? 'var(--accent-green)' : 'var(--accent-red)',
                                        }}>{p.active ? '활성' : '비활성'}</button>
                                        <button onClick={() => doDelete(p.id)} disabled={deletingId === p.id} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}>
                                            {deletingId === p.id ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
