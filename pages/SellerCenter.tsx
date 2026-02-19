import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Store, Upload, Package, BarChart3, Settings, Download, FileSpreadsheet, Search, Filter, AlertCircle, CheckCircle, Loader2, RefreshCw, Trash2, Edit3, Eye, TrendingUp, DollarSign, ShoppingCart, ChevronDown, X } from 'lucide-react';
import { sellerAuth, getSellerDashboard, getSellerProducts, uploadSellerProducts, registerSeller } from '../hooks';

type Tab = 'dashboard' | 'products' | 'upload' | 'orders' | 'settings';

/* ━━━ Excel Template Columns ━━━ */
const TEMPLATE_COLUMNS = [
    { key: 'sku', label: 'SKU', required: true, example: 'TISSUE-70x20' },
    { key: 'title', label: '상품명', required: true, example: '물티슈 70매 20팩' },
    { key: 'category', label: '카테고리', required: true, example: 'CONSUMABLES' },
    { key: 'price', label: '판매가(원)', required: true, example: '18900' },
    { key: 'stock_qty', label: '재고수량', required: true, example: '142' },
    { key: 'brand', label: '브랜드', required: false, example: 'BrandA' },
    { key: 'ship_by_days', label: '출고일', required: false, example: '1' },
    { key: 'eta_days', label: '배송소요일', required: false, example: '3' },
    { key: 'return_days', label: '반품기간', required: false, example: '7' },
    { key: 'return_fee', label: '반품배송비', required: false, example: '3000' },
    { key: 'gtin', label: '바코드', required: false, example: '8801234567890' },
    { key: 'min_order_qty', label: '최소주문수량', required: false, example: '1' },
    { key: 'attributes', label: '추가속성(JSON)', required: false, example: '{"color":"white"}' },
];

/* ━━━ CSV Generator ━━━ */
function downloadTemplate() {
    const header = TEMPLATE_COLUMNS.map(c => c.key).join(',');
    const example = TEMPLATE_COLUMNS.map(c => c.example).join(',');
    const csv = `${header}\n${example}\n`;
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'jsonmart_product_template.csv'; a.click();
    URL.revokeObjectURL(url);
}

/* ━━━ CSV Parser ━━━ */
function parseCsv(text: string): Record<string, string>[] {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim());
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
        return obj;
    });
}

