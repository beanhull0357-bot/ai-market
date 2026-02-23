import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { ProductPack, Order, AgentReview, Seller, SellerUpload } from './types';

// ---- Input Validation Helpers ----

/** Sanitize string input: trim, enforce max length, strip control characters */
function sanitizeString(input: string, maxLength: number = 500): string {
    return input.trim().slice(0, maxLength).replace(/[\x00-\x1F\x7F]/g, '');
}

/** Validate positive integer */
function validatePositiveInt(value: number, fieldName: string): number {
    const n = Math.floor(value);
    if (!Number.isFinite(n) || n < 0) {
        throw new Error(`${fieldName} must be a non-negative integer`);
    }
    return n;
}

/** Validate ID format (alphanumeric, dashes, underscores) */
function validateId(id: string, fieldName: string): string {
    const sanitized = id.trim();
    if (!sanitized || sanitized.length > 100 || !/^[a-zA-Z0-9_\-]+$/.test(sanitized)) {
        throw new Error(`Invalid ${fieldName} format`);
    }
    return sanitized;
}
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
        // ━━━ Enhanced Product Data ━━━
        certifications: row.certifications || undefined,
        dimensions: row.dimensions || undefined,
        weightG: row.weight_g ?? undefined,
        minOrderQty: row.min_order_qty ?? undefined,
        bulkPricing: row.bulk_pricing || undefined,
        substitutes: row.substitutes || undefined,
        restockEta: row.restock_eta || undefined,
        carbonFootprintG: row.carbon_footprint_g ?? undefined,
        sellerId: row.seller_id || undefined,
        sellerName: row.seller_name || undefined,
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
        // Validate inputs before sending to DB
        const sku = sanitizeString(product.sku, 50);
        const title = sanitizeString(product.title, 200);
        const price = validatePositiveInt(product.offer.price, 'price');
        const stockQty = product.offer.stockQty != null ? validatePositiveInt(product.offer.stockQty, 'stockQty') : null;

        if (!sku || !title) {
            console.error('SKU and title are required');
            return false;
        }

        const { error } = await supabase.from('products').insert({
            sku,
            category: sanitizeString(product.category, 50),
            title,
            brand: sanitizeString(product.identifiers.brand, 100),
            gtin: product.identifiers.gtin ? sanitizeString(product.identifiers.gtin, 50) : null,
            price,
            currency: sanitizeString(product.offer.currency, 10),
            stock_status: product.offer.stockStatus,
            stock_qty: stockQty,
            ship_by_days: validatePositiveInt(product.offer.shipByDays, 'shipByDays'),
            eta_days: validatePositiveInt(product.offer.etaDays, 'etaDays'),
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
        const validId = validateId(agentId, 'agentId');
        const { data, error } = await supabase.rpc('approve_pending_agent', { p_agent_id: validId });
        if (error) {
            console.error('Error approving agent:', error);
            return null;
        }
        await fetchPendingAgents();
        await fetchAgents();
        return data;
    };

    const rejectAgent = async (agentId: string) => {
        const validId = validateId(agentId, 'agentId');
        const { data, error } = await supabase.rpc('reject_pending_agent', { p_agent_id: validId });
        if (error) {
            console.error('Error rejecting agent:', error);
            return null;
        }
        await fetchPendingAgents();
        return data;
    };

    const createAgent = async (name: string, ownerId: string, policyId?: string) => {
        const validName = sanitizeString(name, 100);
        const validOwnerId = validateId(ownerId, 'ownerId');
        if (!validName) {
            console.error('Agent name is required');
            return null;
        }
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

// ---- Agent Q&A hook ----
import { AgentQuestion, QuestionStatus } from './types';

export interface AgentQuestionRow {
    ticket_id: string;
    agent_id: string;
    sku: string | null;
    category: string;
    question: string;
    status: string;
    answer: string | null;
    structured_data: any;
    answered_by: string | null;
    created_at: string;
    answered_at: string | null;
}

function rowToQuestion(row: AgentQuestionRow): AgentQuestion {
    return {
        ticketId: row.ticket_id,
        agentId: row.agent_id,
        sku: row.sku,
        category: row.category as AgentQuestion['category'],
        question: row.question,
        status: row.status as QuestionStatus,
        answer: row.answer,
        structuredData: row.structured_data || {},
        answeredBy: row.answered_by as AgentQuestion['answeredBy'],
        createdAt: row.created_at,
        answeredAt: row.answered_at,
    };
}

export function useAgentQuestions(filterStatus?: QuestionStatus) {
    const [questions, setQuestions] = useState<AgentQuestion[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchQuestions = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('agent_questions')
                .select('*')
                .order('created_at', { ascending: false });

            if (filterStatus) {
                query = query.eq('status', filterStatus);
            }

            const { data, error } = await query;
            if (error) throw error;
            setQuestions((data || []).map(rowToQuestion));
        } catch (err) {
            console.error('Failed to fetch questions:', err);
        } finally {
            setLoading(false);
        }
    }, [filterStatus]);

    useEffect(() => {
        fetchQuestions();

        // Realtime subscription
        const channel = supabase
            .channel('agent_questions_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_questions' }, () => {
                fetchQuestions();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchQuestions]);

    const answerQuestion = async (ticketId: string, answer: string, structuredData: Record<string, any> = {}) => {
        try {
            const { error } = await supabase
                .from('agent_questions')
                .update({
                    answer: sanitizeString(answer, 2000),
                    structured_data: structuredData,
                    status: 'ANSWERED',
                    answered_by: 'ADMIN',
                    answered_at: new Date().toISOString(),
                })
                .eq('ticket_id', ticketId);

            if (error) throw error;
            await fetchQuestions();
            return true;
        } catch (err) {
            console.error('Failed to answer question:', err);
            return false;
        }
    };

    const closeQuestion = async (ticketId: string) => {
        try {
            const { error } = await supabase
                .from('agent_questions')
                .update({ status: 'CLOSED' })
                .eq('ticket_id', ticketId);

            if (error) throw error;
            await fetchQuestions();
            return true;
        } catch (err) {
            console.error('Failed to close question:', err);
            return false;
        }
    };

    return { questions, loading, fetchQuestions, answerQuestion, closeQuestion };
}

// ━━━ A2A Protocol Hooks ━━━

export function useA2AQueries(status: string = 'OPEN', sku?: string) {
    const [queries, setQueries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchQueries = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_a2a_queries', {
                p_status: status || null,
                p_sku: sku || null,
                p_query_type: null,
                p_limit: 50,
            });
            if (error) throw error;
            if (data?.queries) {
                setQueries(data.queries);
            }
        } catch (err) {
            console.error('Failed to fetch A2A queries:', err);
        } finally {
            setLoading(false);
        }
    }, [status, sku]);

    useEffect(() => { fetchQueries(); }, [fetchQueries]);

    return { queries, loading, fetchQueries };
}

