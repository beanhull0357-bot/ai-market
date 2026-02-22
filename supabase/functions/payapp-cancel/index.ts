// supabase/functions/payapp-cancel/index.ts
// Supabase Edge Function: PayApp 결제 취소
// Deploy: supabase functions deploy payapp-cancel

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYAPP_API_URL = 'https://api.payapp.kr/oapi/apiLoad.html';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { mul_no, cancelmemo } = await req.json();

        if (!mul_no) {
            return new Response(
                JSON.stringify({ error: 'Missing required field: mul_no' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const PAYAPP_USERID = Deno.env.get('PAYAPP_USERID')!;
        const PAYAPP_LINKKEY = Deno.env.get('PAYAPP_LINKKEY')!;

        const formData = new URLSearchParams({
            cmd: 'paycancel',
            userid: PAYAPP_USERID,
            linkkey: PAYAPP_LINKKEY,
            mul_no: String(mul_no),
            cancelmemo: cancelmemo || 'Test cancellation',
        });

        const payappRes = await fetch(PAYAPP_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString(),
        });

        const resText = await payappRes.text();
        const resParams = new URLSearchParams(resText);

        const state = resParams.get('state');
        const errorMessage = resParams.get('errorMessage');

        if (state !== '1') {
            return new Response(
                JSON.stringify({
                    error: 'Cancel failed',
                    errorMessage: errorMessage || 'Unknown error',
                    errno: resParams.get('errno'),
                }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Update order in DB
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        await supabase
            .from('orders')
            .update({ payment_status: 'VOIDED', status: 'CANCELLED', updated_at: new Date().toISOString() })
            .eq('payapp_mul_no', String(mul_no));

        return new Response(
            JSON.stringify({ success: true, mul_no, message: 'Payment cancelled successfully' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
