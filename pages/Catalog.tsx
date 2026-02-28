import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Code2, Eye, EyeOff, Search, Package, Bot, User, Database, ChevronRight, Terminal, Zap, Shield, Globe, Copy, Check, Filter, ArrowRight } from 'lucide-react';
import { useProducts } from '../hooks';
import { useLanguage } from '../context/LanguageContext';
import { ProductPack } from '../types';

/* ━━━ Category Colors ━━━ */
const CATEGORY_COLORS: Record<string, string> = {
    CONSUMABLES: '#34d399',
    MRO: '#60a5fa',
    FOOD: '#fbbf24',
    OFFICE: '#a78bfa',
    HOUSEHOLD: '#f472b6',
    FASHION: '#fb923c',
    BEAUTY: '#e879f9',
    DIGITAL: '#22d3ee',
    SPORTS: '#4ade80',
    PETS: '#facc15',
    BABY: '#fb7185',
    OTHER: '#94a3b8',
};

function getCategoryColor(cat: string): string {
    return CATEGORY_COLORS[cat] || CATEGORY_COLORS.OTHER;
}

/* ━━━ Typing Animation Hook ━━━ */
function useTypingEffect(text: string, speed = 30) {
    const [displayed, setDisplayed] = useState('');
    useEffect(() => {
        setDisplayed('');
        let i = 0;
        const iv = setInterval(() => {
            setDisplayed(text.slice(0, ++i));
            if (i >= text.length) clearInterval(iv);
        }, speed);
        return () => clearInterval(iv);
    }, [text, speed]);
    return displayed;
}

/* ━━━ JSON Syntax Highlighter ━━━ */
function SyntaxHighlight({ json, compact = false }: { json: string; compact?: boolean }) {
    const lines = json.split('\n');
    return (
        <pre style={{
            margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            lineHeight: compact ? 1.5 : 1.7, fontSize: compact ? 11 : 12,
            fontFamily: 'var(--font-mono)',
        }}>
            {lines.map((line, i) => {
                const colored = line
                    .replace(/"([^"]+)"(?=\s*:)/g, '<k>"$1"</k>')
                    .replace(/:\s*"([^"]*)"(?=[,\n\r}]|$)/g, ': <s>"$1"</s>')
                    .replace(/:\s*(\d+\.?\d*)(?=[,\n\r}\]]|$)/g, ': <n>$1</n>')
                    .replace(/:\s*(true|false|null)(?=[,\n\r}\]]|$)/g, ': <b>$1</b>');
                return (
                    <span key={i} style={{ display: 'block' }}>
                        <span
                            style={{ color: 'var(--text-dim)', userSelect: 'none', display: 'inline-block', width: 32, textAlign: 'right', marginRight: 16, fontSize: 10 }}
                        >
                            {i + 1}
                        </span>
                        <span dangerouslySetInnerHTML={{ __html: colored }} />
                    </span>
                );
            })}
        </pre>
    );
}

/* ━━━ Product to Agent JSON ━━━ */
function productToAgentJson(p: ProductPack): object {
    return {
        sku: p.sku,
        title: p.title,
        category: p.category,
        brand: p.identifiers?.brand || null,
        offer: {
            price: p.offer.price,
            currency: p.offer.currency || 'KRW',
            stock_status: p.offer.stockStatus,
            stock_qty: p.offer.stockQty ?? null,
            ship_by_days: p.offer.shipByDays,
            eta_days: p.offer.etaDays,
        },
        policies: {
            return_days: p.policies.returnDays,
            return_fee: p.policies.returnFee,
        },
        quality_signals: {
            ai_readiness_score: p.qualitySignals.aiReadinessScore,
            seller_trust: p.qualitySignals.sellerTrust,
        },
        seller: p.sellerId ? { id: p.sellerId, name: p.sellerName || null } : null,
    };
}

