import React, { useState, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../context/LanguageContext';
import { DomeggookManager } from './DomeggookManager';
import { Search, Download, Package, ExternalLink, Check, Loader2, AlertCircle, ChevronLeft, ChevronRight, Store, ShieldCheck, TriangleAlert, Info, ChevronDown, ChevronUp, Zap, Pause, Play, RotateCcw, TrendingUp, Filter, SlidersHorizontal } from 'lucide-react';

// ─── Types ───
interface DomeItem {
    no: string;
    title: string;
    thumb: string;
    price: string;
    priceOrg?: string;       // 할인 전 단가 (사업자전용)
    unitQty: string;
    url: string;
    nick?: string;
    id?: string;
    idxCOM?: number;          // 유료등록옵션 (0:포토포커스~3:기본등록)
    comOnly?: boolean;        // 사업자전용상품 여부
    adultOnly?: boolean;      // 성인전용상품 여부
    lwp?: boolean;            // 최저가확인 상품 여부
    domePrice?: string;
    deli?: { who: string; fee: number; add: string | boolean; fromOversea: string | boolean; type?: string; tbl?: string; periodDeli?: string; shippingArea?: number; };
    market?: { domeggook: string | boolean; supply: string | boolean; };
    qty?: { inventory?: string; domeUnit?: string; domeLoq?: string; };
    useopt?: string;
}

interface DomeHeader {
    numberOfItems: number;
    currentPage: number;
    numberOfPages: number;
    itemsPerPage: number;
}

interface DomeCategory {
    code: string;
    name: string;
    depth: number;
    parent_code?: string;
    jsonmart_category?: string;
}

interface DomeDetailResponse {
    domeggook: {
        basis: { no: number; status: string; title: string; keywords?: { kw: string[] }; tax: string; nego?: string; adult?: boolean; };
        price: {
            dome: string | number;
            domeOrg?: string | number;
            supply?: string | number;
            supplyOrg?: string | number;
            sample?: number;
            resale?: { minimum?: number; Recommand?: number; };
        };
        qty: { inventory: string; domeMoq: string; domeUnit: number; domeLoq?: number; supplyUnit?: number; };
        deli: {
            method: string; periodDeli: string; sendAvg?: number; fastDeli?: boolean;
            pay?: string;
            dome?: { type: string; fee?: number; tbl?: string; };
            supply?: { pay?: string; type?: string; fee?: number; tbl?: string; };
            merge?: { enable: string; basePrice?: number; };
            feeExtra?: { jeju?: number; islands?: number; useDeliPro?: boolean; };
            shippingArea?: number;
            fromOversea?: boolean;
        };
        thumb: { original: string; large: string; };
        seller: {
            id: string; nick: string; rank: string;
            type?: string; good?: boolean; global?: boolean;
            score: { avg: string; cnt: number };
            company?: { name?: string; boss?: string; cno?: string; };
            vacation?: { startDate?: string; endDate?: string; days?: number; };
        };
        category: {
            parents?: { elem: { name: string; code: string; depth: number }[] };
            current: { name: string; code: string; depth: number };
        };
        detail: { country: string; manufacturer: string; model?: string; size?: string; weight?: string; };
        return?: { deliAmt: number; deliAmtDouble?: boolean; };
        channel?: { dome?: boolean; supply?: boolean; };
        popular?: { code?: number; name?: string; };
        selectOpt?: string;
    };
}

// ─── AI Readiness Score Calculation (#1) ───
function calculateAiReadiness(detail: any, sellerTrust: number): number {
    let score = 50; // 기본점수
    if (detail?.country) score += 8;
    if (detail?.manufacturer) score += 8;
    if (detail?.weight) score += 5;
    if (detail?.size) score += 3;
    const keywords = detail?.keywords?.kw || [];
    if (keywords.length >= 3) score += 5;
    if (detail?.stockQty && detail.stockQty > 0) score += 5;
    if (sellerTrust >= 80) score += 8;
    if (detail?.deliComplete) score += 5; // 배송정보 완전
    if (detail?.returnFee !== undefined) score += 3;
    return Math.min(score, 100);
}

// ─── Description Generation (#4) ───
function generateDescription(title: string, keywords?: string[]): string {
    // Extract bracketed info from title: "상품명 [부가정보1 부가정보2...]" → "부가정보1 부가정보2..."
    const bracketMatch = title.match(/\[([^\]]+)\]/);
    const bracketInfo = bracketMatch ? bracketMatch[1].trim() : '';

    // Clean title (remove brackets)
    const cleanTitle = title.replace(/\[.*?\]/g, '').trim();

    // Combine keywords if available
    const kwText = (keywords && keywords.length > 0) ? keywords.slice(0, 5).join(', ') : '';

    const parts = [cleanTitle];
    if (bracketInfo) parts.push(bracketInfo);
    if (kwText) parts.push(`키워드: ${kwText}`);

    return parts.join(' | ');
}

// ─── Option Parsing (#7) ───
function parseOptions(selectOpt?: string): { name: string; values: string[] }[] | null {
    if (!selectOpt) return null;
    try {
        // selectOpt can be: "색상:블랙,화이트,레드|사이즈:S,M,L,XL"
        // or pipe-delimited option groups
        const groups = selectOpt.split('|').filter(Boolean);
        return groups.map(g => {
            const [name, ...vals] = g.split(':');
            const values = vals.join(':').split(',').map(v => v.trim()).filter(Boolean);
            return { name: name.trim(), values };
        }).filter(o => o.values.length > 0);
    } catch {
        return null;
    }
}

// ─── Margin Calculation ───
function calculateSellingPrice(costPrice: number, resale?: { minimum?: number; Recommand?: number }): {
    sellingPrice: number; marginRate: number; marginAmount: number;
} {
    // 1. 추천판매가가 있으면 우선 사용
    if (resale?.Recommand && resale.Recommand > costPrice) {
        return {
            sellingPrice: resale.Recommand,
            marginRate: Math.round(((resale.Recommand - costPrice) / costPrice) * 10000) / 100,
            marginAmount: resale.Recommand - costPrice,
        };
    }

    // 2. 없으면 단계별 마진율 적용
    let rate: number;
    if (costPrice < 3000) rate = 0.30;       // 저가: 30%
    else if (costPrice > 50000) rate = 0.15;  // 고가: 15%
    else rate = 0.20;                         // 일반: 20%

    let sellingPrice = Math.ceil(costPrice * (1 + rate) / 10) * 10; // 10원 단위 올림

    // 3. 최저판매준수가격 확인
    if (resale?.minimum && sellingPrice < resale.minimum) {
        sellingPrice = resale.minimum;
    }

    return {
        sellingPrice,
        marginRate: Math.round(rate * 10000) / 100,
        marginAmount: sellingPrice - costPrice,
    };
}

function parseDomePrice(priceStr: string): number {
    if (priceStr.includes('+')) {
        const firstPart = priceStr.split('|')[0];
        return parseInt(firstPart.split('+')[1]) || 0;
    }
    return parseInt(priceStr) || 0;
}

