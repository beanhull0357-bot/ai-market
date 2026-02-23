import React, { useState } from 'react';
import { Cpu, Copy, CheckCircle2, Server, Wrench, Database, ArrowRight, Globe, ExternalLink, ChevronDown, ChevronUp, Radio, Terminal } from 'lucide-react';

const MCP_ENDPOINT = 'https://psiysvvcusfyfsfozywn.supabase.co/functions/v1/mcp';

/* ━━━ Tool Card (Interactive) ━━━ */
function ToolCard({ name, desc, params, color, request, response }: {
    key?: string; name: string; desc: string; params: string[]; color: string;
    request: string; response: string;
}) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
            <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Wrench size={14} style={{ color }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{name}</span>
                    </div>
                    {expanded ? <ChevronUp size={12} style={{ color: 'var(--text-dim)' }} /> : <ChevronDown size={12} style={{ color: 'var(--text-dim)' }} />}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>{desc}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {params.map(p => (
                        <span key={p} style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)',
                            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                            color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)',
                        }}>{p}</span>
                    ))}
                </div>
            </div>
            {expanded && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 16 }} onClick={e => e.stopPropagation()}>
                    <JsonBlock label="📤 요청 (Request)" code={request} accent={color} />
                    <JsonBlock label="📥 응답 (Response)" code={response} accent="var(--accent-green)" />
                </div>
            )}
        </div>
    );
}

/* ━━━ JSON Block ━━━ */
function JsonBlock({ label, code, accent }: { label: string; code: string; accent: string }) {
    const [copied, setCopied] = useState(false);
    const copy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)' }}>{label}</span>
                <button onClick={copy} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: copied ? 'var(--accent-green)' : 'var(--text-muted)', fontSize: 10,
                    display: 'flex', alignItems: 'center', gap: 4,
                }}>
                    {copied ? <CheckCircle2 size={10} /> : <Copy size={10} />}
                    {copied ? '복사됨' : '복사'}
                </button>
            </div>
            <pre style={{
                background: 'var(--bg-surface)', border: `1px solid color-mix(in srgb, ${accent} 20%, var(--border-subtle))`,
                borderRadius: 'var(--radius-md)', padding: 12, fontSize: 11,
                fontFamily: 'var(--font-mono)', color: accent,
                overflow: 'auto', lineHeight: 1.6, margin: 0,
            }}>{code}</pre>
        </div>
    );
}

/* ━━━ Code Snippet ━━━ */
function CodeSnippet({ code, label }: { code: string; label: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
                <button onClick={copy} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: copied ? 'var(--accent-green)' : 'var(--text-muted)', fontSize: 11,
                    display: 'flex', alignItems: 'center', gap: 4,
                }}>
                    {copied ? <CheckCircle2 size={11} /> : <Copy size={11} />}
                    {copied ? '복사됨' : '복사'}
                </button>
            </div>
            <pre style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)', padding: 12, fontSize: 11,
                fontFamily: 'var(--font-mono)', color: 'var(--accent-green)',
                overflow: 'auto', lineHeight: 1.6,
            }}>{code}</pre>
        </div>
    );
}

