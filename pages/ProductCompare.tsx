import React, { useState } from 'react';
import { GitCompare, Plus, Trash2, CheckCircle2, XCircle, Package, Loader2, ArrowUpDown } from 'lucide-react';
import { useProducts } from '../hooks';

/* ━━━ Main Page ━━━ */
export const ProductCompare: React.FC = () => {
    const { products, loading } = useProducts();
    const [selectedSkus, setSelectedSkus] = useState<string[]>([]);

    const addProduct = (sku: string) => {
        if (sku && !selectedSkus.includes(sku) && selectedSkus.length < 4) {
            setSelectedSkus([...selectedSkus, sku]);
        }
    };

    const removeProduct = (sku: string) => {
        setSelectedSkus(selectedSkus.filter(s => s !== sku));
    };

    const selected = products.filter(p => selectedSkus.includes(p.sku));

    const compareFields: { key: string; label: string; format: (p: any) => string; better?: 'lower' | 'higher' }[] = [
        { key: 'price', label: '가격 (₩)', format: p => `₩${(p.price || 0).toLocaleString()}`, better: 'lower' },
        { key: 'stock', label: '재고', format: p => `${p.stock ?? '-'}`, better: 'higher' },
        { key: 'category', label: '카테고리', format: p => p.category || '-' },
        { key: 'aiReadinessScore', label: 'AI 적합도', format: p => `${p.aiReadinessScore || '-'}`, better: 'higher' },
        { key: 'trustScore', label: '신뢰 점수', format: p => `${p.trustScore ?? '-'}`, better: 'higher' },
        { key: 'sellerTrust', label: '셀러 신뢰도', format: p => `${p.sellerTrust ?? '-'}`, better: 'higher' },
        { key: 'returnPolicy', label: '반품 기간', format: p => p.returnWindowDays ? `${p.returnWindowDays}일` : '-' },
        { key: 'freeShipping', label: '무료 배송', format: p => p.freeShipping ? '✅' : '❌' },
    ];

    const getBestIdx = (field: typeof compareFields[0]): number => {
        if (!field.better || selected.length < 2) return -1;
        let bestIdx = 0;
        for (let i = 1; i < selected.length; i++) {
            const a = (selected[bestIdx] as any)[field.key];
            const b = (selected[i] as any)[field.key];
            if (field.better === 'lower' && b < a) bestIdx = i;
            if (field.better === 'higher' && b > a) bestIdx = i;
        }
        return bestIdx;
    };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <GitCompare size={24} style={{ color: 'var(--accent-cyan)' }} />
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Product Compare</h1>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>상품 스펙, 가격, 신뢰도 비교 분석</p>
                </div>
            </div>

            {/* Product Selector */}
            <div className="glass-card" style={{ padding: 14, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)' }}>비교할 상품 선택 (최대 4개):</span>
                    <select
                        onChange={e => { addProduct(e.target.value); e.target.value = ''; }}
                        disabled={loading || selectedSkus.length >= 4}
                        style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '6px 10px', fontSize: 11 }}
                    >
                        <option value="">상품 추가...</option>
                        {products.filter(p => !selectedSkus.includes(p.sku)).map(p => (
                            <option key={p.sku} value={p.sku}>{p.sku} — {p.title}</option>
                        ))}
                    </select>
                    {selectedSkus.map(sku => (
                        <span key={sku} style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: 10, padding: '4px 10px', borderRadius: 'var(--radius-full)',
                            background: 'rgba(34,211,238,0.08)', color: 'var(--accent-cyan)',
                        }}>
                            <Package size={10} /> {sku}
                            <button onClick={() => removeProduct(sku)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0 }}>
                                <Trash2 size={10} />
                            </button>
                        </span>
                    ))}
                </div>
            </div>

            {/* Comparison Table */}
            {selected.length > 0 ? (
                <div className="glass-card" style={{ padding: 0, overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-medium)' }}>
                                <th style={{ padding: '14px 16px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>속성</th>
                                {selected.map(p => (
                                    <th key={p.sku} style={{ padding: '14px 12px', textAlign: 'center', minWidth: 140 }}>
                                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', marginBottom: 4 }}>{p.sku}</div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{p.title}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {compareFields.map(field => {
                                const bestIdx = getBestIdx(field);
                                return (
                                    <tr key={field.key} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{field.label}</td>
                                        {selected.map((p, i) => (
                                            <td key={p.sku} style={{
                                                padding: '10px 12px', textAlign: 'center',
                                                fontFamily: 'var(--font-mono)', fontWeight: 600,
                                                color: bestIdx === i ? 'var(--accent-green)' : 'var(--text-primary)',
                                                background: bestIdx === i ? 'rgba(52,211,153,0.05)' : 'transparent',
                                            }}>
                                                {field.format(p)} {bestIdx === i && <CheckCircle2 size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
                    <GitCompare size={40} style={{ color: 'var(--text-dim)', margin: '0 auto 12px' }} />
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>비교할 상품을 선택하세요</p>
                    <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>최대 4개 상품의 스펙, 가격, 신뢰도를 한눈에 비교합니다</p>
                </div>
            )}

            {/* API Hint */}
            {selected.length > 0 && (
                <div className="glass-card" style={{ padding: 14, marginTop: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>에이전트 API</div>
                    <code style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                        compare_products(sku_list: [{selectedSkus.map(s => `"${s}"`).join(', ')}])
                    </code>
                </div>
            )}
        </div>
    );
};
