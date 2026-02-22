/**
 * PayApp PG Integration Service
 * Client-side module for interacting with PayApp via Supabase Edge Functions
 */
import { supabase } from './supabaseClient';

// Supabase Edge Function URLs
const getEdgeFunctionUrl = (name: string) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    return `${supabaseUrl}/functions/v1/${name}`;
};

export interface PaymentRequest {
    orderId: string;
    price: number;
    goodname: string;
    recvphone?: string;
    memo?: string;
}

export interface PaymentResponse {
    success: boolean;
    mul_no?: string;
    payurl?: string;
    order_id?: string;
    error?: string;
    errorMessage?: string;
}

/**
 * Request payment via PayApp through Supabase Edge Function
 * Called after agent creates an order to initiate payment
 */
export async function requestPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
        const res = await fetch(getEdgeFunctionUrl('payapp-request'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                order_id: request.orderId,
                price: request.price,
                goodname: request.goodname,
                recvphone: request.recvphone || '01000000000',
                memo: request.memo,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            return {
                success: false,
                error: data.error || 'Payment request failed',
                errorMessage: data.errorMessage,
            };
        }

        return {
            success: true,
            mul_no: data.mul_no,
            payurl: data.payurl,
            order_id: data.order_id,
        };
    } catch (error: any) {
        return {
            success: false,
            error: 'Network error',
            errorMessage: error.message,
        };
    }
}

/**
 * Check payment status for an order
 */
export async function checkPaymentStatus(orderId: string): Promise<{
    paymentStatus: string;
    mulNo: string | null;
    payurl: string | null;
    payType: string | null;
    payDate: string | null;
}> {
    const { data, error } = await supabase
        .from('orders')
        .select('payment_status, payapp_mul_no, payapp_payurl, payapp_pay_type, payapp_pay_date')
        .eq('order_id', orderId)
        .single();

    if (error || !data) {
        return { paymentStatus: 'UNKNOWN', mulNo: null, payurl: null, payType: null, payDate: null };
    }

    return {
        paymentStatus: data.payment_status,
        mulNo: data.payapp_mul_no,
        payurl: data.payapp_payurl,
        payType: data.payapp_pay_type,
        payDate: data.payapp_pay_date,
    };
}

/**
 * Cancel payment via PayApp through Supabase Edge Function
 * Phase 2: To be implemented
 */
export async function cancelPayment(_orderId: string, _reason?: string): Promise<{ success: boolean; error?: string }> {
    // TODO: Implement via payapp-cancel Edge Function
    return { success: false, error: 'Not implemented yet' };
}