/* ━━━ Main Page ━━━ */
export const MCPIntegration: React.FC = () => {
    const [health, setHealth] = useState<string | null>(null);
    const [healthLoading, setHealthLoading] = useState(false);

    const checkHealth = async () => {
        setHealthLoading(true);
        try {
            const res = await fetch(MCP_ENDPOINT);
            const json = await res.json();
            setHealth(json.status === 'ok' ? '✅ LIVE — ' + json.tools.length + ' tools active' : '⚠️ ' + JSON.stringify(json));
        } catch (e: any) {
            setHealth('❌ 연결 실패: ' + e.message);
        }
        setHealthLoading(false);
    };

    const mcpConfig = `{
  "mcpServers": {
    "jsonmart": {
      "url": "${MCP_ENDPOINT}",
      "transport": "http"
    }
  }
}`;

    const claudeDesktopConfig = `{
  "mcpServers": {
    "jsonmart": {
      "url": "${MCP_ENDPOINT}",
      "transport": "http",
      "headers": {
        "x-api-key": "agk_your_api_key_here"
      }
    }
  }
}`;

    const tools = [
        {
            name: 'search_products', desc: '상품 카탈로그 검색. 카테고리, 가격 범위, 재고 상태로 필터링',
            params: ['query?', 'category?', 'max_price?', 'in_stock_only?'], color: 'var(--accent-cyan)',
            request: `{
  "tool": "search_products",
  "arguments": {
    "query": "물티슈",
    "category": "CONSUMABLES",
    "max_price": 5000,
    "in_stock_only": true
  }
}`,
            response: `{
  "results": [
    {
      "sku": "WW-001",
      "title": "물티슈 80매",
      "price": 2500,
      "stock": 150,
      "category": "CONSUMABLES",
      "trustScore": 4.2
    }
  ],
  "total": 1
}`,
        },
        {
            name: 'get_product_detail', desc: 'SKU로 상품 상세 정보 조회. 스펙, 가격, 재고, 신뢰 점수 포함',
            params: ['sku'], color: 'var(--accent-green)',
            request: `{
  "tool": "get_product_detail",
  "arguments": {
    "sku": "WW-001"
  }
}`,
            response: `{
  "sku": "WW-001",
  "title": "물티슈 80매",
  "price": 2500,
  "stock": 150,
  "category": "CONSUMABLES",
  "specs": {
    "sheets": 80,
    "material": "레이온",
    "size": "200x150mm"
  },
  "trustScore": 4.2,
  "reviewCount": 12,
  "freeShipping": true,
  "returnWindowDays": 14
}`,
        },
        {
            name: 'create_order', desc: '구매 주문 생성. 24시간 결제 유예, 관리자 승인 필요',
            params: ['sku', 'quantity', 'policy_id?'], color: 'var(--accent-purple)',
            request: `{
  "tool": "create_order",
  "arguments": {
    "sku": "WW-001",
    "quantity": 10,
    "policy_id": "POL-001"
  }
}`,
            response: `{
  "orderId": "ORD-20260219-A1B2C",
  "status": "ORDER_CREATED",
  "sku": "WW-001",
  "quantity": 10,
  "totalPrice": 25000,
  "paymentDeadline": "2026-02-20T00:50:00Z",
  "message": "24시간 내 결제 필요"
}`,
        },
        {
            name: 'check_order_status', desc: '주문 상태 확인. 결제, 배송, 풀필먼트 상태 반환',
            params: ['order_id'], color: 'var(--accent-amber)',
            request: `{
  "tool": "check_order_status",
  "arguments": {
    "order_id": "ORD-20260219-A1B2C"
  }
}`,
            response: `{
  "orderId": "ORD-20260219-A1B2C",
  "status": "SHIPPED",
  "events": [
    { "status": "ORDER_CREATED", "at": "2026-02-19T00:50:00Z" },
    { "status": "PAYMENT_AUTHORIZED", "at": "2026-02-19T02:30:00Z" },
    { "status": "SHIPPED", "at": "2026-02-19T14:00:00Z" }
  ],
  "estimatedDelivery": "2026-02-21"
}`,
        },
        {
            name: 'compare_products', desc: '여러 상품의 스펙, 가격, 신뢰도를 비교 분석',
            params: ['sku_list[]'], color: 'var(--accent-red)',
            request: `{
  "tool": "compare_products",
  "arguments": {
    "sku_list": ["WW-001", "WW-002", "WW-003"]
  }
}`,
            response: `{
  "comparison": [
    { "sku": "WW-001", "price": 2500, "trust": 4.2, "stock": 150 },
    { "sku": "WW-002", "price": 3200, "trust": 4.5, "stock": 80 },
    { "sku": "WW-003", "price": 1900, "trust": 3.8, "stock": 200 }
  ],
  "recommendation": "WW-002",
  "reason": "가격 대비 최고 신뢰 점수"
}`,
        },
        {
            name: 'ask_question', desc: '상품에 대한 질문 등록. 답변 시 알림',
            params: ['sku?', 'category', 'question'], color: 'var(--accent-cyan)',
            request: `{
  "tool": "ask_question",
  "arguments": {
    "sku": "WW-001",
    "category": "SPEC",
    "question": "이 물티슈는 알코올 성분이 포함되어 있나요?"
  }
}`,
            response: `{
  "ticketId": "QA-20260219-X7Y8Z",
  "status": "PENDING",
  "message": "질문이 등록되었습니다. 답변 시 알림을 보내드립니다.",
  "estimatedResponseTime": "24시간 이내"
}`,
        },
    ];

    const resources = [
        { name: 'jsonmart://catalog', desc: '전체 상품 카탈로그 (JSON)', color: 'var(--accent-green)' },
        { name: 'jsonmart://policies', desc: '에이전트 정책 목록', color: 'var(--accent-purple)' },
        { name: 'jsonmart://orders', desc: '내 주문 이력', color: 'var(--accent-amber)' },
        { name: 'jsonmart://promotions', desc: '활성 프로모션', color: 'var(--accent-cyan)' },
    ];

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                <Cpu size={24} style={{ color: 'var(--accent-purple)' }} />
                <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>MCP Integration</h1>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Model Context Protocol — LLM이 JSONMart를 직접 도구로 사용</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(52,211,153,0.12)', color: 'var(--accent-green)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Radio size={9} /> LIVE
                    </span>
                    <button onClick={checkHealth} disabled={healthLoading} style={{
                        fontSize: 11, padding: '6px 12px', borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                        color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600,
                    }}>
                        {healthLoading ? '확인 중...' : '서버 상태 확인'}
                    </button>
                </div>
            </div>
            {health && (
                <div style={{ fontSize: 11, padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', marginBottom: 12, fontFamily: 'var(--font-mono)' }}>
                    {health}
                </div>
            )}

            {/* How it works */}
            <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {[
                        { icon: <Globe size={20} />, label: 'Claude / GPT', color: 'var(--accent-purple)' },
                        { icon: <ArrowRight size={16} />, label: '', color: 'var(--text-dim)' },
                        { icon: <Server size={20} />, label: 'MCP Server', color: 'var(--accent-cyan)' },
                        { icon: <ArrowRight size={16} />, label: '', color: 'var(--text-dim)' },
                        { icon: <Database size={20} />, label: 'JSONMart API', color: 'var(--accent-green)' },
                    ].map((step, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                            <div style={{ color: step.color }}>{step.icon}</div>
                            {step.label && <span style={{ fontSize: 10, fontWeight: 600, color: step.color }}>{step.label}</span>}
                        </div>
                    ))}
                </div>
            </div>

            {/* Setup */}
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>⚡ 설정 방법</h2>

            {/* Deploy instruction */}
            <div className="glass-card" style={{ padding: 14, marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Terminal size={14} style={{ color: 'var(--accent-amber)', flexShrink: 0, marginTop: 1 }} />
                <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-amber)', marginBottom: 4 }}>배포 명령어 (최초 1회)</div>
                    <code style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>supabase functions deploy mcp --no-verify-jwt</code>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>--no-verify-jwt: MCP 클라이언트가 Supabase JWT 없이 접근 가능</div>
                </div>
            </div>

            <CodeSnippet label="Claude Desktop — claude_desktop_config.json" code={claudeDesktopConfig} />
            <CodeSnippet label="MCP Client 직접 연결 (curl/SDK)" code={mcpConfig} />

            {/* Available Tools */}
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '24px 0 12px' }}>🔧 사용 가능한 Tools ({tools.length})</h2>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                💡 카드를 클릭하면 요청/응답 JSON 예시를 확인할 수 있습니다
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
                {tools.map(t => <ToolCard key={t.name} {...t} />)}
            </div>

            {/* Resources */}
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '24px 0 12px' }}>📦 Resources ({resources.length})</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
                {resources.map(r => (
                    <div key={r.name} className="glass-card" style={{ padding: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: r.color, marginBottom: 4 }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.desc}</div>
                    </div>
                ))}
            </div>

            {/* Related Links */}
            <div className="glass-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>관련 리소스</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {[
                        { label: 'MCP 엔드포인트', href: MCP_ENDPOINT },
                        { label: 'agents.json', href: '/agents.json' },
                        { label: 'llms.txt', href: '/llms.txt' },
                        { label: 'openapi.json', href: '/openapi.json' },
                        { label: 'API Docs', href: '/agent/docs' },
                    ].map(l => (
                        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" style={{
                            display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
                            color: 'var(--accent-cyan)', textDecoration: 'none',
                        }}>
                            <ExternalLink size={10} /> {l.label}
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
};
