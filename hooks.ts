import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { ProductPack, Order, AgentReview } from './types';

// ---- Helpers: DB row → Frontend type ----

function rowToProduct(row: any): ProductPack {
    return {
        sku: row.sku,
        category: row.category,
        title: row.title,
        identifiers: { brand: row.brand, gtin: row.gtin || undefined },
        offer: {
            price: row.price,
            currency: row.currency,
            stockStatus: row.stock_status,
            stockQty: row.stock_qty ?? undefined,
            shipByDays: row.ship_by_days,
            etaDays: row.eta_days,
        },
        policies: {
            returnDays: row.return_days,
            returnFee: row.return_fee,
            returnExceptions: row.return_exceptions || [],
        },
        qualitySignals: {
            aiReadinessScore: row.ai_readiness_score,
            sellerTrust: row.seller_trust,
        },
        attributes: row.attributes || {},
        sourcingType: row.sourcing_type,
    };
}

function rowToOrder(row: any): Order {
    return {
        orderId: row.order_id,
        createdAt: row.created_at,
        status: row.status,
        items: row.items || [],
        payment: {
            status: row.payment_status,
            authorizedAmount: row.authorized_amount,
            captureDeadline: row.capture_deadline,
        },
        risks: {
            stock: row.risk_stock,
            price: row.risk_price,
            policy: row.risk_policy,
            consent: row.risk_consent,
            timeLeft: row.risk_time_left,
        },
        consent: {
            thirdPartySharing: row.third_party_sharing,
        },
    };
}

function rowToReview(row: any): AgentReview {
    return {
        reviewId: row.review_id,
        targetSku: row.target_sku,
        reviewerAgentId: row.reviewer_agent_id,
        timestamp: row.created_at,
        metrics: {
            fulfillmentDelta: row.fulfillment_delta,
            specCompliance: row.spec_compliance,
            apiLatencyMs: row.api_latency_ms,
        },
        structuredLog: row.structured_log || [],
        verdict: row.verdict,
    };
}

// ---- Hooks ----

export function useProducts() {
    const [products, setProducts] = useState<ProductPack[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching products:', error);
        } else {
            setProducts((data || []).map(rowToProduct));
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    const addProduct = async (product: ProductPack) => {
        const { error } = await supabase.from('products').insert({
            sku: product.sku,
            category: product.category,
            title: product.title,
            brand: product.identifiers.brand,
            gtin: product.identifiers.gtin || null,
            price: product.offer.price,
            currency: product.offer.currency,
            stock_status: product.offer.stockStatus,
            stock_qty: product.offer.stockQty ?? null,
            ship_by_days: product.offer.shipByDays,
            eta_days: product.offer.etaDays,
            return_days: product.policies.returnDays,
            return_fee: product.policies.returnFee,
            return_exceptions: product.policies.returnExceptions,
            ai_readiness_score: product.qualitySignals.aiReadinessScore,
            seller_trust: product.qualitySignals.sellerTrust,
            attributes: product.attributes,
            sourcing_type: product.sourcingType || 'HUMAN',
        });

        if (error) {
            console.error('Error adding product:', error);
            return false;
        }
        await fetchProducts();
        return true;
    };

    return { products, loading, fetchProducts, addProduct };
}

export function useOrders() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching orders:', error);
        } else {
            setOrders((data || []).map(rowToOrder));
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const createOrder = async (order: {
        orderId: string;
        status: string;
        items: any[];
        paymentStatus: string;
        authorizedAmount: number;
        captureDeadline: string;
        risks: any;
        thirdPartySharing: boolean;
        decisionTrace?: any;
    }) => {
        const { error } = await supabase.from('orders').insert({
            order_id: order.orderId,
            status: order.status,
            items: order.items,
            payment_status: order.paymentStatus,
            authorized_amount: order.authorizedAmount,
            capture_deadline: order.captureDeadline,
            risk_stock: order.risks.stock,
            risk_price: order.risks.price,
            risk_policy: order.risks.policy,
            risk_consent: order.risks.consent,
            risk_time_left: order.risks.timeLeft,
            third_party_sharing: order.thirdPartySharing,
            decision_trace: order.decisionTrace || {},
        });

        if (error) {
            console.error('Error creating order:', error);
            return false;
        }
        await fetchOrders();
        return true;
    };

    const updateOrderStatus = async (orderId: string, status: string, paymentStatus?: string) => {
        const updates: any = { status, updated_at: new Date().toISOString() };
        if (paymentStatus) updates.payment_status = paymentStatus;

        const { error } = await supabase
            .from('orders')
            .update(updates)
            .eq('order_id', orderId);

        if (error) {
            console.error('Error updating order:', error);
            return false;
        }
        await fetchOrders();
        return true;
    };

    return { orders, loading, fetchOrders, createOrder, updateOrderStatus };
}

