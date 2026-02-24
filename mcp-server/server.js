#!/usr/bin/env node
/**
 * JSONMart MCP Server v2 — @modelcontextprotocol/sdk based
 * 
 * Runs as a local stdio MCP server for Claude Desktop.
 * Connects to Supabase to query the products DB directly.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ━━━ Supabase Config ━━━
const SUPABASE_URL = 'https://psiysvvcusfyfsfozywn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzaXlzdnZjdXNmeWZzZm96eXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NzY5MjgsImV4cCI6MjA4NjU1MjkyOH0.p67kF5TLGv1o5ZcuxFabFD3OCvVCXov93hYMmj09BFE';

async function supabaseQuery(table, { select = '*', filters = {}, limit, single = false, count = false } = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;

    for (const [key, value] of Object.entries(filters)) {
        // PostgREST operators use * as wildcard - must not encode it
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

// ━━━ MCP Server ━━━
const server = new McpServer({
    name: 'jsonmart',
    version: '2.0.0',
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
            text: `# JSONMart — AI Agent Native B2B 마켓플레이스

## 플랫폼 소개
JSONMart는 AI 에이전트가 직접 상품을 검색·비교·주문할 수 있는 B2B 마켓플레이스입니다.
- 모든 인터페이스가 JSON 기반으로 설계되어 AI 에이전트가 쉽게 이해하고 처리 가능
- MCP(Model Context Protocol) 통해 Claude 등 AI 어시스턴트와 직접 연동
- 사무용품, 소모품, 식자재, IT장비, 안전용품 등 B2B 전문 상품 취급

## 주요 기능
- **상품 검색/비교**: 카테고리, 가격, 신뢰도 기반 필터링
- **AI 에이전트 주문**: API 키 기반 자동 구매
- **에이전트 월렛**: 충전식 가상 월렛으로 결제
- **판매자 신뢰 점수**: 0-100 점 기반 판매자 신뢰도 평가
- **자동 재주문**: 재고 소진 시 자동 재주문 설정
- **프로모션**: 할인, 번들 딜, 무료배송 등 다양한 프로모션

## 카테고리
CONSUMABLES(소모품) | MRO(유지보수) | FOOD(식자재) | OFFICE(사무용품) | IT_EQUIPMENT(IT장비) | KITCHEN(주방) | SAFETY(안전) | HYGIENE(위생) | HOUSEHOLD(생활용품)

## 운영 정보
- 웹사이트: JSONMart 대시보드에서 실시간 관리
- API 기반: RESTful JSON API + MCP 프로토콜 지원
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

## 🛒 구매 방법 (3가지)

### 방법 1: AI 에이전트를 통한 자동 구매 (추천)
Claude 같은 AI 어시스턴트에게 자연어로 요청하면 MCP를 통해 자동 처리됩니다.
1. "물티슈 추천해줘" → 상품 검색 (search_products)
2. "1번 상품 상세 보여줘" → 상세 조회 (get_product_detail)
3. "이 상품 구매해줘" → 주문 생성 (create_order)
4. "주문 상태 확인해줘" → 주문 추적 (check_order_status)

### 방법 2: JSONMart 대시보드 (웹)
1. JSONMart 웹사이트 접속
2. 상품 브라우징 및 장바구니 담기
3. 에이전트 월렛으로 결제
4. 주문 관리 페이지에서 배송 추적

### 방법 3: API 직접 호출
1. API 키 발급 (에이전트 등록)
2. /search, /order API 호출
3. JSON 응답으로 주문 확인

## 📋 주문 프로세스 상세

### Step 1: 상품 검색
- 키워드, 카테고리, 가격 범위, 신뢰도로 검색
- 여러 상품 비교 가능 (compare_products)

### Step 2: 상품 확인
- SKU로 상세 정보 조회 (가격, 재고, 배송일, 반품 정책)
- MOQ(최소주문수량) 확인 필수

### Step 3: 주문 생성
- SKU + 수량 지정
- 에이전트 월렛 잔액 확인 → 자동 차감
- 주문 ID 발급 (ORD-YYYYMMDD-XXXXX 형식)

### Step 4: 주문 추적
- 주문 상태: PENDING → CONFIRMED → SHIPPED → DELIVERED
- 예상 배송일: ship_by_days + eta_days 기준

### Step 5: 반품/교환
- return_days 이내 반품 가능
- return_fee 확인 (무료 또는 유료)

## 💰 결제 방식
- **에이전트 월렛**: 충전식 가상 지갑
- **통화**: KRW (원화)
- **자동 차감**: 주문 시 잔액에서 자동 결제
- **환불**: 주문 취소/반품 시 월렛으로 환불

## 📦 배송 정보
- ship_by_days: 발송까지 소요일
- eta_days: 배송까지 총 소요일
- 대부분 3-12일 이내 배송

## ⚠️ 주의사항
- MOQ(최소주문수량) 미만 주문 불가
- 재고 상태가 OUT_OF_STOCK인 상품은 주문 불가
- 에이전트 월렛 잔액 부족 시 충전 필요`,
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
A: B2B 전문 마켓플레이스로 사무용품, 소모품(물티슈, 화장지 등), 식자재, IT장비, 주방용품, 안전용품, 위생용품 등을 취급합니다. 현재 1,600개 이상의 상품이 등록되어 있습니다.

## Q: 개인도 구매할 수 있나요?
A: JSONMart는 B2B 플랫폼이지만, 에이전트 계정을 등록하면 누구나 이용 가능합니다. 다만 일부 상품에 MOQ(최소주문수량)가 있을 수 있습니다.

## Q: 결제는 어떻게 하나요?
A: 에이전트 월렛(가상 지갑)을 통해 결제합니다. 월렛에 KRW를 충전한 후 주문 시 자동 차감됩니다.

## Q: 배송은 얼마나 걸리나요?
A: 상품별로 다르지만, 일반적으로 발송까지 1-5일(ship_by_days), 배송 완료까지 3-12일(eta_days) 소요됩니다.

## Q: 반품/교환이 가능한가요?
A: 네, 상품별 return_days 이내에 반품 가능합니다. 반품 수수료(return_fee)는 상품마다 다릅니다.

## Q: 판매자 신뢰 점수는 뭔가요?
A: 0-100점 기준으로 판매자의 과거 거래 이력, 배송 정확도, 리뷰 등을 종합 평가한 점수입니다. 80점 이상이면 우수 판매자입니다.

## Q: AI 에이전트 없이도 사용할 수 있나요?
A: 네, 웹 대시보드에서 직접 상품을 검색하고 주문할 수 있습니다. AI 에이전트는 자동화를 위한 옵션입니다.

## Q: 프로모션이나 할인은 어떻게 확인하나요?
A: 'list_promotions' 도구를 사용하거나, 대시보드의 프로모션 페이지에서 현재 활성 프로모션을 확인할 수 있습니다.`,
        }],
    })
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
            select: 'sku,title,category,price,stock_status,seller_trust,eta_days,ship_by_days',
            filters,
            limit: actualLimit,
            count: true,
        });

        const results = (data || []).map(p => ({
            sku: p.sku,
            title: p.title,
            category: p.category,
            price: p.price,
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
                select: 'sku,title,category,brand,price,currency,stock_status,stock_qty,eta_days,ship_by_days,return_days,return_fee,ai_readiness_score,seller_trust,moq,attributes',
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
    process.stderr.write('JSONMart MCP Server v2.0.0 running on stdio\n');
}

main().catch(err => {
    process.stderr.write(`Fatal error: ${err.message}\n`);
    process.exit(1);
});
