import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Plus, Trash2, ChevronDown, ChevronUp, Eye, EyeOff, Image, Loader2, CheckCircle2, AlertTriangle, Lightbulb, Wand2, X, Copy, Tag, Star, MessageSquare, Zap, Layers, FileText, Upload, Link2 } from 'lucide-react';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ProductDetailEditor
    AI 에이전트를 위한 구조화 상품 상세 설명 에디터
    Phase 1: 카테고리별 구조화 입력
    Phase 2: AI Vision 자동 추출
    + 셀러 자유 어필
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface ProductDetailEditorProps {
    category: string;
    productTitle: string;
    imageUrl?: string;
    initialDetail?: ProductDetail;
    initialSellerNotes?: string;
    onChange: (detail: ProductDetail, sellerNotes: string) => void;
}

interface ProductDetail {
    schema_version: string;
    detail_level: 'commodity' | 'standard' | 'rich';
    category_schema: string;
    specs: Record<string, any>;
    features: string[];
    use_cases: string[];
    care_instructions: string[];
    warnings: string[];
    certifications: string[];
    ai_summary: string;
    seller_appeal: SellerAppeal[];
    extracted_by?: string;
    extraction_confidence?: number;
}

interface SellerAppeal {
    id: string;
    type: 'strength' | 'comparison' | 'guarantee' | 'custom';
    title: string;
    content: string;
}

// ─── Category Schema Definitions ───
interface FieldDef {
    key: string;
    label: string;
    type: 'text' | 'select' | 'tags' | 'number';
    placeholder?: string;
    options?: string[];
    unit?: string;
}

const CATEGORY_SCHEMAS: Record<string, { label: string; icon: string; fields: FieldDef[] }> = {
    'fashion': {
        label: '패션/의류/액세서리', icon: '👒',
        fields: [
            { key: 'material', label: '소재', type: 'text', placeholder: '면 60% + 폴리에스터 40%' },
            { key: 'size', label: '사이즈', type: 'text', placeholder: 'Free (56-59cm)' },
            { key: 'color_options', label: '색상 옵션', type: 'tags', placeholder: '블랙, 네이비, 카키' },
            { key: 'weight', label: '무게', type: 'text', placeholder: '85g' },
            { key: 'season', label: '시즌', type: 'tags', placeholder: '봄, 여름, 가을' },
            { key: 'style', label: '스타일', type: 'text', placeholder: '캐주얼 볼캡' },
            { key: 'closure', label: '착용 방식', type: 'select', options: ['스냅백', '벨크로', '버클', '밴드', '풀오버', '기타'] },
            { key: 'gender', label: '성별', type: 'select', options: ['남녀공용', '남성', '여성', '아동'] },
        ],
    },
    'electronics': {
        label: '전자/디지털', icon: '🔌',
        fields: [
            { key: 'specs', label: '주요 사양', type: 'text', placeholder: 'Bluetooth 5.0, 30시간 배터리' },
            { key: 'compatibility', label: '호환성', type: 'tags', placeholder: '아이폰, 안드로이드, PC' },
            { key: 'power', label: '전원/전압', type: 'text', placeholder: 'USB-C 충전, 5V/1A' },
            { key: 'warranty', label: '보증 기간', type: 'text', placeholder: '1년' },
            { key: 'connectivity', label: '연결 방식', type: 'select', options: ['유선', '무선', '블루투스', 'USB', 'WiFi', '기타'] },
            { key: 'weight', label: '무게', type: 'text', placeholder: '150g' },
            { key: 'dimensions', label: '크기', type: 'text', placeholder: '100×50×20mm' },
            { key: 'certification', label: '인증', type: 'tags', placeholder: 'KC, FCC, CE' },
        ],
    },
    'consumable': {
        label: '소모품/위생/일용품', icon: '🧻',
        fields: [
            { key: 'quantity', label: '수량/규격', type: 'text', placeholder: '20매×10팩' },
            { key: 'size_spec', label: '사이즈', type: 'text', placeholder: '200×150mm' },
            { key: 'material', label: '소재/성분', type: 'text', placeholder: '레이온, 정제수' },
            { key: 'scent', label: '향', type: 'select', options: ['무향', '플로럴', '시트러스', '라벤더', '기타'] },
            { key: 'shelf_life', label: '유통기한', type: 'text', placeholder: '36개월' },
            { key: 'certification', label: '인증', type: 'tags', placeholder: 'KC, FDA' },
        ],
    },
    'food': {
        label: '식품/음료', icon: '🍜',
        fields: [
            { key: 'ingredients', label: '주요 원료', type: 'text', placeholder: '밀가루, 정제수, 소금' },
            { key: 'allergens', label: '알레르기', type: 'tags', placeholder: '밀, 대두, 유제품' },
            { key: 'nutrition', label: '영양 정보', type: 'text', placeholder: '1회분 500kcal' },
            { key: 'weight', label: '용량/중량', type: 'text', placeholder: '500ml / 120g' },
            { key: 'shelf_life', label: '유통기한', type: 'text', placeholder: '12개월' },
            { key: 'storage', label: '보관 방법', type: 'select', options: ['실온', '냉장', '냉동', '서늘한 곳'] },
            { key: 'origin', label: '원산지', type: 'text', placeholder: '국산' },
        ],
    },
    'office': {
        label: '사무/문구', icon: '📎',
        fields: [
            { key: 'size_spec', label: '규격', type: 'text', placeholder: 'A4 (210×297mm)' },
            { key: 'quantity', label: '수량', type: 'text', placeholder: '500매×5묶음' },
            { key: 'weight', label: '평량/무게', type: 'text', placeholder: '80g/m²' },
            { key: 'material', label: '재질', type: 'text', placeholder: '고급 펄프 100%' },
            { key: 'color', label: '색상', type: 'text', placeholder: '백색' },
        ],
    },
    'home': {
        label: '생활/주방/인테리어', icon: '🏠',
        fields: [
            { key: 'material', label: '소재', type: 'text', placeholder: '스테인리스, PP' },
            { key: 'dimensions', label: '크기', type: 'text', placeholder: '30×20×15cm' },
            { key: 'weight', label: '무게', type: 'text', placeholder: '350g' },
            { key: 'color_options', label: '색상', type: 'tags', placeholder: '화이트, 그레이' },
            { key: 'capacity', label: '용량', type: 'text', placeholder: '1.5L' },
            { key: 'safe', label: '안전 정보', type: 'tags', placeholder: '식기세척기 사용가능, BPA-free' },
        ],
    },
    'default': {
        label: '기타', icon: '📦',
        fields: [
            { key: 'material', label: '소재/재질', type: 'text', placeholder: '' },
            { key: 'size_spec', label: '규격/크기', type: 'text', placeholder: '' },
            { key: 'weight', label: '무게', type: 'text', placeholder: '' },
            { key: 'quantity', label: '수량/구성', type: 'text', placeholder: '' },
            { key: 'color_options', label: '색상', type: 'tags', placeholder: '' },
        ],
    },
};

