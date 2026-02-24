// supabase/functions/mcp/index.ts
// JSONMart MCP Server — Model Context Protocol over HTTP (JSON-RPC 2.0)
// Deploy: supabase functions deploy mcp --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ━━━ CORS ━━━
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ━━━ MCP Response Helpers ━━━
function mcpResult(id: unknown, result: unknown) {
    return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}
function mcpError(id: unknown, code: number, message: string) {
    return new Response(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

// ━━━ Tool Definitions ━━━
const TOOLS = [
    {
        name: 'search_products',
        description: 'JSONMart 상품 카탈로그 검색. 카테고리, 가격 범위, 재고 여부로 필터링 가능.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: '검색 키워드 (상품명, 브랜드 등)' },
                category: { type: 'string', description: '카테고리 필터: CONSUMABLES | MRO | FOOD | OFFICE' },
                max_price: { type: 'number', description: '최대 가격 (원)' },
                min_trust: { type: 'number', description: '최소 신뢰 점수 (0-100)' },
                in_stock_only: { type: 'boolean', description: '재고 있는 상품만 조회' },
                limit: { type: 'number', description: '최대 결과 수 (기본 10, 최대 200)' },
                offset: { type: 'number', description: '페이지네이션 오프셋 (기본 0)' },
            },
        },
    },
    {
        name: 'get_product_detail',
        description: 'SKU로 상품 상세 정보 조회.',
        inputSchema: {
            type: 'object',
            properties: {
                sku: { type: 'string', description: '상품 SKU (필수)' },
            },
            required: ['sku'],
        },
    },
    {
        name: 'compare_products',
        description: '여러 상품의 스펙, 가격, 신뢰도를 비교하고 AI 추천을 반환.',
        inputSchema: {
            type: 'object',
            properties: {
                sku_list: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '비교할 상품 SKU 목록 (2-4개)',
                    minItems: 2,
                    maxItems: 4,
                },
            },
            required: ['sku_list'],
        },
    },
    {
        name: 'create_order',
        description: '상품 구매 주문 생성. 에이전트 API 키(x-api-key)가 헤더에 필요.',
        inputSchema: {
            type: 'object',
            properties: {
                sku: { type: 'string', description: '주문할 상품 SKU' },
                quantity: { type: 'number', description: '주문 수량' },
                policy_id: { type: 'string', description: '적용할 에이전트 정책 ID (선택)' },
            },
            required: ['sku', 'quantity'],
        },
    },
    {
        name: 'check_order_status',
        description: '주문 ID로 주문 상태 조회.',
        inputSchema: {
            type: 'object',
            properties: {
                order_id: { type: 'string', description: '주문 ID' },
            },
            required: ['order_id'],
        },
    },
    {
        name: 'list_promotions',
        description: '현재 활성 중인 프로모션 목록 조회.',
        inputSchema: {
            type: 'object',
            properties: {
                category: { type: 'string', description: '특정 카테고리 프로모션만 필터 (선택)' },
            },
        },
    },
    {
        name: 'count_products',
        description: 'JSONMart 전체 상품 수 또는 조건에 맞는 상품 수를 조회합니다. "상품이 몇 개야?" 같은 질문에 사용하세요. 실제 DB count를 반환하므로 정확합니다.',
        inputSchema: {
            type: 'object',
            properties: {
                category: { type: 'string', description: '카테고리 필터 (선택): CONSUMABLES | MRO | FOOD | OFFICE' },
                in_stock_only: { type: 'boolean', description: '재고 있는 상품만 집계 (선택)' },
                query: { type: 'string', description: '제목 검색 키워드 (선택)' },
            },
        },
    },
];

// ━━━ Resource Definitions ━━━
const RESOURCES = [
    {
        uri: 'jsonmart://catalog',
        name: 'Product Catalog',
        description: 'JSONMart 전체 상품 카탈로그 (최신 100개)',
        mimeType: 'application/json',
    },
    {
        uri: 'jsonmart://promotions',
        name: 'Active Promotions',
        description: '현재 활성 중인 프로모션 목록',
        mimeType: 'application/json',
    },
];

