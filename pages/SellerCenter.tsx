import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Store, Upload, Package, BarChart3, Settings, Download, FileSpreadsheet, Search, Filter, AlertCircle, CheckCircle, Loader2, RefreshCw, Trash2, Edit3, Eye, TrendingUp, DollarSign, ShoppingCart, ChevronDown, X, Plus, Truck, RotateCcw, CreditCard, Save, Key, Ban } from 'lucide-react';
import { sellerAuth, getSellerDashboard, getSellerProducts, uploadSellerProducts, registerSeller, addSellerProduct, updateSellerProduct, deleteSellerProduct, getSellerOrders, updateOrderShipment, handleReturnRequest, getSellerSettlements, updateSellerProfile } from '../hooks';

type Tab = 'dashboard' | 'products' | 'upload' | 'orders' | 'settlement' | 'settings';

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

const CARRIERS = ['CJ대한통운', '롯데택배', '한진택배', '우체국택배', '로젠택배', '경동택배', '대신택배', '기타'];

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

const emptyProduct = { sku: '', title: '', category: '', price: '', stock_qty: '', brand: '', ship_by_days: '1', eta_days: '3', return_days: '7', return_fee: '3000', gtin: '', min_order_qty: '1', attributes: '' };

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
    const [showAddProduct, setShowAddProduct] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [productForm, setProductForm] = useState(emptyProduct);
    const [savingProduct, setSavingProduct] = useState(false);

    // Upload
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [parsedRows, setParsedRows] = useState<any[]>([]);
    const [uploadResult, setUploadResult] = useState<any>(null);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // Orders
    const [orders, setOrders] = useState<any[]>([]);
    const [orderFilter, setOrderFilter] = useState('all');
    const [shipModal, setShipModal] = useState<any>(null);
    const [shipCarrier, setShipCarrier] = useState(CARRIERS[0]);
    const [shipTracking, setShipTracking] = useState('');

    // Settlement
    const [settlements, setSettlements] = useState<any>(null);

    // Settings
    const [profileForm, setProfileForm] = useState<any>({});
    const [savingProfile, setSavingProfile] = useState(false);

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

        /* ─── 필수 컬럼 헤더 검증 ─── */
        const REQUIRED_COLS = ['sku', 'title', 'category', 'price', 'stock_qty'];
        const fileHeaders = Object.keys(parsedRows[0] || {});
        const missingCols = REQUIRED_COLS.filter(col => !fileHeaders.includes(col));
        if (missingCols.length > 0) {
            setUploadResult({ success: false, error: `필수 컬럼 누락: ${missingCols.join(', ')}. 템플릿을 다운로드하여 올바른 형식으로 업로드하세요.` });
            return;
        }

        /* ─── 행 레벨 검증 ─── */
        const rowErrors: string[] = [];
        parsedRows.forEach((row, i) => {
            const rowNum = i + 2; // 1=헤더, 2부터 데이터
            if (!row.sku?.trim()) rowErrors.push(`행 ${rowNum}: SKU가 비어있습니다`);
            if (!row.title?.trim()) rowErrors.push(`행 ${rowNum}: 상품명이 비어있습니다`);
            const price = parseInt(row.price);
            if (isNaN(price) || price <= 0) rowErrors.push(`행 ${rowNum}: 가격(${row.price})이 유효하지 않습니다`);
            const stock = parseInt(row.stock_qty);
            if (isNaN(stock) || stock < 0) rowErrors.push(`행 ${rowNum}: 재고수량(${row.stock_qty})이 유효하지 않습니다`);
        });
        if (rowErrors.length > 0) {
            setUploadResult({ success: false, error: rowErrors.slice(0, 5).join(' | ') + (rowErrors.length > 5 ? ` 외 ${rowErrors.length - 5}건` : '') });
            return;
        }

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

    /* ━━━ Product CRUD ━━━ */
    const handleSaveProduct = async () => {
        setSavingProduct(true); setError('');
        try {
            const prod = {
                sku: productForm.sku, title: productForm.title, category: productForm.category || 'GENERAL',
                price: parseInt(productForm.price) || 0, stock_qty: parseInt(productForm.stock_qty) || 0,
                brand: productForm.brand || '', ship_by_days: parseInt(productForm.ship_by_days) || 1,
                eta_days: parseInt(productForm.eta_days) || 3, return_days: parseInt(productForm.return_days) || 7,
                return_fee: parseInt(productForm.return_fee) || 0, gtin: productForm.gtin || null,
                min_order_qty: parseInt(productForm.min_order_qty) || 1, attributes: productForm.attributes || '{}',
            };
            if (editingProduct) {
                await updateSellerProduct(apiKey, editingProduct.sku, prod);
            } else {
                await addSellerProduct(apiKey, prod);
            }
            setShowAddProduct(false); setEditingProduct(null); setProductForm(emptyProduct);
            loadProducts();
        } catch (e: any) { setError(e.message); }
        setSavingProduct(false);
    };

    const handleDeleteProduct = async (sku: string) => {
        if (!confirm(`정말 "${sku}" 상품을 삭제하시겠습니까?`)) return;
        try {
            await deleteSellerProduct(apiKey, sku);
            loadProducts();
        } catch (e: any) { setError(e.message); }
    };

    const startEditProduct = (p: any) => {
        setEditingProduct(p);
        setProductForm({ sku: p.sku, title: p.title, category: p.category, price: String(p.price || ''), stock_qty: String(p.stock_qty || ''), brand: p.brand || '', ship_by_days: String(p.ship_by_days || '1'), eta_days: String(p.eta_days || '3'), return_days: String(p.return_days || '7'), return_fee: String(p.return_fee || '0'), gtin: p.gtin || '', min_order_qty: String(p.min_order_qty || '1'), attributes: typeof p.attributes === 'object' ? JSON.stringify(p.attributes) : p.attributes || '' });
        setShowAddProduct(true);
    };

    /* ━━━ Orders ━━━ */
    const loadOrders = useCallback(async () => {
        if (!authenticated) return;
        setLoading(true);
        try {
            const res = await getSellerOrders(apiKey, orderFilter);
            if (res?.success) setOrders(res.orders || []);
        } catch (e) { /* silent */ }
        setLoading(false);
    }, [apiKey, authenticated, orderFilter]);

    useEffect(() => { if (authenticated && tab === 'orders') loadOrders(); }, [authenticated, tab, loadOrders]);

    const handleShip = async () => {
        if (!shipModal || !shipTracking) return;
        try {
            await updateOrderShipment(apiKey, shipModal.id, shipCarrier, shipTracking);
            setShipModal(null); setShipTracking('');
            loadOrders();
        } catch (e: any) { setError(e.message); }
    };

    /* ━━━ Settlement ━━━ */
    const loadSettlements = useCallback(async () => {
        if (!authenticated) return;
        try {
            const res = await getSellerSettlements(apiKey);
            if (res?.success) setSettlements(res);
        } catch (e) { /* silent */ }
    }, [apiKey, authenticated]);

    useEffect(() => { if (authenticated && tab === 'settlement') loadSettlements(); }, [authenticated, tab, loadSettlements]);

    /* ━━━ Profile ━━━ */
    useEffect(() => {
        if (authenticated && tab === 'settings' && sellerInfo) {
            setProfileForm({
                business_name: sellerInfo.business_name || '', representative: sellerInfo.representative || '',
                phone: sellerInfo.phone || '', email: sellerInfo.email || '',
                bank_name: sellerInfo.bank_name || '', bank_account: sellerInfo.bank_account || '',
                default_ship_by_days: sellerInfo.default_ship_by_days || 1, default_eta_days: sellerInfo.default_eta_days || 3,
                default_return_days: sellerInfo.default_return_days || 7, default_return_fee: sellerInfo.default_return_fee || 3000,
            });
        }
    }, [authenticated, tab, sellerInfo]);

    const handleSaveProfile = async () => {
        setSavingProfile(true);
        try {
            await updateSellerProfile(apiKey, profileForm);
            const res = await sellerAuth(apiKey);
            if (res?.success) setSellerInfo(res);
        } catch (e: any) { setError(e.message); }
        setSavingProfile(false);
    };

    const tabStyle = (t: Tab) => ({
        padding: '8px 16px', fontSize: 12, fontWeight: tab === t ? 700 : 500, cursor: 'pointer',
        color: tab === t ? 'var(--accent-cyan)' : 'var(--text-muted)',
        borderBottom: tab === t ? '2px solid var(--accent-cyan)' : '2px solid transparent',
        transition: 'all 0.2s',
    });

    const inputStyle = { width: '100%', padding: 10, borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 12, boxSizing: 'border-box' as const };

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
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-subtle)', marginBottom: 20, overflowX: 'auto' }}>
                <div style={tabStyle('dashboard')} onClick={() => setTab('dashboard')}><BarChart3 size={12} style={{ marginRight: 4 }} />대시보드</div>
                <div style={tabStyle('products')} onClick={() => setTab('products')}><Package size={12} style={{ marginRight: 4 }} />상품관리</div>
                <div style={tabStyle('upload')} onClick={() => setTab('upload')}><Upload size={12} style={{ marginRight: 4 }} />엑셀 업로드</div>
                <div style={tabStyle('orders')} onClick={() => setTab('orders')}><ShoppingCart size={12} style={{ marginRight: 4 }} />주문관리</div>
                <div style={tabStyle('settlement')} onClick={() => setTab('settlement')}><CreditCard size={12} style={{ marginRight: 4 }} />정산</div>
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
                        <button onClick={() => { setEditingProduct(null); setProductForm(emptyProduct); setShowAddProduct(true); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--accent-cyan)', color: '#000', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                            <Plus size={14} /> 상품 추가
                        </button>
                        <button onClick={loadProducts} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <RefreshCw size={14} />
                        </button>
                    </div>

                    {/* Add/Edit Product Modal */}
                    {showAddProduct && (
                        <div className="glass-card" style={{ padding: 20, marginBottom: 16, borderLeft: '3px solid var(--accent-cyan)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{editingProduct ? '✏️ 상품 수정' : '➕ 새 상품 등록'}</div>
                                <button onClick={() => { setShowAddProduct(false); setEditingProduct(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={16} /></button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                                {[
                                    { key: 'sku', label: 'SKU *', ph: 'TISSUE-70x20', disabled: !!editingProduct },
                                    { key: 'title', label: '상품명 *', ph: '물티슈 70매 20팩' },
                                    { key: 'category', label: '카테고리 *', ph: 'CONSUMABLES' },
                                    { key: 'price', label: '판매가(원) *', ph: '18900' },
                                    { key: 'stock_qty', label: '재고수량 *', ph: '142' },
                                    { key: 'brand', label: '브랜드', ph: 'BrandA' },
                                    { key: 'ship_by_days', label: '출고일(일)', ph: '1' },
                                    { key: 'eta_days', label: '배송소요일', ph: '3' },
                                    { key: 'return_days', label: '반품기간(일)', ph: '7' },
                                    { key: 'return_fee', label: '반품배송비(원)', ph: '3000' },
                                    { key: 'gtin', label: '바코드', ph: '8801234567890' },
                                    { key: 'min_order_qty', label: '최소주문수량', ph: '1' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>{f.label}</label>
                                        <input value={(productForm as any)[f.key]} onChange={e => setProductForm(p => ({ ...p, [f.key]: e.target.value }))}
                                            placeholder={f.ph} disabled={f.disabled} style={inputStyle} />
                                    </div>
                                ))}
                            </div>
                            {error && <div style={{ color: 'var(--accent-red)', fontSize: 11, marginTop: 8 }}>{error}</div>}
                            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                                <button onClick={handleSaveProduct} disabled={savingProduct || !productForm.sku || !productForm.title}
                                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--accent-green)', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                                    {savingProduct ? <Loader2 size={13} className="spin" /> : <Save size={13} />} {editingProduct ? '수정 완료' : '등록'}
                                </button>
                                <button onClick={() => { setShowAddProduct(false); setEditingProduct(null); }}
                                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>취소</button>
                            </div>
                        </div>
                    )}

                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>총 {productTotal}개 상품</div>

                    <div className="glass-card" style={{ overflow: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    {['SKU', '상품명', '카테고리', '가격', '재고', '출고일', '상태', '관리'].map(h => (
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
                                        <td style={{ padding: '8px 12px' }}>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button onClick={() => startEditProduct(p)} title="수정" style={{ padding: 4, borderRadius: 4, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--accent-cyan)', cursor: 'pointer' }}><Edit3 size={12} /></button>
                                                <button onClick={() => handleDeleteProduct(p.sku)} title="삭제" style={{ padding: 4, borderRadius: 4, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--accent-red)', cursor: 'pointer' }}><Trash2 size={12} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {products.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 12 }}>등록된 상품이 없습니다. "상품 추가" 버튼으로 시작하세요.</div>}
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
                <div>
                    {/* Order Filter Tabs */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                        {[
                            { key: 'all', label: '전체' },
                            { key: 'pending', label: '신규주문' },
                            { key: 'confirmed', label: '발송대기' },
                            { key: 'shipped', label: '배송중' },
                            { key: 'delivered', label: '완료' },
                            { key: 'returned', label: '반품' },
                        ].map(f => (
                            <button key={f.key} onClick={() => setOrderFilter(f.key)}
                                style={{ padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: orderFilter === f.key ? 700 : 500, cursor: 'pointer', border: orderFilter === f.key ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)', background: orderFilter === f.key ? 'rgba(6,182,212,0.1)' : 'transparent', color: orderFilter === f.key ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                                {f.label}
                            </button>
                        ))}
                        <button onClick={loadOrders} style={{ marginLeft: 'auto', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}><RefreshCw size={12} /></button>
                    </div>

                    {/* Shipment Modal */}
                    {shipModal && (
                        <div className="glass-card" style={{ padding: 20, marginBottom: 16, borderLeft: '3px solid var(--accent-green)' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>🚚 발송 처리 — 주문#{shipModal.id?.slice?.(0, 8)}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
                                <div>
                                    <label style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>택배사</label>
                                    <select value={shipCarrier} onChange={e => setShipCarrier(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                                        {CARRIERS.map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>운송장 번호</label>
                                    <input value={shipTracking} onChange={e => setShipTracking(e.target.value)} placeholder="운송장 번호 입력" style={inputStyle} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={handleShip} disabled={!shipTracking}
                                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--accent-green)', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}><Truck size={13} /> 발송 완료</button>
                                <button onClick={() => setShipModal(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>취소</button>
                            </div>
                        </div>
                    )}

                    {/* Orders Table */}
                    <div className="glass-card" style={{ overflow: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    {['주문번호', '상품', '수량', '금액', '주문일', '상태', '관리'].map(h => (
                                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((o: any) => {
                                    const statusMap: Record<string, { label: string; color: string }> = {
                                        pending: { label: '신규', color: 'var(--accent-amber)' }, confirmed: { label: '발송대기', color: 'var(--accent-cyan)' },
                                        shipped: { label: '배송중', color: 'var(--accent-purple)' }, delivered: { label: '완료', color: 'var(--accent-green)' },
                                        returned: { label: '반품', color: 'var(--accent-red)' },
                                    };
                                    const st = statusMap[o.procurement_status] || { label: o.procurement_status, color: 'var(--text-dim)' };
                                    return (
                                        <tr key={o.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontSize: 10 }}>{o.id?.slice?.(0, 8)}…</td>
                                            <td style={{ padding: '8px 12px', color: 'var(--text-primary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.product_title || o.items?.[0]?.title || '-'}</td>
                                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{o.quantity || 1}</td>
                                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>₩{(o.total_amount || 0).toLocaleString()}</td>
                                            <td style={{ padding: '8px 12px', fontSize: 10, color: 'var(--text-muted)' }}>{new Date(o.created_at).toLocaleDateString('ko')}</td>
                                            <td style={{ padding: '8px 12px' }}><span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 600, background: `color-mix(in srgb, ${st.color} 12%, transparent)`, color: st.color }}>{st.label}</span></td>
                                            <td style={{ padding: '8px 12px' }}>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    {(o.procurement_status === 'pending' || o.procurement_status === 'confirmed') && (
                                                        <button onClick={() => setShipModal(o)} title="발송" style={{ padding: 4, borderRadius: 4, border: '1px solid var(--accent-green)', background: 'rgba(34,197,94,0.08)', color: 'var(--accent-green)', cursor: 'pointer' }}><Truck size={12} /></button>
                                                    )}
                                                    {o.procurement_status === 'return_requested' && (
                                                        <button onClick={() => handleReturnRequest(apiKey, o.id, 'approve').then(loadOrders)} title="반품승인" style={{ padding: 4, borderRadius: 4, border: '1px solid var(--accent-red)', background: 'rgba(239,68,68,0.08)', color: 'var(--accent-red)', cursor: 'pointer' }}><RotateCcw size={12} /></button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {orders.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 12 }}>주문 내역이 없습니다</div>}
                    </div>
                    {loading && <div style={{ textAlign: 'center', padding: 16 }}><Loader2 size={18} className="spin" style={{ color: 'var(--accent-cyan)' }} /></div>}
                </div>
            )}

            {/* ━━━ Settlement Tab ━━━ */}
            {tab === 'settlement' && (
                <div>
                    {/* Summary KPIs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                        <KpiCard label="총 매출" value={`₩${(settlements?.summary?.totalSales || sellerInfo?.total_revenue || 0).toLocaleString()}`} icon={<DollarSign size={16} />} color="var(--accent-green)" />
                        <KpiCard label="수수료" value={`₩${(settlements?.summary?.commission || 0).toLocaleString()}`} sub={`${sellerInfo?.commission_rate || 10}%`} icon={<CreditCard size={16} />} color="var(--accent-red)" />
                        <KpiCard label="정산 금액" value={`₩${(settlements?.summary?.netPayout || 0).toLocaleString()}`} sub="매출 - 수수료" icon={<TrendingUp size={16} />} color="var(--accent-cyan)" />
                        <KpiCard label="정산 주기" value="월간" sub="익월 15일 정산" icon={<BarChart3 size={16} />} color="var(--accent-purple)" />
                    </div>

                    {/* Settlement History */}
                    <div className="glass-card" style={{ padding: 20 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>📋 정산 내역</div>
                        {(settlements?.settlements || []).length > 0 ? (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        {['정산 기간', '매출', '수수료', '정산액', '상태'].map(h => (
                                            <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {settlements.settlements.map((s: any) => (
                                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                            <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{s.period}</td>
                                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>₩{s.totalSales?.toLocaleString()}</td>
                                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--accent-red)' }}>-₩{s.commission?.toLocaleString()}</td>
                                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', fontWeight: 700 }}>₩{s.netPayout?.toLocaleString()}</td>
                                            <td style={{ padding: '8px 12px' }}><span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 600, background: s.status === 'paid' ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)', color: s.status === 'paid' ? 'var(--accent-green)' : 'var(--accent-amber)' }}>{s.status === 'paid' ? '정산완료' : s.status === 'approved' ? '승인됨' : '대기중'}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 12 }}>
                                <CreditCard size={28} style={{ marginBottom: 8, opacity: 0.5 }} />
                                <div>아직 정산 내역이 없습니다</div>
                                <div style={{ fontSize: 10, marginTop: 4 }}>주문이 완료되면 정산 내역이 생성됩니다</div>
                            </div>
                        )}
                    </div>

                    {/* Commission Info */}
                    <div className="glass-card" style={{ padding: 16, marginTop: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>💡 수수료 안내</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                            • 기본 수수료율: <strong style={{ color: 'var(--accent-cyan)' }}>{sellerInfo?.commission_rate || 10}%</strong><br />
                            • 정산 주기: 월간 (1일~말일 매출 → 익월 15일 정산)<br />
                            • 정산 금액 = 총 매출 - 수수료 - 반품 금액<br />
                            • 정산 계좌는 설정 탭에서 등록할 수 있습니다
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ Settings Tab ━━━ */}
            {tab === 'settings' && (
                <div>
                    {/* Account Info (read-only) */}
                    <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>🔑 계정 정보</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                            {[
                                { label: '셀러 ID', value: sellerInfo?.seller_id },
                                { label: '신뢰도', value: `${sellerInfo?.trust_score || 0} / 100` },
                                { label: '수수료율', value: `${sellerInfo?.commission_rate || 10}%` },
                                { label: '입점 상품', value: `${sellerInfo?.total_products || 0}개` },
                            ].map(item => (
                                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 12 }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Editable Profile */}
                    <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>📝 프로필 수정</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                            {[
                                { key: 'business_name', label: '상호명' },
                                { key: 'representative', label: '대표자' },
                                { key: 'phone', label: '연락처' },
                                { key: 'email', label: '이메일' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>{f.label}</label>
                                    <input value={profileForm[f.key] || ''} onChange={e => setProfileForm((p: any) => ({ ...p, [f.key]: e.target.value }))} style={inputStyle} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Shipping Policy */}
                    <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>🚚 기본 배송 정책</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                            {[
                                { key: 'default_ship_by_days', label: '기본 출고 소요일', suffix: '일' },
                                { key: 'default_eta_days', label: '기본 배송 소요일', suffix: '일' },
                                { key: 'default_return_days', label: '반품 가능 기간', suffix: '일' },
                                { key: 'default_return_fee', label: '반품 배송비', suffix: '원' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>{f.label} ({f.suffix})</label>
                                    <input type="number" value={profileForm[f.key] || ''} onChange={e => setProfileForm((p: any) => ({ ...p, [f.key]: parseInt(e.target.value) || 0 }))} style={inputStyle} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bank Account */}
                    <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>🏦 정산 계좌</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                            <div>
                                <label style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>은행</label>
                                <select value={profileForm.bank_name || ''} onChange={e => setProfileForm((p: any) => ({ ...p, bank_name: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                                    <option value="">선택</option>
                                    {['국민은행', '신한은행', '우리은행', '하나은행', 'SC제일은행', '기업은행', '농협은행', '카카오뱅크', '토스뱅크'].map(b => <option key={b}>{b}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>계좌번호</label>
                                <input value={profileForm.bank_account || ''} onChange={e => setProfileForm((p: any) => ({ ...p, bank_account: e.target.value }))} placeholder="계좌번호 입력" style={inputStyle} />
                            </div>
                        </div>
                    </div>

                    {/* Save Button */}
                    <button onClick={handleSaveProfile} disabled={savingProfile}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--accent-cyan)', color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        {savingProfile ? <Loader2 size={14} className="spin" /> : <Save size={14} />} 설정 저장
                    </button>
                </div>
            )}
        </div>
    );
};
