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
                category: { type: 'string', description: '카테고리 필터: CONSUMABLES | MRO | FOOD | OFFICE | HOUSEHOLD | FASHION | BEAUTY | DIGITAL | SPORTS | PETS | BABY | OTHER' },
                max_price: { type: 'number', description: '최대 가격 (원)' },
                min_trust: { type: 'number', description: '최소 신뢰 점수 (0-100)' },
                in_stock_only: { type: 'boolean', description: '재고 있는 상품만 조회' },
                seller_id: { type: 'string', description: '특정 셀러 상품만 조회 (셀러 ID)' },
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
    {
        name: 'negotiate_price',
        description: '대량 구매 가격 협상. 시스템이 자동으로 수락/역제안/거절 응답.',
        inputSchema: {
            type: 'object',
            properties: {
                sku: { type: 'string', description: '협상할 상품 SKU' },
                qty: { type: 'number', description: '희망 수량' },
                unit_price: { type: 'number', description: '제안 단가 (원)' },
            },
            required: ['sku', 'qty', 'unit_price'],
        },
    },
    {
        name: 'sandbox_order',
        description: '테스트 주문 생성. 실제 재고 차감 없음, 결제 없음.',
        inputSchema: {
            type: 'object',
            properties: {
                sku: { type: 'string', description: '상품 SKU' },
                qty: { type: 'number', description: '수량 (기본 1)' },
            },
            required: ['sku'],
        },
    },
    {
        name: 'get_sla',
        description: 'JSONMart SLA 성능 지표 조회. 재고 정확도, 배송율, 웹훅 신뢰도 등.',
        inputSchema: {
            type: 'object',
            properties: {
                days: { type: 'number', description: '조회 기간 (기본 30일)' },
            },
        },
    },
    {
        name: 'get_rewards',
        description: '에이전트 로열티 보상 및 티어 상태 조회.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'submit_review',
        description: '구매 상품 리뷰 제출. KPI 기반 (배송, 정확도, 포장).',
        inputSchema: {
            type: 'object',
            properties: {
                sku: { type: 'string', description: '상품 SKU' },
                review_text: { type: 'string', description: '리뷰 내용' },
                delivery_score: { type: 'number', description: '배송 평점 0-5' },
                accuracy_score: { type: 'number', description: '정확도 평점 0-5' },
            },
            required: ['sku', 'review_text', 'delivery_score', 'accuracy_score'],
        },
    },
    {
        name: 'wallet_check',
        description: '에이전트 지갑 잔액, 티어, 포인트, 최근 거래 조회.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'apply_coupon',
        description: '쿠폰 적용. 티어 제한, 유효기간, 사용 횟수 검증 후 할인 금액 반환.',
        inputSchema: {
            type: 'object',
            properties: {
                coupon_code: { type: 'string', description: '쿠폰 코드' },
                order_amount: { type: 'number', description: '주문 금액 (원)' },
            },
            required: ['coupon_code', 'order_amount'],
        },
    },
    {
        name: 'predict_reorder',
        description: '구매 이력 분석 후 재주문 시기 예측.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'get_notifications',
        description: '에이전트 수신함 확인. 신상품, 가격 변동, 프로모션 등.',
        inputSchema: {
            type: 'object',
            properties: {
                unread_only: { type: 'boolean', description: '읽지 않은 알림만' },
                type: { type: 'string', description: 'NEW_PRODUCT | PRICE_DROP | PROMOTION | RESTOCK | SYSTEM' },
                limit: { type: 'number', description: '최대 결과 수 (기본 20)' },
            },
        },
    },
    {
        name: 'a2a_broadcast',
        description: '에이전트 네트워크에 질의 전송. 다른 에이전트의 상품 경험, 공급사 평가 등.',
        inputSchema: {
            type: 'object',
            properties: {
                query_type: { type: 'string', description: 'PRODUCT_EXPERIENCE | SUPPLIER_RATING | PRICE_CHECK | GENERAL' },
                sku: { type: 'string', description: '대상 상품 SKU (선택)' },
                question: { type: 'string', description: '질문 내용' },
                ttl_hours: { type: 'number', description: '질의 만료 시간 (기본 24)' },
            },
            required: ['question'],
        },
    },
    {
        name: 'a2a_respond',
        description: '다른 에이전트의 A2A 질의에 응답.',
        inputSchema: {
            type: 'object',
            properties: {
                query_id: { type: 'string', description: 'A2A 질의 ID' },
                verdict: { type: 'string', description: 'ENDORSE | WARN | BLOCKLIST | NEUTRAL' },
                confidence: { type: 'number', description: '확신도 0.0-1.0' },
                message: { type: 'string', description: '코멘트 (선택)' },
            },
            required: ['query_id', 'verdict'],
        },
    },
    {
        name: 'a2a_get_queries',
        description: '에이전트 네트워크의 활성 질의 목록 조회.',
        inputSchema: {
            type: 'object',
            properties: {
                status: { type: 'string', description: 'OPEN | RESOLVED | EXPIRED' },
                sku: { type: 'string', description: '상품 SKU 필터' },
                limit: { type: 'number', description: '최대 결과 수 (기본 20)' },
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
    {
        uri: 'jsonmart://sla',
        name: 'SLA Metrics',
        description: 'SLA 성능 지표 대시보드',
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
                .select('sku, title, description, category, brand, price, currency, stock_status, stock_qty, seller_trust, eta_days, ship_by_days, return_days, return_fee, ai_readiness_score, moq, min_order_qty, seller_id, seller_name, source, delivery_fee, attributes', { count: 'exact' })
                .limit(Math.min(args.limit || 10, 200));

            if (args.category) q = q.eq('category', args.category);
            if (args.max_price) q = q.lte('price', args.max_price);
            if (args.min_trust) q = q.gte('seller_trust', args.min_trust);
            if (args.in_stock_only) q = q.eq('stock_status', 'in_stock');
            if (args.query) q = q.ilike('title', `%${args.query}%`);
            if (args.seller_id) q = q.eq('seller_id', args.seller_id);
            if (args.offset) q = q.range(args.offset, args.offset + Math.min(args.limit || 10, 200) - 1);

            const { data, error, count: totalCount } = await q;
            if (error) return { error: error.message };

            return {
                results: (data || []).map((p: any) => ({
                    sku: p.sku,
                    title: p.title,
                    description: p.description || null,
                    category: p.category,
                    brand: p.brand || null,
                    price: p.price,
                    currency: p.currency || 'KRW',
                    stock_status: p.stock_status,
                    stock_qty: p.stock_qty,
                    trust_score: p.seller_trust,
                    ai_readiness_score: p.ai_readiness_score || 70,
                    eta_days: p.eta_days,
                    ship_by_days: p.ship_by_days,
                    return_days: p.return_days,
                    return_fee: p.return_fee,
                    moq: p.moq || p.min_order_qty || 1,
                    seller_id: p.seller_id || null,
                    seller_name: p.seller_name || null,
                    source: p.source || 'direct',
                    delivery_fee: p.delivery_fee || null,
                    attributes: p.attributes || {},
                })),
                returned: (data || []).length,
                total_count: totalCount ?? (data || []).length,
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
                brand: data.brand || null,
                description: data.description || null,
                gtin: data.gtin || null,
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
                moq: data.moq || data.min_order_qty || 1,
                sellerId: data.seller_id || null,
                sellerName: data.seller_name || null,
                deliveryFee: data.delivery_fee || null,
                source: data.source || 'direct',
                sourceUrl: data.source_url || null,
                purchaseUnit: data.purchase_unit || 1,
                maxOrderQty: data.max_order_qty || null,
                isPopular: data.is_popular || false,
                hasOptions: data.has_options || false,
                attributes: data.attributes || {},
                updatedAt: data.updated_at,
            };
        }

        case 'compare_products': {
            const skus: string[] = args.sku_list || [];
            const { data, error } = await supabase
                .from('products')
                .select('sku, title, category, brand, price, seller_trust, stock_status, stock_qty, ship_by_days, eta_days, moq, min_order_qty, return_days, return_fee, seller_id, seller_name, delivery_fee, attributes')
                .in('sku', skus);
            if (error) return { error: error.message };

            const comparison = (data || []).map((p: any) => ({
                sku: p.sku,
                title: p.title,
                category: p.category,
                brand: p.brand || null,
                price: p.price,
                trust_score: p.seller_trust,
                stock: p.stock_status,
                stock_qty: p.stock_qty,
                ship_by_days: p.ship_by_days,
                eta_days: p.eta_days,
                moq: p.moq || p.min_order_qty || 1,
                return_days: p.return_days,
                return_fee: p.return_fee,
                seller_id: p.seller_id || null,
                seller_name: p.seller_name || null,
                delivery_fee: p.delivery_fee || null,
                attributes: p.attributes || {},
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
            if (args.in_stock_only) q = q.eq('stock_status', 'in_stock');
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
                .select('sku, title, price, stock_status, seller_id')
                .eq('sku', args.sku)
                .single();

            if (!product) return { error: `Product not found: ${args.sku}` };
            if (product.stock_status !== 'in_stock') return { error: `Product out of stock: ${args.sku}` };

            const unitPrice = product.price || 0;
            const totalPrice = unitPrice * args.quantity;
            const orderId = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
            const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

            const { error: insertErr } = await supabase.from('orders').insert({
                order_id: orderId,
                agent_id: agentId,
                seller_id: product.seller_id || 'SLR-JSONMART',
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

        default: {
            // ━━━ RPC Proxy: route remaining tools to Supabase RPC functions ━━━
            const rpcMap: Record<string, { rpc: string; needsAuth: boolean; argMap?: (a: any, key?: string) => any }> = {
                'negotiate_price': { rpc: 'agent_negotiate', needsAuth: true, argMap: (a, k) => ({ p_api_key: k, p_sku: a.sku, p_qty: a.qty, p_unit_price: a.unit_price }) },
                'sandbox_order': { rpc: 'sandbox_create_order', needsAuth: true, argMap: (a, k) => ({ p_api_key: k, p_sku: a.sku, p_qty: a.qty || 1 }) },
                'get_sla': { rpc: 'get_sla_dashboard', needsAuth: false, argMap: (a) => ({ p_days: a.days || 30 }) },
                'get_rewards': { rpc: 'get_agent_rewards', needsAuth: true, argMap: (_a, k) => ({ p_api_key: k }) },
                'submit_review': { rpc: 'agent_create_review', needsAuth: true, argMap: (a, k) => ({ p_api_key: k, p_sku: a.sku, p_review_text: a.review_text, p_delivery_score: a.delivery_score, p_accuracy_score: a.accuracy_score }) },
                'wallet_check': { rpc: 'get_wallet_info', needsAuth: true, argMap: (_a, k) => ({ p_api_key: k }) },
                'apply_coupon': { rpc: 'apply_coupon', needsAuth: true, argMap: (a, k) => ({ p_api_key: k, p_coupon_code: a.coupon_code, p_order_amount: a.order_amount }) },
                'predict_reorder': { rpc: 'generate_predictions', needsAuth: true, argMap: (_a, k) => ({ p_api_key: k }) },
                'get_notifications': { rpc: 'get_agent_notifications', needsAuth: true, argMap: (a, k) => ({ p_api_key: k, p_unread_only: a.unread_only || false, p_type: a.type || null, p_limit: a.limit || 20 }) },
                'a2a_broadcast': { rpc: 'agent_broadcast_query', needsAuth: true, argMap: (a, k) => ({ p_api_key: k, p_query_type: a.query_type || 'GENERAL', p_sku: a.sku || null, p_question: a.question, p_ttl_hours: a.ttl_hours || 24 }) },
                'a2a_respond': { rpc: 'agent_respond_query', needsAuth: true, argMap: (a, k) => ({ p_api_key: k, p_query_id: a.query_id, p_verdict: a.verdict, p_confidence: a.confidence || 0.8, p_message: a.message || null }) },
                'a2a_get_queries': { rpc: 'get_a2a_queries', needsAuth: false, argMap: (a) => ({ p_status: a.status || 'OPEN', p_sku: a.sku || null, p_limit: a.limit || 20 }) },
            };

            const mapping = rpcMap[name];
            if (!mapping) return { error: `Unknown tool: ${name}` };

            if (mapping.needsAuth && !apiKey) {
                return { error: `x-api-key header required for ${name}` };
            }

            const rpcArgs = mapping.argMap ? mapping.argMap(args, apiKey) : args;
            const { data, error } = await supabase.rpc(mapping.rpc, rpcArgs);

            if (error) {
                // RPC function might not exist yet → return helpful message
                if (error.message?.includes('does not exist') || error.code === '42883') {
                    return { error: `RPC function '${mapping.rpc}' not deployed yet. Run the corresponding SQL migration.`, tool: name };
                }
                return { error: error.message };
            }

            return data || { success: true };
        }
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
        case 'jsonmart://sla': {
            const { data } = await supabase.rpc('get_sla_dashboard', { p_days: 30 });
            return JSON.stringify({ sla: data || {}, generatedAt: new Date().toISOString() }, null, 2);
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
                        version: '2.0.0',
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
