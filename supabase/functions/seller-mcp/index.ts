// supabase/functions/seller-mcp/index.ts
// JSONMart Seller MCP Server — 셀러용 AI 에이전트 판매 관리 도구
// Deploy: supabase functions deploy seller-mcp --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ━━━ CORS ━━━
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-seller-key',
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

// ━━━ Seller Auth Helper ━━━
async function authSeller(supabase: any, sellerKey: string) {
    const { data } = await supabase
        .from('sellers')
        .select('seller_id, business_name, status, trust_score, total_products')
        .eq('api_key', sellerKey)
        .eq('status', 'ACTIVE')
        .single();
    return data;
}

// ━━━ Tool Definitions ━━━
const TOOLS = [
    {
        name: 'get_my_products',
        description: '내 등록 상품 목록 조회. 카테고리, 재고 상태별 필터 가능.',
        inputSchema: {
            type: 'object',
            properties: {
                category: { type: 'string', description: '카테고리 필터 (선택)' },
                in_stock_only: { type: 'boolean', description: '재고 있는 상품만 (선택)' },
                query: { type: 'string', description: '상품명 검색 (선택)' },
                limit: { type: 'number', description: '최대 결과 수 (기본 20)' },
            },
        },
    },
    {
        name: 'get_my_orders',
        description: '내 주문 목록 조회. 상태별, 기간별 필터 가능.',
        inputSchema: {
            type: 'object',
            properties: {
                status: { type: 'string', description: '주문 상태: ORDER_CREATED | PAYMENT_AUTHORIZED | SHIPPED | DELIVERED | VOIDED' },
                days: { type: 'number', description: '최근 N일 주문 (기본 30)' },
                limit: { type: 'number', description: '최대 결과 수 (기본 20)' },
            },
        },
    },
    {
        name: 'confirm_order',
        description: '주문 확인 및 발송 처리. 송장번호 입력 가능.',
        inputSchema: {
            type: 'object',
            properties: {
                order_id: { type: 'string', description: '주문 ID (필수)' },
                tracking_number: { type: 'string', description: '송장번호 (선택)' },
                carrier: { type: 'string', description: '택배사 (선택)' },
            },
            required: ['order_id'],
        },
    },
    {
        name: 'update_stock',
        description: '상품 재고 수량 변경.',
        inputSchema: {
            type: 'object',
            properties: {
                sku: { type: 'string', description: '상품 SKU (필수)' },
                stock_qty: { type: 'number', description: '새 재고 수량 (필수)' },
            },
            required: ['sku', 'stock_qty'],
        },
    },
    {
        name: 'update_price',
        description: '상품 가격 변경.',
        inputSchema: {
            type: 'object',
            properties: {
                sku: { type: 'string', description: '상품 SKU (필수)' },
                price: { type: 'number', description: '새 가격 원 (필수)' },
            },
            required: ['sku', 'price'],
        },
    },
    {
        name: 'get_sales_report',
        description: '매출 요약 리포트. 기간별 매출, 주문 수, 인기 상품 분석.',
        inputSchema: {
            type: 'object',
            properties: {
                days: { type: 'number', description: '분석 기간 (기본 30일)' },
            },
        },
    },
    {
        name: 'get_settlement',
        description: '정산 내역 조회. 정산 완료/미정산/예정 금액 확인.',
        inputSchema: {
            type: 'object',
            properties: {
                status: { type: 'string', description: '정산 상태: all | pending | completed (기본 all)' },
                days: { type: 'number', description: '최근 N일 (기본 90)' },
            },
        },
    },
    {
        name: 'add_product',
        description: '새 상품 등록. SKU, 상품명, 가격, 재고 필수.',
        inputSchema: {
            type: 'object',
            properties: {
                sku: { type: 'string', description: 'SKU (필수, 고유)' },
                title: { type: 'string', description: '상품명 (필수)' },
                category: { type: 'string', description: '카테고리: CONSUMABLES | MRO | FOOD | OFFICE | HOUSEHOLD | OTHER' },
                price: { type: 'number', description: '판매가 원 (필수)' },
                stock_qty: { type: 'number', description: '재고 수량 (필수)' },
                brand: { type: 'string', description: '브랜드 (선택)' },
                delivery_fee: { type: 'string', description: '배송비 유형: 무료배송 | 착불 | 선결제 (기본 무료배송)' },
                delivery_amount: { type: 'number', description: '배송비 금액 (선택)' },
                manufacturer: { type: 'string', description: '제조사 (선택)' },
                country: { type: 'string', description: '원산지 (선택)' },
            },
            required: ['sku', 'title', 'price', 'stock_qty'],
        },
    },
    {
        name: 'get_buyer_agents',
        description: '내 상품을 구매한 AI 에이전트 분석. 에이전트별 주문 빈도, 선호 상품 등.',
        inputSchema: {
            type: 'object',
            properties: {
                days: { type: 'number', description: '분석 기간 (기본 30일)' },
            },
        },
    },
];

