// supabase/functions/jsonmart-api/index.ts
// JSONMart REST API — AI 에이전트 전용 커머스 플랫폼 (인간 구매 불가)
// Deploy: supabase functions deploy jsonmart-api

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYAPP_API_URL = 'https://api.payapp.kr/oapi/apiLoad.html';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    // Health check
    if (req.method === 'GET') {
        return json({
            name: 'JSONMart API',
            version: '2.0.0',
            description: 'AI Agent-Only Commerce REST API — API agents (wallet) & Computer Use agents (payapp)',
            actions: ['search_products', 'get_product', 'compare_products', 'list_promotions', 'create_order', 'check_order'],
            payment_methods: {
                wallet: '지갑 선불 차감 — API 에이전트용 (즉시 결제, payment_method: "wallet")',
                payapp: 'PG 결제 URL 반환 — Computer Use 에이전트용 (payurl 브라우저에서 열어 결제, 기본값)',
            },
            status: 'ok',
        });
    }

    if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let body: any;
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

    const { action, ...args } = body;
    if (!action) return json({ error: 'Missing "action". Available: search_products | get_product | compare_products | list_promotions | create_order | check_order' }, 400);

    try {
        switch (action) {

            case 'search_products': {
                let q = supabase
                    .from('products')
                    .select('sku, title, category, brand, price, currency, stock_status, stock_qty, seller_trust, eta_days, ship_by_days, return_days, return_fee, ai_readiness_score, moq, min_order_qty, seller_id, seller_name, source, delivery_fee, attributes')
                    .limit(Math.min(args.limit || 10, 50));
                if (args.category) q = q.eq('category', args.category);
                if (args.max_price) q = q.lte('price', args.max_price);
                if (args.in_stock_only) q = q.eq('stock_status', 'in_stock');
                if (args.query) q = q.ilike('title', `%${args.query}%`);
                if (args.min_trust) q = q.gte('seller_trust', args.min_trust);
                if (args.seller_id) q = q.eq('seller_id', args.seller_id);
                const { data, error } = await q;
                if (error) return json({ error: error.message }, 500);
                return json({
                    results: (data || []).map((p: any) => ({
                        sku: p.sku,
                        title: p.title,
                        category: p.category,
                        brand: p.brand || null,
                        price: p.price,
                        currency: p.currency || 'KRW',
                        stock_status: p.stock_status,
                        stock_qty: p.stock_qty,
                        trust_score: p.seller_trust,
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
                    total: (data || []).length,
                });
            }

            case 'get_product': {
                if (!args.sku) return json({ error: 'sku required' }, 400);
                const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .eq('sku', args.sku)
                    .single();
                if (error) return json({ error: `Product not found: ${args.sku}` }, 404);
                return json({
                    sku: data.sku,
                    title: data.title,
                    category: data.category,
                    brand: data.brand || null,
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
                    // Seller info
                    sellerId: data.seller_id || null,
                    sellerName: data.seller_name || null,
                    // Delivery
                    deliveryFee: data.delivery_fee || null,
                    // Source
                    source: data.source || 'direct',
                    sourceUrl: data.source_url || null,
                    // Extra
                    purchaseUnit: data.purchase_unit || 1,
                    maxOrderQty: data.max_order_qty || null,
                    isPopular: data.is_popular || false,
                    hasOptions: data.has_options || false,
                    attributes: data.attributes || {},
                    updatedAt: data.updated_at,
                });
            }

            case 'compare_products': {
                const skus: string[] = args.sku_list || [];
                if (skus.length < 2) return json({ error: 'sku_list requires 2-4 items' }, 400);
                const { data, error } = await supabase
                    .from('products')
                    .select('sku, title, category, brand, price, seller_trust, stock_status, stock_qty, ship_by_days, eta_days, moq, min_order_qty, return_days, return_fee, seller_id, seller_name, delivery_fee, attributes')
                    .in('sku', skus);
                if (error) return json({ error: error.message }, 500);
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
                    (b.trust_score || 0) - (a.trust_score || 0) || (a.price || 0) - (b.price || 0)
                );
                return json({
                    comparison,
                    recommendation: sorted[0]?.sku || null,
                    reason: sorted[0]
                        ? `최고 신뢰 점수 (${sorted[0].trust_score}) + 최적 가격 ₩${(sorted[0].price || 0).toLocaleString()}`
                        : 'No products found',
                });
            }

            case 'list_promotions': {
                let q = supabase
                    .from('promotions')
                    .select('promo_id, name, type, value, min_qty, categories, valid_from, valid_to')
                    .eq('active', true)
                    .order('created_at', { ascending: false });
                if (args.category) q = q.contains('categories', [args.category]);
                const { data, error } = await q;
                if (error) return json({ error: error.message }, 500);
                return json({
                    promotions: (data || []).map((p: any) => ({
                        id: p.promo_id, name: p.name, type: p.type, value: p.value,
                        minQty: p.min_qty, categories: p.categories,
                        validFrom: p.valid_from, validUntil: p.valid_to,
                    })),
                });
            }

            case 'create_order': {
                const apiKey = req.headers.get('x-api-key');
                if (!apiKey) return json({ error: 'x-api-key header required for create_order' }, 401);
                if (!args.sku || !args.quantity) return json({ error: 'sku and quantity required' }, 400);

                /**
                 * payment_method 파라미터
                 *   - "wallet" : 지갑 잔액 즉시 차감 → API 에이전트용 (자동화, 고속)
                 *   - "payapp"(기본값) : PG payurl 반환 → Computer Use 에이전트가 브라우저에서 직접 결제
                 */
                const paymentMethod: 'wallet' | 'payapp' = args.payment_method === 'wallet' ? 'wallet' : 'payapp';

                const { data: product } = await supabase
                    .from('products')
                    .select('sku, title, price, seller_id, seller_name')
                    .eq('sku', args.sku)
                    .single();
                if (!product) return json({ error: `Product not found: ${args.sku}` }, 404);

                const unitPrice = product.price || 0;
                const totalPrice = unitPrice * args.quantity;
                const orderId = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

                // ── API 키로 실제 agent_id 조회 (파생 방식 제거) ──────────────
                const { data: agentRow, error: agentLookupErr } = await supabase
                    .from('agents')
                    .select('agent_id, status, name')
                    .eq('api_key', apiKey)
                    .single();

                if (agentLookupErr || !agentRow) {
                    return json({ error: '유효하지 않은 API 키입니다.', hint: 'x-api-key 헤더를 확인하세요.' }, 401);
                }
                if (agentRow.status !== 'ACTIVE') {
                    return json({ error: `에이전트가 활성 상태가 아닙니다. (현재 상태: ${agentRow.status})` }, 403);
                }
                const agentId = agentRow.agent_id;


                // ── 방식 1: 지갑 선불 차감 (API 에이전트) ─────────────────────
                if (paymentMethod === 'wallet') {
                    const { data: spendData, error: spendErr } = await supabase.rpc('wallet_spend', {
                        p_api_key: apiKey,
                        p_amount: totalPrice,
                        p_order_id: orderId,
                        p_description: `구매: ${product.title} x${args.quantity}`,
                    });
                    if (spendErr) {
                        return json({
                            error: '지갑 잔액 부족 또는 차감 실패',
                            detail: spendErr.message,
                            hint: 'payment_method를 "payapp"으로 변경하여 PG 결제를 이용하거나, 지갑을 충전하세요.',
                        }, 402);
                    }

                    await supabase.from('orders').insert({
                        order_id: orderId, agent_id: agentId,
                        seller_id: product.seller_id || 'SLR-JSONMART',
                        sku: args.sku, product_title: product.title, quantity: args.quantity,
                        unit_price: unitPrice, total_price: totalPrice,
                        status: 'CONFIRMED',
                        payment_status: 'CAPTURED',
                        payment_method: 'WALLET',
                        source: args.source || 'API',
                    });

                    return json({
                        orderId, status: 'CONFIRMED',
                        paymentMethod: 'wallet',
                        sku: args.sku, productTitle: product.title,
                        quantity: args.quantity, unitPrice, totalPrice,
                        walletBalance: spendData?.balance_after ?? null,
                        message: '✅ 지갑 결제 완료. 주문이 즉시 확정되었습니다.',
                    });
                }

                // ── 방식 2: PG payurl 반환 (Computer Use 에이전트) ──────────────
                await supabase.from('orders').insert({
                    order_id: orderId, agent_id: agentId,
                    seller_id: product.seller_id || 'SLR-JSONMART',
                    sku: args.sku, product_title: product.title, quantity: args.quantity,
                    unit_price: unitPrice, total_price: totalPrice,
                    status: 'ORDER_CREATED',
                    payment_status: 'PENDING',
                    payment_method: 'PAYAPP',
                    payment_deadline: new Date(Date.now() + 86400000).toISOString(),
                    source: args.source || 'API',
                });

                try {
                    const PAYAPP_USERID = Deno.env.get('PAYAPP_USERID')!;
                    const PAYAPP_LINKKEY = Deno.env.get('PAYAPP_LINKKEY')!;
                    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

                    const formData = new URLSearchParams({
                        cmd: 'payrequest',
                        userid: PAYAPP_USERID,
                        goodname: `${product.title} x${args.quantity}`,
                        price: String(Math.round(totalPrice)),
                        recvphone: args.recvphone || '01000000000',
                        feedbackurl: `${SUPABASE_URL}/functions/v1/payapp-feedback`,
                        var1: orderId,
                        smsuse: 'n',
                        memo: `JSONMart ${orderId}`,
                        linkkey: PAYAPP_LINKKEY,
                    });

                    const payappRes = await fetch(PAYAPP_API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: formData.toString(),
                    });

                    const resParams = new URLSearchParams(await payappRes.text());
                    const mul_no = resParams.get('mul_no');
                    const payurl = resParams.get('payurl');

                    if (resParams.get('state') === '1' && payurl) {
                        await supabase.from('orders').update({
                            payment_status: 'PAYMENT_REQUESTED',
                            payapp_mul_no: mul_no,
                            payapp_payurl: payurl,
                        }).eq('order_id', orderId);

                        return json({
                            orderId, status: 'ORDER_CREATED',
                            paymentMethod: 'payapp',
                            sku: args.sku, productTitle: product.title,
                            quantity: args.quantity, unitPrice, totalPrice,
                            payurl,   // ← Computer Use 에이전트가 이 URL을 브라우저에서 열어 결제
                            mulNo: mul_no,
                            paymentDeadline: new Date(Date.now() + 86400000).toISOString(),
                            message: '🔗 payurl을 열어 카드/간편결제로 결제하세요. 완료 시 주문이 자동 확정됩니다.',
                            instructions: {
                                computerUse: 'open_url(payurl) → 결제 완료',
                                humanOperator: 'payurl 링크를 브라우저에서 열어 결제',
                            },
                        });
                    }

                    // PayApp 요청 실패
                    return json({
                        orderId, status: 'ORDER_CREATED',
                        paymentMethod: 'payapp',
                        sku: args.sku, productTitle: product.title,
                        quantity: args.quantity, unitPrice, totalPrice,
                        payurl: null,
                        warning: 'PG 결제 URL 생성 실패. payment_method="wallet"로 재시도하거나 관리자에게 문의하세요.',
                        payappError: resParams.get('errorMessage'),
                    });
                } catch (pgErr: any) {
                    return json({
                        orderId, status: 'ORDER_CREATED',
                        warning: 'PG 연결 오류. 주문은 생성되었습니다.',
                        detail: pgErr.message,
                    });
                }
            }

            case 'check_order': {
                if (!args.order_id) return json({ error: 'order_id required' }, 400);
                const { data, error } = await supabase
                    .from('orders')
                    .select('order_id, status, payment_status, payment_method, sku, product_title, quantity, total_price, created_at, payment_deadline, tracking_number, payapp_payurl, payapp_mul_no, payapp_pay_type, payapp_pay_date')
                    .eq('order_id', args.order_id)
                    .single();
                if (error) return json({ error: `Order not found: ${args.order_id}` }, 404);
                return json({
                    orderId: data.order_id,
                    status: data.status,
                    paymentStatus: data.payment_status,
                    paymentMethod: data.payment_method,
                    sku: data.sku,
                    productTitle: data.product_title,
                    quantity: data.quantity,
                    totalPrice: data.total_price,
                    createdAt: data.created_at,
                    paymentDeadline: data.payment_deadline,
                    trackingNumber: data.tracking_number || null,
                    // PG 결제 정보 (payapp 방식인 경우 — Computer Use 에이전트가 payurl 재확인 가능)
                    payurl: data.payapp_payurl || null,
                    mulNo: data.payapp_mul_no || null,
                    payType: data.payapp_pay_type || null,
                    payDate: data.payapp_pay_date || null,
                });
            }

            default:
                return json({ error: `Unknown action: "${action}". Available: search_products | get_product | compare_products | list_promotions | create_order | check_order` }, 400);
        }
    } catch (err: any) {
        return json({ error: 'Internal server error', detail: err.message }, 500);
    }
});
