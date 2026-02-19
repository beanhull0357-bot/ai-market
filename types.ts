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