// supabase/functions/payapp-request/index.ts
// Supabase Edge Function: PayApp 결제 요청
// Deploy: supabase functions deploy payapp-request

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYAPP_API_URL = 'https://api.payapp.kr/oapi/apiLoad.html';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { order_id, price, goodname, recvphone, memo } = await req.json();

        // Validate required fields
        if (!order_id || !price || !goodname) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: order_id, price, goodname' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Validate price is positive integer
        const priceInt = Math.round(Number(price));
        if (priceInt <= 0 || isNaN(priceInt)) {
            return new Response(
                JSON.stringify({ error: 'Invalid price: must be a positive integer' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get PayApp credentials from environment
        const PAYAPP_USERID = Deno.env.get('PAYAPP_USERID')!;
        const PAYAPP_LINKKEY = Deno.env.get('PAYAPP_LINKKEY')!;

        // Get Supabase URL for feedback
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const feedbackUrl = `${SUPABASE_URL}/functions/v1/payapp-feedback`;

        // Build PayApp request
        const formData = new URLSearchParams({
            cmd: 'payrequest',
            userid: PAYAPP_USERID,
            goodname: goodname,
            price: String(priceInt),
            recvphone: recvphone || '01000000000', // Agent placeholder
            feedbackurl: feedbackUrl,
            var1: order_id, // Pass order_id through for callback matching
            smsuse: 'n', // No SMS for agent transactions
            memo: memo || `JSONMart Order ${order_id}`,
            linkkey: PAYAPP_LINKKEY,
        });

        // Call PayApp API
        const payappRes = await fetch(PAYAPP_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString(),
        });

        const resText = await payappRes.text();
        const resParams = new URLSearchParams(resText);

        const state = resParams.get('state');
        const errorMessage = resParams.get('errorMessage');
        const mul_no = resParams.get('mul_no');
        const payurl = resParams.get('payurl');

        if (state !== '1') {
            return new Response(
                JSON.stringify({
                    error: 'PayApp request failed',
                    errorMessage: errorMessage || 'Unknown error',
                    errno: resParams.get('errno'),
                }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Store mul_no in orders table for callback matching
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        await supabase
            .from('orders')
            .update({
                payment_status: 'PAYMENT_REQUESTED',
                payapp_mul_no: mul_no,
                payapp_payurl: payurl,
            })
            .eq('order_id', order_id);

        return new Response(
            JSON.stringify({
                success: true,
                mul_no,
                payurl,
                order_id,
                message: 'Payment request created. Awaiting payment completion.',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