export function useReviews(targetSku?: string) {
    const [reviews, setReviews] = useState<AgentReview[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchReviews = useCallback(async () => {
        setLoading(true);
        let query = supabase
            .from('agent_reviews')
            .select('*')
            .order('created_at', { ascending: false });

        if (targetSku) {
            query = query.eq('target_sku', targetSku);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching reviews:', error);
        } else {
            setReviews((data || []).map(rowToReview));
        }
        setLoading(false);
    }, [targetSku]);

    useEffect(() => { fetchReviews(); }, [fetchReviews]);

    const addReview = async (review: AgentReview) => {
        const { error } = await supabase.from('agent_reviews').insert({
            review_id: review.reviewId,
            target_sku: review.targetSku,
            reviewer_agent_id: review.reviewerAgentId,
            fulfillment_delta: review.metrics.fulfillmentDelta,
            spec_compliance: review.metrics.specCompliance,
            api_latency_ms: review.metrics.apiLatencyMs,
            structured_log: review.structuredLog,
            verdict: review.verdict,
        });

        if (error) {
            console.error('Error adding review:', error);
            return false;
        }
        await fetchReviews();
        return true;
    };

    return { reviews, loading, fetchReviews, addReview };
}

// ---- Agent type ----

export interface Agent {
    id: string;
    agentId: string;
    name: string;
    ownerId: string | null;
    apiKey: string | null;
    status: 'ACTIVE' | 'REVOKED' | 'PENDING_APPROVAL';
    policyId: string | null;
    capabilities: string[];
    contactUri: string | null;
    totalOrders: number;
    totalReviews: number;
    lastActiveAt: string | null;
    createdAt: string;
}

function generateApiKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'agk_';
    for (let i = 0; i < 32; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
}

function rowToAgent(row: any): Agent {
    return {
        id: row.id,
        agentId: row.agent_id,
        name: row.name,
        ownerId: row.owner_id || null,
        apiKey: row.api_key || null,
        status: row.status,
        policyId: row.policy_id,
        capabilities: row.capabilities || [],
        contactUri: row.contact_uri || null,
        totalOrders: row.total_orders || 0,
        totalReviews: row.total_reviews || 0,
        lastActiveAt: row.last_active_at,
        createdAt: row.created_at,
    };
}

export function useAgents(ownerId?: string) {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [pendingAgents, setPendingAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAgents = useCallback(async () => {
        setLoading(true);
        let query = supabase
            .from('agents')
            .select('*')
            .order('created_at', { ascending: false });

        if (ownerId) {
            query = query.eq('owner_id', ownerId);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching agents:', error);
        } else {
            setAgents((data || []).map(rowToAgent));
        }
        setLoading(false);
    }, [ownerId]);

    useEffect(() => { fetchAgents(); }, [fetchAgents]);

    const fetchPendingAgents = useCallback(async () => {
        const { data, error } = await supabase
            .from('agents')
            .select('*')
            .eq('status', 'PENDING_APPROVAL')
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching pending agents:', error);
        } else {
            setPendingAgents((data || []).map(rowToAgent));
        }
    }, []);

    useEffect(() => { fetchPendingAgents(); }, [fetchPendingAgents]);

    const approveAgent = async (agentId: string) => {
        const { data, error } = await supabase.rpc('approve_pending_agent', { p_agent_id: agentId });
        if (error) {
            console.error('Error approving agent:', error);
            return null;
        }
        await fetchPendingAgents();
        await fetchAgents();
        return data;
    };

    const rejectAgent = async (agentId: string) => {
        const { data, error } = await supabase.rpc('reject_pending_agent', { p_agent_id: agentId });
        if (error) {
            console.error('Error rejecting agent:', error);
            return null;
        }
        await fetchPendingAgents();
        return data;
    };

    const createAgent = async (name: string, ownerId: string, policyId?: string) => {
        const agentId = `AGT-${Date.now().toString(36).toUpperCase()}`;
        const apiKey = generateApiKey();

        const { error } = await supabase.from('agents').insert({
            agent_id: agentId,
            name,
            owner_id: ownerId,
            api_key: apiKey,
            status: 'ACTIVE',
            policy_id: policyId || null,
        });

        if (error) {
            console.error('Error creating agent:', error);
            return null;
        }
        await fetchAgents();
        return { agentId, apiKey };
    };

    const revokeAgent = async (agentId: string) => {
        const { error } = await supabase
            .from('agents')
            .update({ status: 'REVOKED', updated_at: new Date().toISOString() })
            .eq('agent_id', agentId);

        if (error) {
            console.error('Error revoking agent:', error);
            return false;
        }
        await fetchAgents();
        return true;
    };

    const activateAgent = async (agentId: string) => {
        const { error } = await supabase
            .from('agents')
            .update({ status: 'ACTIVE', updated_at: new Date().toISOString() })
            .eq('agent_id', agentId);

        if (error) {
            console.error('Error activating agent:', error);
            return false;
        }
        await fetchAgents();
        return true;
    };

    const regenerateKey = async (agentId: string) => {
        const newKey = generateApiKey();
        const { error } = await supabase
            .from('agents')
            .update({ api_key: newKey, updated_at: new Date().toISOString() })
            .eq('agent_id', agentId);

        if (error) {
            console.error('Error regenerating key:', error);
            return null;
        }
        await fetchAgents();
        return newKey;
    };

    const deleteAgent = async (agentId: string) => {
        const { error } = await supabase
            .from('agents')
            .delete()
            .eq('agent_id', agentId);

        if (error) {
            console.error('Error deleting agent:', error);
            return false;
        }
        await fetchAgents();
        return true;
    };

    const linkPolicy = async (agentId: string, policyId: string | null) => {
        const { error } = await supabase
            .from('agents')
            .update({ policy_id: policyId, updated_at: new Date().toISOString() })
            .eq('agent_id', agentId);

        if (error) {
            console.error('Error linking policy:', error);
            return false;
        }
        await fetchAgents();
        return true;
    };

    return { agents, pendingAgents, loading, fetchAgents, fetchPendingAgents, createAgent, revokeAgent, activateAgent, regenerateKey, deleteAgent, linkPolicy, approveAgent, rejectAgent };
}

// ---- Policies hook ----

export interface AgentPolicy {
    id: string;
    policyId: string;
    userId: string | null;
    maxBudget: number;
    allowedCategories: string[];
    maxDeliveryDays: number;
    minSellerTrust: number;
    createdAt: string;
}

function rowToPolicy(row: any): AgentPolicy {
    return {
        id: row.id,
        policyId: row.policy_id,
        userId: row.user_id,
        maxBudget: row.max_budget || 0,
        allowedCategories: row.allowed_categories || ['CONSUMABLES', 'MRO'],
        maxDeliveryDays: row.max_delivery_days || 5,
        minSellerTrust: row.min_seller_trust || 70,
        createdAt: row.created_at,
    };
}

export function usePolicies() {
    const [policies, setPolicies] = useState<AgentPolicy[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPolicies = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('agent_policies')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching policies:', error);
        } else {
            setPolicies((data || []).map(rowToPolicy));
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

    const createPolicy = async (policy: {
        policyId: string;
        maxBudget: number;
        allowedCategories: string[];
        maxDeliveryDays: number;
        minSellerTrust: number;
    }) => {
        const { data, error } = await supabase
            .from('agent_policies')
            .insert({
                policy_id: policy.policyId,
                max_budget: policy.maxBudget,
                allowed_categories: policy.allowedCategories,
                max_delivery_days: policy.maxDeliveryDays,
                min_seller_trust: policy.minSellerTrust,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating policy:', error);
            return null;
        }
        await fetchPolicies();
        return rowToPolicy(data);
    };

    const updatePolicy = async (policyId: string, updates: {
        maxBudget?: number;
        allowedCategories?: string[];
        maxDeliveryDays?: number;
        minSellerTrust?: number;
    }) => {
        const updateData: any = { updated_at: new Date().toISOString() };
        if (updates.maxBudget !== undefined) updateData.max_budget = updates.maxBudget;
        if (updates.allowedCategories !== undefined) updateData.allowed_categories = updates.allowedCategories;
        if (updates.maxDeliveryDays !== undefined) updateData.max_delivery_days = updates.maxDeliveryDays;
        if (updates.minSellerTrust !== undefined) updateData.min_seller_trust = updates.minSellerTrust;

        const { error } = await supabase
            .from('agent_policies')
            .update(updateData)
            .eq('policy_id', policyId);

        if (error) {
            console.error('Error updating policy:', error);
            return false;
        }
        await fetchPolicies();
        return true;
    };

    const deletePolicy = async (policyId: string) => {
        const { error } = await supabase
            .from('agent_policies')
            .delete()
            .eq('policy_id', policyId);

        if (error) {
            console.error('Error deleting policy:', error);
            return false;
        }
        await fetchPolicies();
        return true;
    };

    return { policies, loading, fetchPolicies, createPolicy, updatePolicy, deletePolicy };
}

