import React, { useState, useRef } from 'react';
import { FlaskConical, Play, Send, CheckCircle2, XCircle, Package, ShoppingCart, Star, Loader2, Terminal, RotateCcw } from 'lucide-react';

/* ━━━ Types ━━━ */
interface SandboxLog {
    id: number;
    type: 'request' | 'response' | 'error' | 'info';
    message: string;
    time: string;
}

const MOCK_PRODUCTS = [
    { sku: 'SB-WW-001', name: '[샌드박스] 물티슈 80매', price: 2500, stock: 100, category: 'CONSUMABLES' },
    { sku: 'SB-CP-001', name: '[샌드박스] A4 복사용지 500매', price: 8900, stock: 50, category: 'MRO' },
    { sku: 'SB-TB-001', name: '[샌드박스] 쓰레기봉투 100L 50매', price: 12000, stock: 200, category: 'CONSUMABLES' },
    { sku: 'SB-TN-001', name: '[샌드박스] 레이저 토너 호환', price: 45000, stock: 15, category: 'MRO' },
];

/* ━━━ Main Page ━━━ */
export const AgentSandbox: React.FC = () => {
    const [logs, setLogs] = useState<SandboxLog[]>([]);
    const [apiKey] = useState('agk_sandbox_test_key_demo');
    const [running, setRunning] = useState(false);
    const logRef = useRef<HTMLDivElement>(null);
    let counter = useRef(0);

    const addLog = (type: SandboxLog['type'], message: string) => {
        counter.current++;
        setLogs(prev => [...prev, { id: counter.current, type, message, time: new Date().toLocaleTimeString('ko-KR') }]);
        setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
    };

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    const runTest = async (testName: string) => {
        setRunning(true);
        addLog('info', `━━━ ${testName} 시작 ━━━`);

        if (testName === 'catalog') {
            addLog('request', 'POST /rpc/get_product_feed [SANDBOX]');
            await delay(500);
            addLog('response', `✅ ${MOCK_PRODUCTS.length}개 테스트 상품 로딩됨`);
            MOCK_PRODUCTS.forEach(p => {
                addLog('response', `  📦 ${p.sku} | ${p.name} | ₩${p.price.toLocaleString()} | 재고: ${p.stock}`);
            });
        } else if (testName === 'order') {
            const product = MOCK_PRODUCTS[0];
            addLog('request', `POST /rpc/agent_create_order { sku: "${product.sku}", qty: 5 } [SANDBOX]`);
            await delay(800);
            addLog('response', `✅ 테스트 주문 생성됨`);
            addLog('response', `  주문번호: ORD-SB-${Date.now().toString(36).toUpperCase()}`);
            addLog('response', `  총액: ₩${(product.price * 5).toLocaleString()}`);
            addLog('response', `  상태: ORDER_CREATED (24시간 유예)`);
            addLog('info', `⚠️ 샌드박스 주문은 실제 풀필먼트가 실행되지 않습니다`);
        } else if (testName === 'review') {
            addLog('request', `POST /rpc/agent_create_review { sku: "${MOCK_PRODUCTS[1].sku}", verdict: "ENDORSE" } [SANDBOX]`);
            await delay(600);
            addLog('response', `✅ 테스트 리뷰 등록됨`);
            addLog('response', `  판결: ENDORSE | 스펙 일치: 0.95 | 배송 오차: +0.2일`);
            addLog('info', `⚠️ 샌드박스 리뷰는 Trust Score에 반영되지 않습니다`);
        } else if (testName === 'full') {
            addLog('info', '🔄 전체 플로우 테스트 (인증 → 카탈로그 → 주문 → 리뷰)');
            await delay(400);
            addLog('request', `POST /rpc/authenticate_agent { api_key: "${apiKey}" }`);
            await delay(500);
            addLog('response', '✅ 인증 성공: SandboxBot-v1');
            await delay(300);
            addLog('request', 'POST /rpc/get_product_feed');
            await delay(500);
            addLog('response', `✅ ${MOCK_PRODUCTS.length}개 상품 확인`);
            await delay(300);
            const p = MOCK_PRODUCTS[2];
            addLog('request', `POST /rpc/agent_create_order { sku: "${p.sku}", qty: 10 }`);
            await delay(700);
            const orderId = `ORD-SB-${Date.now().toString(36).toUpperCase()}`;
            addLog('response', `✅ 주문 생성: ${orderId} | ₩${(p.price * 10).toLocaleString()}`);
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

            {/* Sandbox Key */}
            <div className="glass-card" style={{ padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>테스트 API 키</div>
                <code style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', background: 'var(--bg-surface)', padding: '4px 10px', borderRadius: 'var(--radius-sm)' }}>{apiKey}</code>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(251,191,36,0.1)', color: 'var(--accent-amber)', fontWeight: 700 }}>SANDBOX</span>
            </div>

            {/* Test Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 16 }}>
                {[
                    { key: 'catalog', label: '카탈로그 조회', icon: <Package size={14} />, color: 'var(--accent-cyan)' },
                    { key: 'order', label: '주문 생성', icon: <ShoppingCart size={14} />, color: 'var(--accent-green)' },
                    { key: 'review', label: '리뷰 제출', icon: <Star size={14} />, color: 'var(--accent-purple)' },
                    { key: 'full', label: '전체 플로우', icon: <Play size={14} />, color: 'var(--accent-amber)' },
                ].map(t => (
                    <button key={t.key} onClick={() => runTest(t.key)} disabled={running}
                        className="glass-card" style={{
                            padding: '12px 16px', cursor: running ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: 8,
                            border: '1px solid var(--border-subtle)',
                            fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                            background: 'var(--bg-card)',
                            opacity: running ? 0.5 : 1,
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
                    {running && <div style={{ color: 'var(--accent-cyan)' }}><Loader2 size={12} className="spin" style={{ display: 'inline' }} /> 실행 중...</div>}
                </div>
            </div>
        </div>
    );
};
