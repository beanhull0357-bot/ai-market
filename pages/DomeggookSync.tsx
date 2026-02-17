import React, { useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../context/LanguageContext';
import { Search, Download, Package, ExternalLink, Check, Loader2, AlertCircle, ChevronLeft, ChevronRight, Store } from 'lucide-react';

// ─── Domeggook API Config ───
const DOME_API_BASE = 'https://domeggook.com/ssl/api/';
const DOME_API_KEY = '59a4d8f9efc963d6446f86615902e416';

// ─── Types ───
interface DomeItem {
    no: string;
    title: string;
    thumb: string;
    price: string;
    unitQty: string;
    url: string;
    nick?: string;
    id?: string;
    domePrice?: string;
    deli?: { who: string; fee: number; add: string; fromOversea: string; type?: string; tbl?: string; periodDeli?: string; };
    market?: { domeggook: string; supply: string; };
    qty?: { inventory?: string; domeUnit?: string; };
    useopt?: string;
}

interface DomeHeader {
    numberOfItems: number;
    currentPage: number;
    numberOfPages: number;
    itemsPerPage: number;
}

interface DomeDetailResponse {
    domeggook: {
        basis: { no: number; status: string; title: string; keywords?: { kw: string[] }; tax: string; };
        price: { dome: string | number; supply?: number; };
        qty: { inventory: string; domeMoq: string; domeUnit: number; };
        deli: { method: string; periodDeli: string; dome?: { type: string; tbl: string }; };
        thumb: { original: string; large: string; };
        seller: { id: string; nick: string; rank: string; score: { avg: string; cnt: number }; };
        category: {
            parents?: { elem: { name: string; code: string; depth: number }[] };
            current: { name: string; code: string; depth: number };
        };
        detail: { country: string; manufacturer: string; };
        return?: { deliAmt: number; };
    };
}

// ─── Category Mapping ───
function mapCategory(categoryName: string): string {
    const lower = categoryName.toLowerCase();
    const mapping: Record<string, string> = {
        '식품': 'FOOD', '음료': 'FOOD', '건강식품': 'FOOD', '과자': 'FOOD',
        '생활용품': 'HOUSEHOLD', '주방': 'HOUSEHOLD', '욕실': 'HOUSEHOLD', '세제': 'HOUSEHOLD',
        '화장지': 'CONSUMABLES', '티슈': 'CONSUMABLES', '물티슈': 'CONSUMABLES', '위생': 'CONSUMABLES',
        '사무': 'OFFICE', '문구': 'OFFICE', '복사': 'OFFICE',
        '패션': 'FASHION', '의류': 'FASHION', '신발': 'FASHION', '가방': 'FASHION',
        '화장품': 'BEAUTY', '뷰티': 'BEAUTY', '미용': 'BEAUTY',
        '디지털': 'DIGITAL', '전자': 'DIGITAL', '컴퓨터': 'DIGITAL',
        '스포츠': 'SPORTS', '레저': 'SPORTS', '캠핑': 'SPORTS',
    };
    for (const [key, val] of Object.entries(mapping)) {
        if (lower.includes(key)) return val;
    }
    return 'OTHER';
}

// ─── API Helpers ───
async function searchDomeggook(keyword: string, page: number = 1, size: number = 20): Promise<{ items: DomeItem[]; header: DomeHeader }> {
    const params = new URLSearchParams({
        ver: '4.1', mode: 'getItemList', aid: DOME_API_KEY,
        market: 'dome', om: 'json', sz: String(size), pg: String(page), kw: keyword,
    });
    const res = await fetch(`${DOME_API_BASE}?${params.toString()}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    if (data.errors) throw new Error(data.errors.message || 'API 오류');
    const list = data.domeggook?.list?.item || [];
    const items = Array.isArray(list) ? list : [list];
    return { items, header: data.domeggook?.header || { numberOfItems: 0, currentPage: 1, numberOfPages: 1, itemsPerPage: size } };
}

async function getItemDetail(itemNo: string): Promise<DomeDetailResponse> {
    const params = new URLSearchParams({
        ver: '4.1', mode: 'getItemView', aid: DOME_API_KEY, no: itemNo, om: 'json',
    });
    const res = await fetch(`${DOME_API_BASE}?${params.toString()}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    if (data.errors) throw new Error(data.errors.message || 'API 오류');
    return data;
}

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

    // Load already imported source_ids on mount
    React.useEffect(() => {
        (async () => {
            const { data } = await supabase.from('products').select('source_id').eq('source', 'domeggook');
            if (data) setImportedSkus(new Set(data.map((r: any) => r.source_id)));
        })();
    }, []);

    const handleSearch = useCallback(async (pg: number = 1) => {
        if (!keyword.trim()) return;
        setLoading(true);
        setError('');
        try {
            const result = await searchDomeggook(keyword.trim(), pg);
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
    }, [keyword]);

    const toggleSelect = (no: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(no) ? next.delete(no) : next.add(no);
            return next;
        });
    };

    const selectAll = () => {
        if (selected.size === items.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(items.map(i => i.no)));
        }
    };

    const importSelected = async () => {
        const toImport = items.filter(i => selected.has(i.no) && !importedSkus.has(i.no));
        if (toImport.length === 0) return;

        for (const item of toImport) {
            setImporting(prev => new Set(prev).add(item.no));
            try {
                // Fetch detail for full data
                const detail = await getItemDetail(item.no);
                const d = detail.domeggook;

                // Extract price (can be string like "1+500|11+480")
                let price = 0;
                const priceStr = String(d.price.dome);
                if (priceStr.includes('+')) {
                    const firstPart = priceStr.split('|')[0];
                    price = parseInt(firstPart.split('+')[1]) || 0;
                } else {
                    price = parseInt(priceStr) || 0;
                }

                // Parse seller trust from percentage
                let sellerTrust = 0;
                const scoreStr = d.seller?.score?.avg || '0';
                sellerTrust = parseInt(scoreStr.replace('%', '')) || 0;

                // Choose category from parent chain
                const categoryName = d.category?.parents?.elem?.[0]?.name || d.category?.current?.name || '';
                const category = mapCategory(categoryName);

                const productData = {
                    sku: `DOME-${d.basis.no}`,
                    category,
                    title: d.basis.title,
                    brand: d.seller?.nick || '',
                    price,
                    currency: 'KRW',
                    stock_status: d.basis.status === '판매중' ? 'in_stock' : 'out_of_stock',
                    stock_qty: parseInt(d.qty.inventory) || null,
                    ship_by_days: parseInt(d.deli.periodDeli) || 1,
                    eta_days: (parseInt(d.deli.periodDeli) || 1) + 2,
                    return_days: 7,
                    return_fee: d.return?.deliAmt || 0,
                    ai_readiness_score: 70,
                    seller_trust: sellerTrust,
                    attributes: {
                        min_qty: parseInt(d.qty.domeMoq) || 1,
                        country: d.detail?.country || '',
                        manufacturer: d.detail?.manufacturer || '',
                        deli_method: d.deli?.method || '',
                        keywords: d.basis.keywords?.kw || [],
                        dome_category: d.category?.current?.name || '',
                        dome_category_code: d.category?.current?.code || '',
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

    const formatPrice = (p: string | number) => {
        const n = parseInt(String(p)) || 0;
        return n.toLocaleString();
    };

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px' }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Store size={24} style={{ color: 'var(--accent-green)' }} />
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        {t('Domeggook Sync', '도매꼭 연동')}
                    </h1>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>
                    {t('Search and import wholesale products from Domeggook into JSONMart catalog', '도매꼭에서 상품을 검색하고 JSONMart 카탈로그로 가져올 수 있습니다')}
                </p>
            </div>

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
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
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
                        {t('Search Domeggook Products', '도매꼭 상품을 검색하세요')}
                    </p>
                    <p style={{ fontSize: 12 }}>
                        {t('Enter a keyword to find wholesale products', '키워드를 입력하면 도매 상품을 찾을 수 있습니다')}
                    </p>
                </div>
            )}

            {/* Loading skeleton */}
            {loading && items.length === 0 && (
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
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