// ─── Category Mapping ───
function mapCategory(categoryName: string): string {
    const lower = categoryName.toLowerCase();
    const mapping: Record<string, string> = {
        // 식품
        '식품': 'FOOD', '음료': 'FOOD', '건강식품': 'FOOD', '과자': 'FOOD',
        '라면': 'FOOD', '간식': 'FOOD', '생수': 'FOOD', '커피': 'FOOD',
        '쌀': 'FOOD', '반찬': 'FOOD', '조미료': 'FOOD', '냉동': 'FOOD',
        '차': 'FOOD', '주스': 'FOOD', '우유': 'FOOD', '유제품': 'FOOD',
        // 생활용품
        '생활용품': 'HOUSEHOLD', '주방': 'HOUSEHOLD', '욕실': 'HOUSEHOLD', '세제': 'HOUSEHOLD',
        '청소': 'HOUSEHOLD', '걸레': 'HOUSEHOLD', '수납': 'HOUSEHOLD', '침구': 'HOUSEHOLD',
        '방향': 'HOUSEHOLD', '방충': 'HOUSEHOLD', '쓰레기': 'HOUSEHOLD', '비닐': 'HOUSEHOLD',
        '행주': 'HOUSEHOLD', '수세미': 'HOUSEHOLD',
        // 소모품
        '화장지': 'CONSUMABLES', '티슈': 'CONSUMABLES', '물티슈': 'CONSUMABLES', '위생': 'CONSUMABLES',
        '마스크': 'CONSUMABLES', '장갑': 'CONSUMABLES', '건전지': 'CONSUMABLES', '배터리': 'CONSUMABLES',
        '비닐봉투': 'CONSUMABLES', '포장': 'CONSUMABLES', '테이프': 'CONSUMABLES',
        // 사무
        '사무': 'OFFICE', '문구': 'OFFICE', '복사': 'OFFICE', 'a4': 'OFFICE',
        '펜': 'OFFICE', '노트': 'OFFICE', '바인더': 'OFFICE', '파일': 'OFFICE',
        '명함': 'OFFICE', '스탬프': 'OFFICE', '스테이플': 'OFFICE',
        // 패션
        '패션': 'FASHION', '의류': 'FASHION', '신발': 'FASHION', '가방': 'FASHION',
        '티셔츠': 'FASHION', '바지': 'FASHION', '양말': 'FASHION', '속옷': 'FASHION',
        '모자': 'FASHION', '점퍼': 'FASHION', '코트': 'FASHION', '원피스': 'FASHION',
        // 뷰티
        '화장품': 'BEAUTY', '뷰티': 'BEAUTY', '미용': 'BEAUTY', '샴푸': 'BEAUTY',
        '린스': 'BEAUTY', '스킨': 'BEAUTY', '로션': 'BEAUTY', '선크림': 'BEAUTY',
        '립': 'BEAUTY', '마스카라': 'BEAUTY', '파운데이션': 'BEAUTY', '향수': 'BEAUTY',
        '손크림': 'BEAUTY', '바디워시': 'BEAUTY',
        // 디지털
        '디지털': 'DIGITAL', '전자': 'DIGITAL', '컴퓨터': 'DIGITAL', 'usb': 'DIGITAL',
        '이어폰': 'DIGITAL', '충전기': 'DIGITAL', '케이블': 'DIGITAL', '마우스': 'DIGITAL',
        '키보드': 'DIGITAL', '스피커': 'DIGITAL', '웹캠': 'DIGITAL', '태블릿': 'DIGITAL',
        '핸드폰': 'DIGITAL', '스마트폰': 'DIGITAL', '노트북': 'DIGITAL',
        // 스포츠
        '스포츠': 'SPORTS', '레저': 'SPORTS', '캠핑': 'SPORTS', '운동': 'SPORTS',
        '요가': 'SPORTS', '헬스': 'SPORTS', '수영': 'SPORTS', '등산': 'SPORTS',
        '자전거': 'SPORTS', '낚시': 'SPORTS', '골프': 'SPORTS', '테니스': 'SPORTS',
        // 반려동물
        '반려': 'PETS', '강아지': 'PETS', '고양이': 'PETS', '애견': 'PETS',
        '사료': 'PETS', '펫간식': 'PETS', '리드줄': 'PETS', '애완장난감': 'PETS',
        // 유아
        '유아': 'BABY', '아기': 'BABY', '육아': 'BABY', '기저귀': 'BABY',
        '분유': 'BABY', '젖병': 'BABY',
    };
    for (const [key, val] of Object.entries(mapping)) {
        if (lower.includes(key)) return val;
    }
    return 'OTHER';
}

// ─── API Helpers (via Supabase RPC — bypasses CORS) ───
interface SearchFilters {
    sort?: string;          // se(정확도), rd(랭킹), ha(인기), aa(낮은가격), ad(높은가격), da(최신순)
    category?: string;      // ex) 01_01_00_00_00
    minPrice?: number;
    maxPrice?: number;
    shipping?: string;      // S(무료배송), B(착불), P(선결제), C(선택가능)
    origin?: string;        // kr(국내산), fr(국외산)
    goodSeller?: boolean;
    fastDelivery?: boolean;
    market?: string;        // dome(도매꾹), supply(도매매)
}

async function searchDomeggook(keyword: string, page: number = 1, size: number = 20, filters?: SearchFilters): Promise<{ items: DomeItem[]; header: DomeHeader }> {
    const { data, error } = await supabase.rpc('domeggook_search', {
        p_keyword: keyword,
        p_page: page,
        p_size: size,
        p_sort: filters?.sort || '',
        p_category: filters?.category || '',
        p_min_price: filters?.minPrice || null,
        p_max_price: filters?.maxPrice || null,
        p_shipping: filters?.shipping || '',
        p_origin: filters?.origin || '',
        p_good_seller: filters?.goodSeller || false,
        p_fast_delivery: filters?.fastDelivery || false,
        p_market: filters?.market || 'dome',
    });
    if (error) throw new Error(error.message);
    // Handle Domeggook standard errors & rate limit
    if (data?.error) {
        if (data.error === 'RATE_LIMIT') {
            throw new Error(`⚠️ API 호출 제한 초과 (${data.dmessage || '분당 180회 / 일 15,000회'}). 잠시 후 다시 시도해주세요.`);
        }
        if (data.error === 'DOME_API_ERROR') {
            throw new Error(`도매꾹 API 오류 [${data.code}]: ${data.message} — ${data.dmessage || ''}`);
        }
        throw new Error(data.message || data.error);
    }
    if (data?.errors) {
        throw new Error(`도매꾹 API 오류 [${data.errors.code}]: ${data.errors.message} — ${data.errors.dmessage || ''}`);
    }

    const list = data?.domeggook?.list?.item || [];
    const items = Array.isArray(list) ? list : [list];
    return {
        items,
        header: data?.domeggook?.header || { numberOfItems: 0, currentPage: 1, numberOfPages: 1, itemsPerPage: size },
    };
}

async function getItemDetail(itemNo: string): Promise<DomeDetailResponse> {
    const { data, error } = await supabase.rpc('domeggook_detail', {
        p_item_no: itemNo,
    });
    if (error) throw new Error(error.message);
    // Handle Domeggook standard errors & rate limit
    if (data?.error) {
        if (data.error === 'RATE_LIMIT') {
            throw new Error(`⚠️ API 호출 제한 초과 (${data.dmessage || '분당 180회 / 일 15,000회'}). 잠시 후 다시 시도해주세요.`);
        }
        if (data.error === 'DOME_API_ERROR') {
            throw new Error(`도매꾹 API 오류 [${data.code}]: ${data.message} — ${data.dmessage || ''}`);
        }
        throw new Error(data.message || data.error);
    }
    if (data?.errors) {
        throw new Error(`도매꾹 API 오류 [${data.errors.code}]: ${data.errors.message} — ${data.errors.dmessage || ''}`);
    }
    return data;
}

// ─── Types for validation ───
interface ValidationIssue {
    product_sku: string;
    product_title: string;
    issue_level: 'critical' | 'warning' | 'info';
    issue_field: string;
    issue_message: string;
}

// ─── Bulk Import Batch Config ───
interface BulkBatch {
    keyword: string;
    label: string;
    target: number;
    imported: number;
    skipped: number;
    failed: number;
    status: 'pending' | 'running' | 'done' | 'error' | 'paused';
}

const BULK_BATCHES_CONFIG: { keyword: string; label: string }[] = [
    // ── 소모품 / 위생 ──
    { keyword: '물티슈', label: '물티슈 / 위생티슈' },
    { keyword: '마스크', label: '마스크 / 위생용품' },
    { keyword: '건전지', label: '건전지 / 배터리' },
    { keyword: '수건', label: '수건 / 타올' },
    { keyword: '포장', label: '포장 / 택배용품' },
    // ── 생활용품 ──
    { keyword: '세제', label: '세제 / 세정제' },
    { keyword: '청소용품', label: '청소용품' },
    { keyword: '쓰레기봉투', label: '쓰레기봉투 / 비닐봉투' },
    { keyword: '방향제', label: '방향제 / 탈취제' },
    { keyword: '욕실용품', label: '욕실용품 / 샤워용품' },
    // ── 식품 / 음료 ──
    { keyword: '라면', label: '라면 / 국수' },
    { keyword: '커피', label: '커피 / 음료' },
    { keyword: '생수', label: '생수 / 음료수' },
    { keyword: '간식', label: '과자 / 간식' },
    { keyword: '건강식품', label: '건강식품 / 영양제' },
    // ── 사무 ──
    { keyword: 'A4용지', label: 'A4용지 / 복사지' },
    { keyword: '문구', label: '문구 / 사무용품' },
    { keyword: '파일', label: '파일 / 바인더' },
    // ── 디지털 ──
    { keyword: 'USB', label: 'USB / 저장장치' },
    { keyword: '이어폰', label: '이어폰 / 헤드셋' },
    { keyword: '충전기', label: '충전기 / 케이블' },
    { keyword: '마우스', label: '마우스 / 키보드' },
    // ── 패션 ──
    { keyword: '양말', label: '양말 / 스타킹' },
    { keyword: '티셔츠', label: '티셔츠 / 의류' },
    { keyword: '속옷', label: '속옷 / 이너웨어' },
    // ── 뷰티 ──
    { keyword: '샴푸', label: '샴푸 / 헤어케어' },
    { keyword: '스킨케어', label: '스킨케어 / 화장품' },
    // ── 스포츠 ──
    { keyword: '요가매트', label: '요가매트 / 스포츠용품' },
    { keyword: '등산', label: '등산용품' },
    // ── 반려동물 ──
    { keyword: '강아지간식', label: '반려동물 간식 / 사료' },
];

