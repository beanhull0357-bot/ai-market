import React, { useState } from 'react';
import { Cpu, Copy, CheckCircle2, Server, Wrench, Database, ArrowRight, Code2, Globe, Zap, ExternalLink } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

/* ━━━ Tool Card ━━━ */
function ToolCard({ name, desc, params, color }: {
    key?: string; name: string; desc: string; params: string[]; color: string;
}) {
    return (
        <div className="glass-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Wrench size={14} style={{ color }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{name}</span>
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
    const mcpConfig = `{
  "mcpServers": {
    "jsonmart": {
      "url": "https://jsonmart.xyz/mcp",
      "transport": "sse",
      "description": "JSONMart Agent-Native Marketplace"
    }
  }
}`;

    const claudeDesktopConfig = `{
  "mcpServers": {
    "jsonmart": {
      "command": "npx",
      "args": ["-y", "@jsonmart/mcp-server"],
      "env": {
        "JSONMART_API_KEY": "agk_your_key_here"
      }
    }
  }
}`;

    const tools = [
        { name: 'search_products', desc: '상품 카탈로그 검색. 카테고리, 가격 범위, 재고 상태로 필터링', params: ['query?', 'category?', 'max_price?', 'in_stock_only?'], color: 'var(--accent-cyan)' },
        { name: 'get_product_detail', desc: 'SKU로 상품 상세 정보 조회. 스펙, 가격, 재고, 신뢰 점수 포함', params: ['sku'], color: 'var(--accent-green)' },
        { name: 'create_order', desc: '구매 주문 생성. 24시간 결제 유예, 관리자 승인 필요', params: ['sku', 'quantity', 'policy_id?'], color: 'var(--accent-purple)' },
        { name: 'check_order_status', desc: '주문 상태 확인. 결제, 배송, 풀필먼트 상태 반환', params: ['order_id'], color: 'var(--accent-amber)' },
        { name: 'compare_products', desc: '여러 상품의 스펙, 가격, 신뢰도를 비교 분석', params: ['sku_list[]'], color: 'var(--accent-red)' },
        { name: 'ask_question', desc: '상품에 대한 질문 등록. 답변 시 알림', params: ['sku?', 'category', 'question'], color: 'var(--accent-cyan)' },
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <Cpu size={24} style={{ color: 'var(--accent-purple)' }} />
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>MCP Integration</h1>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Model Context Protocol — LLM이 JSONMart를 직접 도구로 사용</p>
                </div>
            </div>

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

            <CodeSnippet label="Claude Desktop — claude_desktop_config.json" code={claudeDesktopConfig} />
            <CodeSnippet label="MCP Client 직접 연결" code={mcpConfig} />

            {/* Available Tools */}
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '24px 0 12px' }}>🔧 사용 가능한 Tools ({tools.length})</h2>
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

            {/* Existing endpoints */}
            <div className="glass-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>관련 리소스</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {[
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