export async function broadcastA2AQuery(
    apiKey: string,
    queryType: string,
    sku: string | null,
    question: string,
    scope: string = 'PUBLIC',
    ttlHours: number = 24
) {
    const { data, error } = await supabase.rpc('agent_broadcast_query', {
        p_api_key: apiKey,
        p_query_type: queryType,
        p_sku: sku || null,
        p_question: sanitizeString(question, 1000),
        p_scope: scope,
        p_ttl_hours: ttlHours,
    });
    if (error) throw error;
    return data;
}

export async function respondToA2AQuery(
    apiKey: string,
    queryId: string,
    verdict: string,
    confidence: number,
    evidence: Record<string, any>,
    message: string | null
) {
    const { data, error } = await supabase.rpc('agent_respond_query', {
        p_api_key: apiKey,
        p_query_id: queryId,
        p_verdict: verdict,
        p_confidence: confidence,
        p_evidence: evidence,
        p_message: message ? sanitizeString(message, 1000) : null,
    });
    if (error) throw error;
    return data;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SELLER MARKETPLACE HOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function rowToSeller(row: any): Seller {
    return {
        sellerId: row.seller_id,
        email: row.email,
        businessName: row.business_name,
        representative: row.representative,
        businessNumber: row.business_number || undefined,
        phone: row.phone || undefined,
        categoryTags: row.category_tags || [],
        trustScore: row.trust_score || 0,
        totalProducts: row.total_products || 0,
        totalSales: row.total_sales || 0,
        totalRevenue: row.total_revenue || 0,
        avgShipDays: row.avg_ship_days || 0,
        returnRate: row.return_rate || 0,
        status: row.status,
        commissionRate: row.commission_rate || 10,
        settlementCycle: row.settlement_cycle || 'MONTHLY',
        bankName: row.bank_name || undefined,
        bankAccount: row.bank_account || undefined,
        createdAt: row.created_at,
    };
}

export function useSellers() {
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSellers = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.from('sellers').select('*').order('created_at', { ascending: false });
        if (!error && data) setSellers(data.map(rowToSeller));
        setLoading(false);
    }, []);

    useEffect(() => { fetchSellers(); }, [fetchSellers]);

    return { sellers, loading, refetch: fetchSellers };
}