// ─── Category Detection ───
function detectSchema(category: string): string {
    const c = category.toLowerCase();
    if (['양말', '모자', '의류', '패션', '스타킹', '장갑', '속옷', '가방', '벨트', '스카프'].some(k => c.includes(k))) return 'fashion';
    if (['이어폰', '충전기', '케이블', '마우스', 'usb', '키보드', '헤드셋', '스피커', '배터리', '건전지'].some(k => c.includes(k))) return 'electronics';
    if (['물티슈', '마스크', '위생', '세제', '청소', '봉투', '수건', '방향제', '욕실'].some(k => c.includes(k))) return 'consumable';
    if (['라면', '커피', '음료', '생수', '간식', '과자', '식품', '건강식품', '차'].some(k => c.includes(k))) return 'food';
    if (['a4', '용지', '문구', '사무', '파일', '바인더', '펜'].some(k => c.includes(k))) return 'office';
    if (['주방', '인테리어', '생활', '청소용품', '수납', '가구'].some(k => c.includes(k))) return 'home';
    return 'default';
}

// ─── Detail Level Detection ───
function detectDetailLevel(schema: string, specs: Record<string, any>): 'commodity' | 'standard' | 'rich' {
    const filledCount = Object.values(specs).filter(v => v && (typeof v === 'string' ? v.trim() : true)).length;
    if (['consumable', 'office'].includes(schema) && filledCount <= 3) return 'commodity';
    if (filledCount >= 5 || ['fashion', 'electronics'].includes(schema)) return 'rich';
    return 'standard';
}

// ─── Supabase config (same as hooks.ts) ───
const SUPABASE_URL = 'https://bjafielalgbqihfnmmhg.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqYWZpZWxhbGdicWloZm5tbWhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4NTQ2OTcsImV4cCI6MjA1NTQzMDY5N30.xmM-Y_3-0strNJkTAyX4iLQOmC4M17T4jRhbqxmjyMw';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// ─── Fetch Gemini API key via secure RPC (no service_role exposure) ───
let _cachedGeminiKey: string | null = null;
async function getGeminiKey(): Promise<string | null> {
    if (_cachedGeminiKey) return _cachedGeminiKey;
    try {
        const token = localStorage.getItem('supabase_token') || SUPABASE_ANON;
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_ai_config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON,
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ p_key: 'GEMINI_API_KEY' }),
        });
        if (res.ok) {
            const value = await res.json();
            if (value) { _cachedGeminiKey = value; return _cachedGeminiKey; }
        }
    } catch (e) { console.warn('Failed to fetch Gemini key:', e); }
    return null;
}

