import React, { useState } from 'react';
import { Brain, TrendingUp, Calendar, Package, AlertCircle, Loader2, Sparkles, ArrowRight, ShoppingCart, Clock, BarChart3 } from 'lucide-react';
import { generatePredictions, usePredictions } from '../hooks';

export const PredictiveProcurement: React.FC = () => {
    const [apiKey, setApiKey] = useState('');
    const [generating, setGenerating] = useState(false);
    const [result, setResult] = useState<any>(null);
    const { predictions, loading, refetch } = usePredictions();

    const handleGenerate = async () => {
        if (!apiKey) return;
        setGenerating(true);
        try {
            const data = await generatePredictions(apiKey);
            setResult(data);
            refetch();
        } catch (e) { alert('예측 생성 실패'); }
        setGenerating(false);
    };

    const getDaysUntil = (date: string) => {
        const d = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return d;
    };

    const getUrgencyColor = (days: number) => {
        if (days <= 3) return 'var(--accent-red)';
        if (days <= 7) return 'var(--accent-amber)';
        return 'var(--accent-green)';
    };

    const getConfColor = (conf: number) => {
        if (conf >= 0.8) return 'var(--accent-green)';
        if (conf >= 0.6) return 'var(--accent-amber)';
        return 'var(--text-dim)';
    };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <Brain size={24} style={{ color: 'var(--accent-purple)' }} />
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Predictive Procurement</h1>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>AI가 구매 패턴을 분석하여 다음 주문을 예측합니다</p>
                </div>
            </div>

            {/* How it works */}
            <div className="glass-card" style={{ padding: 14, marginBottom: 16, background: 'rgba(168,85,247,0.03)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-purple)', marginBottom: 8 }}>🧠 작동 원리</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 10, color: 'var(--text-muted)' }}>
                    <span style={{ padding: '4px 8px', borderRadius: 4, background: 'rgba(168,85,247,0.1)', color: 'var(--accent-purple)', fontWeight: 700 }}>1. 패턴 분석</span>
                    <ArrowRight size={12} style={{ color: 'var(--text-dim)' }} />
                    <span style={{ padding: '4px 8px', borderRadius: 4, background: 'rgba(14,165,233,0.1)', color: 'var(--accent-cyan)', fontWeight: 700 }}>2. 주기 계산</span>
                    <ArrowRight size={12} style={{ color: 'var(--text-dim)' }} />
                    <span style={{ padding: '4px 8px', borderRadius: 4, background: 'rgba(34,197,94,0.1)', color: 'var(--accent-green)', fontWeight: 700 }}>3. 다음 주문 예측</span>
                    <ArrowRight size={12} style={{ color: 'var(--text-dim)' }} />
                    <span style={{ padding: '4px 8px', borderRadius: 4, background: 'rgba(251,191,36,0.1)', color: 'var(--accent-amber)', fontWeight: 700 }}>4. 자동 알림</span>
                </div>
            </div>

            {/* Generate */}
            <div className="glass-card" style={{ padding: 14, marginBottom: 16, display: 'flex', gap: 8 }}>
                <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="에이전트 API 키"
                    style={{ flex: 1, border: 'none', background: 'var(--bg-surface)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }} />
                <button onClick={handleGenerate} disabled={!apiKey || generating}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 16px', borderRadius: 6, border: 'none', background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    {generating ? <Loader2 size={14} className="spin" /> : <><Sparkles size={14} /> 예측 생성</>}
                </button>
            </div>

            {result && (
                <div className="glass-card" style={{ padding: 12, marginBottom: 16, background: 'rgba(34,197,94,0.05)' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-green)' }}>✅ {result.predictions_count}개 예측 생성 완료</span>
                </div>
            )}

            {/* Predictions Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={24} className="spin" style={{ color: 'var(--accent-cyan)' }} /></div>
            ) : predictions.length === 0 ? (
                <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
                    <Brain size={32} style={{ color: 'var(--text-dim)', marginBottom: 8 }} />
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>예측 데이터가 없습니다. API 키를 입력하고 예측을 생성하세요.</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>최소 2번 이상 주문한 상품에 대해 예측이 생성됩니다.</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                    {predictions.map((p: any) => {
                        const days = getDaysUntil(p.predicted_date);
                        const urgency = getUrgencyColor(days);
                        const conf = Number(p.confidence || 0);
                        return (
                            <div key={p.id} className="glass-card" style={{ padding: 14, position: 'relative', borderLeft: `3px solid ${urgency}` }}>
                                {/* Status badge */}
                                <div style={{ position: 'absolute', top: 10, right: 10 }}>
                                    <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: p.status === 'ORDERED' ? 'rgba(34,197,94,0.12)' : p.status === 'NOTIFIED' ? 'rgba(251,191,36,0.12)' : 'rgba(107,114,128,0.12)', color: p.status === 'ORDERED' ? 'var(--accent-green)' : p.status === 'NOTIFIED' ? 'var(--accent-amber)' : 'var(--text-dim)' }}>
                                        {p.status}
                                    </span>
                                </div>

                                {/* Product */}
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, paddingRight: 50 }}>{p.product_title || p.sku}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>SKU: {p.sku}</div>

                                {/* Prediction details */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Calendar size={11} style={{ color: urgency }} />
                                        <span style={{ color: 'var(--text-dim)' }}>예상 주문일</span>
                                    </div>
                                    <div style={{ textAlign: 'right', fontWeight: 700, color: urgency, fontFamily: 'var(--font-mono)' }}>
                                        {p.predicted_date} ({days > 0 ? `${days}일 후` : days === 0 ? '오늘' : `${Math.abs(days)}일 전`})
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <BarChart3 size={11} style={{ color: getConfColor(conf) }} />
                                        <span style={{ color: 'var(--text-dim)' }}>신뢰도</span>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            <div style={{ width: 40, height: 4, background: 'var(--bg-surface)', borderRadius: 2, overflow: 'hidden' }}>
                                                <div style={{ width: `${conf * 100}%`, height: '100%', background: getConfColor(conf), borderRadius: 2 }} />
                                            </div>
                                            <span style={{ fontWeight: 700, color: getConfColor(conf), fontFamily: 'var(--font-mono)' }}>{(conf * 100).toFixed(0)}%</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Clock size={11} style={{ color: 'var(--text-dim)' }} />
                                        <span style={{ color: 'var(--text-dim)' }}>평균 주기</span>
                                    </div>
                                    <div style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{p.avg_interval_days}일</div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <ShoppingCart size={11} style={{ color: 'var(--text-dim)' }} />
                                        <span style={{ color: 'var(--text-dim)' }}>누적 주문</span>
                                    </div>
                                    <div style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{p.total_orders}회 (평균 {p.avg_quantity}개)</div>
                                </div>

                                {p.estimated_amount > 0 && (
                                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)', textAlign: 'right' }}>
                                        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>예상 금액: </span>
                                        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>₩{Number(p.estimated_amount).toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
