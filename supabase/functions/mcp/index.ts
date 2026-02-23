// supabase/functions/mcp/index.ts
// JSONMart MCP Server — Model Context Protocol over HTTP (JSON-RPC 2.0)
// Deploy: supabase functions deploy mcp --no-verify-jwt
//
// Supported clients: Claude Desktop, Cursor, Windsurf, any MCP-compatible LLM
// Transport: HTTP POST (Streamable HTTP) — supported by all MCP clients since spec 2024-11-05

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
        description: 'JSONMart 상품 카탈로그 검색. 카테고리, 가격 범위, 재고 여부로 필터링 가능. AI 에이전트가 구매 후보를 찾을 때 사용.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: '검색 키워드 (상품명, 브랜드 등)' },
                category: { type: 'string', description: '카테고리 필터: CONSUMABLES | MRO | FOOD | OFFICE' },
                max_price: { type: 'number', description: '최대 가격 (원)' },
                min_trust: { type: 'number', description: '최소 신뢰 점수 (0-100)' },
                in_stock_only: { type: 'boolean', description: '재고 있는 상품만 조회' },
                limit: { type: 'number', description: '최대 결과 수 (기본 10, 최대 50)' },
            },
        },
    },
    {
        name: 'get_product_detail',
        description: 'SKU로 상품 상세 정보 조회. 스펙, 가격, 재고, 신뢰 점수, 배송 조건 등 포함.',
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
        description: '상품 구매 주문 생성. 에이전트 API 키(x-api-key)가 헤더에 필요. 24시간 내 결제 필요.',
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
        description: '주문 ID로 주문 상태 및 결제/배송 이력 조회.',
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
        description: '현재 활성 중인 프로모션 목록 조회. 할인 코드, 조건 포함.',
        inputSchema: {
            type: 'object',
            properties: {
                category: { type: 'string', description: '특정 카테고리 프로모션만 필터 (선택)' },
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
async function handleTool(name: string, args: any, supabase: any, apiKey?: string) {
    switch (name) {

        case 'search_products': {
            let q = supabase
                .from('products')
                .select('sku, title, category, price:offer->price, stock:offer->stockStatus, trust_score:qualitySignals->sellerTrust, free_shipping:offer->freeShipping')
                .limit(Math.min(args.limit || 10, 50));

            if (args.category) q = q.eq('category', args.category);
            if (args.max_price) q = q.lte('offer->>price', args.max_price);
            if (args.min_trust) q = q.gte('qualitySignals->>sellerTrust', args.min_trust);
            if (args.in_stock_only) q = q.eq('offer->>stockStatus', 'IN_STOCK');
            if (args.query) q = q.ilike('title', `%${args.query}%`);

            const { data, error } = await q;
            if (error) return { error: error.message };

            return {
                results: (data || []).map((p: any) => ({
                    sku: p.sku,
                    title: p.title,
                    category: p.category,
                    price: p.price,
                    stock_status: p.stock,
                    trust_score: p.trust_score,
                    free_shipping: p.free_shipping,
                })),
                total: (data || []).length,
            };
        }

        case 'get_product_detail': {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('sku', args.sku)
                .single();
            if (error) return { error: `Product not found: ${args.sku}` };
            return {
                sku: data.sku,
                title: data.title,
                category: data.category,
                price: data.offer?.price,
                stockStatus: data.offer?.stockStatus,
                etaDays: data.offer?.etaDays,
                freeShipping: data.offer?.freeShipping,
                returnWindowDays: data.offer?.returnWindowDays,
                specs: data.specs || {},
                trustScore: data.qualitySignals?.sellerTrust,
                aiReadinessScore: data.aiReadinessScore,
                moq: data.moq,
            };
        }

        case 'compare_products': {
            const skus: string[] = args.sku_list || [];
            const { data, error } = await supabase
                .from('products')
                .select('sku, title, category, offer, qualitySignals, moq')
                .in('sku', skus);
            if (error) return { error: error.message };

            const comparison = (data || []).map((p: any) => ({
                sku: p.sku,
                title: p.title,
                price: p.offer?.price,
                trust_score: p.qualitySignals?.sellerTrust,
                stock: p.offer?.stockStatus,
                free_shipping: p.offer?.freeShipping,
                eta_days: p.offer?.etaDays,
                moq: p.moq,
            }));

            // 신뢰도/가격 기반 추천
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

        case 'create_order': {
            // API 키로 에이전트 인증
            if (!apiKey) return { error: 'x-api-key header required for create_order' };

            const agentId = `AGT-${apiKey.slice(-8).toUpperCase()}`;

            // 상품 확인
            const { data: product } = await supabase
                .from('products')
                .select('sku, title, offer')
                .eq('sku', args.sku)
                .single();

            if (!product) return { error: `Product not found: ${args.sku}` };

            const unitPrice = product.offer?.price || 0;
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
                .select('id, name, code, discount_type, discount_value, min_order_amount, start_at, end_at, active')
                .eq('active', true)
                .order('created_at', { ascending: false });

            const { data, error } = await q;
            if (error) return { error: error.message };

            return {
                promotions: (data || []).map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    code: p.code,
                    discountType: p.discount_type,
                    discountValue: p.discount_value,
                    minOrderAmount: p.min_order_amount,
                    validUntil: p.end_at,
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
                .select('sku, title, category, offer, qualitySignals, aiReadinessScore')
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
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // Health check (GET)
    if (req.method === 'GET') {
        return new Response(JSON.stringify({
            name: 'JSONMart MCP Server',
            version: '1.0.0',
            protocol: 'MCP/2024-11-05',
            tools: TOOLS.map(t => t.name),
            resources: RESOURCES.map(r => r.uri),
            status: 'ok',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    // Supabase client with service role (edge function has env access)
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
        return mcpError(id, -32600, 'Invalid JSON-RPC version — must be "2.0"');
    }

    // ━━━ MCP Method Router ━━━
    try {
        switch (method) {

            // Handshake
            case 'initialize':
                return mcpResult(id, {
                    protocolVersion: '2024-11-05',
                    capabilities: {
                        tools: { listChanged: false },
                        resources: { subscribe: false, listChanged: false },
                    },
                    serverInfo: {
                        name: 'JSONMart MCP Server',
                        version: '1.0.0',
                        description: 'AI-native marketplace tools for autonomous purchasing agents',
                    },
                });

            case 'notifications/initialized':
                return new Response(null, { status: 204, headers: corsHeaders });

            // Tool list
            case 'tools/list':
                return mcpResult(id, { tools: TOOLS });

            // Tool call
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

            // Resource list
            case 'resources/list':
                return mcpResult(id, { resources: RESOURCES });

            // Resource read
            case 'resources/read': {
                const uri = params?.uri;
                if (!uri) return mcpError(id, -32602, 'Missing resource URI');

                const content = await handleResource(uri, supabase);
                if (!content) return mcpError(id, -32602, `Unknown resource: ${uri}`);

                return mcpResult(id, {
                    contents: [{ uri, mimeType: 'application/json', text: content }],
                });
            }

            // Prompt list (optional, return empty)
            case 'prompts/list':
                return mcpResult(id, { prompts: [] });

            default:
                return mcpError(id, -32601, `Method not found: ${method}`);
        }
    } catch (err: any) {
        return mcpError(id, -32603, `Internal error: ${err.message}`);
    }
});