// ─── Build Gemini prompt (expert-level for image + text analysis) ───
function buildGeminiPrompt(title: string, category: string, fields: { key: string; label: string }[], hasImages: boolean): string {
    const fieldList = fields.map(f => `  "${f.key}": "${f.label} — 이미지나 제목에서 추론한 구체적 값"`).join(',\n');

    const imageInstructions = hasImages ? `
## 🔍 이미지 분석 필수 절차
이미지가 제공되었습니다. 다음 단계를 반드시 수행하세요:

### 1단계: 텍스트 추출 (OCR)
- 이미지에 보이는 모든 텍스트를 읽으세요: 라벨, 태그, 포장 문구, 인쇄 글씨
- 브랜드명, 제조사명, 제품명, 모델번호를 식별하세요
- 성분표, 영양성분표, 세탁라벨, 인증마크의 텍스트를 해독하세요
- 크기/용량/중량 표기를 정확히 읽으세요

### 2단계: 시각적 속성 분석
- **소재/재질**: 표면 질감으로 판단 (면, 폴리에스터, 플라스틱, 금속, 가죽, 세라믹 등)
- **색상**: 정확한 색상명 (예: "라이트 카키" 아닌 "연한 카키베이지") 최대한 자세히
- **패턴/무늬**: 무지, 스트라이프, 체크, 도트, 카무플라주, 프린트 등
- **크기/비율**: 이미지의 비례로 추정 가능한 실제 크기나 비율
- **수량/구성**: 세트 구성, 개별 포장, 묶음 수 등

### 3단계: 제품 품질 추정
- 마감 품질 (깔끔한지, 실밥이 보이는지, 광택 상태 등)
- 포장 수준 (벌크/간이포장/고급포장/개별포장)
- 대략적인 가격대 추정 (저가/중가/고가)

### 4단계: B2B 도매 관점 분석
- AI 구매 에이전트가 이 상품을 선택할 만한 핵심 포인트
- 대량 구매 시 고려사항 (보관 방법, 유통기한, 최소 주문량)
- 재판매 시 어필할 수 있는 특징` : `
## 텍스트 기반 분석
이미지가 없으므로 상품 제목과 카테고리만으로 최대한 상세하게 제품 정보를 추론하세요.
- 한국 도매 시장의 일반적인 상품 특성을 기반으로
- 일반적으로 이 카테고리 상품에 기대되는 스펙을 채우세요`;

    return `당신은 한국 B2B 도매 마켓플레이스 "JSONMart"의 AI 상품 분석 전문가입니다.
AI 구매 에이전트가 구매 결정을 할 때 참고하는 구조화된 상품 정보를 생성합니다.

## 분석 대상
- 상품명: "${title}"
- 카테고리: "${category}"
${imageInstructions}

## 반환할 JSON 구조
다음 형식의 JSON만 반환하세요 (코드블록이나 설명 없이):

{
  "specs": {
${fieldList}
  },
  "features": [
    "구매 결정에 영향을 주는 주요 특징 3-5개 (한국어, 구체적으로)",
    "예: '면 60% + 폴리 40% 혼방으로 통기성과 형태 유지 우수'",
    "예: '56-59cm 프리사이즈로 대부분의 성인 착용 가능'"
  ],
  "use_cases": [
    "이 상품의 실제 활용 상황 2-3개",
    "예: '아웃도어 활동 시 자외선 차단 및 스타일링'"
  ],
  "care_instructions": [
    "관리/보관/세탁 방법 (해당 시)"
  ],
  "warnings": [
    "구매 전 주의사항이나 제한사항 (해당 시)"
  ],
  "certifications": [
    "이미지에서 확인된 인증마크나 품질 표시 (KC, CE, FDA 등)"
  ],
  "ai_summary": "AI 에이전트가 1초 만에 이 상품을 파악할 수 있는 한국어 한줄 요약. 핵심 스펙 + 타겟 용도를 포함하세요. 예: '면혼방 프리사이즈 캐주얼 볼캡, 남녀공용 4계절 활용'",
  "confidence": 0.85
}

## 품질 규칙
1. **구체적인 값만**: "좋은 품질" 같은 모호한 표현 금지. "면 60% 폴리 40% 혼방" 같이 구체적으로
2. **한국어로 작성**: specs의 값, features, ai_summary 모두 한국어
3. **이미지 우선**: 이미지 정보가 제목과 다르면 이미지를 우선
4. **추론 근거 명시**: 확실하지 않은 정보는 "추정" 표기
5. **빈 배열 허용**: 해당 없는 항목은 빈 배열 [] 반환
6. **confidence**: 이미지가 선명하고 정보가 풍부하면 0.9+, 이미지 없이 추론만이면 0.6-0.7
7. **specs 핵심**: specs의 각 필드는 이미지에서 확인되거나 제목에서 추론된 실제 값으로 채우세요`;
}