// ━━━ Tool Handlers ━━━
async function handleTool(name: string, args: any, supabase: any, seller: any) {
    switch (name) {

        case 'get_my_products': {
            let q = supabase
                .from('products')
                .select('sku, title, category, brand, price, stock_status, stock_qty, delivery_fee, attributes, updated_at')
                .eq('seller_id', seller.seller_id)
                .order('updated_at', { ascending: false })
                .limit(Math.min(args.limit || 20, 100));

            if (args.category) q = q.eq('category', args.category);
            if (args.in_stock_only) q = q.eq('stock_status', 'in_stock');
            if (args.query) q = q.ilike('title', `%${args.query}%`);

            const { data, error } = await q;
            if (error) return { error: error.message };

            return {
                seller: seller.business_name,
                products: (data || []).map((p: any) => ({
                    sku: p.sku,
                    title: p.title,
                    category: p.category,
                    brand: p.brand || null,
                    price: p.price,
                    stock_status: p.stock_status,
                    stock_qty: p.stock_qty,
                    delivery_fee: p.delivery_fee || null,
                    attributes: p.attributes || {},
                    updated_at: p.updated_at,
                })),
                total: (data || []).length,
            };
        }

        case 'get_my_orders': {
            const days = args.days || 30;
            const since = new Date(Date.now() - days * 86400000).toISOString();

            let q = supabase
                .from('orders')
                .select('order_id, status, sku, product_title, quantity, unit_price, total_price, agent_id, created_at, tracking_number')
                .eq('seller_id', seller.seller_id)
                .gte('created_at', since)
                .order('created_at', { ascending: false })
                .limit(Math.min(args.limit || 20, 100));

            if (args.status) q = q.eq('status', args.status);

            const { data, error } = await q;
            if (error) return { error: error.message };

            return {
                seller: seller.business_name,
                period: `최근 ${days}일`,
                orders: (data || []).map((o: any) => ({
                    order_id: o.order_id,
                    status: o.status,
                    sku: o.sku,
                    product_title: o.product_title,
                    quantity: o.quantity,
                    unit_price: o.unit_price,
                    total_price: o.total_price,
                    buyer_agent: o.agent_id,
                    created_at: o.created_at,
                    tracking_number: o.tracking_number || null,
                })),
                total_orders: (data || []).length,
            };
        }

        case 'confirm_order': {
            // Verify this order belongs to the seller
            const { data: order } = await supabase
                .from('orders')
                .select('order_id, status, seller_id')
                .eq('order_id', args.order_id)
                .eq('seller_id', seller.seller_id)
                .single();

            if (!order) return { error: `주문을 찾을 수 없습니다: ${args.order_id}` };
            if (order.status === 'SHIPPED') return { error: '이미 발송 처리된 주문입니다' };
            if (order.status === 'DELIVERED') return { error: '이미 배송 완료된 주문입니다' };
            if (order.status === 'VOIDED') return { error: '취소된 주문입니다' };

            const updateData: any = {
                status: 'SHIPPED',
                updated_at: new Date().toISOString(),
            };
            if (args.tracking_number) updateData.tracking_number = args.tracking_number;
            if (args.carrier) updateData.carrier = args.carrier;

            const { error } = await supabase
                .from('orders')
                .update(updateData)
                .eq('order_id', args.order_id)
                .eq('seller_id', seller.seller_id);

            if (error) return { error: error.message };

            return {
                success: true,
                order_id: args.order_id,
                new_status: 'SHIPPED',
                tracking_number: args.tracking_number || null,
                carrier: args.carrier || null,
                message: `주문 ${args.order_id} 발송 처리 완료`,
            };
        }

        case 'update_stock': {
            const { error } = await supabase
                .from('products')
                .update({
                    stock_qty: args.stock_qty,
                    stock_status: args.stock_qty > 0 ? 'in_stock' : 'out_of_stock',
                    updated_at: new Date().toISOString(),
                })
                .eq('sku', args.sku)
                .eq('seller_id', seller.seller_id);

            if (error) return { error: error.message };

            return {
                success: true,
                sku: args.sku,
                new_stock_qty: args.stock_qty,
                stock_status: args.stock_qty > 0 ? 'in_stock' : 'out_of_stock',
                message: `${args.sku} 재고 → ${args.stock_qty}개`,
            };
        }

        case 'update_price': {
            const { data: existing } = await supabase
                .from('products')
                .select('price')
                .eq('sku', args.sku)
                .eq('seller_id', seller.seller_id)
                .single();

            if (!existing) return { error: `상품을 찾을 수 없습니다: ${args.sku}` };

            const oldPrice = existing.price;

            const { error } = await supabase
                .from('products')
                .update({
                    price: args.price,
                    updated_at: new Date().toISOString(),
                })
                .eq('sku', args.sku)
                .eq('seller_id', seller.seller_id);

            if (error) return { error: error.message };

            const change = args.price - oldPrice;
            const changePercent = oldPrice > 0 ? ((change / oldPrice) * 100).toFixed(1) : '0';

            return {
                success: true,
                sku: args.sku,
                old_price: oldPrice,
                new_price: args.price,
                change: `${change >= 0 ? '+' : ''}₩${change.toLocaleString()} (${changePercent}%)`,
                message: `${args.sku} 가격 ₩${oldPrice.toLocaleString()} → ₩${args.price.toLocaleString()}`,
            };
        }

        case 'get_sales_report': {
            const days = args.days || 30;
            const since = new Date(Date.now() - days * 86400000).toISOString();

            // Get orders for this seller
            const { data: orders } = await supabase
                .from('orders')
                .select('sku, product_title, quantity, total_price, status, agent_id, created_at')
                .eq('seller_id', seller.seller_id)
                .gte('created_at', since);

            const allOrders = orders || [];
            const activeOrders = allOrders.filter((o: any) => o.status !== 'VOIDED');

            // Calculate totals
            const totalRevenue = activeOrders.reduce((s: number, o: any) => s + (o.total_price || 0), 0);
            const totalItems = activeOrders.reduce((s: number, o: any) => s + (o.quantity || 0), 0);

            // Top products by revenue
            const productMap: Record<string, { title: string; revenue: number; qty: number; orders: number }> = {};
            activeOrders.forEach((o: any) => {
                const key = o.sku;
                if (!productMap[key]) productMap[key] = { title: o.product_title, revenue: 0, qty: 0, orders: 0 };
                productMap[key].revenue += o.total_price || 0;
                productMap[key].qty += o.quantity || 0;
                productMap[key].orders += 1;
            });

            const topProducts = Object.entries(productMap)
                .map(([sku, info]) => ({ sku, ...info }))
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 5);

            // Unique buyer agents
            const uniqueAgents = [...new Set(activeOrders.map((o: any) => o.agent_id))];

            return {
                seller: seller.business_name,
                period: `최근 ${days}일`,
                summary: {
                    total_revenue: totalRevenue,
                    total_revenue_formatted: `₩${totalRevenue.toLocaleString()}`,
                    total_orders: activeOrders.length,
                    total_items_sold: totalItems,
                    unique_buyer_agents: uniqueAgents.length,
                    avg_order_value: activeOrders.length > 0 ? Math.round(totalRevenue / activeOrders.length) : 0,
                    voided_orders: allOrders.length - activeOrders.length,
                },
                top_products: topProducts,
                status_breakdown: {
                    order_created: allOrders.filter((o: any) => o.status === 'ORDER_CREATED').length,
                    payment_authorized: allOrders.filter((o: any) => o.status === 'PAYMENT_AUTHORIZED').length,
                    shipped: allOrders.filter((o: any) => o.status === 'SHIPPED').length,
                    delivered: allOrders.filter((o: any) => o.status === 'DELIVERED').length,
                    voided: allOrders.filter((o: any) => o.status === 'VOIDED').length,
                },
            };
        }

        case 'get_settlement': {
            const days = args.days || 90;
            const since = new Date(Date.now() - days * 86400000).toISOString();
            const statusFilter = args.status || 'all';

            // Get delivered orders (settleable)
            const { data: orders } = await supabase
                .from('orders')
                .select('order_id, total_price, status, created_at')
                .eq('seller_id', seller.seller_id)
                .gte('created_at', since)
                .in('status', ['DELIVERED', 'SHIPPED', 'PAYMENT_AUTHORIZED']);

            const allOrders = orders || [];

            const delivered = allOrders.filter((o: any) => o.status === 'DELIVERED');
            const shipped = allOrders.filter((o: any) => o.status === 'SHIPPED');
            const authorized = allOrders.filter((o: any) => o.status === 'PAYMENT_AUTHORIZED');

            const deliveredTotal = delivered.reduce((s: number, o: any) => s + (o.total_price || 0), 0);
            const shippedTotal = shipped.reduce((s: number, o: any) => s + (o.total_price || 0), 0);
            const authorizedTotal = authorized.reduce((s: number, o: any) => s + (o.total_price || 0), 0);

            const commissionRate = 0.05; // 5% 수수료

            return {
                seller: seller.business_name,
                period: `최근 ${days}일`,
                settlement: {
                    completed: {
                        count: delivered.length,
                        gross: deliveredTotal,
                        commission: Math.round(deliveredTotal * commissionRate),
                        net: Math.round(deliveredTotal * (1 - commissionRate)),
                        net_formatted: `₩${Math.round(deliveredTotal * (1 - commissionRate)).toLocaleString()}`,
                    },
                    pending_shipment: {
                        count: authorized.length,
                        amount: authorizedTotal,
                        message: '결제 완료, 발송 대기 중',
                    },
                    in_transit: {
                        count: shipped.length,
                        amount: shippedTotal,
                        message: '배송 중 — 배송 완료 후 정산',
                    },
                    total_expected: {
                        gross: deliveredTotal + shippedTotal + authorizedTotal,
                        net: Math.round((deliveredTotal + shippedTotal + authorizedTotal) * (1 - commissionRate)),
                    },
                },
                commission_rate: `${commissionRate * 100}%`,
            };
        }

        case 'add_product': {
            const deliveryFee = JSON.stringify({
                pay: args.delivery_fee || '무료배송',
                fee: args.delivery_amount || 0,
                jeju_extra: 0,
                merge_enable: 'y',
            });

            const attributes: any = {};
            if (args.manufacturer) attributes.manufacturer = args.manufacturer;
            if (args.country) attributes.country = args.country;

            const product = {
                sku: args.sku,
                title: args.title,
                category: args.category || 'GENERAL',
                price: args.price,
                stock_qty: args.stock_qty,
                brand: args.brand || '',
                delivery_fee: deliveryFee,
                attributes: JSON.stringify(attributes),
            };

            const { data, error } = await supabase.rpc('seller_upload_products', {
                p_api_key: '', // We'll pass seller_id directly
                p_file_name: 'mcp_entry',
                p_products: [product],
            });

            // Fallback: direct insert if RPC fails (may lack api_key in this context)
            if (error) {
                const { error: insertErr } = await supabase.from('products').upsert({
                    sku: args.sku,
                    title: args.title,
                    category: args.category || 'GENERAL',
                    price: args.price,
                    stock_qty: args.stock_qty,
                    stock_status: args.stock_qty > 0 ? 'in_stock' : 'out_of_stock',
                    brand: args.brand || '',
                    currency: 'KRW',
                    delivery_fee: JSON.parse(deliveryFee),
                    attributes,
                    source: 'seller',
                    sourcing_type: 'HUMAN',
                    seller_id: seller.seller_id,
                    seller_name: seller.business_name,
                    ai_readiness_score: 70,
                    seller_trust: seller.trust_score,
                    min_order_qty: 1,
                    ship_by_days: 1,
                    eta_days: 3,
                    return_days: 7,
                    return_fee: 0,
                }, { onConflict: 'sku' });

                if (insertErr) return { error: insertErr.message };
            }

            return {
                success: true,
                sku: args.sku,
                title: args.title,
                price: args.price,
                stock_qty: args.stock_qty,
                message: `상품 "${args.title}" 등록 완료 (SKU: ${args.sku})`,
            };
        }

        case 'get_buyer_agents': {
            const days = args.days || 30;
            const since = new Date(Date.now() - days * 86400000).toISOString();

            const { data: orders } = await supabase
                .from('orders')
                .select('agent_id, sku, product_title, quantity, total_price, created_at')
                .eq('seller_id', seller.seller_id)
                .neq('status', 'VOIDED')
                .gte('created_at', since);

            const allOrders = orders || [];

            // Aggregate by agent
            const agentMap: Record<string, { orders: number; revenue: number; items: number; products: Set<string>; last_order: string }> = {};
            allOrders.forEach((o: any) => {
                const aid = o.agent_id;
                if (!agentMap[aid]) agentMap[aid] = { orders: 0, revenue: 0, items: 0, products: new Set(), last_order: '' };
                agentMap[aid].orders += 1;
                agentMap[aid].revenue += o.total_price || 0;
                agentMap[aid].items += o.quantity || 0;
                agentMap[aid].products.add(o.sku);
                if (o.created_at > agentMap[aid].last_order) agentMap[aid].last_order = o.created_at;
            });

            const agents = Object.entries(agentMap)
                .map(([agent_id, info]) => ({
                    agent_id,
                    total_orders: info.orders,
                    total_revenue: info.revenue,
                    total_items: info.items,
                    unique_products: info.products.size,
                    favorite_products: [...info.products].slice(0, 3),
                    last_order: info.last_order,
                }))
                .sort((a, b) => b.total_revenue - a.total_revenue);

            return {
                seller: seller.business_name,
                period: `최근 ${days}일`,
                buyer_agents: agents,
                total_unique_agents: agents.length,
                message: agents.length > 0
                    ? `${agents.length}개 AI 에이전트가 구매 — 최다 구매: ${agents[0].agent_id} (₩${agents[0].total_revenue.toLocaleString()})`
                    : '아직 구매한 에이전트가 없습니다',
            };
        }

        default:
            return { error: `Unknown tool: ${name}` };
    }
}