/* ━━━ Category Summary JSON ━━━ */
function buildCatalogSummary(products: ProductPack[], categories: string[]) {
    const summary: Record<string, any> = {};
    categories.forEach(cat => {
        const catProducts = products.filter(p => p.category === cat);
        if (catProducts.length > 0) {
            summary[cat] = {
                count: catProducts.length,
                price_range: {
                    min: Math.min(...catProducts.map(p => p.offer.price)),
                    max: Math.max(...catProducts.map(p => p.offer.price)),
                    currency: 'KRW',
                },
                in_stock: catProducts.filter(p => p.offer.stockStatus === 'in_stock').length,
                avg_trust: Math.round(catProducts.reduce((s, p) => s + p.qualitySignals.sellerTrust, 0) / catProducts.length),
            };
        }
    });
    return summary;
}

/* ━━━ Copy Button ━━━ */
function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button
            onClick={handleCopy}
            style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', fontSize: 10, fontWeight: 600,
                background: copied ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${copied ? 'rgba(52,211,153,0.3)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                color: copied ? 'var(--accent-green)' : 'var(--text-muted)',
                transition: 'all 200ms',
            }}
        >
            {copied ? <Check size={10} /> : <Copy size={10} />}
            {copied ? 'Copied' : 'Copy'}
        </button>
    );
}

/* ━━━ Scan Line Animation ━━━ */
function ScanLine() {
    return (
        <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 1,
            background: 'linear-gradient(90deg, transparent, var(--accent-green), transparent)',
            animation: 'scanDown 4s linear infinite', opacity: 0.3, pointerEvents: 'none',
        }} />
    );
}