export async function registerSeller(
    email: string, businessName: string, representative: string,
    businessNumber?: string, phone?: string, categoryTags?: string[]
) {
    const { data, error } = await supabase.rpc('seller_register', {
        p_email: sanitizeString(email, 200),
        p_business_name: sanitizeString(businessName, 200),
        p_representative: sanitizeString(representative, 100),
        p_business_number: businessNumber ? sanitizeString(businessNumber, 20) : null,
        p_phone: phone ? sanitizeString(phone, 20) : null,
        p_category_tags: categoryTags || [],
    });
    if (error) throw error;
    return data;
}

export async function sellerAuth(apiKey: string) {
    const { data, error } = await supabase.rpc('seller_auth', { p_api_key: apiKey });
    if (error) throw error;
    return data;
}

export async function uploadSellerProducts(apiKey: string, fileName: string, products: any[]) {
    const { data, error } = await supabase.rpc('seller_upload_products', {
        p_api_key: apiKey,
        p_file_name: sanitizeString(fileName, 200),
        p_products: products,
    });
    if (error) throw error;
    return data;
}

export async function getSellerDashboard(apiKey: string) {
    const { data, error } = await supabase.rpc('seller_dashboard_stats', { p_api_key: apiKey });
    if (error) throw error;
    return data;
}

export async function getSellerProducts(apiKey: string, category?: string, search?: string) {
    const { data, error } = await supabase.rpc('get_seller_products', {
        p_api_key: apiKey,
        p_category: category || null,
        p_search: search || null,
    });
    if (error) throw error;
    return data;
}

export async function updateSellerStatus(sellerId: string, status: string) {
    const { error } = await supabase.from('sellers').update({ status, updated_at: new Date().toISOString() }).eq('seller_id', sellerId);
    if (error) throw error;
}

// ━━━ Seller Product CRUD ━━━
export async function addSellerProduct(apiKey: string, product: any) {
    // Use the upload function with a single product
    const { data, error } = await supabase.rpc('seller_upload_products', {
        p_api_key: apiKey,
        p_file_name: 'manual_entry',
        p_products: [product],
    });
    if (error) throw error;
    return data;
}

export async function updateSellerProduct(apiKey: string, sku: string, updates: any) {
    // Authenticate seller first
    const auth = await sellerAuth(apiKey);
    if (!auth?.success) throw new Error('Authentication failed');
    const sellerId = auth.seller_id;

    const { error } = await supabase.from('products')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('sku', sku)
        .eq('seller_id', sellerId);
    if (error) throw error;
    return { success: true };
}

export async function deleteSellerProduct(apiKey: string, sku: string) {
    const auth = await sellerAuth(apiKey);
    if (!auth?.success) throw new Error('Authentication failed');
    const sellerId = auth.seller_id;

    const { error } = await supabase.from('products')
        .delete()
        .eq('sku', sku)
        .eq('seller_id', sellerId);
    if (error) throw error;
    return { success: true };
}

// ━━━ Seller Order Management ━━━
export async function getSellerOrders(apiKey: string, status?: string) {
    const auth = await sellerAuth(apiKey);
    if (!auth?.success) throw new Error('Authentication failed');
    const sellerId = auth.seller_id;

    let query = supabase.from('orders')
        .select('*')
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false });

    if (status && status !== 'all') {
        query = query.eq('procurement_status', status);
    }

    const { data, error } = await query;
    if (error) {
        // If seller_id column doesn't exist, return demo data
        return { success: true, orders: [], total: 0 };
    }
    return { success: true, orders: data || [], total: data?.length || 0 };
}

export async function updateOrderShipment(apiKey: string, orderId: string, carrier: string, trackingNumber: string) {
    const auth = await sellerAuth(apiKey);
    if (!auth?.success) throw new Error('Authentication failed');

    const { error } = await supabase.from('orders')
        .update({
            procurement_status: 'shipped',
            carrier,
            tracking_number: trackingNumber,
            shipped_at: new Date().toISOString(),
        })
        .eq('id', orderId);
    if (error) throw error;
    return { success: true };
}