// ━━━ Tool Handlers ━━━
// products 테이블 실제 컬럼: sku, title, category, price, currency,
//   stock_status, stock_qty, ship_by_days, eta_days, return_days, return_fee,
//   ai_readiness_score, seller_trust, moq, attributes, brand, sourcing_type
async function handleTool(name: string, args: any, supabase: any, apiKey?: string) {
    switch (name) {

        case 'search_products': {
            let q = supabase
                .from('products')
                .select('sku, title, category, price, stock_status, seller_trust, eta_days, ship_by_days')
                .limit(Math.min(args.limit || 10, 200));

            if (args.category) q = q.eq('category', args.category);
            if (args.max_price) q = q.lte('price', args.max_price);
            if (args.min_trust) q = q.gte('seller_trust', args.min_trust);
            if (args.in_stock_only) q = q.eq('stock_status', 'IN_STOCK');
            if (args.query) q = q.ilike('title', `%${args.query}%`);

            // Also get the total count without limit
            let countQ = supabase.from('products').select('*', { count: 'exact', head: true });
            if (args.category) countQ = countQ.eq('category', args.category);
            if (args.max_price) countQ = countQ.lte('price', args.max_price);
            if (args.min_trust) countQ = countQ.gte('seller_trust', args.min_trust);
            if (args.in_stock_only) countQ = countQ.eq('stock_status', 'IN_STOCK');
            if (args.query) countQ = countQ.ilike('title', `%${args.query}%`);
            const { count: totalCount } = await countQ;

            const { data, error } = await q;
            if (error) return { error: error.message };

            return {
                results: (data || []).map((p: any) => ({
                    sku: p.sku,
                    title: p.title,
                    category: p.category,
                    price: p.price,
                    stock_status: p.stock_status,
                    trust_score: p.seller_trust,
                    eta_days: p.eta_days,
                    ship_by_days: p.ship_by_days,
                })),
                returned: (data || []).length,
                total_count: totalCount ?? (data || []).length,
            };
        }

        case 'get_product_detail': {
            const { data, error } = await supabase
                .from('products')
                .select('sku, title, category, brand, price, currency, stock_status, stock_qty, eta_days, ship_by_days, return_days, return_fee, ai_readiness_score, seller_trust, moq, attributes')
                .eq('sku', args.sku)
                .single();
            if (error) return { error: `Product not found: ${args.sku}` };
            return {
                sku: data.sku,
                title: data.title,
                category: data.category,
                brand: data.brand,
                price: data.price,
                currency: data.currency || 'KRW',
                stockStatus: data.stock_status,
                stockQty: data.stock_qty,
                etaDays: data.eta_days,
                shipByDays: data.ship_by_days,
                returnDays: data.return_days,
                returnFee: data.return_fee,
                aiReadinessScore: data.ai_readiness_score,
                trustScore: data.seller_trust,
                moq: data.moq,
                attributes: data.attributes || {},
            };
        }

        case 'compare_products': {
            const skus: string[] = args.sku_list || [];
            const { data, error } = await supabase
                .from('products')
                .select('sku, title, category, price, seller_trust, stock_status, ship_by_days, eta_days, moq')
                .in('sku', skus);
            if (error) return { error: error.message };

            const comparison = (data || []).map((p: any) => ({
                sku: p.sku,
                title: p.title,
                price: p.price,
                trust_score: p.seller_trust,
                stock: p.stock_status,
                ship_by_days: p.ship_by_days,
                eta_days: p.eta_days,
                moq: p.moq,
            }));

            const sorted = [...comparison].sort((a, b) =>
                (b.trust_score || 0) - (a.trust_score || 0) ||
                (a.price || 0) - (b.price || 0)
            );

            return {
                comparison,
                recommendation: sorted[0]?.sku || null,
                reason: sorted[0]
                    ? `최고 신뢰 점수 (${sorted[0].trust_score}) + 최적 가격 ₩${(sorted[0].price || 0).toLocaleString()}`
                    : 'No products found',
            };
        }

        case 'count_products': {
            let q = supabase.from('products').select('*', { count: 'exact', head: true });
            if (args.category) q = q.eq('category', args.category);
            if (args.in_stock_only) q = q.eq('stock_status', 'IN_STOCK');
            if (args.query) q = q.ilike('title', `%${args.query}%`);
            const { count, error } = await q;
            if (error) return { error: error.message };
            return {
                count,
                filters_applied: {
                    category: args.category || null,
                    in_stock_only: args.in_stock_only || false,
                    query: args.query || null,
                },
            };
        }

        case 'create_order': {
            if (!apiKey) return { error: 'x-api-key header required for create_order' };

            const agentId = `AGT-${apiKey.slice(-8).toUpperCase()}`;

            const { data: product } = await supabase
                .from('products')
                .select('sku, title, price, stock_status')
                .eq('sku', args.sku)
                .single();

            if (!product) return { error: `Product not found: ${args.sku}` };

            const unitPrice = product.price || 0;
            const totalPrice = unitPrice * args.quantity;
            const orderId = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
            const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

            const { error: insertErr } = await supabase.from('orders').insert({
                order_id: orderId,
                agent_id: agentId,
                sku: args.sku,
                product_title: product.title,
                quantity: args.quantity,
                unit_price: unitPrice,
                total_price: totalPrice,
                status: 'ORDER_CREATED',
                payment_deadline: deadline,
                policy_id: args.policy_id || null,
                source: 'MCP',
            });

            if (insertErr) return { error: insertErr.message };

            return {
                orderId,
                status: 'ORDER_CREATED',
                sku: args.sku,
                productTitle: product.title,
                quantity: args.quantity,
                unitPrice,
                totalPrice,
                paymentDeadline: deadline,
                message: '주문 생성 완료. 24시간 내 결제가 필요합니다.',
                agentId,
            };
        }

        case 'check_order_status': {
            const { data, error } = await supabase
                .from('orders')
                .select('order_id, status, sku, product_title, quantity, total_price, created_at, payment_deadline, tracking_number')
                .eq('order_id', args.order_id)
                .single();

            if (error) return { error: `Order not found: ${args.order_id}` };

            return {
                orderId: data.order_id,
                status: data.status,
                sku: data.sku,
                productTitle: data.product_title,
                quantity: data.quantity,
                totalPrice: data.total_price,
                createdAt: data.created_at,
                paymentDeadline: data.payment_deadline,
                trackingNumber: data.tracking_number || null,
            };
        }

        case 'list_promotions': {
            let q = supabase
                .from('promotions')
                .select('promo_id, name, type, value, min_qty, categories, valid_from, valid_to, active')
                .eq('active', true)
                .order('created_at', { ascending: false });

            if (args.category) q = q.contains('categories', [args.category]);

            const { data, error } = await q;
            if (error) return { error: error.message };

            return {
                promotions: (data || []).map((p: any) => ({
                    id: p.promo_id,
                    name: p.name,
                    type: p.type,
                    value: p.value,
                    minQty: p.min_qty,
                    categories: p.categories,
                    validFrom: p.valid_from,
                    validUntil: p.valid_to,
                })),
            };
        }

        default:
            return { error: `Unknown tool: ${name}` };
    }
}