/* ━━━ Main Component ━━━ */
export const Catalog: React.FC = () => {
    const { t } = useLanguage();
    const { products, loading } = useProducts();
    const [isHumanView, setIsHumanView] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 20;

    // Terminal typing effect for the header
    const terminalText = useTypingEffect(
        '$ curl -s https://jsonmart.xyz/api/v1/catalog | jq',
        25
    );

    // Get all unique categories
    const categories = useMemo(() => {
        const cats = [...new Set(products.map(p => p.category))].sort();
        return cats;
    }, [products]);

    // Filtered products
    const filtered = useMemo(() => {
        let result = products;
        if (selectedCategory !== 'ALL') {
            result = result.filter(p => p.category === selectedCategory);
        }
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(p =>
                p.title.toLowerCase().includes(term) ||
                p.sku.toLowerCase().includes(term) ||
                (p.identifiers?.brand || '').toLowerCase().includes(term)
            );
        }
        return result;
    }, [products, selectedCategory, searchTerm]);

    // Paginated
    const paginated = useMemo(() => {
        return filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    }, [filtered, page]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

    // Stats
    const stats = useMemo(() => ({
        total: products.length,
        inStock: products.filter(p => p.offer.stockStatus === 'in_stock').length,
        categories: categories.length,
        avgTrust: products.length > 0 ? Math.round(products.reduce((s, p) => s + p.qualitySignals.sellerTrust, 0) / products.length) : 0,
    }), [products, categories]);

    // Build catalog JSON for the overview
    const catalogJson = useMemo(() => {
        return JSON.stringify({
            endpoint: 'https://jsonmart.xyz/api/v1/catalog',
            protocol: 'REST + MCP + A2A',
            total_products: products.length,
            categories: buildCatalogSummary(products, categories),
            api_access: {
                search: 'POST /api/v1/catalog { action: "search_products" }',
                detail: 'POST /api/v1/catalog { action: "get_product", sku: "..." }',
                mcp: 'MCP tools/call { name: "search_products" }',
            },
            auth_required: false,
            message: 'AI agents can access this catalog programmatically. No login needed.',
        }, null, 2);
    }, [products, categories]);

    // Full product list JSON
    const productListJson = useMemo(() => {
        const items = paginated.map(productToAgentJson);
        return JSON.stringify({
            results: items,
            pagination: { page: page + 1, per_page: PAGE_SIZE, total: filtered.length, total_pages: totalPages },
            filter: { category: selectedCategory === 'ALL' ? null : selectedCategory, query: searchTerm || null },
        }, null, 2);
    }, [paginated, page, filtered.length, totalPages, selectedCategory, searchTerm]);

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-root)', color: 'var(--text-secondary)' }}>

            {/* ━━━ Hero / Terminal Header ━━━ */}
            <div style={{
                position: 'relative', overflow: 'hidden',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'linear-gradient(180deg, rgba(52,211,153,0.03) 0%, transparent 100%)',
            }}>
                {/* Grid overlay */}
                <div style={{
                    position: 'absolute', inset: 0, opacity: 0.02,
                    backgroundImage: 'linear-gradient(var(--text-dim) 1px, transparent 1px), linear-gradient(90deg, var(--text-dim) 1px, transparent 1px)',
                    backgroundSize: '40px 40px', pointerEvents: 'none',
                }} />

                <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: 'clamp(24px, 5vw, 48px) clamp(16px, 4vw, 24px)' }}>
                    {/* Status row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                                width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-green)',
                                boxShadow: '0 0 8px var(--accent-green)', animation: 'livePulse 2s infinite',
                            }} />
                            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: 'var(--accent-green)', textTransform: 'uppercase' }}>
                                Live Catalog
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                — {stats.total} products indexed
                            </span>
                        </div>

                        {/* View Toggle */}
                        <button
                            onClick={() => setIsHumanView(!isHumanView)}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                padding: '6px 16px', borderRadius: 'var(--radius-full)',
                                background: isHumanView ? 'rgba(96,165,250,0.12)' : 'rgba(52,211,153,0.12)',
                                border: `1px solid ${isHumanView ? 'rgba(96,165,250,0.3)' : 'rgba(52,211,153,0.3)'}`,
                                color: isHumanView ? '#60a5fa' : 'var(--accent-green)',
                                fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                                cursor: 'pointer', transition: 'all 0.3s ease',
                            }}
                        >
                            {isHumanView ? <Eye size={13} /> : <Terminal size={13} />}
                            {isHumanView ? (t('catalog.humanView') || 'Human View') : (t('catalog.jsonView') || 'Agent View')}
                            <div style={{
                                width: 32, height: 16, borderRadius: 8,
                                background: isHumanView ? '#60a5fa' : 'var(--accent-green)',
                                position: 'relative', transition: 'all 0.3s ease',
                            }}>
                                <div style={{
                                    width: 12, height: 12, borderRadius: '50%',
                                    background: 'white', position: 'absolute', top: 2,
                                    left: isHumanView ? 18 : 2, transition: 'left 0.3s ease',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                }} />
                            </div>
                        </button>
                    </div>

                    {/* Terminal-style title */}
                    <h1 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 900, margin: '0 0 8px', lineHeight: 1.1 }}>
                        <span style={{ color: 'var(--text-primary)' }}>{t('catalog.title') || 'Product Catalog'}</span>
                        <span style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)', fontSize: '0.6em', marginLeft: 12 }}>.json</span>
                    </h1>
                    <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 20px', maxWidth: 560 }}>
                        {t('catalog.subtitle') || 'Live product data in JSON — as AI agents see it. No images, no marketing. Just structured data for autonomous purchasing.'}
                    </p>

                    {/* Terminal prompt */}
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '8px 16px', borderRadius: 'var(--radius-md)',
                        background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-subtle)',
                        fontFamily: 'var(--font-mono)', fontSize: 12,
                    }}>
                        <span style={{ color: 'var(--accent-green)' }}>❯</span>
                        <span style={{ color: 'var(--text-tertiary)' }}>{terminalText}</span>
                        <span style={{ animation: 'blink 1s step-end infinite', color: 'var(--accent-green)' }}>▊</span>
                    </div>
                </div>
            </div>

            {/* ━━━ Stats Strip ━━━ */}
            <div style={{
                maxWidth: 1100, margin: '0 auto', padding: '16px clamp(16px, 4vw, 24px)',
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
            }} className="grid-responsive-4">
                {[
                    { label: 'Total Products', value: stats.total, icon: <Package size={14} />, color: 'var(--accent-cyan)' },
                    { label: 'Categories', value: stats.categories, icon: <Filter size={14} />, color: 'var(--accent-purple)' },
                    { label: 'In Stock', value: stats.inStock, icon: <Check size={14} />, color: 'var(--accent-green)' },
                    { label: 'Avg Trust', value: stats.avgTrust, icon: <Shield size={14} />, color: 'var(--accent-amber)' },
                ].map(s => (
                    <div key={s.label} style={{
                        padding: '12px 14px', borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                        display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                        <span style={{ color: s.color }}>{s.icon}</span>
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: s.color }}>
                                {loading ? '...' : s.value}
                            </div>
                            <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: 1, textTransform: 'uppercase' }}>
                                {s.label}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ━━━ Search + Category Filter ━━━ */}
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 clamp(16px, 4vw, 24px) 16px' }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Search */}
                    <div style={{
                        flex: '1 1 260px', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 14px', borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                    }}>
                        <Search size={14} style={{ color: 'var(--text-dim)' }} />
                        <input
                            type="text"
                            placeholder={t('catalog.searchPlaceholder') || 'Search by SKU, title, or brand...'}
                            value={searchTerm}
                            onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
                            style={{
                                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                                color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)',
                            }}
                        />
                    </div>

                    {/* Category Toggle Chips */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                            onClick={() => { setSelectedCategory('ALL'); setPage(0); }}
                            style={{
                                padding: '5px 12px', fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                                borderRadius: 'var(--radius-full)', cursor: 'pointer', transition: 'all 200ms',
                                border: `1px solid ${selectedCategory === 'ALL' ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                                background: selectedCategory === 'ALL' ? 'rgba(52,211,153,0.12)' : 'transparent',
                                color: selectedCategory === 'ALL' ? 'var(--accent-green)' : 'var(--text-muted)',
                            }}
                        >
                            ALL ({products.length})
                        </button>
                        {categories.map(cat => {
                            const count = products.filter(p => p.category === cat).length;
                            const color = getCategoryColor(cat);
                            const isActive = selectedCategory === cat;
                            return (
                                <button
                                    key={cat}
                                    onClick={() => { setSelectedCategory(cat); setPage(0); }}
                                    style={{
                                        padding: '5px 12px', fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                                        borderRadius: 'var(--radius-full)', cursor: 'pointer', transition: 'all 200ms',
                                        border: `1px solid ${isActive ? color : 'var(--border-subtle)'}`,
                                        background: isActive ? `${color}18` : 'transparent',
                                        color: isActive ? color : 'var(--text-muted)',
                                    }}
                                >
                                    {cat} ({count})
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ━━━ Main Content ━━━ */}
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 clamp(16px, 4vw, 24px) 48px' }}>
                {loading ? (
                    <div style={{ padding: 48, textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--accent-green)', fontSize: 13 }}>
                            <Database size={16} className="animate-spin" />
                            Fetching product catalog from Supabase...
                        </div>
                    </div>
                ) : isHumanView ? (
                    /* ━━━ HUMAN VIEW ━━━ */
                    <div>
                        <div style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                        }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
                                borderBottom: '1px solid var(--border-subtle)',
                                background: 'rgba(96,165,250,0.05)',
                            }}>
                                <Eye size={14} style={{ color: '#60a5fa' }} />
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', letterSpacing: 1, textTransform: 'uppercase' }}>
                                    Human-Readable View
                                </span>
                                <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>
                                    {filtered.length} products
                                </span>
                            </div>

                            <table style={{ width: '100%', textAlign: 'left', fontSize: 12, fontFamily: 'var(--font-mono)', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                        {['Category', 'SKU', 'Product Name', 'Price (KRW)', 'Stock', 'Trust', 'AI Score'].map(h => (
                                            <th key={h} style={{ padding: '10px 14px', fontWeight: 700, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-dim)', borderBottom: '1px solid var(--border-subtle)' }}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.map((p, idx) => (
                                        <tr key={p.sku} style={{
                                            borderBottom: '1px solid var(--border-subtle)',
                                            transition: 'background 150ms',
                                            cursor: 'default',
                                        }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            <td style={{ padding: '10px 14px' }}>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                                    padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                                    background: `${getCategoryColor(p.category)}15`,
                                                    border: `1px solid ${getCategoryColor(p.category)}30`,
                                                    fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                                                    color: getCategoryColor(p.category),
                                                }}>
                                                    {p.category}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 11 }}>{p.sku}</td>
                                            <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>{p.title}</td>
                                            <td style={{ padding: '10px 14px', color: 'var(--accent-green)', fontWeight: 700 }}>₩{p.offer.price.toLocaleString()}</td>
                                            <td style={{ padding: '10px 14px' }}>
                                                <span style={{
                                                    color: p.offer.stockStatus === 'in_stock' ? 'var(--accent-green)' : 'var(--accent-red)',
                                                    fontWeight: 600,
                                                }}>
                                                    {p.offer.stockQty ?? '—'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 14px', color: 'var(--accent-amber)', fontWeight: 700 }}>{p.qualitySignals.sellerTrust}</td>
                                            <td style={{ padding: '10px 14px' }}>
                                                <span style={{
                                                    color: p.qualitySignals.aiReadinessScore >= 90 ? 'var(--accent-green)' : p.qualitySignals.aiReadinessScore >= 70 ? 'var(--accent-amber)' : 'var(--accent-red)',
                                                    fontWeight: 700,
                                                }}>
                                                    {p.qualitySignals.aiReadinessScore}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* ━━━ JSON / AGENT VIEW ━━━ */
                    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }} className="grid-responsive-4">

                        {/* Left Panel — Catalog Overview */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {/* Catalog Summary JSON */}
                            <div style={{
                                borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                                border: '1px solid rgba(52,211,153,0.2)',
                                background: 'linear-gradient(180deg, rgba(52,211,153,0.04) 0%, var(--bg-card) 100%)',
                            }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '10px 14px', borderBottom: '1px solid rgba(52,211,153,0.1)',
                                    background: 'rgba(52,211,153,0.05)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Globe size={12} style={{ color: 'var(--accent-green)' }} />
                                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-green)', letterSpacing: 1 }}>CATALOG MANIFEST</span>
                                    </div>
                                    <CopyButton text={catalogJson} />
                                </div>
                                <div style={{ padding: '12px 14px', maxHeight: 400, overflow: 'auto' }}>
                                    <SyntaxHighlight json={catalogJson} compact />
                                </div>
                            </div>

                            {/* API Access Info */}
                            <div style={{
                                padding: 16, borderRadius: 'var(--radius-lg)',
                                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                    <Zap size={12} style={{ color: 'var(--accent-cyan)' }} />
                                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-cyan)', letterSpacing: 1 }}>API ACCESS</span>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <span style={{ color: 'var(--accent-green)', fontSize: 10 }}>●</span>
                                        <span>REST API — no auth for reads</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <span style={{ color: 'var(--accent-green)', fontSize: 10 }}>●</span>
                                        <span>MCP Protocol — tool: search_products</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ color: 'var(--accent-green)', fontSize: 10 }}>●</span>
                                        <span>A2A Network — agent-to-agent queries</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Panel — Product List JSON */}
                        <div style={{
                            borderRadius: 'var(--radius-lg)', overflow: 'hidden', position: 'relative',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-card)',
                        }}>
                            <ScanLine />

                            {/* Header */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)',
                                background: 'rgba(0,0,0,0.2)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{
                                        display: 'flex', gap: 5,
                                    }}>
                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fbbf24' }} />
                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#34d399' }} />
                                    </div>
                                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                        catalog_response.json — {filtered.length} results
                                    </span>
                                </div>
                                <CopyButton text={productListJson} />
                            </div>

                            {/* JSON Content */}
                            <div style={{ padding: '12px 14px', maxHeight: 'calc(100vh - 360px)', overflow: 'auto' }}>
                                {paginated.length === 0 ? (
                                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>
                                        <Database size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                                        <div style={{ fontSize: 12 }}>No products match filters</div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Product entries — interactive JSON blocks */}
                                        {paginated.map((p, idx) => {
                                            const isExpanded = expandedProduct === p.sku;
                                            const jsonStr = JSON.stringify(productToAgentJson(p), null, 2);
                                            const compactStr = `{ "sku": "${p.sku}", "title": "${p.title.length > 35 ? p.title.slice(0, 35) + '...' : p.title}", "price": ${p.offer.price}, "stock": "${p.offer.stockStatus}" }`;

                                            return (
                                                <div
                                                    key={p.sku}
                                                    onClick={() => setExpandedProduct(isExpanded ? null : p.sku)}
                                                    style={{
                                                        marginBottom: 4, padding: '8px 12px',
                                                        borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                                        background: isExpanded ? 'rgba(52,211,153,0.05)' : 'transparent',
                                                        border: `1px solid ${isExpanded ? 'rgba(52,211,153,0.2)' : 'transparent'}`,
                                                        transition: 'all 200ms',
                                                    }}
                                                    onMouseEnter={e => {
                                                        if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                                                    }}
                                                    onMouseLeave={e => {
                                                        if (!isExpanded) e.currentTarget.style.background = 'transparent';
                                                    }}
                                                >
                                                    {/* Compact line */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <ChevronRight
                                                            size={12}
                                                            style={{
                                                                color: 'var(--text-dim)', transition: 'transform 200ms',
                                                                transform: isExpanded ? 'rotate(90deg)' : 'none',
                                                            }}
                                                        />
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                                            padding: '1px 6px', borderRadius: 3,
                                                            background: `${getCategoryColor(p.category)}15`,
                                                            fontSize: 9, fontWeight: 700, color: getCategoryColor(p.category),
                                                        }}>
                                                            {p.category}
                                                        </span>
                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                                                            {compactStr}
                                                        </span>
                                                    </div>

                                                    {/* Expanded JSON */}
                                                    {isExpanded && (
                                                        <div style={{
                                                            marginTop: 8, padding: '12px', borderRadius: 'var(--radius-md)',
                                                            background: 'rgba(0,0,0,0.3)', animation: 'fadeIn 0.2s ease',
                                                        }}>
                                                            <SyntaxHighlight json={jsonStr} />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ━━━ Pagination ━━━ */}
                {totalPages > 1 && (
                    <div style={{
                        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20,
                    }}>
                        {Array.from({ length: totalPages }, (_, i) => (
                            <button
                                key={i}
                                onClick={() => setPage(i)}
                                style={{
                                    width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
                                    cursor: 'pointer', transition: 'all 200ms',
                                    border: `1px solid ${page === i ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                                    background: page === i ? 'rgba(52,211,153,0.12)' : 'transparent',
                                    color: page === i ? 'var(--accent-green)' : 'var(--text-muted)',
                                }}
                            >
                                {i + 1}
                            </button>
                        ))}
                    </div>
                )}

                {/* ━━━ Agent Access Banner ━━━ */}
                <div style={{
                    marginTop: 32, padding: 20, borderRadius: 'var(--radius-lg)',
                    background: 'linear-gradient(135deg, rgba(52,211,153,0.06), rgba(34,211,238,0.06))',
                    border: '1px solid rgba(52,211,153,0.15)',
                    display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                }}>
                    <Bot size={20} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                            {t('catalog.apiHint') || 'This catalog is also accessible via API — no login required'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                            AI agents can discover, search, compare, and purchase products using REST API, MCP, or A2A protocol.
                        </div>
                    </div>
                    <code style={{
                        padding: '8px 14px', borderRadius: 'var(--radius-md)',
                        background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)',
                        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-green)',
                        whiteSpace: 'nowrap',
                    }}>
                        POST /api/v1/catalog {'{'} "action": "search_products" {'}'}
                    </code>
                </div>
            </div>

            {/* ━━━ Inline Styles ━━━ */}
            <style>{`
        @keyframes scanDown {
          0% { top: 0; opacity: 0; }
          10% { opacity: 0.3; }
          90% { opacity: 0.3; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes livePulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }

        .catalog-json pre k { color: var(--accent-purple); }
        .catalog-json pre s { color: var(--accent-green); }
        .catalog-json pre n { color: var(--accent-cyan); }
        .catalog-json pre b { color: var(--accent-amber); }

        /* global syntax highlight overrides */
        pre k { color: #c084fc; }
        pre s { color: #34d399; }
        pre n { color: #22d3ee; }
        pre b { color: #fbbf24; }
      `}</style>
        </div>
    );
};