export async function handleReturnRequest(apiKey: string, orderId: string, action: 'approve' | 'reject') {
    const auth = await sellerAuth(apiKey);
    if (!auth?.success) throw new Error('Authentication failed');

    const newStatus = action === 'approve' ? 'returned' : 'delivered';
    const { error } = await supabase.from('orders')
        .update({ procurement_status: newStatus })
        .eq('id', orderId);
    if (error) throw error;
    return { success: true };
}

// ━━━ Seller Settlement ━━━
export async function getSellerSettlements(apiKey: string) {
    const auth = await sellerAuth(apiKey);
    if (!auth?.success) throw new Error('Authentication failed');
    // Return demo settlement data (real data would come from a settlements table)
    return {
        success: true,
        settlements: [],
        summary: {
            totalSales: auth.total_revenue || 0,
            commission: Math.round((auth.total_revenue || 0) * (auth.commission_rate || 10) / 100),
            netPayout: Math.round((auth.total_revenue || 0) * (1 - (auth.commission_rate || 10) / 100)),
            pendingPayout: 0,
        }
    };
}

// ━━━ Seller Profile Update ━━━
export async function updateSellerProfile(apiKey: string, updates: any) {
    const auth = await sellerAuth(apiKey);
    if (!auth?.success) throw new Error('Authentication failed');
    const sellerId = auth.seller_id;

    const { error } = await supabase.from('sellers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('seller_id', sellerId);
    if (error) throw error;
    return { success: true };
}

// ━━━ Admin: Update Seller Commission ━━━
export async function updateSellerCommission(sellerId: string, commissionRate: number) {
    const { error } = await supabase.from('sellers')
        .update({ commission_rate: commissionRate, updated_at: new Date().toISOString() })
        .eq('seller_id', sellerId);
    if (error) throw error;
    return { success: true };
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WALLET & PAYMENT HOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getWalletInfo(apiKey: string) {
    const { data, error } = await supabase.rpc('get_wallet_info', { p_api_key: apiKey });
    if (error) throw error;
    return data;
}

export async function walletDeposit(apiKey: string, amount: number, description?: string) {
    const { data, error } = await supabase.rpc('wallet_deposit', {
        p_api_key: apiKey, p_amount: amount, p_description: description || 'Manual deposit',
    });
    if (error) throw error;
    return data;
}

export async function walletSpend(apiKey: string, amount: number, orderId?: string) {
    const { data, error } = await supabase.rpc('wallet_spend', {
        p_api_key: apiKey, p_amount: amount, p_order_id: orderId || null,
    });
    if (error) throw error;
    return data;
}

export async function walletRefund(apiKey: string, orderId: string, amount?: number) {
    const { data, error } = await supabase.rpc('wallet_refund', {
        p_api_key: apiKey, p_order_id: orderId, p_amount: amount || 0,
    });
    if (error) throw error;
    return data;
}

export async function applyCoupon(apiKey: string, couponCode: string, orderAmount: number, orderId?: string) {
    const { data, error } = await supabase.rpc('apply_coupon', {
        p_api_key: apiKey, p_coupon_code: sanitizeString(couponCode, 50),
        p_order_amount: orderAmount, p_order_id: orderId || null,
    });
    if (error) throw error;
    return data;
}

export async function generateInvoice(apiKey: string, orderId: string, items: any[], couponCode?: string) {
    const { data, error } = await supabase.rpc('generate_invoice', {
        p_api_key: apiKey, p_order_id: orderId, p_items: items,
        p_coupon_code: couponCode || null,
    });
    if (error) throw error;
    return data;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COUPON HOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useCoupons() {
    const [coupons, setCoupons] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const fetchCoupons = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.from('agent_coupons').select('*').eq('is_active', true).order('created_at', { ascending: false });
        if (!error && data) setCoupons(data);
        setLoading(false);
    }, []);
    useEffect(() => { fetchCoupons(); }, [fetchCoupons]);
    return { coupons, loading, refetch: fetchCoupons };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USAGE TIER HOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useTiers() {
    const [tiers, setTiers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const fetchTiers = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.from('usage_tiers').select('*').order('sort_order');
        if (!error && data) setTiers(data);
        setLoading(false);
    }, []);
    useEffect(() => { fetchTiers(); }, [fetchTiers]);
    return { tiers, loading };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PREDICTION HOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function generatePredictions(apiKey: string) {
    const { data, error } = await supabase.rpc('generate_predictions', { p_api_key: apiKey });
    if (error) throw error;
    return data;
}

export function usePredictions(agentId?: string) {
    const [predictions, setPredictions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const fetchPredictions = useCallback(async () => {
        setLoading(true);
        let q = supabase.from('purchase_predictions').select('*').order('predicted_date');
        if (agentId) q = q.eq('agent_id', agentId);
        const { data, error } = await q;
        if (!error && data) setPredictions(data);
        setLoading(false);
    }, [agentId]);
    useEffect(() => { fetchPredictions(); }, [fetchPredictions]);
    return { predictions, loading, refetch: fetchPredictions };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUBLIC ANALYTICS HOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getPublicAnalytics() {
    const { data, error } = await supabase.rpc('get_public_analytics');
    if (error) throw error;
    return data;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INVOICE HOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useInvoices(agentId?: string) {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        let q = supabase.from('invoices').select('*').order('issued_at', { ascending: false });
        if (agentId) q = q.eq('agent_id', agentId);
        const { data, error } = await q;
        if (!error && data) setInvoices(data);
        setLoading(false);
    }, [agentId]);
    useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
    return { invoices, loading, refetch: fetchInvoices };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WORKFLOW HOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useWorkflows(agentId?: string) {
    const [workflows, setWorkflows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchWorkflows = useCallback(async () => {
        setLoading(true);
        let q = supabase
            .from('workflows')
            .select('*')
            .order('updated_at', { ascending: false });
        if (agentId) q = q.eq('agent_id', agentId);
        const { data, error } = await q;
        if (!error && data) setWorkflows(data);
        setLoading(false);
    }, [agentId]);

    useEffect(() => { fetchWorkflows(); }, [fetchWorkflows]);
    return { workflows, loading, refetch: fetchWorkflows };
}

export async function saveWorkflowToDB(workflow: {
    workflowId: string;
    name: string;
    nodes: any[];
    edges: any[];
    agentId?: string;
    lastSimResult?: any;
}) {
    const payload = {
        workflow_id: workflow.workflowId,
        name: sanitizeString(workflow.name, 200),
        nodes: workflow.nodes,
        edges: workflow.edges,
        agent_id: workflow.agentId || null,
        last_sim_result: workflow.lastSimResult || null,
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('workflows')
        .upsert(payload, { onConflict: 'workflow_id' })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteWorkflowFromDB(workflowId: string) {
    const { error } = await supabase
        .from('workflows')
        .delete()
        .eq('workflow_id', workflowId);
    if (error) throw error;
    return { success: true };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WEBHOOK HOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useWebhooks(agentId?: string) {
    const [webhooks, setWebhooks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchWebhooks = useCallback(async () => {
        setLoading(true);
        let q = supabase.from('webhook_configs').select('*').order('created_at', { ascending: false });
        if (agentId) q = q.eq('agent_id', agentId);
        const { data, error } = await q;
        if (!error && data) setWebhooks(data);
        setLoading(false);
    }, [agentId]);

    useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);
    return { webhooks, loading, refetch: fetchWebhooks };
}

export async function saveWebhook(payload: { agentId?: string; url: string; events: string[] }) {
    const { data, error } = await supabase
        .from('webhook_configs')
        .insert({ agent_id: payload.agentId || null, url: sanitizeString(payload.url, 500), events: payload.events })
        .select().single();
    if (error) throw error;
    return data;
}

export async function updateWebhook(id: string, patch: { active?: boolean; fail_count?: number; last_triggered?: string }) {
    const { error } = await supabase.from('webhook_configs').update(patch).eq('id', id);
    if (error) throw error;
}

export async function deleteWebhook(id: string) {
    const { error } = await supabase.from('webhook_configs').delete().eq('id', id);
    if (error) throw error;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTO REORDER HOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useAutoReorderRules(agentId?: string) {
    const [rules, setRules] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRules = useCallback(async () => {
        setLoading(true);
        let q = supabase.from('auto_reorder_rules').select('*').order('created_at', { ascending: false });
        if (agentId) q = q.eq('agent_id', agentId);
        const { data, error } = await q;
        if (!error && data) setRules(data);
        setLoading(false);
    }, [agentId]);

    useEffect(() => { fetchRules(); }, [fetchRules]);
    return { rules, loading, refetch: fetchRules };
}

export async function saveReorderRule(payload: {
    agentId: string; sku: string; productName: string;
    quantity: number; intervalDays: number; priceThreshold?: number | null;
}) {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + payload.intervalDays);

    const { data, error } = await supabase
        .from('auto_reorder_rules')
        .upsert({
            agent_id: payload.agentId,
            sku: payload.sku,
            product_name: sanitizeString(payload.productName, 200),
            quantity: payload.quantity,
            interval_days: payload.intervalDays,
            next_order_date: nextDate.toISOString().slice(0, 10),
            price_threshold: payload.priceThreshold || null,
            enabled: true,
        }, { onConflict: 'agent_id,sku' })
        .select().single();
    if (error) throw error;
    return data;
}

export async function toggleReorderRule(id: string, enabled: boolean) {
    const { error } = await supabase.from('auto_reorder_rules').update({ enabled }).eq('id', id);
    if (error) throw error;
}

export async function deleteReorderRule(id: string) {
    const { error } = await supabase.from('auto_reorder_rules').delete().eq('id', id);
    if (error) throw error;
}

export async function executeReorderRule(ruleId: string) {
    const { data, error } = await supabase.rpc('execute_reorder_rule', { p_rule_id: ruleId });
    if (error) throw error;
    return data;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROMOTIONS HOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function usePromotions() {
    const [promotions, setPromotions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPromotions = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('promotions').select('*').order('created_at', { ascending: false });
        if (!error && data) setPromotions(data);
        setLoading(false);
    }, []);

    useEffect(() => { fetchPromotions(); }, [fetchPromotions]);
    return { promotions, loading, refetch: fetchPromotions };
}

export async function savePromotion(payload: {
    name: string; type: string; value: number; minQty: number;
    categories: string[]; validFrom: string; validTo: string;
}) {
    const { data, error } = await supabase
        .from('promotions')
        .insert({
            name: sanitizeString(payload.name, 200),
            type: payload.type,
            value: payload.value,
            min_qty: payload.minQty,
            categories: payload.categories,
            valid_from: payload.validFrom,
            valid_to: payload.validTo,
            active: true,
        })
        .select().single();
    if (error) throw error;
    return data;
}

export async function togglePromotion(id: string, active: boolean) {
    const { error } = await supabase.from('promotions').update({ active }).eq('id', id);
    if (error) throw error;
}

export async function deletePromotion(id: string) {
    const { error } = await supabase.from('promotions').delete().eq('id', id);
    if (error) throw error;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NEGOTIATIONS HOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useNegotiations(agentId?: string) {
    const [negotiations, setNegotiations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchNegotiations = useCallback(async () => {
        setLoading(true);
        let q = supabase.from('negotiations').select('*').order('created_at', { ascending: false }).limit(50);
        if (agentId) q = q.eq('agent_id', agentId);
        const { data, error } = await q;
        if (!error && data) setNegotiations(data);
        setLoading(false);
    }, [agentId]);

    useEffect(() => { fetchNegotiations(); }, [fetchNegotiations]);
    return { negotiations, loading, refetch: fetchNegotiations };
}

export async function saveNegotiationToDB(neg: {
    negotiationId: string; agentId?: string; sku: string; productTitle: string;
    listPrice: number; finalPrice: number | null; policyBudget: number | null;
    buyerAgentId: string; sellerAgentId: string; status: string;
    rounds: any[]; maxRounds: number;
}) {
    const savingsPct = neg.finalPrice && neg.listPrice > 0
        ? ((1 - neg.finalPrice / neg.listPrice) * 100)
        : null;

    const { data, error } = await supabase
        .from('negotiations')
        .upsert({
            negotiation_id: neg.negotiationId,
            agent_id: neg.agentId || null,
            sku: neg.sku,
            product_title: sanitizeString(neg.productTitle, 200),
            list_price: neg.listPrice,
            final_price: neg.finalPrice,
            policy_budget: neg.policyBudget ? Math.round(neg.policyBudget) : null,
            buyer_agent_id: neg.buyerAgentId,
            seller_agent_id: neg.sellerAgentId,
            status: neg.status,
            rounds: neg.rounds,
            max_rounds: neg.maxRounds,
            savings_pct: savingsPct ? Math.round(savingsPct * 100) / 100 : null,
            completed_at: ['AGREED', 'REJECTED'].includes(neg.status) ? new Date().toISOString() : null,
        }, { onConflict: 'negotiation_id' })
        .select().single();
    if (error) throw error;
    return data;
}
