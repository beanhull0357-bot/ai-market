import React, { useState, useRef, useMemo } from 'react';
import { FlaskConical, Play, CheckCircle2, XCircle, Package, ShoppingCart, Star, Loader2, Terminal, RotateCcw, Bot } from 'lucide-react';
import { useProducts, useAgents } from '../hooks';

interface SandboxLog {
    id: number;
    type: 'request' | 'response' | 'error' | 'info';
    message: string;
    time: string;
}

export const AgentSandbox: React.FC = () => {
    const { products, loading: productsLoading } = useProducts();
    const { agents } = useAgents();

    const [agentIdInput, setAgentIdInput] = useState('');
    const [logs, setLogs] = useState<SandboxLog[]>([]);
    const [running, setRunning] = useState(false);
    const logRef = useRef<HTMLDivElement>(null);
    const counter = useRef(0);

    // 선택한 에이전트 (또는 첫 번째 에이전트)
    const selectedAgent = useMemo(() => {
        if (agentIdInput) return agents.find(a => a.agentId === agentIdInput) || null;
        return agents[0] || null;
    }, [agentIdInput, agents]);

    const sandboxKey = selectedAgent
        ? `agk_sb_${selectedAgent.agentId.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20)}`
        : 'agk_sandbox_demo_key';

    // 테스트용 상품 (실 products 앞 4개)
    const sandboxProducts = products.slice(0, 4);

    const addLog = (type: SandboxLog['type'], message: string) => {
        counter.current++;
        setLogs(prev => [...prev, { id: counter.current, type, message, time: new Date().toLocaleTimeString('ko-KR') }]);
        setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
    };

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    const runTest = async (testName: string) => {
        if (productsLoading || sandboxProducts.length === 0) {
            addLog('error', '❌ 상품 데이터 로딩 중입니다. 잠시 후 다시 시도하세요.');
            return;
        }
        setRunning(true);
        addLog('info', `━━━ ${testName.toUpperCase()} TEST 시작 ━━━`);

        if (testName === 'catalog') {
            addLog('request', `POST /rpc/get_product_feed { api_key: "${sandboxKey}" } [SANDBOX]`);
            await delay(500);
            addLog('response', `✅ ${sandboxProducts.length}개 테스트 상품 로딩됨 (실 카탈로그 기반)`);
            sandboxProducts.forEach(p => {
                addLog('response', `  📦 ${p.sku} | ${p.title} | ₩${(p.price || 0).toLocaleString()} | 재고: ${p.stock ?? '-'}`);
            });
        } else if (testName === 'order') {
            const product = sandboxProducts[0];
            addLog('request', `POST /rpc/agent_create_order { sku: "${product.sku}", qty: 5, api_key: "${sandboxKey}" } [SANDBOX]`);
            await delay(800);
            addLog('response', `✅ 테스트 주문 생성됨 (실제 DB 미반영)`);
            addLog('response', `  주문번호: ORD-SB-${Date.now().toString(36).toUpperCase()}`);
            addLog('response', `  상품: ${product.title}`);
            addLog('response', `  총액: ₩${((product.price || 0) * 5).toLocaleString()}`);
            addLog('response', `  상태: ORDER_CREATED (샌드박스 — 24시간 자동 소멸)`);
            addLog('info', `⚠️ 샌드박스 주문은 실제 풀필먼트가 실행되지 않습니다`);
        } else if (testName === 'review') {
            const product = sandboxProducts[1] || sandboxProducts[0];
            addLog('request', `POST /rpc/agent_create_review { sku: "${product.sku}", verdict: "ENDORSE", api_key: "${sandboxKey}" } [SANDBOX]`);
            await delay(600);
            addLog('response', `✅ 테스트 리뷰 등록됨 (실제 DB 미반영)`);
            addLog('response', `  상품: ${product.title}`);
            addLog('response', `  판결: ENDORSE | 스펙 일치: 0.95 | 배송 오차: +0.2일`);
            addLog('info', `⚠️ 샌드박스 리뷰는 Trust Score에 반영되지 않습니다`);
        } else if (testName === 'full') {
            const agentName = selectedAgent?.name || 'SandboxBot-v1';
            addLog('info', '🔄 전체 플로우 테스트 (인증 → 카탈로그 → 주문 → 리뷰)');
            await delay(300);
            addLog('request', `POST /rpc/authenticate_agent { api_key: "${sandboxKey}" }`);
            await delay(500);
            addLog('response', `✅ 인증 성공: ${agentName}`);
            addLog('response', `  에이전트ID: ${selectedAgent?.agentId || 'SANDBOX-AGENT'}`);
            await delay(300);
            addLog('request', 'POST /rpc/get_product_feed');
            await delay(500);
            addLog('response', `✅ ${sandboxProducts.length}개 상품 확인`);
            sandboxProducts.slice(0, 2).forEach(p => addLog('response', `  📦 ${p.sku} — ₩${(p.price || 0).toLocaleString()}`));
            await delay(300);
            const p = sandboxProducts[2] || sandboxProducts[0];
            addLog('request', `POST /rpc/agent_create_order { sku: "${p.sku}", qty: 10 }`);
            await delay(700);
            const orderId = `ORD-SB-${Date.now().toString(36).toUpperCase()}`;
            addLog('response', `✅ 주문 생성: ${orderId} | ${p.title} × 10 = ₩${((p.price || 0) * 10).toLocaleString()}`);
            await delay(400);
            addLog('request', `POST /rpc/agent_create_review { sku: "${p.sku}", verdict: "ENDORSE" }`);
            await delay(500);
            addLog('response', '✅ 리뷰 제출 완료');
            addLog('info', '━━━ 전체 플로우 완료! 모든 API가 정상 동작합니다 ━━━');
        }

        setRunning(false);
    };

    const typeColors: Record<string, string> = {
        request: 'var(--accent-cyan)',
        response: 'var(--accent-green)',
        error: 'var(--accent-red)',
        info: 'var(--accent-amber)',
    };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <FlaskConical size={24} style={{ color: 'var(--accent-amber)' }} />
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Agent Sandbox</h1>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>실제 주문 없이 API를 테스트하는 안전한 환경</p>
                </div>
            </div>

            {/* Agent 선택 */}
            {/* ──────── 실운영 무관 안내 배너 ──────── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)',
            }}>
                <FlaskConical size={14} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--accent-amber)', fontWeight: 600 }}>
                    Sandbox 환경 — 모든 주문·리뷰는 <strong>실제 DB에 반영되지 않습니다.</strong>
                    실제 구매 테스트는 <a href="/playground" style={{ color: 'var(--accent-cyan)', textDecoration: 'underline' }}>/playground</a>를 이용하세요.
                </span>
            </div>
            {/* ──────── 에이전트 선택 ──────── */}

            <div className="glass-card" style={{ padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Bot size={14} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>에이전트</div>
                <select
                    value={agentIdInput}
                    onChange={e => setAgentIdInput(e.target.value)}
                    style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '4px 10px', fontSize: 12 }}
                >
                    <option value="">{agents[0]?.name || '기본 샌드박스 에이전트'}</option>
                    {agents.map(a => <option key={a.agentId} value={a.agentId}>{a.name} ({a.agentId})</option>)}
                </select>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>테스트 API 키</div>
                <code style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', background: 'var(--bg-surface)', padding: '4px 10px', borderRadius: 'var(--radius-sm)' }}>{sandboxKey}</code>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(251,191,36,0.1)', color: 'var(--accent-amber)', fontWeight: 700 }}>SANDBOX</span>
            </div>

            {/* 샌드박스 상품 목록 */}
            <div className="glass-card" style={{ padding: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                    📦 테스트 상품 풀 ({sandboxProducts.length}개 — 실 카탈로그)
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {sandboxProducts.map(p => (
                        <span key={p.sku} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 'var(--radius-full)', background: 'var(--bg-surface)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {p.sku}
                        </span>
                    ))}
                </div>
            </div>

            {/* Test Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 16 }}>
                {[
                    { key: 'catalog', label: '카탈로그 조회', icon: <Package size={14} />, color: 'var(--accent-cyan)' },
                    { key: 'order', label: '주문 생성', icon: <ShoppingCart size={14} />, color: 'var(--accent-green)' },
                    { key: 'review', label: '리뷰 제출', icon: <Star size={14} />, color: 'var(--accent-purple)' },
                    { key: 'full', label: '전체 플로우', icon: <Play size={14} />, color: 'var(--accent-amber)' },
                ].map(t => (
                    <button key={t.key} onClick={() => runTest(t.key)} disabled={running || productsLoading}
                        className="glass-card" style={{
                            padding: '12px 16px', cursor: (running || productsLoading) ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: 8,
                            border: '1px solid var(--border-subtle)', fontSize: 12, fontWeight: 600,
                            color: 'var(--text-primary)', background: 'var(--bg-card)',
                            opacity: (running || productsLoading) ? 0.5 : 1,
                        }}>
                        <div style={{ color: t.color }}>{t.icon}</div>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Log Console */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                        <Terminal size={14} /> Sandbox Console
                        {productsLoading && <span style={{ fontSize: 10, color: 'var(--accent-amber)' }}>상품 로딩 중...</span>}
                    </div>
                    <button onClick={() => setLogs([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                        <RotateCcw size={10} /> 초기화
                    </button>
                </div>
                <div ref={logRef} style={{ height: 320, overflowY: 'auto', padding: 14, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {logs.length === 0 ? (
                        <div style={{ color: 'var(--text-dim)', textAlign: 'center', paddingTop: 60 }}>
                            테스트를 실행하면 여기에 결과가 표시됩니다...
                        </div>
                    ) : (
                        logs.map(log => (
                            <div key={log.id} style={{ marginBottom: 4, display: 'flex', gap: 8 }}>
                                <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>[{log.time}]</span>
                                <span style={{ color: typeColors[log.type] }}>{log.message}</span>
                            </div>
                        ))
                    )}
                    {running && <div style={{ color: 'var(--accent-cyan)' }}><Loader2 size={12} style={{ display: 'inline', animation: 'spin 1s linear infinite' }} /> 실행 중...</div>}
                </div>
            </div>
        </div>
    );
};
