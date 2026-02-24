// supabase/functions/jsonmart-api/index.ts
// JSONMart REST API for ChatGPT Custom GPT Actions
// Single endpoint: POST /jsonmart-api with { action, ...params }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
            version: '1.0.0',
            description: 'B2B AI Marketplace REST API for ChatGPT Custom GPT Actions',
            actions: ['search_products', 'get_product', 'compare_products', 'list_promotions', 'create_order', 'check_order'],
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
    if (!action) return json({ error: 'Missing "action" field. Available: search_products | get_product | compare_products | list_promotions | create_order | check_order' }, 400);

    try {
        switch (action) {

            case 'search_products': {
                let q = supabase
                    .from('products')
                    .select('sku, title, category, price, stock_status, seller_trust, eta_days, ship_by_days')
                    .limit(Math.min(args.limit || 10, 50));
                if (args.category) q = q.eq('category', args.category);
                if (args.max_price) q = q.lte('price', args.max_price);
                if (args.in_stock_only) q = q.eq('stock_status', 'IN_STOCK');
                if (args.query) q = q.ilike('title', `%${args.query}%`);
                const { data, error } = await q;
                if (error) return json({ error: error.message }, 500);
                return json({
                    results: (data || []).map((p: any) => ({
                        sku: p.sku, title: p.title, category: p.category,
                        price: p.price, stock_status: p.stock_status,
                        trust_score: p.seller_trust, eta_days: p.eta_days,
                    })),
                    total: (data || []).length,
                });
            }

            case 'get_product': {
                if (!args.sku) return json({ error: 'sku required' }, 400);
                const { data, error } = await supabase
                    .from('products')
                    .select('sku, title, category, brand, price, currency, stock_status, stock_qty, eta_days, ship_by_days, return_days, return_fee, ai_readiness_score, seller_trust, moq, attributes')
                    .eq('sku', args.sku)
                    .single();
                if (error) return json({ error: `Product not found: ${args.sku}` }, 404);
                return json({
                    sku: data.sku, title: data.title, category: data.category,
                    brand: data.brand, price: data.price, currency: data.currency || 'KRW',
                    stockStatus: data.stock_status, stockQty: data.stock_qty,
                    etaDays: data.eta_days, shipByDays: data.ship_by_days,
                    returnDays: data.return_days, returnFee: data.return_fee,
                    aiReadinessScore: data.ai_readiness_score, trustScore: data.seller_trust,
                    moq: data.moq, attributes: data.attributes || {},
                });
            }

            case 'compare_products': {
                const skus: string[] = args.sku_list || [];
                if (skus.length < 2) return json({ error: 'sku_list requires 2-4 items' }, 400);
                const { data, error } = await supabase
                    .from('products')
                    .select('sku, title, price, seller_trust, stock_status, ship_by_days, eta_days, moq')
                    .in('sku', skus);
                if (error) return json({ error: error.message }, 500);
                const comparison = (data || []).map((p: any) => ({
                    sku: p.sku, title: p.title, price: p.price,
                    trust_score: p.seller_trust, stock: p.stock_status,
                    ship_by_days: p.ship_by_days, eta_days: p.eta_days, moq: p.moq,
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

                const { data: product } = await supabase
                    .from('products')
                    .select('sku, title, price')
                    .eq('sku', args.sku)
                    .single();
                if (!product) return json({ error: `Product not found: ${args.sku}` }, 404);

                const unitPrice = product.price || 0;
                const totalPrice = unitPrice * args.quantity;
                const orderId = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

                const { error: insertErr } = await supabase.from('orders').insert({
                    order_id: orderId, agent_id: `AGT-${apiKey.slice(-8).toUpperCase()}`,
                    sku: args.sku, product_title: product.title, quantity: args.quantity,
                    unit_price: unitPrice, total_price: totalPrice,
                    status: 'ORDER_CREATED',
                    payment_deadline: new Date(Date.now() + 86400000).toISOString(),
                    source: 'ChatGPT',
                });
                if (insertErr) return json({ error: insertErr.message }, 500);
                return json({
                    orderId, status: 'ORDER_CREATED', sku: args.sku,
                    productTitle: product.title, quantity: args.quantity,
                    unitPrice, totalPrice,
                    message: '주문 생성 완료. 24시간 내 결제가 필요합니다.',
                });
            }

            case 'check_order': {
                if (!args.order_id) return json({ error: 'order_id required' }, 400);
                const { data, error } = await supabase
                    .from('orders')
                    .select('order_id, status, sku, product_title, quantity, total_price, created_at, payment_deadline, tracking_number')
                    .eq('order_id', args.order_id)
                    .single();
                if (error) return json({ error: `Order not found: ${args.order_id}` }, 404);
                return json({
                    orderId: data.order_id, status: data.status, sku: data.sku,
                    productTitle: data.product_title, quantity: data.quantity,
                    totalPrice: data.total_price, createdAt: data.created_at,
                    paymentDeadline: data.payment_deadline,
                    trackingNumber: data.tracking_number || null,
                });
            }

            default:
                return json({ error: `Unknown action: "${action}". Available: search_products | get_product | compare_products | list_promotions | create_order | check_order` }, 400);
        }
    } catch (err: any) {
        return json({ error: 'Internal server error', detail: err.message }, 500);
    }
});
