import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../context/LanguageContext';
import * as XLSX from 'xlsx';
import {
    Package, Loader2, AlertCircle, FileSpreadsheet, Truck, Clock, Filter,
    Search, Users, MapPin, Phone, ChevronDown, ChevronRight, Copy, Check, Mail
} from 'lucide-react';

// ─── Types ───
interface OrderRow {
    id: string;
    order_id: string;
    status: string;
    items: any[];
    recipient_name: string | null;
    postal_code: string | null;
    address: string | null;
    address_detail: string | null;
    phone: string | null;
    phone_alt: string | null;
    delivery_note: string | null;
    customs_id: string | null;
    procurement_status: string;
    authorized_amount: number;
    created_at: string;
}

interface ProductInfo {
    sku: string;
    source: string;
    source_id: string;
    title: string;
}

// ─── Helpers ───
function formatPhone(phone: string | null): string {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    if (digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return phone;
}

// ─── Copy Button ───
function CopyBtn({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); };
    return (
        <button onClick={handleCopy} title="복사" style={{ padding: 2, border: 'none', background: 'none', color: copied ? '#22c55e' : 'var(--text-tertiary)', cursor: 'pointer', display: 'inline-flex', verticalAlign: 'middle' }}>
            {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
    );
}

// ─── Info Row ───
function InfoRow({ label, value, copyValue }: { label: string; value: string | null; copyValue?: string }) {
    return (
        <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
            <span style={{ minWidth: 70, fontWeight: 600, color: 'var(--text-tertiary)', flexShrink: 0 }}>{label}</span>
            <span style={{ color: value ? 'var(--text-primary)' : '#ef4444' }}>
                {value || '-'}
                {value && copyValue && <CopyBtn text={copyValue} />}
            </span>
        </div>
    );
}

// ─── Status Badge ───
function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, { bg: string; color: string }> = {
        pending: { bg: 'rgba(234,179,8,0.15)', color: '#eab308' },
        exported: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
        ordered: { bg: 'rgba(168,85,247,0.15)', color: '#a855f7' },
        shipped: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
    };
    const c = colors[status] || colors.pending;
    return (
        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: c.bg, color: c.color, textTransform: 'uppercase' }}>
            {status}
        </span>
    );
}

