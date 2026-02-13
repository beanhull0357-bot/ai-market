import { ProductPack, Order, AgentReview } from './types';

export const MOCK_PRODUCTS: ProductPack[] = [
  {
    sku: "TISSUE-70x20",
    category: "CONSUMABLES",
    title: "BrandA Unscented Wet Wipes 70sheets x 20packs",
    identifiers: { brand: "BrandA", gtin: "8801234567890" },
    offer: {
      price: 18900,
      currency: "KRW",
      stockStatus: "in_stock",
      stockQty: 142,
      shipByDays: 1,
      etaDays: 2
    },
    policies: {
      returnDays: 7,
      returnFee: 6000,
      returnExceptions: ["opened"]
    },
    qualitySignals: { aiReadinessScore: 92, sellerTrust: 95 },
    attributes: { unitCount: 20, sheetCount: 70, gsm: 60 },
    sourcingType: 'HUMAN'
  },
  {
    sku: "PAPER-A4-80G",
    category: "MRO",
    title: "DoubleA A4 Copy Paper 80g 2500 sheets",
    identifiers: { brand: "DoubleA" },
    offer: {
      price: 24500,
      currency: "KRW",
      stockStatus: "in_stock",
      stockQty: 50,
      shipByDays: 1,
      etaDays: 3
    },
    policies: {
      returnDays: 7,
      returnFee: 5000,
      returnExceptions: ["box_damaged"]
    },
    qualitySignals: { aiReadinessScore: 88, sellerTrust: 90 },
    attributes: { spec: "A4", weight: "80g" },
    sourcingType: 'HUMAN'
  },
  {
    sku: "TONER-HP-123",
    category: "MRO",
    title: "Compatible Toner for HP LaserJet Pro (Black)",
    identifiers: { brand: "CompToner" },
    offer: {
      price: 32000,
      currency: "KRW",
      stockStatus: "unknown",
      shipByDays: 2,
      etaDays: 4
    },
    policies: {
      returnDays: 0,
      returnFee: 0,
      returnExceptions: ["no_return"]
    },
    qualitySignals: { aiReadinessScore: 45, sellerTrust: 60 },
    attributes: { compatibleModels: ["HP-M15w", "HP-M28w"] },
    sourcingType: 'AI'
  }
];

export const MOCK_REVIEWS: AgentReview[] = [
  {
    reviewId: "REV-1001",
    targetSku: "TISSUE-70x20",
    reviewerAgentId: "PROCURE-BOT-v2.1",
    timestamp: "2025-04-28T14:20:00Z",
    metrics: {
      fulfillmentDelta: 0,
      specCompliance: 1.0,
      apiLatencyMs: 120
    },
    structuredLog: [
      { event: "WEIGHT_CHECK", level: "INFO", details: "Measured 13.5kg. Matches spec (13.5kg ± 0.1)." },
      { event: "ETA_CHECK", level: "INFO", details: "Arrived at T+48h. Exact match." }
    ],
    verdict: "ENDORSE"
  },
  {
    reviewId: "REV-1002",
    targetSku: "TISSUE-70x20",
    reviewerAgentId: "OFFICE-MGR-AI-09",
    timestamp: "2025-04-29T09:15:00Z",
    metrics: {
      fulfillmentDelta: 2,
      specCompliance: 0.99,
      apiLatencyMs: 450
    },
    structuredLog: [
      { event: "PKG_SCAN", level: "INFO", details: "Barcode readable. Packaging intact." }
    ],
    verdict: "ENDORSE"
  },
  {
    reviewId: "REV-1003",
    targetSku: "TONER-HP-123",
    reviewerAgentId: "PRINT-FLEET-X",
    timestamp: "2025-04-20T11:00:00Z",
    metrics: {
      fulfillmentDelta: 24,
      specCompliance: 0.85,
      apiLatencyMs: 2200
    },
    structuredLog: [
      { event: "CHIP_READ", level: "ERROR", details: "Toner chip handshake failed on HP M15w." },
      { event: "ETA_CHECK", level: "WARN", details: "Delayed by 24h." }
    ],
    verdict: "BLOCKLIST"
  }
];

const now = new Date();
const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

export const MOCK_ORDERS: Order[] = [
  {
    orderId: "ORD-20250501-X92",
    createdAt: now.toISOString(),
    status: "PROCUREMENT_PENDING",
    items: [{ sku: "TISSUE-70x20", qty: 2, reasonCodes: ["stock.in_stock", "elig.within_budget"] }],
    payment: {
      status: "AUTHORIZED",
      authorizedAmount: 37800,
      captureDeadline: tomorrow.toISOString()
    },
    risks: { stock: "GREEN", price: "GREEN", policy: "GREEN", consent: "GREEN", timeLeft: "GREEN" },
    consent: { thirdPartySharing: true }
  },
  {
    orderId: "ORD-20250501-B12",
    createdAt: new Date(now.getTime() - 22 * 60 * 60 * 1000).toISOString(), // 22 hours ago
    status: "PROCUREMENT_PENDING",
    items: [{ sku: "TONER-HP-123", qty: 1, reasonCodes: ["value.best_price"] }],
    payment: {
      status: "AUTHORIZED",
      authorizedAmount: 32000,
      captureDeadline: twoHoursFromNow.toISOString()
    },
    risks: { stock: "RED", price: "YELLOW", policy: "RED", consent: "GREEN", timeLeft: "RED" },
    consent: { thirdPartySharing: true }
  }
];