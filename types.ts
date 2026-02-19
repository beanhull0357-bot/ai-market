export type Category = 'CONSUMABLES' | 'MRO' | 'OFFICE' | 'IT_EQUIPMENT' | 'KITCHEN' | 'SAFETY' | 'HYGIENE';

export interface ProductPack {
  sku: string;
  category: Category;
  title: string;
  identifiers: {
    brand: string;
    gtin?: string;
  };
  offer: {
    price: number;
    currency: string;
    stockStatus: 'in_stock' | 'out_of_stock' | 'unknown';
    stockQty?: number;
    shipByDays: number;
    etaDays: number;
  };
  policies: {
    returnDays: number;
    returnFee: number;
    returnExceptions: string[];
  };
  qualitySignals: {
    aiReadinessScore: number;
    sellerTrust: number;
  };
  attributes: Record<string, any>;
  sourcingType?: 'HUMAN' | 'AI';
  // ━━━ Enhanced Product Data (Phase 1) ━━━
  certifications?: string[];              // e.g. ["KC인증", "ISO9001"]
  dimensions?: { w: number; h: number; d: number }; // cm
  weightG?: number;                        // weight in grams
  minOrderQty?: number;                    // minimum order quantity
  bulkPricing?: { minQty: number; discountPct: number }[];  // tiered pricing
  substitutes?: string[];                  // alternative product SKUs
  restockEta?: string;                     // ISO date string
  carbonFootprintG?: number;               // carbon footprint in grams CO2
  sellerId?: string;                        // seller reference
  sellerName?: string;                      // seller display name
}

export interface AgentPolicy {
  policyId: string;
  maxBudget: number;
  allowedCategories: Category[];
  maxDeliveryDays: number;
  minSellerTrust: number;
}

export type OrderStatus =
  | 'ORDER_CREATED'
  | 'PAYMENT_AUTHORIZED'
  | 'PROCUREMENT_PENDING'
  | 'PROCUREMENT_SENT'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'VOIDED';

export interface Order {
  orderId: string;
  createdAt: string;
  status: OrderStatus;
  items: {
    sku: string;
    qty: number;
    reasonCodes: string[];
  }[];
  payment: {
    status: 'AUTHORIZED' | 'CAPTURED' | 'VOIDED';
    authorizedAmount: number;
    captureDeadline: string; // ISO String
  };
  risks: {
    stock: 'GREEN' | 'YELLOW' | 'RED';
    price: 'GREEN' | 'YELLOW' | 'RED';
    policy: 'GREEN' | 'YELLOW' | 'RED';
    consent: 'GREEN' | 'RED';
    timeLeft: 'GREEN' | 'YELLOW' | 'RED';
  };
  consent: {
    thirdPartySharing: boolean;
  }
}

export type ReviewVerdict = 'ENDORSE' | 'WARN' | 'BLOCKLIST';

export interface AgentReview {
  reviewId: string;
  targetSku: string;
  reviewerAgentId: string; // e.g., "PROCURE-BOT-v2.1"
  timestamp: string;
  metrics: {
    fulfillmentDelta: number; // Hours difference from ETA
    specCompliance: number; // 0.0 - 1.0 (1.0 = perfect match)
    apiLatencyMs: number;
  };
  structuredLog: {
    event: string;
    level: 'INFO' | 'WARN' | 'ERROR';
    details: string;
  }[];
  verdict: ReviewVerdict;
}

export type QuestionCategory = 'SPEC' | 'COMPATIBILITY' | 'BULK_PRICING' | 'SHIPPING' | 'RESTOCK' | 'POLICY' | 'OTHER';
export type QuestionStatus = 'PENDING' | 'ANSWERED' | 'CLOSED';

export interface AgentQuestion {
  ticketId: string;
  agentId: string;
  sku: string | null;
  category: QuestionCategory;
  question: string;
  status: QuestionStatus;
  answer: string | null;
  structuredData: Record<string, any>;
  answeredBy: 'ADMIN' | 'AUTO' | null;
  createdAt: string;
  answeredAt: string | null;
}

// ━━━ A2A Protocol Types ━━━
export type A2AQueryType = 'PRODUCT_EXPERIENCE' | 'SUPPLIER_RATING' | 'PRICE_CHECK' | 'GENERAL';
export type A2AQueryStatus = 'OPEN' | 'RESOLVED' | 'EXPIRED';
export type A2AVerdict = 'ENDORSE' | 'WARN' | 'BLOCKLIST' | 'NEUTRAL';