// ─── Main Component ───
export function OrderManager() {
    const { language } = useLanguage();
    const t = (en: string, ko: string) => language === 'ko' ? ko : en;

    const [orders, setOrders] = useState<OrderRow[]>([]);
    const [products, setProducts] = useState<Map<string, ProductInfo>>(new Map());
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [exporting, setExporting] = useState(false);
    const [filter, setFilter] = useState<string>('pending');
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => { loadOrders(); }, [filter]);

    async function loadOrders() {
        setLoading(true);
        try {
            let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
            if (filter !== 'all') query = query.eq('procurement_status', filter);
            const { data, error: fetchErr } = await query;
            if (fetchErr) throw fetchErr;
            setOrders(data || []);

            const skus = new Set<string>();
            (data || []).forEach((o: OrderRow) => {
                if (Array.isArray(o.items)) o.items.forEach((item: any) => skus.add(item.sku));
            });
            if (skus.size > 0) {
                const { data: prods } = await supabase.from('products').select('sku, source, source_id, title').in('sku', Array.from(skus));
                const map = new Map<string, ProductInfo>();
                (prods || []).forEach((p: ProductInfo) => map.set(p.sku, p));
                setProducts(map);
            }
        } catch (err: any) { setError(err.message); }
        finally { setLoading(false); }
    }

    // ─── Search filter ───
    const filtered = useMemo(() => {
        if (!search.trim()) return orders;
        const q = search.trim().toLowerCase();
        return orders.filter(o =>
            (o.recipient_name || '').toLowerCase().includes(q) ||
            (o.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
            (o.address || '').toLowerCase().includes(q) ||
            (o.order_id || '').toLowerCase().includes(q)
        );
    }, [orders, search]);

    // ─── KPI Stats ───
    const stats = useMemo(() => {
        const withAddress = orders.filter(o => o.address);
        const uniqueRecipients = new Set(orders.filter(o => o.recipient_name).map(o => o.recipient_name));
        return {
            total: orders.length,
            uniqueRecipients: uniqueRecipients.size,
            withAddress: withAddress.length,
            missingInfo: orders.filter(o => !o.recipient_name || !o.phone || !o.address).length,
        };
    }, [orders]);

    function toggleSelect(orderId: string) {
        setSelected(prev => { const next = new Set(prev); next.has(orderId) ? next.delete(orderId) : next.add(orderId); return next; });
    }
    function selectAll() {
        selected.size === filtered.length ? setSelected(new Set()) : setSelected(new Set(filtered.map(o => o.id)));
    }

    async function exportToExcel() {
        const toExport = orders.filter(o => selected.has(o.id));
        if (toExport.length === 0) return;
        setExporting(true);
        try {
            const rows: any[][] = [];
            rows.push(['마켓', '상품번호', '옵션코드', '옵션명', '수량', '수령자명', '우편번호', '배송주소', '배송 상세주소', '휴대전화', '추가연락처', '쇼핑몰명', '전달사항', '배송요청사항', '통관고유번호']);
            for (const order of toExport) {
                const items = Array.isArray(order.items) ? order.items : [];
                for (const item of items) {
                    const product = products.get(item.sku);
                    const isDomeggook = product?.source === 'domeggook';
                    let sourceId = product?.source_id || '';
                    sourceId = sourceId.replace(/[^0-9]/g, '');
                    rows.push([
                        isDomeggook ? '도매꾹' : '도매매', sourceId, item.option_code || '00', item.option_name || '', item.qty || 1,
                        order.recipient_name || '', order.postal_code || '', order.address || '', order.address_detail || '',
                        formatPhone(order.phone), formatPhone(order.phone_alt), isDomeggook ? '' : '제이슨마트',
                        item.supplier_note || '', order.delivery_note || '', order.customs_id || '',
                    ]);
                }
            }
            const ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [
                { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 6 },
                { wch: 10 }, { wch: 10 }, { wch: 25 }, { wch: 20 },
                { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 18 },
            ];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'ordersBatchForm');
            XLSX.writeFile(wb, `domeggook_order_${new Date().toISOString().slice(0, 10)}.xlsx`);
            await supabase.from('orders').update({ procurement_status: 'exported' }).in('id', toExport.map(o => o.id));
            await loadOrders();
            setSelected(new Set());
        } catch (err: any) { setError(err.message); }
        finally { setExporting(false); }
    }

    async function updateStatus(orderId: string, newStatus: string) {
        await supabase.from('orders').update({ procurement_status: newStatus }).eq('id', orderId);
        loadOrders();
    }

    const filterTabs = [
        { key: 'pending', label: t('Pending', '발주 대기'), icon: <Clock size={13} /> },
        { key: 'exported', label: t('Exported', '엑셀 출력'), icon: <FileSpreadsheet size={13} /> },
        { key: 'ordered', label: t('Ordered', '발주 완료'), icon: <Package size={13} /> },
        { key: 'shipped', label: t('Shipped', '배송 중'), icon: <Truck size={13} /> },
        { key: 'all', label: t('All', '전체'), icon: <Filter size={13} /> },
    ];

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(16px, 4vw, 32px) clamp(12px, 3vw, 20px)' }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Truck size={24} style={{ color: 'var(--accent-blue)' }} />
                        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                            {t('Order Manager', '주문 관리')}
                        </h1>
                    </div>
                    <button onClick={exportToExcel} disabled={selected.size === 0 || exporting}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', fontSize: 13, fontWeight: 700,
                            borderRadius: 'var(--radius-sm)', border: 'none',
                            background: selected.size > 0 ? 'var(--accent-green)' : 'var(--bg-surface)',
                            color: selected.size > 0 ? '#fff' : 'var(--text-tertiary)',
                            cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
                        }}>
                        {exporting ? <Loader2 size={14} className="spin" /> : <FileSpreadsheet size={14} />}
                        {t(`Export ${selected.size} to Excel`, `${selected.size}건 엑셀 내보내기`)}
                    </button>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>
                    {t('Order management + shipping info + Excel bulk export', '주문 관리 · 배송정보 · 엑셀일괄주문 내보내기')}
                </p>
            </div>

            {/* KPI Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
                {[
                    { label: t('Total Orders', '총 주문'), value: stats.total, icon: <Package size={15} />, color: '#3b82f6' },
                    { label: t('Recipients', '수령자 수'), value: stats.uniqueRecipients, icon: <Users size={15} />, color: '#8b5cf6' },
                    { label: t('Has Address', '주소 등록'), value: stats.withAddress, icon: <MapPin size={15} />, color: '#22c55e' },
                    { label: t('Missing Info', '정보 미입력'), value: stats.missingInfo, icon: <AlertCircle size={15} />, color: '#ef4444' },
                ].map((s, i) => (
                    <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                            <span style={{ color: s.color }}>{s.icon}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>{s.label}</span>
                        </div>
                        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</span>
                    </div>
                ))}
            </div>

            {/* Filter Tabs + Search */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', flexWrap: 'wrap' }}>
                    {filterTabs.map(tab => (
                        <button key={tab.key} onClick={() => { setFilter(tab.key); setSelected(new Set()); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', fontSize: 11, fontWeight: 600,
                                borderRadius: 'var(--radius-sm)', border: 'none',
                                background: filter === tab.key ? 'var(--bg-card)' : 'transparent',
                                color: filter === tab.key ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                cursor: 'pointer', boxShadow: filter === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            }}>
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 200px', minWidth: 180, padding: '7px 12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
                    <Search size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder={t('Search name, phone, address, order ID...', '수령자, 전화번호, 주소, 주문번호 검색...')}
                        style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary)' }} />
                </div>
            </div>

            {/* Error */}
            {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', marginBottom: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: '#ef4444', fontSize: 13 }}>
                    <AlertCircle size={14} /> {error}
                    <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
                </div>
            )}

            {/* Orders Table */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <Loader2 size={20} className="spin" style={{ marginBottom: 8 }} />
                        <div style={{ fontSize: 13 }}>{t('Loading orders...', '주문 불러오는 중...')}</div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <Package size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
                        <div style={{ fontSize: 13 }}>{t('No orders found', '주문이 없습니다')}</div>
                    </div>
                ) : (
                    <div>
                        {/* Table Header */}
                        <div style={{
                            display: 'grid', gridTemplateColumns: '32px 32px 1fr 1fr 100px 90px 90px 80px',
                            gap: 0, padding: '10px 14px', background: 'var(--bg-surface)',
                            fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)',
                            textTransform: 'uppercase', letterSpacing: '0.3px', borderBottom: '1px solid var(--border-subtle)',
                        }}>
                            <span><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll} style={{ cursor: 'pointer' }} /></span>
                            <span />
                            <span>{t('Items', '상품')}</span>
                            <span>{t('Recipient / Address', '수령자 / 배송지')}</span>
                            <span style={{ textAlign: 'right' }}>{t('Amount', '금액')}</span>
                            <span style={{ textAlign: 'center' }}>{t('Status', '상태')}</span>
                            <span>{t('Date', '날짜')}</span>
                            <span style={{ textAlign: 'center' }}>{t('Actions', '관리')}</span>
                        </div>

                        {/* Rows */}
                        {filtered.map(order => {
                            const items = Array.isArray(order.items) ? order.items : [];
                            const firstItem = items[0];
                            const product = firstItem ? products.get(firstItem.sku) : null;
                            const isExpanded = expandedId === order.id;
                            const hasMissing = !order.recipient_name || !order.phone || !order.address;

                            return (
                                <div key={order.id}>
                                    {/* Summary Row */}
                                    <div style={{
                                        display: 'grid', gridTemplateColumns: '32px 32px 1fr 1fr 100px 90px 90px 80px',
                                        gap: 0, padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)',
                                        background: isExpanded ? 'rgba(59,130,246,0.04)' : selected.has(order.id) ? 'rgba(59,130,246,0.03)' : 'transparent',
                                        alignItems: 'center', fontSize: 12,
                                    }}>
                                        <span><input type="checkbox" checked={selected.has(order.id)} onChange={() => toggleSelect(order.id)} style={{ cursor: 'pointer' }} /></span>
                                        <span onClick={() => setExpandedId(isExpanded ? null : order.id)} style={{ cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </span>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                                                {product?.title?.slice(0, 30) || firstItem?.sku || '-'}
                                            </div>
                                            {items.length > 1 && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>+{items.length - 1} {t('more', '더')}</span>}
                                            <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-tertiary)' }}>{order.order_id?.slice(0, 14)}</div>
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: order.recipient_name ? 'var(--text-primary)' : '#ef4444' }}>
                                                    {order.recipient_name || t('No name', '미입력')}
                                                </span>
                                                {hasMissing && <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 600 }}>!</span>}
                                            </div>
                                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                                                {order.address ? `${order.postal_code ? `[${order.postal_code}] ` : ''}${order.address}` : t('No address', '주소 미입력')}
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>₩{(order.authorized_amount || 0).toLocaleString()}</div>
                                        <div style={{ textAlign: 'center' }}><StatusBadge status={order.procurement_status || 'pending'} /></div>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{new Date(order.created_at).toLocaleDateString('ko-KR')}</div>
                                        <div style={{ textAlign: 'center' }}>
                                            {order.procurement_status === 'exported' && (
                                                <button onClick={() => updateStatus(order.id, 'ordered')} style={{ padding: '3px 6px', fontSize: 10, fontWeight: 600, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.1)', color: '#a855f7', borderRadius: 4, cursor: 'pointer' }}>
                                                    {t('Ordered', '발주')}
                                                </button>
                                            )}
                                            {order.procurement_status === 'ordered' && (
                                                <button onClick={() => updateStatus(order.id, 'shipped')} style={{ padding: '3px 6px', fontSize: 10, fontWeight: 600, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderRadius: 4, cursor: 'pointer' }}>
                                                    {t('Shipped', '배송')}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded: Shipping Info + Items (merged from CustomerManagement) */}
                                    {isExpanded && (
                                        <div style={{ padding: '16px 48px 20px', background: 'rgba(59,130,246,0.02)', borderBottom: '1px solid var(--border-subtle)' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                                {/* Left: Shipping Info */}
                                                <div>
                                                    <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <MapPin size={14} style={{ color: '#3b82f6' }} />
                                                        {t('Shipping Information', '배송 정보')}
                                                    </h4>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                        <InfoRow label={t('Recipient', '수령자')} value={order.recipient_name} />
                                                        <InfoRow label={t('Phone', '전화번호')} value={formatPhone(order.phone)} copyValue={order.phone || ''} />
                                                        {order.phone_alt && <InfoRow label={t('Alt Phone', '추가연락처')} value={formatPhone(order.phone_alt)} copyValue={order.phone_alt} />}
                                                        <InfoRow label={t('Postal', '우편번호')} value={order.postal_code} />
                                                        <InfoRow label={t('Address', '주소')} value={order.address} copyValue={`${order.postal_code || ''} ${order.address || ''} ${order.address_detail || ''}`.trim()} />
                                                        {order.address_detail && <InfoRow label={t('Detail', '상세주소')} value={order.address_detail} />}
                                                        {order.delivery_note && <InfoRow label={t('Note', '배송메모')} value={order.delivery_note} />}
                                                        {order.customs_id && <InfoRow label={t('Customs', '통관번호')} value={order.customs_id} />}
                                                    </div>
                                                </div>
                                                {/* Right: Order Items */}
                                                <div>
                                                    <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <Package size={14} style={{ color: '#8b5cf6' }} />
                                                        {t('Order Items', '주문 상품')} ({items.length})
                                                    </h4>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                        {items.map((item: any, idx: number) => (
                                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
                                                                <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                                                    {item.sku || item.title || `Item ${idx + 1}`}
                                                                    {item.option_name && <span style={{ color: 'var(--text-tertiary)', fontSize: 11, marginLeft: 6 }}>[{item.option_name}]</span>}
                                                                </div>
                                                                <span style={{ fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>×{item.qty || 1}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        <span>{t('Order', '주문')}: {order.order_id}</span>
                                                        <span>{t('Date', '날짜')}: {new Date(order.created_at).toLocaleString('ko-KR')}</span>
                                                        <span>{t('Procurement', '발주상태')}: {order.procurement_status || 'pending'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Summary */}
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
                <span>
                    {t(`${filtered.length} of ${orders.length} orders`, `${orders.length}건 중 ${filtered.length}건 표시`)}
                    {selected.size > 0 && ` · ${t(`${selected.size} selected`, `${selected.size}건 선택`)}`}
                </span>
                <span>{t('Click ▶ to view shipping details', '▶ 클릭하면 배송정보를 확인할 수 있습니다')}</span>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
}