/* ━━━ KPI Card ━━━ */
function KpiCard({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: React.ReactNode; color: string }) {
    return (
        <div className="glass-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</div>
                    {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: `color-mix(in srgb, ${color} 12%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{icon}</div>
            </div>
        </div>
    );
}

/* ━━━ Main SellerCenter Component ━━━ */
export const SellerCenter: React.FC = () => {
    const [apiKey, setApiKey] = useState('');
    const [authenticated, setAuthenticated] = useState(false);
    const [sellerInfo, setSellerInfo] = useState<any>(null);
    const [tab, setTab] = useState<Tab>('dashboard');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Dashboard
    const [dashboard, setDashboard] = useState<any>(null);

    // Products
    const [products, setProducts] = useState<any[]>([]);
    const [productSearch, setProductSearch] = useState('');
    const [productTotal, setProductTotal] = useState(0);

    // Upload
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [parsedRows, setParsedRows] = useState<any[]>([]);
    const [uploadResult, setUploadResult] = useState<any>(null);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // Registration
    const [showRegister, setShowRegister] = useState(false);
    const [regForm, setRegForm] = useState({ email: '', businessName: '', representative: '', businessNumber: '', phone: '' });
    const [regResult, setRegResult] = useState<any>(null);

    /* ━━━ Auth ━━━ */
    const handleAuth = async () => {
        setError(''); setLoading(true);
        try {
            const res = await sellerAuth(apiKey);
            if (res?.success) { setAuthenticated(true); setSellerInfo(res); }
            else setError(res?.error || 'Authentication failed');
        } catch (e: any) { setError(e.message); }
        setLoading(false);
    };

    /* ━━━ Dashboard ━━━ */
    const loadDashboard = useCallback(async () => {
        if (!authenticated) return;
        setLoading(true);
        try {
            const res = await getSellerDashboard(apiKey);
            if (res?.success) setDashboard(res);
        } catch (e) { /* silent */ }
        setLoading(false);
    }, [apiKey, authenticated]);

    useEffect(() => { if (authenticated && tab === 'dashboard') loadDashboard(); }, [authenticated, tab, loadDashboard]);

    /* ━━━ Products ━━━ */
    const loadProducts = useCallback(async () => {
        if (!authenticated) return;
        setLoading(true);
        try {
            const res = await getSellerProducts(apiKey, undefined, productSearch || undefined);
            if (res?.success) { setProducts(res.products || []); setProductTotal(res.total || 0); }
        } catch (e) { /* silent */ }
        setLoading(false);
    }, [apiKey, authenticated, productSearch]);

    useEffect(() => { if (authenticated && tab === 'products') loadProducts(); }, [authenticated, tab, loadProducts]);

    /* ━━━ File Upload ━━━ */
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadFile(file);
        setUploadResult(null);
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            const rows = parseCsv(text);
            setParsedRows(rows);
        };
        reader.readAsText(file);
    };

    const handleUpload = async () => {
        if (parsedRows.length === 0) return;
        setUploading(true); setUploadResult(null);
        try {
            const products = parsedRows.map(row => ({
                sku: row.sku, title: row.title, category: row.category || 'CONSUMABLES',
                price: parseInt(row.price) || 0, stock_qty: parseInt(row.stock_qty) || 0,
                brand: row.brand || '', ship_by_days: parseInt(row.ship_by_days) || 1,
                eta_days: parseInt(row.eta_days) || 3, return_days: parseInt(row.return_days) || 7,
                return_fee: parseInt(row.return_fee) || 0, gtin: row.gtin || null,
                min_order_qty: parseInt(row.min_order_qty) || 1,
                attributes: row.attributes ? row.attributes : '{}',
            }));
            const res = await uploadSellerProducts(apiKey, uploadFile?.name || 'upload.csv', products);
            setUploadResult(res);
            if (res?.success) { loadDashboard(); loadProducts(); }
        } catch (e: any) { setUploadResult({ success: false, error: e.message }); }
        setUploading(false);
    };

    /* ━━━ Register ━━━ */
    const handleRegister = async () => {
        setError('');
        try {
            const res = await registerSeller(regForm.email, regForm.businessName, regForm.representative, regForm.businessNumber || undefined, regForm.phone || undefined);
            setRegResult(res);
        } catch (e: any) { setError(e.message); }
    };

    const tabStyle = (t: Tab) => ({
        padding: '8px 16px', fontSize: 12, fontWeight: tab === t ? 700 : 500, cursor: 'pointer',
        color: tab === t ? 'var(--accent-cyan)' : 'var(--text-muted)',
        borderBottom: tab === t ? '2px solid var(--accent-cyan)' : '2px solid transparent',
        transition: 'all 0.2s',
    });

    /* ━━━ Login Screen ━━━ */
    if (!authenticated) return (
        <div style={{ maxWidth: 480, margin: '60px auto' }}>
            <div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
                <Store size={40} style={{ color: 'var(--accent-cyan)', marginBottom: 16 }} />
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>Seller Center</h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>셀러 API 키로 로그인하세요</p>

                <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="slk_..." onKeyDown={e => e.key === 'Enter' && handleAuth()}
                    style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-mono)', marginBottom: 12, boxSizing: 'border-box' }} />

                <button onClick={handleAuth} disabled={loading || !apiKey}
                    style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', background: 'var(--accent-cyan)', color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 12 }}>
                    {loading ? <Loader2 size={14} className="spin" /> : '로그인'}
                </button>

                {error && <div style={{ color: 'var(--accent-red)', fontSize: 11, marginBottom: 12 }}>{error}</div>}

                <button onClick={() => setShowRegister(!showRegister)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-purple)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
                    신규 셀러 가입
                </button>

                {showRegister && (
                    <div style={{ marginTop: 16, textAlign: 'left' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📋 셀러 가입 신청</div>
                        {[
                            { key: 'email', label: '이메일 *', ph: 'seller@example.com' },
                            { key: 'businessName', label: '상호명 *', ph: '주식회사 OO' },
                            { key: 'representative', label: '대표자 *', ph: '홍길동' },
                            { key: 'businessNumber', label: '사업자등록번호', ph: '123-45-67890' },
                            { key: 'phone', label: '연락처', ph: '010-1234-5678' },
                        ].map(f => (
                            <div key={f.key} style={{ marginBottom: 8 }}>
                                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>{f.label}</label>
                                <input value={(regForm as any)[f.key]} onChange={e => setRegForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph}
                                    style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 12, boxSizing: 'border-box' }} />
                            </div>
                        ))}
                        <button onClick={handleRegister}
                            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--accent-purple)', background: 'rgba(168,85,247,0.1)', color: 'var(--accent-purple)', fontWeight: 700, fontSize: 12, cursor: 'pointer', marginTop: 8 }}>
                            가입 신청
                        </button>
                        {regResult && (
                            <div style={{ marginTop: 8, padding: 10, borderRadius: 6, background: regResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', fontSize: 11, color: regResult.success ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                {regResult.success ? `✅ 가입 신청 완료! 셀러 ID: ${regResult.seller_id}` : `❌ ${regResult.error}`}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    /* ━━━ Main Layout ━━━ */
    return (
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Store size={24} style={{ color: 'var(--accent-cyan)' }} />
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Seller Center</h1>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                            {sellerInfo?.business_name} · {sellerInfo?.seller_id}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, padding: '4px 8px', borderRadius: 4, background: 'rgba(34,197,94,0.12)', color: 'var(--accent-green)', fontWeight: 700 }}>ACTIVE</span>
                    <button onClick={() => { setAuthenticated(false); setSellerInfo(null); setApiKey(''); }}
                        style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
                        로그아웃
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-subtle)', marginBottom: 20 }}>
                <div style={tabStyle('dashboard')} onClick={() => setTab('dashboard')}><BarChart3 size={12} style={{ marginRight: 4 }} />대시보드</div>
                <div style={tabStyle('products')} onClick={() => setTab('products')}><Package size={12} style={{ marginRight: 4 }} />상품관리</div>
                <div style={tabStyle('upload')} onClick={() => setTab('upload')}><Upload size={12} style={{ marginRight: 4 }} />엑셀 업로드</div>
                <div style={tabStyle('orders')} onClick={() => setTab('orders')}><ShoppingCart size={12} style={{ marginRight: 4 }} />주문/정산</div>
                <div style={tabStyle('settings')} onClick={() => setTab('settings')}><Settings size={12} style={{ marginRight: 4 }} />설정</div>
            </div>

            {/* ━━━ Dashboard Tab ━━━ */}
            {tab === 'dashboard' && (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                        <KpiCard label="총 매출" value={`₩${(dashboard?.seller?.total_revenue || 0).toLocaleString()}`} icon={<DollarSign size={16} />} color="var(--accent-green)" />
                        <KpiCard label="총 주문" value={`${dashboard?.seller?.total_sales || 0}`} icon={<ShoppingCart size={16} />} color="var(--accent-cyan)" />
                        <KpiCard label="입점 상품" value={`${dashboard?.products?.total || 0}`} sub={`재고 있음 ${dashboard?.products?.in_stock || 0}`} icon={<Package size={16} />} color="var(--accent-purple)" />
                        <KpiCard label="신뢰도" value={`${dashboard?.seller?.trust_score || 0}`} sub={`수수료 ${dashboard?.seller?.commission_rate || 10}%`} icon={<TrendingUp size={16} />} color="var(--accent-amber)" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                        {/* Category Distribution */}
                        <div className="glass-card" style={{ padding: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📊 카테고리 분포</div>
                            {(dashboard?.categories || []).map((c: any) => (
                                <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 12 }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{c.category}</span>
                                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{c.count}</span>
                                </div>
                            ))}
                            {(!dashboard?.categories || dashboard.categories.length === 0) && <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>상품을 먼저 등록하세요</div>}
                        </div>

                        {/* Recent Uploads */}
                        <div className="glass-card" style={{ padding: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📤 최근 업로드</div>
                            {(dashboard?.recent_uploads || []).slice(0, 5).map((u: any) => (
                                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 11 }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{u.file_name}</span>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <span style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>{u.success_count}</span>
                                        {u.error_count > 0 && <span style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>/{u.error_count}err</span>}
                                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: u.status === 'COMPLETED' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: u.status === 'COMPLETED' ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>
                                            {u.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {(!dashboard?.recent_uploads || dashboard.recent_uploads.length === 0) && <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>업로드 이력이 없습니다</div>}
                        </div>
                    </div>

                    {loading && <div style={{ textAlign: 'center', padding: 20 }}><Loader2 size={20} className="spin" style={{ color: 'var(--accent-cyan)' }} /></div>}
                </div>
            )}

            {/* ━━━ Products Tab ━━━ */}
            {tab === 'products' && (
                <div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                            <Search size={14} style={{ color: 'var(--text-dim)' }} />
                            <input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="SKU 또는 상품명 검색..."
                                style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
                        </div>
                        <button onClick={loadProducts} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <RefreshCw size={14} />
                        </button>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>총 {productTotal}개 상품</div>

                    <div className="glass-card" style={{ overflow: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    {['SKU', '상품명', '카테고리', '가격', '재고', '출고일', '상태'].map(h => (
                                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {products.map((p: any) => (
                                    <tr key={p.sku} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontSize: 11 }}>{p.sku}</td>
                                        <td style={{ padding: '8px 12px', color: 'var(--text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</td>
                                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{p.category}</td>
                                        <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>₩{(p.price || 0).toLocaleString()}</td>
                                        <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: p.stock_qty > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{p.stock_qty ?? '-'}</td>
                                        <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{p.ship_by_days}일</td>
                                        <td style={{ padding: '8px 12px' }}>
                                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 600, background: p.stock_status === 'in_stock' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: p.stock_status === 'in_stock' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                                {p.stock_status === 'in_stock' ? '판매중' : '품절'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {products.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 12 }}>등록된 상품이 없습니다</div>}
                    </div>
                    {loading && <div style={{ textAlign: 'center', padding: 16 }}><Loader2 size={18} className="spin" style={{ color: 'var(--accent-cyan)' }} /></div>}
                </div>
            )}

            {/* ━━━ Upload Tab ━━━ */}
            {tab === 'upload' && (
                <div>
                    {/* Template Download */}
                    <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>📎 엑셀(CSV) 상품 일괄 등록</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>CSV 파일로 상품을 대량 입점하세요. 기존 SKU는 자동 업데이트됩니다.</div>
                            </div>
                            <button onClick={downloadTemplate}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--accent-purple)', background: 'rgba(168,85,247,0.08)', color: 'var(--accent-purple)', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>
                                <Download size={13} /> 템플릿 다운로드
                            </button>
                        </div>

                        {/* Column Reference */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>컬럼 안내</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 4, fontSize: 10 }}>
                                {TEMPLATE_COLUMNS.map(c => (
                                    <div key={c.key} style={{ display: 'flex', gap: 4, color: 'var(--text-muted)' }}>
                                        <span style={{ fontFamily: 'var(--font-mono)', color: c.required ? 'var(--accent-cyan)' : 'var(--text-dim)', fontWeight: c.required ? 700 : 400 }}>{c.key}</span>
                                        {c.required && <span style={{ color: 'var(--accent-red)', fontSize: 8 }}>*</span>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* File Drop */}
                        <div onClick={() => fileRef.current?.click()}
                            style={{ border: '2px dashed var(--border-subtle)', borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s' }}
                            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent-cyan)'; }}
                            onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                            onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border-subtle)'; const f = e.dataTransfer.files[0]; if (f) { const dt = new DataTransfer(); dt.items.add(f); if (fileRef.current) { fileRef.current.files = dt.files; fileRef.current.dispatchEvent(new Event('change', { bubbles: true })); } } }}>
                            <FileSpreadsheet size={32} style={{ color: 'var(--accent-cyan)', marginBottom: 8 }} />
                            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{uploadFile ? uploadFile.name : 'CSV 파일을 드래그하거나 클릭하세요'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>.csv 형식 지원</div>
                        </div>
                        <input ref={fileRef} type="file" accept=".csv" onChange={handleFileSelect} style={{ display: 'none' }} />
                    </div>

                    {/* Preview */}
                    {parsedRows.length > 0 && (
                        <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>📋 미리보기 ({parsedRows.length}행)</div>
                                <button onClick={handleUpload} disabled={uploading}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--accent-green)', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                                    {uploading ? <Loader2 size={13} className="spin" /> : <Upload size={13} />}
                                    {uploading ? '업로드 중...' : '확인 — 일괄 입점'}
                                </button>
                            </div>

                            <div style={{ overflow: 'auto', maxHeight: 300 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                                    <thead>
                                        <tr>{Object.keys(parsedRows[0]).filter(k => parsedRows[0][k]).map(k => (
                                            <th key={k} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', borderBottom: '1px solid var(--border-subtle)' }}>{k}</th>
                                        ))}</tr>
                                    </thead>
                                    <tbody>
                                        {parsedRows.slice(0, 20).map((row, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                                {Object.keys(row).filter(k => row[k]).map(k => (
                                                    <td key={k} style={{ padding: '6px 8px', color: 'var(--text-primary)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row[k]}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {parsedRows.length > 20 && <div style={{ textAlign: 'center', padding: 8, fontSize: 10, color: 'var(--text-dim)' }}>... 그 외 {parsedRows.length - 20}행</div>}
                            </div>
                        </div>
                    )}

                    {/* Upload Result */}
                    {uploadResult && (
                        <div className="glass-card" style={{ padding: 16, borderLeft: `3px solid ${uploadResult.success ? 'var(--accent-green)' : 'var(--accent-red)'}` }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: uploadResult.success ? 'var(--accent-green)' : 'var(--accent-red)', marginBottom: 8 }}>
                                {uploadResult.success ? '✅ 업로드 완료' : '❌ 업로드 실패'}
                            </div>
                            {uploadResult.success && (
                                <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                                    <span>총 {uploadResult.total_rows}행</span>
                                    <span style={{ color: 'var(--accent-green)' }}>성공 {uploadResult.success_count}</span>
                                    {uploadResult.error_count > 0 && <span style={{ color: 'var(--accent-red)' }}>실패 {uploadResult.error_count}</span>}
                                </div>
                            )}
                            {(uploadResult.errors || []).length > 0 && (
                                <div style={{ marginTop: 8, fontSize: 11 }}>
                                    {uploadResult.errors.slice(0, 10).map((e: any, i: number) => (
                                        <div key={i} style={{ color: 'var(--accent-red)', padding: '2px 0' }}>Row {e.row}: [{e.field}] {e.message}</div>
                                    ))}
                                </div>
                            )}
                            {uploadResult.error && <div style={{ fontSize: 11, color: 'var(--accent-red)' }}>{uploadResult.error}</div>}
                        </div>
                    )}
                </div>
            )}

            {/* ━━━ Orders Tab ━━━ */}
            {tab === 'orders' && (
                <div className="glass-card" style={{ padding: 24, textAlign: 'center' }}>
                    <ShoppingCart size={32} style={{ color: 'var(--text-dim)', marginBottom: 12 }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>주문/정산</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                        셀러별 주문 현황 및 정산 내역을 확인합니다.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, maxWidth: 500, margin: '0 auto' }}>
                        <div style={{ padding: 16, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>총 매출</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>₩{(sellerInfo?.total_revenue || 0).toLocaleString()}</div>
                        </div>
                        <div style={{ padding: 16, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>정산 주기</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>월간</div>
                        </div>
                        <div style={{ padding: 16, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>수수료율</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-purple)', fontFamily: 'var(--font-mono)' }}>{sellerInfo?.commission_rate || 10}%</div>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ Settings Tab ━━━ */}
            {tab === 'settings' && (
                <div className="glass-card" style={{ padding: 24 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>⚙️ 셀러 설정</div>
                    <div style={{ display: 'grid', gap: 12, maxWidth: 500 }}>
                        {[
                            { label: '셀러 ID', value: sellerInfo?.seller_id },
                            { label: '상호명', value: sellerInfo?.business_name },
                            { label: '신뢰도', value: `${sellerInfo?.trust_score || 0} / 100` },
                            { label: '수수료율', value: `${sellerInfo?.commission_rate || 10}%` },
                            { label: '입점 상품', value: `${sellerInfo?.total_products || 0}개` },
                        ].map(item => (
                            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 12 }}>
                                <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