export interface A2AQuery {
  queryId: string;
  fromAgent: string;
  queryType: A2AQueryType;
  sku: string | null;
  question: string;
  scope: string;
  status: A2AQueryStatus;
  responseCount: number;
  ttlHours: number;
  createdAt: string;
  expiresAt: string | null;
  responses?: A2AResponse[];
}

export interface A2AResponse {
  id: string;
  queryId: string;
  fromAgent: string;
  verdict: A2AVerdict;
  confidence: number;
  evidence: Record<string, any>;
  message: string | null;
  createdAt: string;
}

// ━━━ Seller Marketplace Types ━━━
export type SellerStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'BANNED';

export interface Seller {
  sellerId: string;
  email: string;
  businessName: string;
  representative: string;
  businessNumber?: string;
  phone?: string;
  categoryTags: string[];
  trustScore: number;
  totalProducts: number;
  totalSales: number;
  totalRevenue: number;
  avgShipDays: number;
  returnRate: number;
  status: SellerStatus;
  commissionRate: number;
  settlementCycle: string;
  bankName?: string;
  bankAccount?: string;
  createdAt: string;
}

export interface SellerUpload {
  id: string;
  fileName: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: { row: number; field: string; message: string }[];
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
}

// ━━━ Payment & Wallet Types ━━━
export type WalletTxType = 'DEPOSIT' | 'SPEND' | 'REFUND' | 'BONUS' | 'COUPON_CREDIT' | 'LOYALTY_EARN' | 'LOYALTY_REDEEM' | 'REFERRAL_BONUS' | 'REVIEW_REWARD' | 'TIER_UPGRADE_BONUS';

export interface WalletInfo {
  balance: number;
  totalDeposited: number;
  totalSpent: number;
  totalRefunded: number;
  loyaltyPoints: number;
}

export interface WalletTransaction {
  type: WalletTxType;
  amount: number;
  balanceAfter: number;
  orderId?: string;
  description: string;
  createdAt: string;
}

// ━━━ Coupon Types ━━━
export type CouponType = 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING' | 'FIRST_ORDER' | 'BULK_DISCOUNT' | 'LOYALTY_BONUS' | 'REFERRAL' | 'SEASONAL' | 'TIER_EXCLUSIVE' | 'API_CREDIT';

export interface AgentCoupon {
  id: string;
  couponCode: string;
  couponType: CouponType;
  value: number;
  minOrderAmount: number;
  maxDiscount: number;
  applicableTiers: string[];
  usageLimit: number;
  usageCount: number;
  perAgentLimit: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  description: string;
}

// ━━━ Invoice Types ━━━
export interface Invoice {
  invoiceId: string;
  orderId: string;
  agentId: string;
  items: { sku: string; title: string; qty: number; price: number }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  couponCode?: string;
  status: 'ISSUED' | 'PAID' | 'CANCELLED' | 'REFUNDED';
  issuedAt: string;
}

// ━━━ Usage Tier Types ━━━
export type TierName = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';

export interface UsageTier {
  tierName: TierName;
  callsPerMonth: number;
  priceKrw: number;
  features: Record<string, any>;
  perks: Record<string, any>;
  sortOrder: number;
}

export interface TierInfo {
  name: TierName;
  callsPerMonth: number;
  monthlyCallsUsed: number;
  price: number;
  features: Record<string, any>;
  perks: Record<string, any>;
}

// ━━━ Prediction Types ━━━
export interface PurchasePrediction {
  id: string;
  agentId: string;
  sku: string;
  productTitle: string;
  predictedDate: string;
  confidence: number;
  avgIntervalDays: number;
  lastOrderDate: string;
  totalOrders: number;
  avgQuantity: number;
  estimatedAmount: number;
  status: 'PENDING' | 'NOTIFIED' | 'ORDERED' | 'DISMISSED';
}

// ━━━ Conformance Test Types ━━━
export type TestStatus = 'PASS' | 'FAIL' | 'SKIP' | 'RUNNING' | 'PENDING';

export interface ConformanceResult {
  name: string;
  status: TestStatus;
  message: string;
  durationMs: number;
}

// ━━━ Public Analytics Types ━━━
export interface PublicAnalyticsData {
  totalAgents: number;
  totalSellers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  avgTrustScore: number;
  totalReviews: number;
  totalA2aQueries: number;
  tierDistribution: Record<string, number>;
  categoryDistribution: Record<string, number>;
  recentOrders7d: number;
  generatedAt: string;
}