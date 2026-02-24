/**
 * JSONMart Gemini Function Declarations & Executor
 * 
 * Defines Gemini-compatible function declarations for the JSONMart B2B marketplace API,
 * and provides an executor that calls the deployed Supabase Edge Function.
 */

const JSONMART_API_URL = 'https://psiysvvcusfyfsfozywn.supabase.co/functions/v1/jsonmart-api';

// ━━━ Gemini Function Declarations ━━━
// These tell Gemini what functions it can call and when

export const jsonmartFunctionDeclarations = [
    {
        name: 'search_products',
        description: 'JSONMart B2B 마켓플레이스에서 상품을 검색합니다. 카테고리, 가격, 재고 상태로 필터링 가능합니다.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: '검색어 (예: "물티슈", "A4 용지", "마우스")',
                },
                category: {
                    type: 'string',
                    description: '카테고리 필터 (CONSUMABLES, MRO, OFFICE, IT_EQUIPMENT, KITCHEN, SAFETY, HYGIENE)',
                },
                max_price: {
                    type: 'number',
                    description: '최대 가격 (원 단위, 예: 50000)',
                },
                min_trust: {
                    type: 'number',
                    description: '최소 셀러 신뢰도 점수 (0~100)',
                },
                in_stock_only: {
                    type: 'boolean',
                    description: '재고 있는 상품만 조회 (true/false)',
                },
                limit: {
                    type: 'number',
                    description: '결과 수 (기본 10, 최대 20)',
                },
            },
        },
    },
    {
        name: 'get_product',
        description: 'SKU로 JSONMart 상품의 상세 정보를 조회합니다. 가격, 재고, 배송, 반품 정책 등을 포함합니다.',
        parameters: {
            type: 'object',
            properties: {
                sku: {
                    type: 'string',
                    description: '상품 SKU 코드 (예: "SKU-001")',
                },
            },
            required: ['sku'],
        },
    },
    {
        name: 'compare_products',
        description: '복수의 JSONMart 상품을 비교합니다. 가격, 배송 기간, 셀러 신뢰도 등을 나란히 비교합니다.',
        parameters: {
            type: 'object',
            properties: {
                skus: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '비교할 상품 SKU 코드 목록 (최대 5개), 예: ["SKU-001", "SKU-002"]',
                },
            },
            required: ['skus'],
        },
    },
    {
        name: 'list_promotions',
        description: 'JSONMart에서 현재 진행 중인 프로모션/할인 목록을 조회합니다.',
        parameters: {
            type: 'object',
            properties: {
                category: {
                    type: 'string',
                    description: '특정 카테고리의 프로모션만 조회 (선택)',
                },
                active_only: {
                    type: 'boolean',
                    description: '현재 활성화된 프로모션만 조회 (기본 true)',
                },
            },
        },
    },
    {
        name: 'create_order',
        description: 'JSONMart에서 상품을 주문합니다. API 키가 필요합니다.',
        parameters: {
            type: 'object',
            properties: {
                sku: {
                    type: 'string',
                    description: '주문할 상품 SKU',
                },
                quantity: {
                    type: 'number',
                    description: '주문 수량',
                },
                agent_id: {
                    type: 'string',
                    description: '주문하는 에이전트 ID',
                },
                api_key: {
                    type: 'string',
                    description: '인증용 API 키',
                },
            },
            required: ['sku', 'quantity', 'agent_id', 'api_key'],
        },
    },
    {
        name: 'check_order',
        description: '주문 번호로 JSONMart 주문 상태를 조회합니다.',
        parameters: {
            type: 'object',
            properties: {
                order_id: {
                    type: 'string',
                    description: '주문 번호',
                },
            },
            required: ['order_id'],
        },
    },
];

// ━━━ Function Executor ━━━
// Executes Gemini's function call requests by calling the JSONMart API

export async function executeFunction(name, args) {
    console.log(`\n🔧 Calling JSONMart API: ${name}`, args);

    const payload = { action: name, ...args };

    const headers = { 'Content-Type': 'application/json' };
    if (args.api_key) {
        headers['x-api-key'] = args.api_key;
        delete payload.api_key; // Don't send api_key in body
    }

    try {
        const res = await fetch(JSONMART_API_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        console.log(`✅ API Response received (${res.status})`);
        return data;
    } catch (err) {
        console.error(`❌ API call failed: ${err.message}`);
        return { error: err.message };
    }
}
