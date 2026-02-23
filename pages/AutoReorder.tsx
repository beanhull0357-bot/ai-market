import React, { useState } from 'react';
import { RefreshCw, Plus, Trash2, Package, Pause, Play, Loader2, Zap, AlertCircle } from 'lucide-react';
import { useProducts, useAutoReorderRules, saveReorderRule, toggleReorderRule, deleteReorderRule, executeReorderRule } from '../hooks';

export const AutoReorder: React.FC = () => {
    const { products } = useProducts();
    const [agentId, setAgentId] = useState('');
    const [agentInput, setAgentInput] = useState('');
    const { rules, loading, refetch } = useAutoReorderRules(agentId || undefined);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ sku: '', quantity: 10, intervalDays: 14, priceThreshold: '' });
    const [saving, setSaving] = useState(false);
    const [executingId, setExecutingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [execResult, setExecResult] = useState<{ ruleId: string; success: boolean; orderId?: string; error?: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);

    const addRule = async () => {
        const product = products.find(p => p.sku === form.sku);
        if (!form.sku || !product || !agentId) { setError(!agentId ? '에이전트 ID를 먼저 입력하세요' : '상품을 선택하세요'); return; }
        setSaving(true); setError(null);
        try {
            await saveReorderRule({
                agentId, sku: form.sku, productName: product.title,
                quantity: form.quantity, intervalDays: form.intervalDays,
                priceThreshold: form.priceThreshold ? +form.priceThreshold : null,
            });
            setShowForm(false);
            setForm({ sku: '', quantity: 10, intervalDays: 14, priceThreshold: '' });
            refetch();
        } catch (e: any) { setError(e.message || '저장 실패'); }
        finally { setSaving(false); }
    };

    const doToggle = async (id: string, enabled: boolean) => {
        try { await toggleReorderRule(id, !enabled); refetch(); } catch (e: any) { setError(e.message); }
    };

    const doDelete = async (id: string) => {
        setDeletingId(id);
        try { await deleteReorderRule(id); refetch(); } catch (e: any) { setError(e.message); }
        finally { setDeletingId(null); }
    };

    const doExecute = async (ruleId: string) => {
        setExecutingId(ruleId); setExecResult(null); setError(null);
        try {
            const result = await executeReorderRule(ruleId);
            if (result?.success) {
                setExecResult({ ruleId, success: true, orderId: result.order_id });
                refetch();
            } else {
                setExecResult({ ruleId, success: false, error: result?.error || '실행 실패' });
            }
        } catch (e: any) {
            setExecResult({ ruleId, success: false, error: e.message });
        } finally { setExecutingId(null); }
    };

    const activeRules = rules.filter(r => r.enabled);
    const totalExecuted = rules.reduce((s: number, r: any) => s + (r.total_executed || 0), 0);
    const soonRules = rules.filter(r => r.enabled && r.next_order_date && daysUntil(r.next_order_date) <= 3);

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

            {/* Agent ID 필터 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                    value={agentInput} onChange={e => setAgentInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && setAgentId(agentInput)}
                    placeholder="에이전트 ID 입력 (Enter 확인)" className="input-field"
                    style={{ flex: 1, maxWidth: 320 }}
                />
                <button onClick={() => setAgentId(agentInput)} style={{ padding: '8px 14px', fontSize: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-secondary)' }}>적용</button>
                {agentId && <button onClick={() => { setAgentId(''); setAgentInput(''); }} style={{ padding: '8px 14px', fontSize: 12, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-dim)' }}>전체</button>}
            </div>

            {error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)', color: 'var(--accent-red)', fontSize: 12, marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}><AlertCircle size={14} />{error}</div>}

            {showForm && (
                <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: 'var(--text-primary)' }}>재구매 규칙 생성</h3>
                    {!agentId && <div style={{ fontSize: 11, color: 'var(--accent-amber)', marginBottom: 8 }}>⚠️ 위에서 에이전트 ID를 입력해야 규칙을 저장할 수 있습니다</div>}
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
                        <button onClick={addRule} disabled={saving} className="btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}>
                            {saving ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> 저장 중...</> : '생성'}
                        </button>
                        <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', fontSize: 12, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', cursor: 'pointer' }}>취소</button>
                    </div>
                </div>
            )}

            {/* 실행 결과 알림 */}
            {execResult && (
                <div style={{ padding: '10px 14px', marginBottom: 12, borderRadius: 'var(--radius-md)', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', background: execResult.success ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)', color: execResult.success ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {execResult.success ? `✅ 주문 생성 완료: ${execResult.orderId}` : `❌ 실행 실패: ${execResult.error}`}
                </div>
            )}

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent-green)' }}>{activeRules.length}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>활성 규칙</div></div>
                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent-cyan)' }}>{totalExecuted}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>총 실행</div></div>
                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent-amber)' }}>{soonRules.length}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>3일 내 주문</div></div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-dim)' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
            ) : rules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
                    <RefreshCw size={28} style={{ opacity: 0.2, marginBottom: 8 }} />
                    <div style={{ fontSize: 13 }}>등록된 자동 재구매 규칙이 없습니다</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {rules.map((rule: any) => {
                        const days = rule.next_order_date ? daysUntil(rule.next_order_date) : null;
                        const isExecuting = executingId === rule.rule_id;
                        const result = execResult?.ruleId === rule.rule_id ? execResult : null;
                        return (
                            <div key={rule.id} className="glass-card" style={{ padding: 16, opacity: rule.enabled ? 1 : 0.5 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <Package size={18} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{rule.product_name}</span>
                                            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{rule.sku}</span>
                                            {days !== null && days <= 3 && rule.enabled && (
                                                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 'var(--radius-full)', background: 'rgba(245,158,11,0.15)', color: 'var(--accent-amber)', fontWeight: 700 }}>⚡ {days <= 0 ? '오늘' : `${days}일 후`}</span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                                            <span>수량: <b style={{ color: 'var(--text-primary)' }}>{rule.quantity}개</b></span>
                                            <span>주기: <b>{rule.interval_days}일</b></span>
                                            <span>다음 주문: {rule.next_order_date || '-'}</span>
                                            <span>실행: {rule.total_executed}회</span>
                                            {rule.price_threshold && <span>상한: ₩{rule.price_threshold.toLocaleString()}</span>}
                                        </div>
                                        {result && (
                                            <div style={{ fontSize: 10, marginTop: 4, color: result.success ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                                {result.success ? `✅ 주문 ${result.orderId}` : `❌ ${result.error}`}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                        <button onClick={() => doExecute(rule.rule_id)} disabled={!rule.enabled || isExecuting || !agentId} title={!agentId ? '에이전트 ID 필요' : '지금 실행'} style={{
                                            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 10, fontWeight: 700,
                                            borderRadius: 'var(--radius-full)', border: 'none', cursor: (rule.enabled && !isExecuting && agentId) ? 'pointer' : 'not-allowed',
                                            background: 'rgba(34,211,238,0.1)', color: 'var(--accent-cyan)',
                                            opacity: (rule.enabled && agentId) ? 1 : 0.4,
                                        }}>
                                            {isExecuting ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={10} />} 실행
                                        </button>
                                        <button onClick={() => doToggle(rule.id, rule.enabled)} style={{
                                            padding: '4px 10px', fontSize: 10, fontWeight: 700, borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
                                            background: rule.enabled ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                                            color: rule.enabled ? 'var(--accent-green)' : 'var(--accent-red)',
                                        }}>{rule.enabled ? <><Play size={10} /> 활성</> : <><Pause size={10} /> 중지</>}</button>
                                        <button onClick={() => doDelete(rule.id)} disabled={deletingId === rule.id} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}>
                                            {deletingId === rule.id ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
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