// ━━━ Resource Definitions ━━━
const RESOURCES = [
    {
        uri: 'seller://dashboard',
        name: 'Seller Dashboard',
        description: '셀러 대시보드 요약 (상품 수, 오늘 주문, 미처리 주문)',
        mimeType: 'application/json',
    },
];

async function handleResource(uri: string, supabase: any, seller: any) {
    switch (uri) {
        case 'seller://dashboard': {
            const today = new Date().toISOString().slice(0, 10);

            const [products, todayOrders, pendingOrders] = await Promise.all([
                supabase.from('products').select('*', { count: 'exact', head: true }).eq('seller_id', seller.seller_id),
                supabase.from('orders').select('*', { count: 'exact', head: true }).eq('seller_id', seller.seller_id).gte('created_at', `${today}T00:00:00`),
                supabase.from('orders').select('*', { count: 'exact', head: true }).eq('seller_id', seller.seller_id).in('status', ['ORDER_CREATED', 'PAYMENT_AUTHORIZED']),
            ]);

            return JSON.stringify({
                seller: seller.business_name,
                seller_id: seller.seller_id,
                trust_score: seller.trust_score,
                total_products: products.count || 0,
                today_orders: todayOrders.count || 0,
                pending_orders: pendingOrders.count || 0,
                generatedAt: new Date().toISOString(),
            }, null, 2);
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
            name: 'JSONMart Seller MCP Server',
            version: '1.0.0',
            protocol: 'MCP/2024-11-05',
            description: '셀러용 AI 에이전트 판매 관리 도구. x-seller-key 헤더에 셀러 API 키 필요.',
            tools: TOOLS.map(t => t.name),
            resources: RESOURCES.map(r => r.uri),
            auth: 'x-seller-key header required',
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

    // Auth: require seller key for all tool calls
    const sellerKey = req.headers.get('x-seller-key') || '';

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
                        name: 'JSONMart Seller MCP Server',
                        version: '1.0.0',
                        description: 'AI 에이전트로 상품관리, 주문처리, 매출분석, 정산확인을 대화형으로 수행하는 셀러 전용 MCP 서버',
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

                // Auth required for tool calls
                if (!sellerKey) {
                    return mcpError(id, -32600, 'x-seller-key 헤더에 셀러 API 키가 필요합니다. 셀러센터에서 API 키를 확인하세요.');
                }

                const seller = await authSeller(supabase, sellerKey);
                if (!seller) {
                    return mcpError(id, -32600, '유효하지 않은 셀러 API 키이거나 비활성 셀러입니다.');
                }

                const result = await handleTool(toolName, toolArgs, supabase, seller);
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

                if (!sellerKey) {
                    return mcpError(id, -32600, 'x-seller-key 헤더에 셀러 API 키가 필요합니다.');
                }

                const seller = await authSeller(supabase, sellerKey);
                if (!seller) {
                    return mcpError(id, -32600, '유효하지 않은 셀러 API 키입니다.');
                }

                const content = await handleResource(uri, supabase, seller);
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