// ━━━ Resource Handlers ━━━
async function handleResource(uri: string, supabase: any) {
    switch (uri) {
        case 'jsonmart://catalog': {
            const { data } = await supabase
                .from('products')
                .select('sku, title, category, price, stock_status, seller_trust, ai_readiness_score')
                .order('created_at', { ascending: false })
                .limit(100);
            return JSON.stringify({ catalog: data || [], generatedAt: new Date().toISOString() }, null, 2);
        }
        case 'jsonmart://promotions': {
            const { data } = await supabase
                .from('promotions')
                .select('*')
                .eq('active', true);
            return JSON.stringify({ promotions: data || [], generatedAt: new Date().toISOString() }, null, 2);
        }
        default:
            return null;
    }
}

// ━━━ Main Handler ━━━
serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method === 'GET') {
        return new Response(JSON.stringify({
            name: 'JSONMart MCP Server',
            version: '1.1.0',
            protocol: 'MCP/2024-11-05',
            tools: TOOLS.map(t => t.name),
            resources: RESOURCES.map(r => r.uri),
            status: 'ok',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const apiKey = req.headers.get('x-api-key') || undefined;

    let body: any;
    try {
        body = await req.json();
    } catch {
        return mcpError(null, -32700, 'Parse error');
    }

    const { jsonrpc, method, id, params } = body;

    if (jsonrpc !== '2.0') {
        return mcpError(id, -32600, 'Invalid JSON-RPC version');
    }

    try {
        switch (method) {

            case 'initialize':
                return mcpResult(id, {
                    protocolVersion: '2024-11-05',
                    capabilities: {
                        tools: { listChanged: false },
                        resources: { subscribe: false, listChanged: false },
                    },
                    serverInfo: {
                        name: 'JSONMart MCP Server',
                        version: '1.1.0',
                        description: 'AI-native marketplace tools for autonomous purchasing agents',
                    },
                });

            case 'notifications/initialized':
                return new Response(null, { status: 204, headers: corsHeaders });

            case 'tools/list':
                return mcpResult(id, { tools: TOOLS });

            case 'tools/call': {
                const toolName = params?.name;
                const toolArgs = params?.arguments || {};
                if (!toolName) return mcpError(id, -32602, 'Missing tool name');

                const found = TOOLS.find(t => t.name === toolName);
                if (!found) return mcpError(id, -32602, `Unknown tool: ${toolName}`);

                const result = await handleTool(toolName, toolArgs, supabase, apiKey);
                return mcpResult(id, {
                    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                    isError: !!result?.error,
                });
            }

            case 'resources/list':
                return mcpResult(id, { resources: RESOURCES });

            case 'resources/read': {
                const uri = params?.uri;
                if (!uri) return mcpError(id, -32602, 'Missing resource URI');

                const content = await handleResource(uri, supabase);
                if (!content) return mcpError(id, -32602, `Unknown resource: ${uri}`);

                return mcpResult(id, {
                    contents: [{ uri, mimeType: 'application/json', text: content }],
                });
            }

            case 'prompts/list':
                return mcpResult(id, { prompts: [] });

            default:
                return mcpError(id, -32601, `Method not found: ${method}`);
        }
    } catch (err: any) {
        return mcpError(id, -32603, `Internal error: ${err.message}`);
    }
});
