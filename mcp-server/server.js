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
