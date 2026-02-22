// supabase/functions/payapp-feedback/index.ts
// Supabase Edge Function: PayApp 결제 완료 콜백 수신
// Deploy: supabase functions deploy payapp-feedback

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req: Request) => {
    try {
        // PayApp sends callback as POST with form-urlencoded data
        const body = await req.text();
        const params = new URLSearchParams(body);

        const mul_no = params.get('mul_no');
        const pay_state = params.get('pay_state'); // 1: 요청, 2: 결제완료, 4: 취소, 8: 환불
        const pay_date = params.get('pay_date');
        const price = params.get('price');
        const goodname = params.get('goodname');
        const var1 = params.get('var1'); // order_id
        const linkval = params.get('linkval');
        const pay_type = params.get('pay_type'); // card, phone, bank, etc.
        const recvphone = params.get('recvphone');

        // Validate linkval to prevent forgery
        const PAYAPP_LINKVAL = Deno.env.get('PAYAPP_LINKVAL')!;
        if (linkval !== PAYAPP_LINKVAL) {
            console.error('Invalid linkval - potential forgery attempt:', { mul_no, linkval });
            return new Response('FAIL', { status: 403 });
        }

        // Create Supabase client with service role
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Find order by mul_no or var1 (order_id)
        let orderQuery = supabase.from('orders').select('*');
        if (var1) {
            orderQuery = orderQuery.eq('order_id', var1);
        } else if (mul_no) {
            orderQuery = orderQuery.eq('payapp_mul_no', mul_no);
        } else {
            console.error('No order identifier in callback');
            return new Response('FAIL', { status: 400 });
        }

        const { data: order, error: findError } = await orderQuery.single();

        if (findError || !order) {
            console.error('Order not found:', { mul_no, var1, error: findError });
            return new Response('FAIL', { status: 404 });
        }

        // Validate payment amount matches order amount
        const paidPrice = Number(price);
        if (paidPrice !== order.authorized_amount) {
            console.error('Amount mismatch:', {
                expected: order.authorized_amount,
                received: paidPrice,
                mul_no,
            });
            // Still update but flag the discrepancy
        }

        // Map PayApp pay_state to our payment status
        let paymentStatus: string;
        let orderStatus: string;
        switch (pay_state) {
            case '2': // 결제완료
                paymentStatus = 'CAPTURED';
                orderStatus = 'CONFIRMED';
                break;
            case '4': // 취소
                paymentStatus = 'VOIDED';
                orderStatus = 'CANCELLED';
                break;
            case '8': // 환불
                paymentStatus = 'REFUNDED';
                orderStatus = 'CANCELLED';
                break;
            case '1': // 요청 (결제 대기)
                paymentStatus = 'PAYMENT_REQUESTED';
                orderStatus = order.status; // Keep current status
                break;
            default:
                paymentStatus = 'UNKNOWN';
                orderStatus = order.status;
        }

        // Update order in database
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                payment_status: paymentStatus,
                status: orderStatus,
                payapp_mul_no: mul_no,
                payapp_pay_type: pay_type,
                payapp_pay_date: pay_date,
                payapp_recvphone: recvphone,
                updated_at: new Date().toISOString(),
            })
            .eq('order_id', order.order_id);

        if (updateError) {
            console.error('Failed to update order:', updateError);
            return new Response('FAIL', { status: 500 });
        }

        console.log(`✅ Payment callback processed: order=${order.order_id}, state=${pay_state}, status=${paymentStatus}`);

        // PayApp expects "SUCCESS" response to confirm receipt
        return new Response('SUCCESS', {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
        });

    } catch (error) {
        console.error('Feedback processing error:', error);
        return new Response('FAIL', { status: 500 });
    }
});