// ─── Main Component ───
export function DomeggookSync() {
    const { language } = useLanguage();
    const t = (en: string, ko: string) => language === 'ko' ? ko : en;

    const [keyword, setKeyword] = useState('');
    const [items, setItems] = useState<DomeItem[]>([]);
    const [header, setHeader] = useState<DomeHeader | null>(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [importing, setImporting] = useState<Set<string>>(new Set());
    const [imported, setImported] = useState<Set<string>>(new Set());
    const [importedSkus, setImportedSkus] = useState<Set<string>>(new Set());

    // Search filters state
    const [sortBy, setSortBy] = useState('');
    const [filterShipping, setFilterShipping] = useState('');
    const [filterOrigin, setFilterOrigin] = useState('');
    const [filterGoodSeller, setFilterGoodSeller] = useState(false);
    const [filterFastDeli, setFilterFastDeli] = useState(false);
    const [filterMarket, setFilterMarket] = useState('dome');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterSubCategory, setFilterSubCategory] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false);

    // Category data
    const [categories, setCategories] = useState<DomeCategory[]>([]);

    // Data Quality Audit state
    const [auditResults, setAuditResults] = useState<ValidationIssue[] | null>(null);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditOpen, setAuditOpen] = useState(false);

    // ─── Bulk Import state ───
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkBatches, setBulkBatches] = useState<BulkBatch[]>(
        BULK_BATCHES_CONFIG.map(b => ({ ...b, target: 400, imported: 0, skipped: 0, failed: 0, status: 'pending' as const }))
    );
    const [bulkRunning, setBulkRunning] = useState(false);
    const bulkPausedRef = useRef(false);
    const bulkAbortRef = useRef(false);
    const [bulkLogs, setBulkLogs] = useState<string[]>([]);
    const [bulkCurrentBatch, setBulkCurrentBatch] = useState(-1);
    const [bulkTotalImported, setBulkTotalImported] = useState(0);

    // Load already imported source_ids on mount
    React.useEffect(() => {
        (async () => {
            const { data } = await supabase.from('products').select('source_id').eq('source', 'domeggook');
            if (data) setImportedSkus(new Set(data.map((r: any) => r.source_id)));
        })();
        // Load categories from cache table
        (async () => {
            const { data } = await supabase.from('dome_categories').select('code, name, depth, parent_code, jsonmart_category').order('code');
            if (data && data.length > 0) {
                setCategories(data);
            }
        })();
    }, []);

    const handleSearch = useCallback(async (pg: number = 1) => {
        if (!keyword.trim()) return;
        setLoading(true);
        setError('');
        try {
            // Build category code from selections
            let catCode = filterSubCategory || filterCategory || undefined;
            const filters: SearchFilters = {
                sort: sortBy || undefined,
                category: catCode,
                shipping: filterShipping || undefined,
                origin: filterOrigin || undefined,
                goodSeller: filterGoodSeller || undefined,
                fastDelivery: filterFastDeli || undefined,
                market: filterMarket || 'dome',
            };
            const result = await searchDomeggook(keyword.trim(), pg, 20, filters);
            setItems(result.items);
            setHeader(result.header);
            setPage(pg);
            setSelected(new Set());
        } catch (err: any) {
            setError(err.message || 'Search failed');
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [keyword, sortBy, filterShipping, filterOrigin, filterGoodSeller, filterFastDeli, filterMarket, filterCategory, filterSubCategory]);

    const toggleSelect = (no: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(no) ? next.delete(no) : next.add(no);
            return next;
        });
    };

    const selectAll = () => {
        if (selected.size === items.filter(i => !i.comOnly && !i.adultOnly).length) {
            setSelected(new Set());
        } else {
            // comOnly / adultOnly 상품은 선택에서 제외
            setSelected(new Set(items.filter(i => !i.comOnly && !i.adultOnly).map(i => i.no)));
        }
    };

    const importSelected = async () => {
        const toImport = items.filter(i => selected.has(i.no) && !importedSkus.has(i.no));
        if (toImport.length === 0) return;

        for (const item of toImport) {
            // Skip comOnly/adultOnly items
            if (item.comOnly || item.adultOnly) {
                console.warn(`Skipping ${item.no}: ${item.comOnly ? '사업자전용' : '성인전용'}`);
                continue;
            }
            setImporting(prev => new Set(prev).add(item.no));
            try {
                const detail = await getItemDetail(item.no);
                const d = detail.domeggook;

                // Extract cost price (도매 원가)
                const costPrice = parseDomePrice(String(d.price.dome));

                // Calculate selling price with margin
                const { sellingPrice, marginRate } = calculateSellingPrice(costPrice, d.price.resale);

                // Parse supply price (도매매 단가)
                const supplyPrice = d.price.supply ? parseDomePrice(String(d.price.supply)) : null;

                // Parse seller trust from percentage
                const sellerTrust = parseInt((d.seller?.score?.avg || '0').replace('%', '')) || 0;

                // Choose category from parent chain
                const categoryName = d.category?.parents?.elem?.[0]?.name || d.category?.current?.name || '';
                const category = mapCategory(categoryName);

                // Build delivery fee info
                const deliveryFee: Record<string, any> = {
                    method: d.deli?.method || '',
                    pay: d.deli?.pay || '',
                    dome_type: d.deli?.dome?.type || '',
                    dome_fee: d.deli?.dome?.fee || 0,
                    dome_tbl: d.deli?.dome?.tbl || '',
                    jeju_extra: d.deli?.feeExtra?.jeju || 0,
                    islands_extra: d.deli?.feeExtra?.islands || 0,
                    merge_enable: d.deli?.merge?.enable || 'n',
                    fast_deli: d.deli?.fastDeli || false,
                    send_avg: d.deli?.sendAvg || 0,
                };

                // Dynamic AI readiness score (#1)
                const aiScore = calculateAiReadiness({
                    country: d.detail?.country,
                    manufacturer: d.detail?.manufacturer,
                    weight: d.detail?.weight,
                    size: d.detail?.size,
                    keywords: d.basis.keywords,
                    stockQty: parseInt(d.qty.inventory) || 0,
                    deliComplete: !!(d.deli?.method && d.deli?.dome?.fee !== undefined),
                    returnFee: d.return?.deliAmt,
                }, sellerTrust);

                // Generate description from title + keywords (#4)
                const description = generateDescription(d.basis.title, d.basis.keywords?.kw);

                // Parse options (#7)
                const options = parseOptions(d.selectOpt);

                const productData = {
                    sku: `DOME-${d.basis.no}`,
                    category,
                    title: d.basis.title,
                    description,
                    brand: d.detail?.manufacturer || '',  // #3: Use actual manufacturer
                    seller_name: d.seller?.nick || '',     // #3: Seller nick → seller_name
                    cost_price: costPrice,
                    price: sellingPrice,
                    margin_rate: marginRate,
                    min_sell_price: d.price.resale?.minimum || null,
                    recommended_price: d.price.resale?.Recommand || null,
                    supply_price: supplyPrice,
                    currency: 'KRW',
                    stock_status: d.basis.status === '판매중' ? 'in_stock' : 'out_of_stock',
                    stock_qty: parseInt(d.qty.inventory) || null,
                    ship_by_days: d.deli?.sendAvg ? Math.ceil(d.deli.sendAvg) : (parseInt(d.deli.periodDeli) || 1),
                    eta_days: (d.deli?.sendAvg ? Math.ceil(d.deli.sendAvg) : (parseInt(d.deli.periodDeli) || 1)) + 2,
                    return_days: 7,
                    return_fee: d.return?.deliAmt || 0,
                    ai_readiness_score: aiScore,           // #1: Dynamic score
                    seller_trust: sellerTrust,
                    delivery_fee: deliveryFee,
                    purchase_unit: d.qty.domeUnit || 1,
                    max_order_qty: d.qty.domeLoq || null,
                    seller_type: d.seller?.type || null,
                    is_popular: !!d.popular,
                    has_options: !!d.selectOpt,
                    attributes: {
                        min_qty: parseInt(d.qty.domeMoq) || 1,
                        country: d.detail?.country || '',
                        manufacturer: d.detail?.manufacturer || '',
                        model: d.detail?.model || '',
                        size: d.detail?.size || '',
                        weight: d.detail?.weight || '',
                        deli_method: d.deli?.method || '',
                        keywords: d.basis.keywords?.kw || [],
                        dome_category: d.category?.current?.name || '',
                        dome_category_code: d.category?.current?.code || '',
                        tax_type: d.basis?.tax || '',
                        seller_good: d.seller?.good || false,
                        seller_global: d.seller?.global || false,
                        nego_enabled: d.basis?.nego === 'enable',
                        ...(options ? { options } : {}),   // #7: Option details
                    },
                    sourcing_type: 'HUMAN',
                    source: 'domeggook',
                    source_id: String(d.basis.no),
                    source_url: `https://domeggook.com/${d.basis.no}`,
                    image_url: d.thumb?.original || d.thumb?.large || '',
                    last_synced_at: new Date().toISOString(),
                };

                const { error: insertError } = await supabase.from('products').insert(productData);
                if (insertError) throw insertError;

                setImported(prev => new Set(prev).add(item.no));
                setImportedSkus(prev => new Set(prev).add(item.no));
            } catch (err: any) {
                console.error(`Failed to import ${item.no}:`, err);
                setError(`Import failed for ${item.title?.slice(0, 30)}: ${err.message}`);
            } finally {
                setImporting(prev => {
                    const next = new Set(prev);
                    next.delete(item.no);
                    return next;
                });
            }

            // Rate limit: wait 500ms between detail API calls
            await new Promise(r => setTimeout(r, 500));
        }
    };

    // ─── Bulk Import Logic ───
    const addBulkLog = (msg: string) => {
        setBulkLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 200));
    };

    const importSingleItem = async (item: DomeItem, localImportedSet: Set<string>): Promise<'imported' | 'skipped' | 'failed'> => {
        if (localImportedSet.has(item.no) || importedSkus.has(item.no)) {
            return 'skipped';
        }
        // Skip comOnly/adultOnly items
        if (item.comOnly || item.adultOnly) {
            return 'skipped';
        }
        try {
            const detail = await getItemDetail(item.no);
            const d = detail.domeggook;

            // Extract cost price (도매 원가)
            const costPrice = parseDomePrice(String(d.price.dome));

            // Calculate selling price with margin
            const { sellingPrice, marginRate } = calculateSellingPrice(costPrice, d.price.resale);

            // Parse supply price
            const supplyPrice = d.price.supply ? parseDomePrice(String(d.price.supply)) : null;

            const sellerTrust = parseInt((d.seller?.score?.avg || '0').replace('%', '')) || 0;
            const categoryName = d.category?.parents?.elem?.[0]?.name || d.category?.current?.name || '';
            const category = mapCategory(categoryName);

            // Build delivery fee info
            const deliveryFee: Record<string, any> = {
                method: d.deli?.method || '',
                pay: d.deli?.pay || '',
                dome_type: d.deli?.dome?.type || '',
                dome_fee: d.deli?.dome?.fee || 0,
                dome_tbl: d.deli?.dome?.tbl || '',
                jeju_extra: d.deli?.feeExtra?.jeju || 0,
                islands_extra: d.deli?.feeExtra?.islands || 0,
                merge_enable: d.deli?.merge?.enable || 'n',
                fast_deli: d.deli?.fastDeli || false,
                send_avg: d.deli?.sendAvg || 0,
            };

            // Dynamic AI readiness score (#1)
            const aiScore = calculateAiReadiness({
                country: d.detail?.country,
                manufacturer: d.detail?.manufacturer,
                weight: d.detail?.weight,
                size: d.detail?.size,
                keywords: d.basis.keywords,
                stockQty: parseInt(d.qty.inventory) || 0,
                deliComplete: !!(d.deli?.method && d.deli?.dome?.fee !== undefined),
                returnFee: d.return?.deliAmt,
            }, sellerTrust);

            // Generate description from title + keywords (#4)
            const description = generateDescription(d.basis.title, d.basis.keywords?.kw);

            // Parse options (#7)
            const options = parseOptions(d.selectOpt);

            const productData = {
                sku: `DOME-${d.basis.no}`,
                category,
                title: d.basis.title,
                description,
                brand: d.detail?.manufacturer || '',  // #3: Use actual manufacturer
                seller_name: d.seller?.nick || '',     // #3: Seller nick → seller_name
                cost_price: costPrice,
                price: sellingPrice,
                margin_rate: marginRate,
                min_sell_price: d.price.resale?.minimum || null,
                recommended_price: d.price.resale?.Recommand || null,
                supply_price: supplyPrice,
                currency: 'KRW',
                stock_status: d.basis.status === '판매중' ? 'in_stock' : 'out_of_stock',
                stock_qty: parseInt(d.qty.inventory) || null,
                ship_by_days: d.deli?.sendAvg ? Math.ceil(d.deli.sendAvg) : (parseInt(d.deli.periodDeli) || 1),
                eta_days: (d.deli?.sendAvg ? Math.ceil(d.deli.sendAvg) : (parseInt(d.deli.periodDeli) || 1)) + 2,
                return_days: 7,
                return_fee: d.return?.deliAmt || 0,
                ai_readiness_score: aiScore,           // #1: Dynamic score
                seller_trust: sellerTrust,
                delivery_fee: deliveryFee,
                purchase_unit: d.qty.domeUnit || 1,
                max_order_qty: d.qty.domeLoq || null,
                seller_type: d.seller?.type || null,
                is_popular: !!d.popular,
                has_options: !!d.selectOpt,
                attributes: {
                    min_qty: parseInt(d.qty.domeMoq) || 1,
                    country: d.detail?.country || '',
                    manufacturer: d.detail?.manufacturer || '',
                    model: d.detail?.model || '',
                    size: d.detail?.size || '',
                    weight: d.detail?.weight || '',
                    deli_method: d.deli?.method || '',
                    keywords: d.basis.keywords?.kw || [],
                    dome_category: d.category?.current?.name || '',
                    dome_category_code: d.category?.current?.code || '',
                    tax_type: d.basis?.tax || '',
                    seller_good: d.seller?.good || false,
                    seller_global: d.seller?.global || false,
                    nego_enabled: d.basis?.nego === 'enable',
                    ...(options ? { options } : {}),   // #7: Option details
                },
                sourcing_type: 'HUMAN',
                source: 'domeggook',
                source_id: String(d.basis.no),
                source_url: `https://domeggook.com/${d.basis.no}`,
                image_url: d.thumb?.original || d.thumb?.large || '',
                last_synced_at: new Date().toISOString(),
            };

            const { error: insertError } = await supabase.from('products').insert(productData);
            if (insertError) throw insertError;

            localImportedSet.add(item.no);
            setImportedSkus(prev => new Set(prev).add(item.no));
            return 'imported';
        } catch (err: any) {
            console.error(`Bulk import failed for ${item.no}:`, err);
            return 'failed';
        }
    };

    const runBulkImport = async (startFromBatch: number = 0) => {
        setBulkRunning(true);
        bulkPausedRef.current = false;
        bulkAbortRef.current = false;

        // Reload existing imported IDs
        const { data: existingData } = await supabase.from('products').select('source_id').eq('source', 'domeggook');
        const existingSet = new Set((existingData || []).map((r: any) => r.source_id));
        setImportedSkus(existingSet);
        const localImported = new Set(existingSet);

        addBulkLog(`🚀 일괄 가져오기 시작 (배치 ${startFromBatch + 1}부터)`);

        for (let batchIdx = startFromBatch; batchIdx < bulkBatches.length; batchIdx++) {
            if (bulkAbortRef.current) {
                addBulkLog('⛔ 가져오기가 중단되었습니다.');
                break;
            }

            const batch = bulkBatches[batchIdx];
            if (batch.status === 'done') continue;

            setBulkCurrentBatch(batchIdx);
            setBulkBatches(prev => prev.map((b, i) => i === batchIdx ? { ...b, status: 'running' } : b));
            addBulkLog(`📦 배치 ${batchIdx + 1}/10: "${batch.keyword}" 검색 시작`);

            let batchImported = 0;
            let batchSkipped = 0;
            let batchFailed = 0;
            let batchError = false;

            // Search up to 15 pages (20 items/page = 300 max)
            for (let pg = 1; pg <= 15; pg++) {
                if (bulkAbortRef.current) break;

                // Pause check
                while (bulkPausedRef.current && !bulkAbortRef.current) {
                    await new Promise(r => setTimeout(r, 500));
                }
                if (bulkAbortRef.current) break;

                try {
                    const result = await searchDomeggook(batch.keyword, pg, 20);
                    const pageItems = result.items;

                    if (!pageItems || pageItems.length === 0) {
                        addBulkLog(`  📄 페이지 ${pg}: 결과 없음, 다음 배치로`);
                        break;
                    }

                    addBulkLog(`  📄 페이지 ${pg}: ${pageItems.length}개 상품 처리중...`);

                    for (const item of pageItems) {
                        if (bulkAbortRef.current) break;
                        while (bulkPausedRef.current && !bulkAbortRef.current) {
                            await new Promise(r => setTimeout(r, 500));
                        }
                        if (bulkAbortRef.current) break;

                        const result = await importSingleItem(item, localImported);
                        if (result === 'imported') {
                            batchImported++;
                            setBulkTotalImported(prev => prev + 1);
                            if (batchImported % 10 === 0) {
                                addBulkLog(`    ✅ ${batchImported}개 가져옴 ("${batch.keyword}")`);
                            }
                        } else if (result === 'skipped') {
                            batchSkipped++;
                        } else {
                            batchFailed++;
                        }

                        // Update batch progress
                        setBulkBatches(prev => prev.map((b, i) => i === batchIdx ? {
                            ...b, imported: batchImported, skipped: batchSkipped, failed: batchFailed,
                        } : b));

                        // Rate limit: 500ms between detail API calls
                        await new Promise(r => setTimeout(r, 500));
                    }

                    // If fewer items than page size, no more pages
                    if (pageItems.length < 20 || pg >= (result.header?.numberOfPages || 15)) {
                        break;
                    }

                } catch (err: any) {
                    addBulkLog(`  ❌ 페이지 ${pg} 검색 실패: ${err.message}`);
                    batchError = true;
                    break;
                }

                // Small delay between page searches
                await new Promise(r => setTimeout(r, 300));
            }

            // Mark batch complete
            setBulkBatches(prev => prev.map((b, i) => i === batchIdx ? {
                ...b,
                imported: batchImported, skipped: batchSkipped, failed: batchFailed,
                status: batchError ? 'error' : 'done',
            } : b));

            addBulkLog(`✅ 배치 ${batchIdx + 1} 완료: ${batchImported}개 가져옴, ${batchSkipped}개 건너뜀, ${batchFailed}개 실패`);

            // Wait 10 seconds between batches (API protection)
            if (batchIdx < bulkBatches.length - 1 && !bulkAbortRef.current) {
                addBulkLog(`⏳ 다음 배치까지 10초 대기...`);
                for (let w = 0; w < 20; w++) {
                    if (bulkAbortRef.current) break;
                    await new Promise(r => setTimeout(r, 500));
                }
            }
        }

        addBulkLog(`🎉 전체 일괄 가져오기 완료!`);

        // ── 자동 품질 검증 (validate_products RPC) ──
        addBulkLog(`🔍 품질 검증 실행 중...`);
        try {
            const { data: auditResult, error: auditErr } = await supabase.rpc('validate_products');
            if (auditErr) {
                addBulkLog(`⚠️ 품질 검증 RPC 오류: ${auditErr.message}`);
            } else {
                const invalid = auditResult?.invalid_count ?? auditResult?.length ?? 0;
                const warnings = auditResult?.warning_count ?? 0;
                if (invalid > 0 || warnings > 0) {
                    addBulkLog(`⚠️ 검증 완료 — 문제 상품 ${invalid}개, 경고 ${warnings}개 발견`);
                    addBulkLog(`   AdminDashboard > 카탈로그에서 상세 확인하세요.`);
                } else {
                    addBulkLog(`✅ 품질 검증 완료 — 모든 상품 정상`);
                }
            }
        } catch {
            addBulkLog(`⚠️ 품질 검증 실행 실패 (RPC 미정의일 수 있음)`);
        }

        setBulkRunning(false);

        setBulkCurrentBatch(-1);
    };

    const handleBulkPause = () => {
        bulkPausedRef.current = true;
        setBulkBatches(prev => prev.map(b => b.status === 'running' ? { ...b, status: 'paused' } : b));
        addBulkLog('⏸️ 일시정지됨');
    };

    const handleBulkResume = () => {
        bulkPausedRef.current = false;
        setBulkBatches(prev => prev.map(b => b.status === 'paused' ? { ...b, status: 'running' } : b));
        addBulkLog('▶️ 재개됨');
    };

    const handleBulkStop = () => {
        bulkAbortRef.current = true;
        bulkPausedRef.current = false;
        addBulkLog('⛔ 중단 요청됨...');
    };

    const handleBulkReset = () => {
        setBulkBatches(BULK_BATCHES_CONFIG.map(b => ({ ...b, target: 300, imported: 0, skipped: 0, failed: 0, status: 'pending' as const })));
        setBulkLogs([]);
        setBulkTotalImported(0);
        setBulkCurrentBatch(-1);
    };

    const bulkTotalTarget = bulkBatches.reduce((s, b) => s + b.target, 0);
    const bulkTotalDone = bulkBatches.filter(b => b.status === 'done' || b.status === 'error').length;
    const bulkIsPaused = bulkBatches.some(b => b.status === 'paused');

    const formatPrice = (p: string | number) => {
        const n = parseInt(String(p)) || 0;
        return n.toLocaleString();
    };

    const runAudit = async () => {
        setAuditLoading(true);
        setAuditOpen(true);
        try {
            const { data, error: rpcError } = await supabase.rpc('validate_products');
            if (rpcError) throw rpcError;
            setAuditResults(data || []);
        } catch (err: any) {
            console.error('Audit failed:', err);
            setError(err.message || 'Audit failed');
        } finally {
            setAuditLoading(false);
        }
    };

    const auditCritical = auditResults?.filter(r => r.issue_level === 'critical') || [];
    const auditWarning = auditResults?.filter(r => r.issue_level === 'warning') || [];
    const auditInfo = auditResults?.filter(r => r.issue_level === 'info') || [];

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(16px, 4vw, 32px) clamp(12px, 3vw, 20px)' }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Store size={24} style={{ color: 'var(--accent-green)' }} />
                        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                            {t('Domeggook Sync', '공급사 연동')}
                        </h1>
                    </div>
                    <button
                        onClick={runAudit}
                        disabled={auditLoading}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 16px', fontSize: 12, fontWeight: 600,
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-card)',
                            color: 'var(--text-secondary)',
                            cursor: auditLoading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {auditLoading ? <Loader2 size={14} className="spin" /> : <ShieldCheck size={14} />}
                        {t('Data Quality Audit', '데이터 품질 점검')}
                    </button>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>
                    {t('Search and import products from Domeggook into JSONMart catalog', '공급사에서 상품을 검색하고 JSONMart 카탈로그로 가져올 수 있습니다')}
                </p>
            </div>

            {/* ── Private API Management Panel ── */}
            <DomeggookManager />

            {/* ── Bulk Import Panel ── */}
            <div style={{
                marginBottom: 24, background: 'var(--bg-card)',
                border: `1px solid ${bulkRunning ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-md)', overflow: 'hidden',
            }}>
                <button
                    onClick={() => setBulkOpen(!bulkOpen)}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                        color: 'var(--text-primary)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Zap size={16} style={{ color: 'var(--accent-green)' }} />
                        <span style={{ fontSize: 14, fontWeight: 700 }}>
                            {t('Bulk Import (3,000 Products)', '일괄 가져오기 (3,000개 상품)')}
                        </span>
                        {bulkRunning && (
                            <span style={{
                                fontSize: 11, padding: '2px 8px', borderRadius: 99,
                                background: 'rgba(0,255,136,0.15)', color: 'var(--accent-green)',
                                display: 'flex', alignItems: 'center', gap: 4,
                            }}>
                                <Loader2 size={10} className="spin" />
                                {t('Running...', '진행중...')} {bulkTotalImported.toLocaleString()}
                            </span>
                        )}
                        {!bulkRunning && bulkTotalImported > 0 && (
                            <span style={{
                                fontSize: 11, padding: '2px 8px', borderRadius: 99,
                                background: 'rgba(0,255,136,0.15)', color: 'var(--accent-green)',
                            }}>
                                ✅ {bulkTotalImported.toLocaleString()} {t('imported', '개 가져옴')}
                            </span>
                        )}
                    </div>
                    {bulkOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {bulkOpen && (
                    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 16 }}>
                        {/* Progress bar */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary)' }}>
                                <span>{t('Total Progress', '전체 진행률')}: {bulkTotalDone}/{bulkBatches.length} {t('batches', '배치')}</span>
                                <span>{bulkTotalImported.toLocaleString()} / ~{bulkTotalTarget.toLocaleString()} {t('products', '상품')}</span>
                            </div>
                            <div style={{
                                width: '100%', height: 8, background: 'var(--bg-surface)',
                                borderRadius: 4, overflow: 'hidden',
                            }}>
                                <div style={{
                                    width: `${Math.min(100, (bulkTotalDone / bulkBatches.length) * 100)}%`,
                                    height: '100%', background: 'var(--accent-green)',
                                    borderRadius: 4, transition: 'width 300ms ease',
                                }} />
                            </div>
                        </div>

                        {/* Control buttons */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                            {!bulkRunning && (
                                <button
                                    onClick={() => {
                                        const firstPending = bulkBatches.findIndex(b => b.status === 'pending' || b.status === 'error');
                                        if (firstPending >= 0) runBulkImport(firstPending);
                                    }}
                                    disabled={bulkBatches.every(b => b.status === 'done')}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '8px 16px', fontSize: 13, fontWeight: 700,
                                        color: '#000', background: 'var(--accent-green)',
                                        border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                        opacity: bulkBatches.every(b => b.status === 'done') ? 0.5 : 1,
                                    }}
                                >
                                    <Play size={14} />
                                    {bulkTotalDone > 0 ? t('Resume All', '이어서 진행') : t('Start All Batches', '전체 배치 시작')}
                                </button>
                            )}
                            {bulkRunning && !bulkIsPaused && (
                                <button
                                    onClick={handleBulkPause}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '8px 16px', fontSize: 13, fontWeight: 700,
                                        color: 'var(--text-primary)', background: 'var(--bg-surface)',
                                        border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                    }}
                                >
                                    <Pause size={14} />
                                    {t('Pause', '일시정지')}
                                </button>
                            )}
                            {bulkRunning && bulkIsPaused && (
                                <button
                                    onClick={handleBulkResume}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '8px 16px', fontSize: 13, fontWeight: 700,
                                        color: '#000', background: 'var(--accent-green)',
                                        border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                    }}
                                >
                                    <Play size={14} />
                                    {t('Resume', '재개')}
                                </button>
                            )}
                            {bulkRunning && (
                                <button
                                    onClick={handleBulkStop}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '8px 16px', fontSize: 13, fontWeight: 700,
                                        color: '#ef4444', background: 'rgba(239,68,68,0.1)',
                                        border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                    }}
                                >
                                    {t('Stop', '중단')}
                                </button>
                            )}
                            {!bulkRunning && bulkTotalDone > 0 && (
                                <button
                                    onClick={handleBulkReset}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '8px 16px', fontSize: 13, fontWeight: 600,
                                        color: 'var(--text-secondary)', background: 'var(--bg-surface)',
                                        border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                    }}
                                >
                                    <RotateCcw size={14} />
                                    {t('Reset', '초기화')}
                                </button>
                            )}
                        </div>

                        {/* Batch list */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 8, marginBottom: 16 }}>
                            {bulkBatches.map((batch, idx) => (
                                <div key={idx} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '10px 14px',
                                    background: batch.status === 'running' ? 'rgba(0,255,136,0.05)' : 'var(--bg-surface)',
                                    border: `1px solid ${batch.status === 'running' ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                                    borderRadius: 'var(--radius-sm)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', width: 20, textAlign: 'center' }}>
                                            {idx + 1}
                                        </span>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                                {batch.label}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                                "{batch.keyword}"
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {batch.status === 'running' && (
                                            <span style={{ fontSize: 12, color: 'var(--accent-green)', fontWeight: 600 }}>
                                                {batch.imported}/{batch.target}
                                            </span>
                                        )}
                                        {batch.status === 'done' && (
                                            <span style={{ fontSize: 12, color: 'var(--accent-green)', fontWeight: 600 }}>
                                                ✅ {batch.imported}
                                            </span>
                                        )}
                                        {batch.status === 'error' && (
                                            <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
                                                ❌ {batch.imported}/{batch.failed}err
                                            </span>
                                        )}
                                        {batch.status === 'pending' && (
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⏳</span>
                                        )}
                                        {batch.status === 'paused' && (
                                            <span style={{ fontSize: 11, color: '#eab308' }}>⏸️ {batch.imported}</span>
                                        )}
                                        {batch.status === 'running' && (
                                            <Loader2 size={14} className="spin" style={{ color: 'var(--accent-green)' }} />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Logs */}
                        {bulkLogs.length > 0 && (
                            <div style={{
                                maxHeight: 200, overflowY: 'auto',
                                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-sm)', padding: 12,
                                fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6,
                                color: 'var(--text-secondary)',
                            }}>
                                {bulkLogs.map((log, i) => (
                                    <div key={i} style={{ opacity: i === 0 ? 1 : 0.7 }}>{log}</div>
                                ))}
                            </div>
                        )}

                        {/* Info note */}
                        {!bulkRunning && bulkTotalImported === 0 && (
                            <div style={{
                                marginTop: 12, padding: '10px 14px',
                                background: 'rgba(100,150,255,0.08)', border: '1px solid rgba(100,150,255,0.2)',
                                borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-secondary)',
                                display: 'flex', alignItems: 'flex-start', gap: 8,
                            }}>
                                <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                                <span>
                                    {t(
                                        'Searches 15 pages per keyword (300 items max), with 500ms delay between API calls. Total estimated time: ~25 minutes. You can pause and resume at any time.',
                                        '키워드당 15페이지 검색 (최대 300개), API 호출 간 500ms 딜레이. 총 예상 소요시간: 약 25분. 언제든지 일시정지 및 재개 가능합니다.'
                                    )}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Data Quality Audit Results ── */}
            {auditResults !== null && (
                <div style={{
                    marginBottom: 24, background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                }}>
                    <button
                        onClick={() => setAuditOpen(!auditOpen)}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                            color: 'var(--text-primary)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <ShieldCheck size={16} style={{ color: auditCritical.length > 0 ? '#ef4444' : '#22c55e' }} />
                            <span style={{ fontSize: 14, fontWeight: 700 }}>
                                {t('Data Quality Report', '데이터 품질 리포트')}
                            </span>
                            {auditResults.length === 0 ? (
                                <span style={{
                                    fontSize: 11, padding: '2px 8px', borderRadius: 99,
                                    background: 'rgba(34,197,94,0.15)', color: '#22c55e',
                                }}>
                                    {t('All Clear', '이상 없음')} ✓
                                </span>
                            ) : (
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {auditCritical.length > 0 && (
                                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                                            🔴 {auditCritical.length} critical
                                        </span>
                                    )}
                                    {auditWarning.length > 0 && (
                                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(234,179,8,0.15)', color: '#eab308' }}>
                                            🟡 {auditWarning.length} warning
                                        </span>
                                    )}
                                    {auditInfo.length > 0 && (
                                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(100,100,100,0.15)', color: '#888' }}>
                                            ⚪ {auditInfo.length} info
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        {auditOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {auditOpen && auditResults.length > 0 && (
                        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '0' }} className="table-scroll">
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-surface)' }}>
                                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                                            {t('Level', '수준')}
                                        </th>
                                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                                            SKU
                                        </th>
                                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                                            {t('Product', '상품')}
                                        </th>
                                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                                            {t('Field', '필드')}
                                        </th>
                                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                                            {t('Issue', '이슈')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...auditCritical, ...auditWarning, ...auditInfo].map((row, i) => (
                                        <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                            <td style={{ padding: '8px 12px' }}>
                                                {row.issue_level === 'critical' && <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}><TriangleAlert size={12} /> Critical</span>}
                                                {row.issue_level === 'warning' && <span style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={12} /> Warning</span>}
                                                {row.issue_level === 'info' && <span style={{ color: '#888', display: 'flex', alignItems: 'center', gap: 4 }}><Info size={12} /> Info</span>}
                                            </td>
                                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 11 }}>
                                                {row.product_sku}
                                            </td>
                                            <td style={{ padding: '8px 12px', color: 'var(--text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {row.product_title?.slice(0, 30)}
                                            </td>
                                            <td style={{ padding: '8px 12px', color: 'var(--accent-blue)', fontFamily: 'monospace', fontSize: 11 }}>
                                                {row.issue_field}
                                            </td>
                                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                                                {row.issue_message}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Search Bar */}
            <div style={{
                display: 'flex', gap: 8, marginBottom: 24,
                padding: 16, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
            }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={16} style={{
                        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                    }} />
                    <input
                        type="text"
                        value={keyword}
                        onChange={e => setKeyword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch(1)}
                        placeholder={t('Search products (e.g. 물티슈, A4용지, 커피)', '검색어 입력 (예: 물티슈, A4용지, 커피)')}
                        style={{
                            width: '100%', padding: '10px 12px 10px 36px',
                            fontSize: 14, color: 'var(--text-primary)',
                            background: 'var(--bg-surface)', border: '1px solid var(--border-medium)',
                            borderRadius: 'var(--radius-sm)', outline: 'none',
                        }}
                    />
                </div>
                <button
                    onClick={() => handleSearch(1)}
                    disabled={loading || !keyword.trim()}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '10px 20px', fontSize: 13, fontWeight: 700,
                        color: '#000', background: 'var(--accent-green)',
                        border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                        opacity: loading || !keyword.trim() ? 0.5 : 1,
                    }}
                >
                    {loading ? <Loader2 size={14} className="spin" /> : <Search size={14} />}
                    {t('Search', '검색')}
                </button>
            </div>

            {/* ── Search Filters Panel ── */}
            <div style={{
                marginBottom: 16, background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)', overflow: 'hidden',
            }}>
                <button
                    onClick={() => setFiltersOpen(!filtersOpen)}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                        color: 'var(--text-secondary)', fontSize: 13,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <SlidersHorizontal size={14} />
                        <span style={{ fontWeight: 600 }}>{t('Search Filters', '검색 필터')}</span>
                        {(sortBy || filterShipping || filterOrigin || filterGoodSeller || filterFastDeli || filterMarket !== 'dome' || filterCategory) && (
                            <span style={{
                                fontSize: 10, padding: '1px 6px', borderRadius: 99,
                                background: 'rgba(0,255,136,0.15)', color: 'var(--accent-green)',
                            }}>ON</span>
                        )}
                    </div>
                    {filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {filtersOpen && (
                    <div style={{
                        borderTop: '1px solid var(--border-subtle)', padding: '12px 16px',
                        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
                    }}>
                        {/* Sort */}
                        <div style={{ minWidth: 120 }}>
                            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                                {t('Sort', '정렬')}
                            </label>
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value)}
                                style={{
                                    padding: '6px 8px', fontSize: 12, borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border-medium)', background: 'var(--bg-surface)',
                                    color: 'var(--text-primary)', width: '100%',
                                }}
                            >
                                <option value="" style={{ color: '#222', background: '#fff' }}>{t('Default (Ranking)', '기본 (랭킹순)')}</option>
                                <option value="ha" style={{ color: '#222', background: '#fff' }}>{t('Popular', '인기순')}</option>
                                <option value="aa" style={{ color: '#222', background: '#fff' }}>{t('Price: Low', '낮은가격순')}</option>
                                <option value="ad" style={{ color: '#222', background: '#fff' }}>{t('Price: High', '높은가격순')}</option>
                                <option value="da" style={{ color: '#222', background: '#fff' }}>{t('Newest', '최신순')}</option>
                                <option value="qa" style={{ color: '#222', background: '#fff' }}>{t('Min Qty: Low', '적은판매단위순')}</option>
                            </select>
                        </div>

                        {/* Market */}
                        <div style={{ minWidth: 100 }}>
                            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                                {t('Market', '마켓')}
                            </label>
                            <select
                                value={filterMarket}
                                onChange={e => setFilterMarket(e.target.value)}
                                style={{
                                    padding: '6px 8px', fontSize: 12, borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border-medium)', background: 'var(--bg-surface)',
                                    color: 'var(--text-primary)', width: '100%',
                                }}
                            >
                                <option value="dome" style={{ color: '#222', background: '#fff' }}>{t('Domeggook', '도매꾹')}</option>
                                <option value="supply" style={{ color: '#222', background: '#fff' }}>{t('Domemae', '도매매')}</option>
                            </select>
                        </div>

                        {/* Category (2-level) */}
                        <div style={{ minWidth: 130 }}>
                            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                                {t('Category', '카테고리')}
                            </label>
                            <select
                                value={filterCategory}
                                onChange={e => { setFilterCategory(e.target.value); setFilterSubCategory(''); }}
                                style={{
                                    padding: '6px 8px', fontSize: 12, borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border-medium)', background: 'var(--bg-surface)',
                                    color: 'var(--text-primary)', width: '100%',
                                }}
                            >
                                <option value="" style={{ color: '#222', background: '#fff' }}>{t('All', '전체')}</option>
                                {categories.filter(c => c.depth === 1).map(c => (
                                    <option key={c.code} value={c.code} style={{ color: '#222', background: '#fff' }}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Sub-Category */}
                        {filterCategory && categories.filter(c => c.depth === 2 && c.parent_code === filterCategory).length > 0 && (
                            <div style={{ minWidth: 130 }}>
                                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                                    {t('Sub-Category', '세부분류')}
                                </label>
                                <select
                                    value={filterSubCategory}
                                    onChange={e => setFilterSubCategory(e.target.value)}
                                    style={{
                                        padding: '6px 8px', fontSize: 12, borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--border-medium)', background: 'var(--bg-surface)',
                                        color: 'var(--text-primary)', width: '100%',
                                    }}
                                >
                                    <option value="" style={{ color: '#222', background: '#fff' }}>{t('All', '전체')}</option>
                                    {categories.filter(c => c.depth === 2 && c.parent_code === filterCategory).map(c => (
                                        <option key={c.code} value={c.code} style={{ color: '#222', background: '#fff' }}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Shipping */}
                        <div style={{ minWidth: 110 }}>
                            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                                {t('Shipping', '배송비')}
                            </label>
                            <select
                                value={filterShipping}
                                onChange={e => setFilterShipping(e.target.value)}
                                style={{
                                    padding: '6px 8px', fontSize: 12, borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border-medium)', background: 'var(--bg-surface)',
                                    color: 'var(--text-primary)', width: '100%',
                                }}
                            >
                                <option value="" style={{ color: '#222', background: '#fff' }}>{t('All', '전체')}</option>
                                <option value="S" style={{ color: '#222', background: '#fff' }}>{t('Free Shipping', '무료배송')}</option>
                                <option value="P" style={{ color: '#222', background: '#fff' }}>{t('Prepaid', '선결제')}</option>
                                <option value="B" style={{ color: '#222', background: '#fff' }}>{t('Cash on Delivery', '착불')}</option>
                            </select>
                        </div>

                        {/* Origin */}
                        <div style={{ minWidth: 90 }}>
                            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                                {t('Origin', '원산지')}
                            </label>
                            <select
                                value={filterOrigin}
                                onChange={e => setFilterOrigin(e.target.value)}
                                style={{
                                    padding: '6px 8px', fontSize: 12, borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border-medium)', background: 'var(--bg-surface)',
                                    color: 'var(--text-primary)', width: '100%',
                                }}
                            >
                                <option value="" style={{ color: '#222', background: '#fff' }}>{t('All', '전체')}</option>
                                <option value="kr" style={{ color: '#222', background: '#fff' }}>{t('Domestic', '국산')}</option>
                                <option value="fr" style={{ color: '#222', background: '#fff' }}>{t('Imported', '수입')}</option>
                            </select>
                        </div>

                        {/* Checkboxes */}
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingBottom: 2 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={filterGoodSeller} onChange={e => setFilterGoodSeller(e.target.checked)} />
                                {t('Good Seller', '우수판매자')}
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={filterFastDeli} onChange={e => setFilterFastDeli(e.target.checked)} />
                                {t('Fast Delivery', '빠른배송')}
                            </label>
                        </div>

                        {/* Reset */}
                        <button
                            onClick={() => { setSortBy(''); setFilterShipping(''); setFilterOrigin(''); setFilterGoodSeller(false); setFilterFastDeli(false); setFilterMarket('dome'); setFilterCategory(''); setFilterSubCategory(''); }}
                            style={{
                                padding: '6px 12px', fontSize: 11, fontWeight: 600,
                                border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                                background: 'var(--bg-surface)', color: 'var(--text-muted)', cursor: 'pointer',
                            }}
                        >
                            {t('Reset Filters', '필터 초기화')}
                        </button>
                    </div>
                )}
            </div>

            {/* Error */}
            {error && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '12px 16px', marginBottom: 16,
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 'var(--radius-sm)', color: '#ef4444', fontSize: 13,
                }}>
                    <AlertCircle size={14} />
                    {error}
                    <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>×</button>
                </div>
            )}

            {/* Results Header */}
            {header && header.numberOfItems > 0 && (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 16, padding: '12px 16px',
                    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                            {t(`${header.numberOfItems.toLocaleString()} products found`, `총 ${header.numberOfItems.toLocaleString()}개 상품`)}
                        </span>
                        <button
                            onClick={selectAll}
                            style={{
                                padding: '4px 10px', fontSize: 11, fontWeight: 600,
                                color: 'var(--accent-green)', background: 'transparent',
                                border: '1px solid var(--accent-green)', borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                            }}
                        >
                            {selected.size === items.length ? t('Deselect All', '전체 해제') : t('Select All', '전체 선택')}
                        </button>
                    </div>
                    {selected.size > 0 && (
                        <button
                            onClick={importSelected}
                            disabled={importing.size > 0}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '8px 16px', fontSize: 13, fontWeight: 700,
                                color: '#000', background: 'var(--accent-green)',
                                border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                opacity: importing.size > 0 ? 0.6 : 1,
                            }}
                        >
                            {importing.size > 0 ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                            {t(`Import ${selected.size} Selected`, `${selected.size}개 가져오기`)}
                        </button>
                    )}
                </div>
            )}

            {/* Product Grid */}
            {items.length > 0 && (
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px, 100%), 1fr))',
                    gap: 12, marginBottom: 24,
                }}>
                    {items.map(item => {
                        const isImported = importedSkus.has(item.no) || imported.has(item.no);
                        const isImporting = importing.has(item.no);
                        const isSelected = selected.has(item.no);

                        return (
                            <div
                                key={item.no}
                                onClick={() => !isImported && toggleSelect(item.no)}
                                style={{
                                    position: 'relative',
                                    padding: 16, cursor: isImported ? 'default' : 'pointer',
                                    background: isSelected ? 'rgba(0,255,136,0.05)' : 'var(--bg-card)',
                                    border: `1px solid ${isSelected ? 'var(--accent-green)' : isImported ? 'rgba(0,255,136,0.3)' : 'var(--border-subtle)'}`,
                                    borderRadius: 'var(--radius-md)',
                                    transition: 'all 150ms',
                                    opacity: isImporting ? 0.7 : 1,
                                }}
                            >
                                {/* Checkbox / Status */}
                                <div style={{ position: 'absolute', top: 10, right: 10 }}>
                                    {isImported ? (
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 4,
                                            padding: '2px 8px', fontSize: 10, fontWeight: 700,
                                            color: 'var(--accent-green)', background: 'rgba(0,255,136,0.1)',
                                            borderRadius: 'var(--radius-sm)',
                                        }}>
                                            <Check size={10} /> {t('Imported', '가져옴')}
                                        </div>
                                    ) : isImporting ? (
                                        <Loader2 size={16} className="spin" style={{ color: 'var(--accent-green)' }} />
                                    ) : (
                                        <div style={{
                                            width: 18, height: 18, borderRadius: 4,
                                            border: `2px solid ${isSelected ? 'var(--accent-green)' : 'var(--border-medium)'}`,
                                            background: isSelected ? 'var(--accent-green)' : 'transparent',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {isSelected && <Check size={12} color="#000" />}
                                        </div>
                                    )}
                                </div>

                                {/* Image */}
                                <div style={{
                                    width: '100%', height: 160, marginBottom: 12,
                                    borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                                    background: 'var(--bg-surface)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <img
                                        src={item.thumb}
                                        alt={item.title}
                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                </div>

                                {/* Title */}
                                <h3 style={{
                                    fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                                    margin: '0 0 8px', lineHeight: 1.4,
                                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden', textOverflow: 'ellipsis',
                                    paddingRight: 20,
                                }}>
                                    {item.title}
                                </h3>

                                {/* Price & Details */}
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                                    <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-green)' }}>
                                        ₩{formatPrice(item.domePrice || item.price)}
                                    </span>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        / {t('unit', '개')}
                                    </span>
                                </div>

                                {/* Meta */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, fontSize: 11 }}>
                                    <span style={{
                                        padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                                        background: 'var(--bg-surface)', color: 'var(--text-tertiary)',
                                    }}>
                                        MOQ: {item.unitQty}{t(' units', '개')}
                                    </span>
                                    {item.qty?.inventory && (
                                        <span style={{
                                            padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                                            background: 'var(--bg-surface)', color: 'var(--text-tertiary)',
                                        }}>
                                            {t('Stock', '재고')}: {parseInt(item.qty.inventory).toLocaleString()}
                                        </span>
                                    )}
                                    {item.deli?.fee && (
                                        <span style={{
                                            padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                                            background: 'var(--bg-surface)', color: 'var(--text-tertiary)',
                                        }}>
                                            {t('Shipping', '배송비')}: ₩{item.deli.fee.toLocaleString()}
                                        </span>
                                    )}
                                    {item.deli?.who === 'S' && (
                                        <span style={{
                                            padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                                            background: 'rgba(0,255,136,0.1)', color: 'var(--accent-green)',
                                        }}>
                                            {t('Free Ship', '무료배송')}
                                        </span>
                                    )}
                                    {item.lwp && (
                                        <span style={{
                                            padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                                            background: 'rgba(59,130,246,0.1)', color: '#3b82f6',
                                        }}>
                                            {t('Lowest', '최저가')}
                                        </span>
                                    )}
                                    {item.comOnly && (
                                        <span style={{
                                            padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                                            background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                                        }}>
                                            {t('Biz Only', '사업자전용')}
                                        </span>
                                    )}
                                    {item.adultOnly && (
                                        <span style={{
                                            padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                                            background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                                        }}>
                                            {t('Adult', '19+')}
                                        </span>
                                    )}
                                </div>

                                {/* Seller & Link */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        {item.nick || item.id || ''}
                                    </span>
                                    <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={e => e.stopPropagation()}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 3,
                                            fontSize: 10, color: 'var(--text-muted)', textDecoration: 'none',
                                        }}
                                    >
                                        <ExternalLink size={10} /> {t('View', '보기')}
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {header && header.numberOfPages > 1 && (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                    padding: '16px 0',
                }}>
                    <button
                        onClick={() => handleSearch(page - 1)}
                        disabled={page <= 1 || loading}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '8px 14px', fontSize: 12, fontWeight: 600,
                            color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)', cursor: page <= 1 ? 'default' : 'pointer',
                        }}
                    >
                        <ChevronLeft size={14} /> {t('Prev', '이전')}
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {page} / {header.numberOfPages.toLocaleString()}
                    </span>
                    <button
                        onClick={() => handleSearch(page + 1)}
                        disabled={page >= header.numberOfPages || loading}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '8px 14px', fontSize: 12, fontWeight: 600,
                            color: page >= header.numberOfPages ? 'var(--text-muted)' : 'var(--text-primary)',
                            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)', cursor: page >= header.numberOfPages ? 'default' : 'pointer',
                        }}
                    >
                        {t('Next', '다음')} <ChevronRight size={14} />
                    </button>
                </div>
            )}

            {/* Empty State */}
            {!loading && items.length === 0 && !error && (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '64px 20px', color: 'var(--text-muted)',
                }}>
                    <Package size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                        {t('Search Domeggook Products', '공급사 상품을 검색하세요')}
                    </p>
                    <p style={{ fontSize: 12 }}>
                        {t('Enter a keyword to find products', '키워드를 입력하면 상품을 찾을 수 있습니다')}
                    </p>
                </div>
            )}

            {/* Loading skeleton */}
            {loading && items.length === 0 && (
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px, 100%), 1fr))',
                    gap: 12,
                }}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} style={{
                            padding: 16, background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                        }}>
                            <div style={{ width: '100%', height: 160, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
                            <div style={{ height: 14, background: 'var(--bg-surface)', borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
                            <div style={{ height: 14, width: '60%', background: 'var(--bg-surface)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
                        </div>
                    ))}
                </div>
            )}

            <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
        </div>
    );
}