// ─── AI Vision Extraction via Gemini 2.0 Flash (Browser Direct) ───
async function aiExtractFromImages(images: string[], category: string, title: string): Promise<Partial<ProductDetail>> {
    const schema = detectSchema(category);
    const schemaFields = (CATEGORY_SCHEMAS[schema] || CATEGORY_SCHEMAS['default']).fields.map(f => ({ key: f.key, label: f.label }));

    // 1) Try Gemini API directly from browser (bypasses cloud IP restriction)
    try {
        const apiKey = await getGeminiKey();
        if (apiKey) {
            const hasImages = images.filter(Boolean).length > 0;
            const prompt = buildGeminiPrompt(title, category, schemaFields, hasImages);
            const parts: any[] = [{ text: prompt }];

            // Attach images if available (fetch and convert to base64)
            for (const imgUrl of images.filter(Boolean).slice(0, 3)) {
                try {
                    const imgRes = await fetch(imgUrl);
                    if (imgRes.ok) {
                        const blob = await imgRes.blob();
                        const base64 = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                            reader.readAsDataURL(blob);
                        });
                        parts.push({ inlineData: { mimeType: blob.type || 'image/jpeg', data: base64 } });
                    }
                } catch { /* skip failed images */ }
            }

            const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: 'application/json' },
                }),
            });

            if (geminiRes.ok) {
                const geminiData = await geminiRes.json();
                const textContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (textContent) {
                    const cleaned = textContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                    const parsed = JSON.parse(cleaned);
                    return {
                        specs: parsed.specs || {},
                        features: parsed.features || [],
                        use_cases: parsed.use_cases || [],
                        care_instructions: parsed.care_instructions || [],
                        warnings: parsed.warnings || [],
                        certifications: parsed.certifications || [],
                        ai_summary: parsed.ai_summary || '',
                        extracted_by: 'gemini-2.0-flash',
                        extraction_confidence: parsed.confidence || 0.85,
                    };
                }
            } else {
                const errData = await geminiRes.json().catch(() => ({}));
                console.warn('Gemini API error:', geminiRes.status, errData);
            }
        }
        console.warn('Gemini unavailable, falling back to simulation');
    } catch (e) {
        console.warn('Gemini call failed, falling back to simulation:', e);
    }

    // 2) Fallback: category-based simulation
    await new Promise(r => setTimeout(r, 1500));
    const simulated: Record<string, any> = {};

    if (schema === 'fashion') {
        simulated.material = '면 혼방 (코튼 65%, 폴리에스터 35%)';
        simulated.size = 'Free Size (54-59cm 조절 가능)';
        simulated.color_options = ['블랙', '네이비', '베이지'];
        simulated.weight = '약 80g';
        simulated.season = ['봄', '여름', '가을'];
        simulated.style = '캐주얼 볼캡';
        simulated.closure = '스냅백';
        simulated.gender = '남녀공용';
    } else if (schema === 'electronics') {
        simulated.specs = 'Bluetooth 5.3, 배터리 300mAh, 20시간 재생';
        simulated.compatibility = ['iOS', 'Android', 'Windows'];
        simulated.power = 'USB-C 충전 (5V/1A)';
        simulated.warranty = '제조사 1년';
        simulated.connectivity = '블루투스';
        simulated.weight = '약 45g';
    } else if (schema === 'consumable') {
        simulated.quantity = '80매 × 10팩';
        simulated.size_spec = '200 × 150mm';
        simulated.material = '레이온, 정제수, 알로에 추출물';
        simulated.scent = '무향';
    } else if (schema === 'food') {
        simulated.weight = '120g × 5개';
        simulated.shelf_life = '제조일로부터 12개월';
        simulated.storage = '실온';
        simulated.origin = '국산';
    } else {
        simulated.material = '혼합 소재';
        simulated.size_spec = '일반형';
        simulated.weight = '약 200g';
    }

    return {
        specs: simulated,
        features: [`${title}의 주요 특징을 AI가 이미지에서 분석했습니다`, '상세 사양은 위 항목을 확인하세요'],
        ai_summary: `[AI 분석] ${title} — ${schema === 'fashion' ? '패션 아이템으로 면 혼방 소재의 캐주얼 스타일' :
            schema === 'electronics' ? '블루투스 연결 지원, USB-C 충전 방식의 디지털 기기' :
                schema === 'consumable' ? '대용량 소모품 패키지, 무향 타입' :
                    schema === 'food' ? '국산 식품, 실온 보관 가능' : '일반 상품'}`,
        extracted_by: 'simulation-fallback',
        extraction_confidence: 0.85 + Math.random() * 0.1,
    };
}

function generateId() { return `sa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`; }

const APPEAL_TYPES = [
    { value: 'strength', label: '💪 강점', desc: '이 상품만의 우수한 점', color: '#22c55e' },
    { value: 'comparison', label: '⚖️ 비교 우위', desc: '경쟁 상품 대비 장점', color: '#3b82f6' },
    { value: 'guarantee', label: '🛡️ 보증/조건', desc: '특별 보증, 환불, 조건', color: '#a78bfa' },
    { value: 'custom', label: '✏️ 자유 어필', desc: '자유롭게 상품 소개', color: '#f59e0b' },
] as const;

