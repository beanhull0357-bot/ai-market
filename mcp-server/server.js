#!/usr/bin/env node
/**
 * JSONMart MCP Server v3 — @modelcontextprotocol/sdk based
 * 
 * Runs as a local stdio MCP server for Claude Desktop.
 * Connects to Supabase to query the products DB directly.
 * 
 * Environment variables:
 *   SUPABASE_URL       - Supabase project URL
 *   SUPABASE_ANON_KEY  - Supabase anon/public key
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ━━━ Supabase Config (from environment variables) ━━━
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    process.stderr.write('⚠️  Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.\n');
    process.stderr.write('   Set them before starting the MCP server.\n');
    process.exit(1);
}

// ━━━ Supabase REST query helper ━━━
async function supabaseQuery(table, { select = '*', filters = {}, limit, single = false, count = false } = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;

    for (const [key, value] of Object.entries(filters)) {
        url += `&${key}=${encodeURIComponent(value).replace(/%2A/gi, '*')}`;
    }
    if (limit) url += `&limit=${limit}`;

    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
    };
    if (count) headers['Prefer'] = 'count=exact';
    if (single) headers['Accept'] = 'application/vnd.pgrst.object+json';

    const res = await fetch(url, { headers });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Supabase error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const totalCount = count ? parseInt(res.headers.get('content-range')?.split('/')[1] || '0') : null;

    return { data, count: totalCount };
}

// ━━━ Supabase RPC call helper ━━━
async function supabaseRpc(functionName, params = {}) {
    const url = `${SUPABASE_URL}/rest/v1/rpc/${functionName}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Supabase RPC error ${res.status}: ${errText}`);
    }

    return await res.json();
}

// ━━━ MCP Server ━━━
const server = new McpServer({
    name: 'jsonmart',
    version: '3.0.0',
});

// ━━━ Resources (정적 가이드/설명) ━━━

server.resource(
    'about',
    'jsonmart://about',
    { description: 'JSONMart 플랫폼 소개 및 개요', mimeType: 'text/plain' },
    async () => ({
        contents: [{
            uri: 'jsonmart://about',
            mimeType: 'text/plain',
            text: `# JSONMart — AI Agent Native 마켓플레이스

## 플랫폼 소개
JSONMart는 AI 에이전트 전용 커머스 플랫폼입니다. 인간 사용자가 아닌 AI 에이전트가 직접 상품을 검색·비교·주문합니다.
- 모든 인터페이스가 JSON 기반으로 설계되어 AI 에이전트가 쉽게 이해하고 처리 가능
- MCP(Model Context Protocol) 통해 Claude 등 AI 어시스턴트와 직접 연동
- 다양한 카테고리의 상품 취급 (소모품, MRO, 식자재, 사무용품, IT장비

## 주요 기능
- **상품 검색/비교**: 카테고리, 가격, 신뢰도 기반 필터링
- **AI 에이전트 주문**: API 키 기반 자동 구매
- **에이전트 월렛**: 충전식 가상 월렛으로 결제
- **판매자 신뢰 점수**: 0-100 점 기반 판매자 신뢰도 평가
- **자동 재주문**: 재고 소진 시 자동 재주문 설정
- **에이전트 리뷰**: 구조화된 fulfillment attestation

## 카테고리
CONSUMABLES(소모품) | MRO(유지보수) | FOOD(식자재) | OFFICE(사무용품) | IT_EQUIPMENT(IT장비) | KITCHEN(주방) | SAFETY(안전) | HYGIENE(위생) | HOUSEHOLD(생활용품)

## 운영 정보
- 웹사이트: https://jsonmart.xyz/
- API 기반: Supabase RPC + MCP 프로토콜 지원
- 결제: 에이전트 월렛 (충전식, KRW 기반)`,
        }],
    })
);

server.resource(
    'buying-guide',
    'jsonmart://buying-guide',
    { description: 'JSONMart 구매 프로세스 가이드', mimeType: 'text/plain' },
    async () => ({
        contents: [{
            uri: 'jsonmart://buying-guide',
            mimeType: 'text/plain',
            text: `# JSONMart 구매 프로세스 가이드

## 🛒 구매 방법

### 방법 1: MCP를 통한 자동 구매 (추천)
Claude 같은 AI 어시스턴트에게 자연어로 요청하면 MCP를 통해 자동 처리됩니다.
1. "에이전트 등록해줘" → 에이전트 등록 (register_agent)
2. "물티슈 검색해줘" → 상품 검색 (search_products)
3. "1번 상품 상세 보여줘" → 상세 조회 (get_product_detail)
4. "이 상품 주문해줘" → 주문 생성 (create_order)
5. "주문 상태 확인해줘" → 주문 추적 (check_order_status)
6. "이 상품 리뷰 남겨줘" → 리뷰 작성 (submit_review)

### 방법 2: API 직접 호출
1. agent_self_register RPC 호출로 에이전트 등록
2. 관리자 승인 후 API 키 발급
3. authenticate_agent로 인증
4. get_product_feed / agent_create_order 등 RPC 호출

## 📋 주문 프로세스 상세

### Step 1: 에이전트 등록
- 이름, 기능(capabilities), 연락처(contact_uri) 제공
- 관리자 승인 후 API 키(agk_...) 발급

### Step 2: 상품 검색
- 키워드, 카테고리, 가격 범위, 신뢰도로 검색
- 여러 상품 비교 가능 (compare_products)

### Step 3: 주문 생성
- API 키 + SKU + 수량 지정
- 정책 자동 검증 (예산, 카테고리, 배송기한, 셀러 신뢰도)
- 주문 ID 발급

### Step 4: 주문 추적
- 주문 상태: ORDER_CREATED → PAYMENT_AUTHORIZED → SHIPPED → DELIVERED

### Step 5: 리뷰 작성
- fulfillment_delta, spec_compliance, api_latency 등 구조화된 메트릭
- verdict: ENDORSE / WARN / BLOCKLIST

## ⚠️ 주의사항
- 에이전트 전용 마켓플레이스입니다 (인간 사용자 직접 구매 불가)
- MOQ(최소주문수량) 미만 주문 불가
- 재고 상태가 OUT_OF_STOCK인 상품은 주문 불가`,
        }],
    })
);

server.resource(
    'faq',
    'jsonmart://faq',
    { description: 'JSONMart 자주 묻는 질문 (FAQ)', mimeType: 'text/plain' },
    async () => ({
        contents: [{
            uri: 'jsonmart://faq',
            mimeType: 'text/plain',
            text: `# JSONMart FAQ (자주 묻는 질문)

## Q: JSONMart에서 어떤 상품을 살 수 있나요?
A: AI 에이전트 전용 마켓플레이스로 사무용품, 소모품(물티슈, 화장지 등), 식자재, IT장비, 주방용품, 안전용품, 위생용품 등을 취급합니다.

## Q: 인간도 직접 구매할 수 있나요?
A: 아닙니다. JSONMart는 AI 에이전트 전용 쇼핑몰입니다. 인간 사용자는 관리 대시보드를 통해 운영만 합니다. 상품 구매는 AI 에이전트가 API를 통해 직접 수행합니다.

## Q: 에이전트 등록은 어떻게 하나요?
A: MCP의 register_agent 도구를 사용하거나, agent_self_register RPC를 직접 호출하세요. 관리자 승인 후 API 키가 발급됩니다.

## Q: 결제는 어떻게 하나요?
A: 에이전트 월렛(가상 지갑)을 통해 결제합니다. 월렛에 KRW를 충전한 후 주문 시 자동 차감됩니다.

## Q: 배송은 얼마나 걸리나요?
A: 상품별로 다르지만, 일반적으로 발송까지 1-5일(ship_by_days), 배송 완료까지 3-12일(eta_days) 소요됩니다.

## Q: 반품/교환이 가능한가요?
A: 네, 상품별 return_days 이내에 반품 가능합니다. 반품 수수료(return_fee)는 상품마다 다릅니다.

## Q: 판매자 신뢰 점수는 뭔가요?
A: 0-100점 기준으로 판매자의 과거 거래 이력, 배송 정확도, 에이전트 리뷰 등을 종합 평가한 점수입니다.

## Q: 프로모션이나 할인은 어떻게 확인하나요?
A: MCP의 list_promotions 도구를 사용하거나, get_agent_offers RPC를 호출하세요.`,
        }],
    })
);

// ━━━ Tools ━━━

// ── register_agent ── (NEW: C-1 fix)
server.tool(
    'register_agent',
    'JSONMart에 새 AI 에이전트를 등록합니다. 등록 후 관리자 승인을 기다려야 합니다. 승인되면 API 키가 발급됩니다.',
    {
        agent_name: z.string().describe('에이전트 이름 (예: "GPT-Procurement-Bot-v1")'),
        capabilities: z.array(z.string()).optional().describe('에이전트 기능 목록 (예: ["purchasing", "price_comparison", "inventory_monitoring"])'),
        contact_uri: z.string().optional().describe('에이전트 연락처 URI (예: "mailto:agent@example.com" 또는 webhook URL)'),
    },
    async ({ agent_name, capabilities, contact_uri }) => {
        try {
            const result = await supabaseRpc('agent_self_register', {
                p_agent_name: agent_name,
                p_capabilities: capabilities || ['purchasing'],
                p_contact_uri: contact_uri || '',
            });

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                }],
            };
        } catch (err) {
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({ error: `Registration failed: ${err.message}` }),
                }],
            };
        }
    }
);

// ── count_products ──
server.tool(
    'count_products',
    'JSONMart 전체 상품 수 또는 조건별 상품 수를 조회합니다. "상품이 몇 개야?" 같은 질문에 사용하세요.',
    {
        category: z.string().optional().describe('카테고리 필터 (CONSUMABLES, MRO, FOOD, OFFICE, IT_EQUIPMENT, KITCHEN, SAFETY, HYGIENE, HOUSEHOLD)'),
        in_stock_only: z.boolean().optional().describe('재고 있는 상품만 집계'),
        query: z.string().optional().describe('제목 검색 키워드'),
    },
    async ({ category, in_stock_only, query }) => {
        const filters = {};
        if (category) filters['category'] = `eq.${category}`;
        if (in_stock_only) filters['stock_status'] = 'eq.IN_STOCK';
        if (query) filters['title'] = `ilike.*${query}*`;

        const { count: total } = await supabaseQuery('products', {
            select: 'sku',
            filters,
            limit: 1,
            count: true,
        });

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({ count: total, filters_applied: { category: category || null, in_stock_only: in_stock_only || false, query: query || null } }, null, 2),
            }],
        };
    }
);

// ── search_products ──
server.tool(
    'search_products',
    'JSONMart 상품 검색. 카테고리, 가격, 재고, 신뢰도로 필터링 가능.',
    {
        query: z.string().optional().describe('검색 키워드 (상품명, 브랜드 등)'),
        category: z.string().optional().describe('카테고리 필터'),
        max_price: z.number().optional().describe('최대 가격 (원)'),
        min_trust: z.number().optional().describe('최소 신뢰 점수 (0-100)'),
        in_stock_only: z.boolean().optional().describe('재고 있는 상품만 조회'),
        limit: z.number().optional().describe('최대 결과 수 (기본 10, 최대 200)'),
    },
    async ({ query, category, max_price, min_trust, in_stock_only, limit }) => {
        const filters = {};
        if (query) filters['title'] = `ilike.*${query}*`;
        if (category) filters['category'] = `eq.${category}`;
        if (max_price) filters['price'] = `lte.${max_price}`;
        if (min_trust) filters['seller_trust'] = `gte.${min_trust}`;
        if (in_stock_only) filters['stock_status'] = 'eq.IN_STOCK';

        const actualLimit = Math.min(limit || 10, 200);

        const { data, count: totalCount } = await supabaseQuery('products', {
            select: 'sku,title,category,price,cost_price,margin_rate,stock_status,seller_trust,eta_days,ship_by_days',
            filters,
            limit: actualLimit,
            count: true,
        });

        const results = (data || []).map(p => ({
            sku: p.sku,
            title: p.title,
            category: p.category,
            price: p.price,
            cost_price: p.cost_price || null,
            margin_rate: p.margin_rate || null,
            stock_status: p.stock_status,
            trust_score: p.seller_trust,
            eta_days: p.eta_days,
            ship_by_days: p.ship_by_days,
        }));

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({ results, returned: results.length, total_count: totalCount }, null, 2),
            }],
        };
    }
);

// ── get_product_detail ──
server.tool(
    'get_product_detail',
    'SKU로 상품 상세 정보 조회 (가격, 재고, 배송, 반품 정책 등)',
    {
        sku: z.string().describe('상품 SKU 코드 (예: "SKU-001")'),
    },
    async ({ sku }) => {
        try {
            const { data } = await supabaseQuery('products', {
                select: 'sku,title,category,brand,price,cost_price,margin_rate,min_sell_price,recommended_price,supply_price,currency,stock_status,stock_qty,eta_days,ship_by_days,return_days,return_fee,ai_readiness_score,seller_trust,delivery_fee,purchase_unit,max_order_qty,seller_type,moq,attributes',
                filters: { sku: `eq.${sku}` },
                single: true,
            });
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(data, null, 2),
                }],
            };
        } catch {
            return { content: [{ type: 'text', text: JSON.stringify({ error: `Product not found: ${sku}` }) }] };
        }
    }
);

// ── compare_products ──
server.tool(
    'compare_products',
    '복수 상품을 비교합니다 (가격, 배송, 신뢰도 등)',
    {
        skus: z.array(z.string()).describe('비교할 SKU 목록 (최대 5개)'),
    },
    async ({ skus }) => {
        const skuList = skus.slice(0, 5);
        const skuFilter = `in.(${skuList.join(',')})`;

        const { data } = await supabaseQuery('products', {
            select: 'sku,title,category,price,seller_trust,stock_status,ship_by_days,eta_days,moq',
            filters: { sku: skuFilter },
        });

        const comparison = (data || []).map(p => ({
            sku: p.sku, title: p.title, price: p.price,
            trust_score: p.seller_trust, stock: p.stock_status,
            ship_by_days: p.ship_by_days, eta_days: p.eta_days, moq: p.moq,
        }));

        const sorted = [...comparison].sort((a, b) => (b.trust_score || 0) - (a.trust_score || 0) || (a.price || 0) - (b.price || 0));

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    comparison,
                    recommendation: sorted[0]?.sku || null,
                    reason: sorted[0] ? `최고 신뢰 점수 (${sorted[0].trust_score}) + 최적 가격 ₩${(sorted[0].price || 0).toLocaleString()}` : 'No products found',
                }, null, 2),
            }],
        };
    }
);

// ── list_promotions ──
server.tool(
    'list_promotions',
    '현재 활성 중인 프로모션 목록 조회',
    {
        category: z.string().optional().describe('특정 카테고리 프로모션만 필터'),
    },
    async ({ category }) => {
        const filters = { active: 'eq.true' };
        if (category) filters['category'] = `eq.${category}`;

        const { data } = await supabaseQuery('promotions', {
            select: '*',
            filters,
            limit: 50,
        });

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({ promotions: data || [], total: (data || []).length }, null, 2),
            }],
        };
    }
);

// ── create_order ── (NEW: C-1 fix)
server.tool(
    'create_order',
    'AI 에이전트가 상품을 주문합니다. API 키(agk_...)가 필요합니다. 자동으로 정책 검증, 재고 확인, 주문 생성을 수행합니다.',
    {
        api_key: z.string().describe('에이전트 API 키 (agk_... 형식)'),
        sku: z.string().describe('주문할 상품 SKU'),
        quantity: z.number().int().positive().optional().describe('주문 수량 (기본 1)'),
    },
    async ({ api_key, sku, quantity }) => {
        try {
            const result = await supabaseRpc('agent_create_order', {
                p_api_key: api_key,
                p_sku: sku,
                p_qty: quantity || 1,
            });

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                }],
            };
        } catch (err) {
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({ error: `Order creation failed: ${err.message}` }),
                }],
            };
        }
    }
);

// ── submit_review ── (NEW: C-1 fix)
server.tool(
    'submit_review',
    '주문 완료 후 상품에 대한 구조화된 리뷰를 작성합니다. fulfillment 정확도, 스펙 준수율, API 응답 지연시간 등의 메트릭을 기록합니다.',
    {
        api_key: z.string().describe('에이전트 API 키 (agk_... 형식)'),
        sku: z.string().describe('리뷰 대상 상품 SKU'),
        verdict: z.enum(['ENDORSE', 'WARN', 'BLOCKLIST']).optional().describe('평가 결과 (ENDORSE=추천, WARN=주의, BLOCKLIST=차단). 기본값: ENDORSE'),
        fulfillment_delta: z.number().optional().describe('예상 배송일 대비 실제 차이(시간). 양수=지연, 음수=조기배송. 기본값: 0'),
        spec_compliance: z.number().optional().describe('스펙 준수율 (0.0~1.0, 1.0=완벽 일치). 기본값: 1.0'),
        api_latency_ms: z.number().int().optional().describe('API 응답 지연시간(ms). 기본값: 0'),
    },
    async ({ api_key, sku, verdict, fulfillment_delta, spec_compliance, api_latency_ms }) => {
        try {
            const result = await supabaseRpc('agent_create_review', {
                p_api_key: api_key,
                p_sku: sku,
                p_verdict: verdict || 'ENDORSE',
                p_fulfillment_delta: fulfillment_delta || 0,
                p_spec_compliance: spec_compliance !== undefined ? spec_compliance : 1.0,
                p_api_latency_ms: api_latency_ms || 0,
                p_log: [],
            });

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                }],
            };
        } catch (err) {
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({ error: `Review submission failed: ${err.message}` }),
                }],
            };
        }
    }
);

// ── check_order_status ──
server.tool(
    'check_order_status',
    '주문 번호로 주문 상태 조회',
    {
        order_id: z.string().describe('주문 번호'),
    },
    async ({ order_id }) => {
        try {
            const { data } = await supabaseQuery('orders', {
                select: '*',
                filters: { order_id: `eq.${order_id}` },
                single: true,
            });
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
        } catch {
            return { content: [{ type: 'text', text: JSON.stringify({ error: `Order not found: ${order_id}` }) }] };
        }
    }
);

// ━━━ Start Server ━━━
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write(`JSONMart MCP Server v3.0.0 running on stdio\n`);
    process.stderr.write(`  Supabase URL: ${SUPABASE_URL.substring(0, 30)}...\n`);
    process.stderr.write(`  Tools: register_agent, count_products, search_products, get_product_detail, compare_products, list_promotions, create_order, submit_review, check_order_status\n`);
}

main().catch(err => {
    process.stderr.write(`Fatal error: ${err.message}\n`);
    process.exit(1);
});
