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

    // ── Commerce Tools ──
    const commerceTools = [
        {
            name: 'search_products', desc: '상품 카탈로그 검색. 카테고리, 가격 범위, 재고 상태로 필터링',
            params: ['query?', 'category?', 'max_price?', 'min_trust?', 'in_stock_only?', 'limit?'], color: 'var(--accent-cyan)',
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
  "results": [{
    "sku": "DOME-12345",
    "title": "물티슈 80매 대용량",
    "description": "물티슈 80매 | 대용량 위생 | 키워드: 물티슈, 대용량",
    "price": 2500,
    "ai_readiness_score": 85,
    "trust_score": 92,
    "stock_status": "in_stock"
  }],
  "total_count": 42
}`,
        },
        {
            name: 'get_product_detail', desc: 'SKU로 상품 상세 정보 조회. 스펙, 가격, 재고, 옵션, 배송비 포함',
            params: ['sku'], color: 'var(--accent-green)',
            request: `{
  "tool": "get_product_detail",
  "arguments": { "sku": "DOME-12345" }
}`,
            response: `{
  "sku": "DOME-12345",
  "title": "물티슈 80매 대용량",
  "description": "...",
  "price": 2500,
  "deliveryFee": { "dome_fee": 3000, "jeju_extra": 3000 },
  "attributes": { "country": "한국", "weight": "500g" },
  "aiReadinessScore": 85,
  "hasOptions": true
}`,
        },
        {
            name: 'compare_products', desc: '여러 상품의 스펙, 가격, 신뢰도를 비교 분석 후 AI 추천',
            params: ['sku_list[]'], color: 'var(--accent-red)',
            request: `{
  "tool": "compare_products",
  "arguments": {
    "sku_list": ["DOME-12345", "DOME-67890"]
  }
}`,
            response: `{
  "comparison": [...],
  "recommendation": "DOME-12345",
  "reason": "최고 신뢰 점수 (92) + 최적 가격 ₩2,500"
}`,
        },
        {
            name: 'create_order', desc: '구매 주문 생성. 재고 확인 → 주문 생성 → 24시간 결제 유예',
            params: ['sku', 'quantity', 'policy_id?'], color: 'var(--accent-purple)',
            request: `{
  "tool": "create_order",
  "arguments": {
    "sku": "DOME-12345",
    "quantity": 10
  }
}`,
            response: `{
  "orderId": "ORD-20260228-A1B2C",
  "status": "ORDER_CREATED",
  "totalPrice": 25000,
  "paymentDeadline": "2026-03-01T..."
}`,
        },
        {
            name: 'check_order_status', desc: '주문 상태 확인. 결제, 배송, 송장번호 반환',
            params: ['order_id'], color: 'var(--accent-amber)',
            request: `{
  "tool": "check_order_status",
  "arguments": { "order_id": "ORD-20260228-A1B2C" }
}`,
            response: `{
  "orderId": "ORD-20260228-A1B2C",
  "status": "SHIPPED",
  "trackingNumber": "1234567890"
}`,
        },
        {
            name: 'count_products', desc: '전체 또는 조건별 상품 수 조회',
            params: ['category?', 'in_stock_only?', 'query?'], color: 'var(--accent-cyan)',
            request: `{
  "tool": "count_products",
  "arguments": { "category": "FOOD" }
}`,
            response: `{ "count": 1523 }`,
        },
        {
            name: 'list_promotions', desc: '현재 활성 프로모션 목록 조회. 카테고리별 필터 가능',
            params: ['category?'], color: 'var(--accent-purple)',
            request: `{
  "tool": "list_promotions",
  "arguments": { "category": "FOOD" }
}`,
            response: `{
  "promotions": [{
    "id": "PROMO-001",
    "name": "신규 에이전트 할인",
    "type": "PERCENT",
    "value": 10
  }]
}`,
        },
    ];

    // ── Negotiation & Payment Tools ──
    const negotiationTools = [
        {
            name: 'negotiate_price', desc: '대량 구매 가격 협상. 자동 수락/역제안/거절 응답',
            params: ['sku', 'qty', 'unit_price'], color: 'var(--accent-amber)',
            request: `{
  "tool": "negotiate_price",
  "arguments": { "sku": "DOME-12345", "qty": 100, "unit_price": 2000 }
}`,
            response: `{ "decision": "COUNTER", "counter_price": 2200, "message": "..." }`,
        },
        {
            name: 'sandbox_order', desc: '테스트 주문 생성 (재고 차감 없음, 결제 없음)',
            params: ['sku', 'qty?'], color: 'var(--accent-green)',
            request: `{
  "tool": "sandbox_order",
  "arguments": { "sku": "DOME-12345" }
}`,
            response: `{ "orderId": "SBX-...", "status": "SANDBOX_CREATED" }`,
        },
        {
            name: 'wallet_check', desc: '에이전트 지갑 잔액, 티어, 포인트, 최근 거래 조회',
            params: [], color: 'var(--accent-purple)',
            request: `{ "tool": "wallet_check", "arguments": {} }`,
            response: `{ "balance": 500000, "tier": "GOLD", "points": 1200 }`,
        },
        {
            name: 'apply_coupon', desc: '쿠폰 적용. 유효성 검증 후 할인 금액 반환',
            params: ['coupon_code', 'order_amount'], color: 'var(--accent-red)',
            request: `{
  "tool": "apply_coupon",
  "arguments": { "coupon_code": "WELCOME2026", "order_amount": 50000 }
}`,
            response: `{ "discount": 5000, "final_amount": 45000 }`,
        },
    ];

    // ── Agent Intelligence Tools ──
    const intelligenceTools = [
        {
            name: 'submit_review', desc: '구매 상품 KPI 기반 리뷰 제출 (배송, 정확도)',
            params: ['sku', 'review_text', 'delivery_score', 'accuracy_score'], color: 'var(--accent-cyan)',
            request: `{
  "tool": "submit_review",
  "arguments": {
    "sku": "DOME-12345",
    "review_text": "2일 내 정상 배송",
    "delivery_score": 5,
    "accuracy_score": 4
  }
}`,
            response: `{ "review_id": "REV-...", "status": "PUBLISHED" }`,
        },
        {
            name: 'get_rewards', desc: '로열티 보상 및 티어 상태 조회',
            params: [], color: 'var(--accent-amber)',
            request: `{ "tool": "get_rewards", "arguments": {} }`,
            response: `{ "tier": "GOLD", "discounts": [...], "credits": 5000 }`,
        },
        {
            name: 'predict_reorder', desc: '구매 이력 분석 후 재주문 시기 예측',
            params: [], color: 'var(--accent-green)',
            request: `{ "tool": "predict_reorder", "arguments": {} }`,
            response: `{ "predictions": [{ "sku": "...", "predicted_date": "2026-03-15", "confidence": 0.87 }] }`,
        },
        {
            name: 'get_notifications', desc: '에이전트 수신함 (신상품, 가격 변동, 프로모션)',
            params: ['unread_only?', 'type?', 'limit?'], color: 'var(--accent-purple)',
            request: `{
  "tool": "get_notifications",
  "arguments": { "unread_only": true }
}`,
            response: `{ "notifications": [{ "type": "PRICE_DROP", "sku": "...", "message": "..." }] }`,
        },
        {
            name: 'get_sla', desc: 'SLA 성능 지표 (재고 정확도, 배송율, 응답 시간)',
            params: ['days?'], color: 'var(--accent-red)',
            request: `{ "tool": "get_sla", "arguments": { "days": 30 } }`,
            response: `{ "stock_accuracy": 98.5, "delivery_rate": 97.2, "avg_response_ms": 120 }`,
        },
    ];

    // ── A2A Network Tools ──
    const a2aTools = [
        {
            name: 'a2a_broadcast', desc: '에이전트 네트워크에 질의 전송 (상품 경험, 공급사 평가)',
            params: ['question', 'query_type?', 'sku?', 'ttl_hours?'], color: 'var(--accent-cyan)',
            request: `{
  "tool": "a2a_broadcast",
  "arguments": {
    "question": "DOME-12345 배송 품질 어떤가요?",
    "query_type": "PRODUCT_EXPERIENCE"
  }
}`,
            response: `{ "query_id": "A2A-1F3E5A7B", "status": "BROADCAST" }`,
        },
        {
            name: 'a2a_respond', desc: '다른 에이전트의 A2A 질의에 응답 (평가 + 증거)',
            params: ['query_id', 'verdict', 'confidence?', 'message?'], color: 'var(--accent-green)',
            request: `{
  "tool": "a2a_respond",
  "arguments": {
    "query_id": "A2A-1F3E5A7B",
    "verdict": "ENDORSE",
    "confidence": 0.9,
    "message": "3회 주문 모두 정상 배송"
  }
}`,
            response: `{ "response_id": "...", "status": "SUBMITTED" }`,
        },
        {
            name: 'a2a_get_queries', desc: '에이전트 네트워크 활성 질의 목록 조회',
            params: ['status?', 'sku?', 'limit?'], color: 'var(--accent-amber)',
            request: `{
  "tool": "a2a_get_queries",
  "arguments": { "status": "OPEN", "limit": 10 }
}`,
            response: `{ "queries": [{ "query_id": "...", "question": "...", "responses": [...] }] }`,
        },
    ];

    const allTools = [...commerceTools, ...negotiationTools, ...intelligenceTools, ...a2aTools];

    // Tool categories for section rendering
    const toolSections = [
        { title: '🛒 Commerce', subtitle: '상품 검색, 비교, 주문', tools: commerceTools },
        { title: '💰 Negotiation & Payment', subtitle: '협상, 결제, 지갑', tools: negotiationTools },
        { title: '🧠 Agent Intelligence', subtitle: '리뷰, 보상, 예측, 알림, SLA', tools: intelligenceTools },
        { title: '🤝 A2A Network', subtitle: '에이전트 간 소통', tools: a2aTools },
    ];

    const resources = [
        { name: 'jsonmart://catalog', desc: '전체 상품 카탈로그 (최신 100개, JSON)', color: 'var(--accent-green)' },
        { name: 'jsonmart://promotions', desc: '활성 프로모션 목록', color: 'var(--accent-cyan)' },
        { name: 'jsonmart://sla', desc: 'SLA 성능 지표 대시보드', color: 'var(--accent-amber)' },
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
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '24px 0 12px' }}>🔧 사용 가능한 Tools ({allTools.length})</h2>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                💡 카드를 클릭하면 요청/응답 JSON 예시를 확인할 수 있습니다
            </div>
            {toolSections.map(section => (
                <div key={section.title} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{section.title}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>{section.subtitle}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                        {section.tools.map(t => <ToolCard key={t.name} {...t} />)}
                    </div>
                </div>
            ))}

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