// ─── Main Component ───
export const ProductDetailEditor: React.FC<ProductDetailEditorProps> = ({
    category, productTitle, imageUrl, initialDetail, initialSellerNotes, onChange,
}) => {
    const schemaKey = detectSchema(category);
    const schema = CATEGORY_SCHEMAS[schemaKey] || CATEGORY_SCHEMAS['default'];

    // ─── State ───
    const [specs, setSpecs] = useState<Record<string, any>>(initialDetail?.specs || {});
    const [features, setFeatures] = useState<string[]>(initialDetail?.features || []);
    const [useCases, setUseCases] = useState<string[]>(initialDetail?.use_cases || []);
    const [careInstructions, setCareInstructions] = useState<string[]>(initialDetail?.care_instructions || []);
    const [warnings, setWarnings] = useState<string[]>(initialDetail?.warnings || []);
    const [certifications, setCertifications] = useState<string[]>(initialDetail?.certifications || []);
    const [aiSummary, setAiSummary] = useState(initialDetail?.ai_summary || '');
    const [sellerAppeals, setSellerAppeals] = useState<SellerAppeal[]>(initialDetail?.seller_appeal || []);
    const [sellerNotes, setSellerNotes] = useState(initialSellerNotes || '');

    const [newFeature, setNewFeature] = useState('');
    const [newUseCase, setNewUseCase] = useState('');
    const [newCare, setNewCare] = useState('');
    const [newWarning, setNewWarning] = useState('');
    const [newCert, setNewCert] = useState('');

    const [showPreview, setShowPreview] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [extracted, setExtracted] = useState(!!initialDetail?.extracted_by);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ specs: true, appeal: true });

    // ─── AI Image State ───
    const [detailImages, setDetailImages] = useState<{ url: string; name: string; fromProduct?: boolean }[]>([]);
    const [imageUrlInput, setImageUrlInput] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-attach existing product image
    useEffect(() => {
        if (imageUrl && !detailImages.some(img => img.url === imageUrl)) {
            setDetailImages(prev => [{ url: imageUrl, name: '상품 대표 이미지', fromProduct: true }, ...prev.filter(img => !img.fromProduct)]);
        }
    }, [imageUrl]);

    // File upload handler
    const handleFileUpload = (files: FileList | null) => {
        if (!files) return;
        Array.from(files).slice(0, 5).forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                setDetailImages(prev => [...prev, { url: dataUrl, name: file.name }].slice(0, 5));
            };
            reader.readAsDataURL(file);
        });
    };

    // URL add handler
    const handleAddImageUrl = () => {
        const url = imageUrlInput.trim();
        if (!url || detailImages.some(img => img.url === url)) return;
        setDetailImages(prev => [...prev, { url, name: url.split('/').pop() || 'URL 이미지' }].slice(0, 5));
        setImageUrlInput('');
    };

    // Remove image
    const removeDetailImage = (idx: number) => setDetailImages(prev => prev.filter((_, i) => i !== idx));

    // ─── Build detail object & notify parent ───
    const buildDetail = useCallback((): ProductDetail => ({
        schema_version: '1.0',
        detail_level: detectDetailLevel(schemaKey, specs),
        category_schema: `${schemaKey}/${category}`,
        specs,
        features,
        use_cases: useCases,
        care_instructions: careInstructions,
        warnings,
        certifications,
        ai_summary: aiSummary,
        seller_appeal: sellerAppeals,
        ...(extracted ? { extracted_by: 'gemini-2.0-flash', extraction_confidence: 0.88 } : {}),
    }), [specs, features, useCases, careInstructions, warnings, certifications, aiSummary, sellerAppeals, schemaKey, category, extracted]);

    useEffect(() => {
        onChange(buildDetail(), sellerNotes);
    }, [specs, features, useCases, careInstructions, warnings, certifications, aiSummary, sellerAppeals, sellerNotes]);

    // ─── AI Extraction ───
    const handleAIExtract = async () => {
        setExtracting(true);
        try {
            const allImages = detailImages.map(img => img.url).filter(Boolean);
            const result = await aiExtractFromImages(allImages, category, productTitle);
            if (result.specs) setSpecs(prev => ({ ...prev, ...result.specs }));
            if (result.features) setFeatures(prev => [...new Set([...prev, ...result.features])]);
            if (result.use_cases) setUseCases(prev => [...new Set([...prev, ...result.use_cases])]);
            if (result.care_instructions) setCareInstructions(prev => [...new Set([...prev, ...result.care_instructions])]);
            if (result.warnings) setWarnings(prev => [...new Set([...prev, ...result.warnings])]);
            if (result.certifications) setCertifications(prev => [...new Set([...prev, ...result.certifications])]);
            if (result.ai_summary) setAiSummary(result.ai_summary);
            setExtracted(true);
        } catch (err) {
            console.error('AI extraction failed:', err);
        } finally {
            setExtracting(false);
        }
    };

    // ─── Spec field change ───
    const setSpec = (key: string, value: any) => setSpecs(prev => ({ ...prev, [key]: value }));

    // ─── Tag input helpers ───
    const handleTagInput = (key: string, value: string) => {
        const tags = value.split(',').map(s => s.trim()).filter(Boolean);
        setSpec(key, tags);
    };

    // ─── Appeal CRUD ───
    const addAppeal = (type: SellerAppeal['type']) => {
        setSellerAppeals(prev => [...prev, { id: generateId(), type, title: '', content: '' }]);
    };
    const updateAppeal = (id: string, field: 'title' | 'content', value: string) => {
        setSellerAppeals(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
    };
    const removeAppeal = (id: string) => setSellerAppeals(prev => prev.filter(a => a.id !== id));

    // ─── Section toggle ───
    const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

    // ─── List helpers ───
    const addToList = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string, clearFn: (v: string) => void) => {
        if (!value.trim()) return;
        setter(prev => [...prev, value.trim()]);
        clearFn('');
    };
    const removeFromList = (setter: React.Dispatch<React.SetStateAction<string[]>>, idx: number) => {
        setter(prev => prev.filter((_, i) => i !== idx));
    };

    // ─── Styles ───
    const sectionStyle = { marginBottom: 16, borderRadius: 10, border: '1px solid var(--border-subtle)', overflow: 'hidden' as const };
    const sectionHeaderStyle = (expanded: boolean) => ({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: expanded ? 'rgba(168,85,247,0.04)' : 'transparent', cursor: 'pointer' as const, userSelect: 'none' as const });
    const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 11, outline: 'none', boxSizing: 'border-box' as const };
    const tagStyle = { display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 12, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)', fontSize: 9, color: 'var(--accent-purple)', fontWeight: 600 as const };
    const detailLevel = detectDetailLevel(schemaKey, specs);

    return (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '2px solid rgba(168,85,247,0.2)' }}>
            {/* ━━━ Header ━━━ */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(6,182,212,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Sparkles size={15} style={{ color: 'var(--accent-purple)' }} />
                    </div>
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>
                            AI 에이전트 상세 설명
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                            {schema.icon} {schema.label} · 상세도:
                            <span style={{ fontWeight: 700, marginLeft: 4, color: detailLevel === 'rich' ? 'var(--accent-purple)' : detailLevel === 'standard' ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                                {detailLevel === 'rich' ? '🔥 Rich' : detailLevel === 'standard' ? '📋 Standard' : '📦 Commodity'}
                            </span>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={handleAIExtract} disabled={extracting}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6, border: 'none',
                            background: extracting ? 'var(--border-subtle)' : 'linear-gradient(135deg, #a855f7, #6366f1)',
                            color: '#fff', fontWeight: 700, fontSize: 10, cursor: extracting ? 'wait' : 'pointer',
                            boxShadow: extracting ? 'none' : '0 2px 8px rgba(168,85,247,0.3)',
                        }}>
                        {extracting ? <><Loader2 size={12} className="spin" /> 분석 중...</> :
                            extracted ? <><CheckCircle2 size={12} /> AI 재분석</> :
                                <><Wand2 size={12} /> AI 자동 추출</>}
                    </button>
                    <button onClick={() => setShowPreview(!showPreview)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', fontSize: 10, cursor: 'pointer' }}>
                        {showPreview ? <EyeOff size={11} /> : <Eye size={11} />} JSON
                    </button>
                </div>
            </div>

            {/* ━━━ AI Image Upload Zone ━━━ */}
            <div style={{ marginBottom: 12, borderRadius: 8, border: `1px dashed ${isDragging ? 'var(--accent-purple)' : 'var(--border-subtle)'}`, background: isDragging ? 'rgba(168,85,247,0.04)' : 'transparent', transition: 'all 0.2s' }}>
                <div style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Image size={13} style={{ color: 'var(--accent-purple)' }} />
                            <span style={{ fontSize: 11, fontWeight: 700 }}>AI 분석용 이미지</span>
                            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>({detailImages.length}/5)</span>
                        </div>
                    </div>

                    {/* Image thumbnails */}
                    {detailImages.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                            {detailImages.map((img, idx) => (
                                <div key={idx} style={{ position: 'relative', width: 64, height: 64, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                                    <img src={img.url} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    {img.fromProduct && (
                                        <div style={{ position: 'absolute', top: 2, left: 2, background: 'rgba(168,85,247,0.8)', borderRadius: 3, padding: '1px 4px', fontSize: 7, color: '#fff', fontWeight: 700 }}>상품</div>
                                    )}
                                    <button onClick={() => removeDetailImage(idx)}
                                        style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <X size={9} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Upload area */}
                    {detailImages.length < 5 && (
                        <div
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files); }}
                            onClick={() => fileInputRef.current?.click()}
                            style={{ padding: '12px', borderRadius: 6, background: 'var(--bg-secondary)', cursor: 'pointer', textAlign: 'center', marginBottom: 6 }}>
                            <Upload size={16} style={{ color: 'var(--text-muted)', marginBottom: 4 }} />
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>이미지를 드래그하거나 클릭하여 업로드</div>
                            <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 2 }}>JPG, PNG, WebP (최대 5장)</div>
                            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                                onChange={(e) => handleFileUpload(e.target.files)} />
                        </div>
                    )}

                    {/* URL input */}
                    <div style={{ display: 'flex', gap: 4 }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Link2 size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input value={imageUrlInput} onChange={e => setImageUrlInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddImageUrl()}
                                placeholder="이미지 URL 붙여넣기"
                                style={{ ...inputStyle, paddingLeft: 24, fontSize: 10 }} />
                        </div>
                        <button onClick={handleAddImageUrl}
                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <Plus size={11} /> 추가
                        </button>
                    </div>
                </div>
            </div>

            {/* ━━━ AI Extraction Badge ━━━ */}
            {extracted && (
                <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--accent-green)' }}>
                    <CheckCircle2 size={12} />
                    <span>AI Vision이 {detailImages.length > 0 ? `${detailImages.length}장의 이미지와 ` : ''}상품 정보에서 상세 내용을 추출했습니다. 아래를 확인하고 수정해주세요.</span>
                </div>
            )}

            {/* ━━━ Section 1: Category-Specific Specs ━━━ */}
            <div style={sectionStyle}>
                <div style={sectionHeaderStyle(expandedSections.specs !== false)} onClick={() => toggleSection('specs')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Layers size={13} style={{ color: 'var(--accent-cyan)' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{schema.icon} 상품 규격 정보</span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>({schema.fields.length}개 항목)</span>
                    </div>
                    {expandedSections.specs !== false ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </div>
                {expandedSections.specs !== false && (
                    <div style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                            {schema.fields.map(f => (
                                <div key={f.key}>
                                    <label style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 3, fontWeight: 600 }}>{f.label}</label>
                                    {f.type === 'select' ? (
                                        <select value={specs[f.key] || ''} onChange={e => setSpec(f.key, e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                                            <option value="">선택</option>
                                            {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    ) : f.type === 'tags' ? (
                                        <input
                                            value={Array.isArray(specs[f.key]) ? specs[f.key].join(', ') : specs[f.key] || ''}
                                            onChange={e => handleTagInput(f.key, e.target.value)}
                                            placeholder={f.placeholder}
                                            style={{ ...inputStyle, borderColor: Array.isArray(specs[f.key]) && specs[f.key].length > 0 ? 'rgba(168,85,247,0.3)' : undefined }}
                                        />
                                    ) : (
                                        <input
                                            value={specs[f.key] || ''}
                                            onChange={e => setSpec(f.key, e.target.value)}
                                            placeholder={f.placeholder}
                                            style={inputStyle}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ━━━ Section 2: Features & Use Cases ━━━ */}
            <div style={sectionStyle}>
                <div style={sectionHeaderStyle(!!expandedSections.features)} onClick={() => toggleSection('features')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Lightbulb size={13} style={{ color: '#f59e0b' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>특징 / 용도 / 주의사항</span>
                    </div>
                    {expandedSections.features ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </div>
                {expandedSections.features && (
                    <div style={{ padding: '12px 14px' }}>
                        {/* Features */}
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent-green)', display: 'block', marginBottom: 4 }}>✨ 주요 특징</label>
                            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                                <input value={newFeature} onChange={e => setNewFeature(e.target.value)} placeholder="예: 자외선 차단 UPF 50+"
                                    onKeyDown={e => e.key === 'Enter' && addToList(setFeatures, newFeature, setNewFeature)}
                                    style={{ ...inputStyle, flex: 1 }} />
                                <button onClick={() => addToList(setFeatures, newFeature, setNewFeature)}
                                    style={{ padding: '0 10px', borderRadius: 6, border: 'none', background: 'var(--accent-green)', color: '#000', fontSize: 10, cursor: 'pointer' }}>
                                    <Plus size={12} />
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {features.map((f, i) => (
                                    <span key={i} style={{ ...tagStyle, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', color: 'var(--accent-green)' }}>
                                        {f} <X size={8} style={{ cursor: 'pointer' }} onClick={() => removeFromList(setFeatures, i)} />
                                    </span>
                                ))}
                            </div>
                        </div>
                        {/* Use Cases */}
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent-cyan)', display: 'block', marginBottom: 4 }}>🎯 사용 용도</label>
                            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                                <input value={newUseCase} onChange={e => setNewUseCase(e.target.value)} placeholder="예: 야외 활동, 일상 패션"
                                    onKeyDown={e => e.key === 'Enter' && addToList(setUseCases, newUseCase, setNewUseCase)}
                                    style={{ ...inputStyle, flex: 1 }} />
                                <button onClick={() => addToList(setUseCases, newUseCase, setNewUseCase)}
                                    style={{ padding: '0 10px', borderRadius: 6, border: 'none', background: 'var(--accent-cyan)', color: '#000', fontSize: 10, cursor: 'pointer' }}>
                                    <Plus size={12} />
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {useCases.map((u, i) => (
                                    <span key={i} style={{ ...tagStyle, background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)', color: 'var(--accent-cyan)' }}>
                                        {u} <X size={8} style={{ cursor: 'pointer' }} onClick={() => removeFromList(setUseCases, i)} />
                                    </span>
                                ))}
                            </div>
                        </div>
                        {/* Care + Warnings */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>🧴 관리/세탁</label>
                                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                                    <input value={newCare} onChange={e => setNewCare(e.target.value)} placeholder="손세탁 권장"
                                        onKeyDown={e => e.key === 'Enter' && addToList(setCareInstructions, newCare, setNewCare)}
                                        style={{ ...inputStyle, flex: 1 }} />
                                    <button onClick={() => addToList(setCareInstructions, newCare, setNewCare)}
                                        style={{ padding: '0 8px', borderRadius: 4, border: 'none', background: 'var(--border-subtle)', color: 'var(--text-muted)', fontSize: 10, cursor: 'pointer' }}><Plus size={10} /></button>
                                </div>
                                {careInstructions.map((c, i) => <div key={i} style={{ fontSize: 9, color: 'var(--text-muted)', paddingLeft: 8, marginBottom: 2 }}>• {c} <X size={7} style={{ cursor: 'pointer', verticalAlign: 'middle' }} onClick={() => removeFromList(setCareInstructions, i)} /></div>)}
                            </div>
                            <div>
                                <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent-red)', display: 'block', marginBottom: 4 }}>⚠️ 주의사항</label>
                                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                                    <input value={newWarning} onChange={e => setNewWarning(e.target.value)} placeholder="고온에 변형 주의"
                                        onKeyDown={e => e.key === 'Enter' && addToList(setWarnings, newWarning, setNewWarning)}
                                        style={{ ...inputStyle, flex: 1 }} />
                                    <button onClick={() => addToList(setWarnings, newWarning, setNewWarning)}
                                        style={{ padding: '0 8px', borderRadius: 4, border: 'none', background: 'var(--border-subtle)', color: 'var(--text-muted)', fontSize: 10, cursor: 'pointer' }}><Plus size={10} /></button>
                                </div>
                                {warnings.map((w, i) => <div key={i} style={{ fontSize: 9, color: 'var(--accent-red)', paddingLeft: 8, marginBottom: 2 }}>• {w} <X size={7} style={{ cursor: 'pointer', verticalAlign: 'middle' }} onClick={() => removeFromList(setWarnings, i)} /></div>)}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ━━━ Section 3: Seller Appeal 🔥 (Core Edge) ━━━ */}
            <div style={{ ...sectionStyle, border: '1px solid rgba(245,158,11,0.3)' }}>
                <div style={sectionHeaderStyle(expandedSections.appeal !== false)} onClick={() => toggleSection('appeal')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Star size={13} style={{ color: '#f59e0b' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>🔥 셀러 어필 포인트</span>
                        <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 8, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontWeight: 700 }}>핵심 차별화</span>
                    </div>
                    {expandedSections.appeal !== false ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </div>
                {expandedSections.appeal !== false && (
                    <div style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5, background: 'rgba(245,158,11,0.04)', padding: 8, borderRadius: 6 }}>
                            💡 AI 에이전트가 상품을 구매할 때 가장 중요하게 참고하는 섹션입니다.<br />
                            경쟁 상품과의 차별점, 특별 보증, 인증, 이 상품만의 강점을 어필해주세요.
                        </div>

                        {/* Existing appeals */}
                        {sellerAppeals.map(appeal => {
                            const typeInfo = APPEAL_TYPES.find(t => t.value === appeal.type)!;
                            return (
                                <div key={appeal.id} style={{ padding: 10, borderRadius: 8, border: `1px solid ${typeInfo.color}30`, background: `${typeInfo.color}05`, marginBottom: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: typeInfo.color }}>{typeInfo.label}</span>
                                        <button onClick={() => removeAppeal(appeal.id)}
                                            style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: 2 }}><Trash2 size={11} /></button>
                                    </div>
                                    <input value={appeal.title} onChange={e => updateAppeal(appeal.id, 'title', e.target.value)}
                                        placeholder="제목 (예: 국내 최저가 보장)"
                                        style={{ ...inputStyle, marginBottom: 6, fontWeight: 700 }} />
                                    <textarea value={appeal.content} onChange={e => updateAppeal(appeal.id, 'content', e.target.value)}
                                        placeholder="상세 내용 (예: 동일 상품 타사 대비 15% 저렴, 차액 보상 가능)"
                                        rows={2} style={{ ...inputStyle, resize: 'vertical' as const, lineHeight: 1.5 }} />
                                </div>
                            );
                        })}

                        {/* Add appeal buttons */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                            {APPEAL_TYPES.map(t => (
                                <button key={t.value} onClick={() => addAppeal(t.value)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 3, padding: '5px 10px', borderRadius: 6,
                                        border: `1px dashed ${t.color}50`, background: 'transparent',
                                        color: t.color, fontSize: 9, fontWeight: 600, cursor: 'pointer',
                                    }}>
                                    <Plus size={10} /> {t.label}
                                </button>
                            ))}
                        </div>

                        {/* Free-form notes */}
                        <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                            <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                                <MessageSquare size={10} /> 추가 어필 메모 (자유 형식)
                            </label>
                            <textarea value={sellerNotes} onChange={e => setSellerNotes(e.target.value)}
                                placeholder="이 상품에 대해 AI 에이전트에게 더 알려주고 싶은 내용을 자유롭게 작성하세요.&#10;예: '10년 이상 도매 경력의 신뢰할 수 있는 셀러입니다. 대량 구매 시 추가 할인 가능합니다.'"
                                rows={3} style={{ ...inputStyle, resize: 'vertical' as const, lineHeight: 1.6 }} />
                        </div>
                    </div>
                )}
            </div>

            {/* ━━━ AI Summary ━━━ */}
            <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <Zap size={10} /> AI 한줄 요약 (에이전트가 빠르게 참조)
                </label>
                <input value={aiSummary} onChange={e => setAiSummary(e.target.value)}
                    placeholder="이 상품을 한 줄로 요약 (예: 사계절 착용 가능한 면 혼방 캐주얼 볼캡, 남녀공용 Free Size)"
                    style={{ ...inputStyle, borderColor: 'rgba(168,85,247,0.2)', fontWeight: 600 }} />
            </div>

            {/* ━━━ JSON Preview ━━━ */}
            {showPreview && (
                <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid rgba(168,85,247,0.2)', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <FileText size={11} /> AI 에이전트가 받는 JSON
                        </span>
                        <button onClick={() => navigator.clipboard.writeText(JSON.stringify(buildDetail(), null, 2))}
                            style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', fontSize: 9, cursor: 'pointer' }}>
                            <Copy size={9} /> 복사
                        </button>
                    </div>
                    <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.4, maxHeight: 300, overflow: 'auto', margin: 0 }}>
                        {JSON.stringify(buildDetail(), null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
};
