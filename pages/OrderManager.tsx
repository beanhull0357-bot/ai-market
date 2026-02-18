import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../context/LanguageContext';
import * as XLSX from 'xlsx';
import {
    Package, Download, Check, Loader2, AlertCircle,
    FileSpreadsheet, Truck, Clock, CheckCircle2, Filter
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
        <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px',
            borderRadius: 99, background: c.bg, color: c.color,
            textTransform: 'uppercase',
        }}>
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
    const [error, setError] = useState('');

    // Load orders
    useEffect(() => {
        loadOrders();
    }, [filter]);

    async function loadOrders() {
        setLoading(true);
        try {
            let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
            if (filter !== 'all') {
                query = query.eq('procurement_status', filter);
            }
            const { data, error: fetchErr } = await query;
            if (fetchErr) throw fetchErr;
            setOrders(data || []);

            // Load product info for SKUs
            const skus = new Set<string>();
            (data || []).forEach((o: OrderRow) => {
                if (Array.isArray(o.items)) {
                    o.items.forEach((item: any) => skus.add(item.sku));
                }
            });
            if (skus.size > 0) {
                const { data: prods } = await supabase
                    .from('products')
                    .select('sku, source, source_id, title')
                    .in('sku', Array.from(skus));
                const map = new Map<string, ProductInfo>();
                (prods || []).forEach((p: ProductInfo) => map.set(p.sku, p));
                setProducts(map);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    function toggleSelect(orderId: string) {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(orderId) ? next.delete(orderId) : next.add(orderId);
            return next;
        });
    }

    function selectAll() {
        if (selected.size === orders.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(orders.map(o => o.id)));
        }
    }

    // ─── Export to Domeggook Excel ───
    async function exportToExcel() {
        const toExport = orders.filter(o => selected.has(o.id));
        if (toExport.length === 0) return;

        setExporting(true);
        try {
            // Build rows in 14-column Domeggook format
            const rows: any[][] = [];

            // Header row (must match Domeggook template exactly)
            rows.push([
                '마켓', '상품번호', '옵션코드', '옵션명', '수량',
                '수령자명', '우편번호', '배송주소', '배송 상세주소',
                '휴대전화', '추가연락처', '쇼핑몰명', '전달사항', '배송요청사항'
            ]);

            for (const order of toExport) {
                const items = Array.isArray(order.items) ? order.items : [];
                for (const item of items) {
                    const product = products.get(item.sku);
                    const isDomeggook = product?.source === 'domeggook';

                    // Extract numeric source_id (remove DOME- prefix or non-numeric chars)
                    let sourceId = product?.source_id || '';
                    sourceId = sourceId.replace(/[^0-9]/g, '');

                    rows.push([
                        isDomeggook ? '도매꾹' : '도매매',     // A: 마켓
                        sourceId,                              // B: 상품번호
                        '00',                                   // C: 옵션코드 (기본: 00)
                        '',                                     // D: 옵션명
                        item.qty || 1,                         // E: 수량
                        order.recipient_name || '',            // F: 수령자명
                        order.postal_code || '',               // G: 우편번호
                        order.address || '',                   // H: 배송주소
                        order.address_detail || '',            // I: 배송 상세주소
                        order.phone || '',                     // J: 휴대전화
                        order.phone_alt || '',                 // K: 추가연락처
                        '',                                     // L: 쇼핑몰명 (도매꾹은 비움)
                        '',                                     // M: 전달사항
                        order.delivery_note || '',             // N: 배송요청사항
                    ]);
                }
            }

            // Create workbook
            const ws = XLSX.utils.aoa_to_sheet(rows);

            // Set column widths for readability
            ws['!cols'] = [
                { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 6 },
                { wch: 10 }, { wch: 10 }, { wch: 25 }, { wch: 20 },
                { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 },
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'ordersBatchForm');

            // Generate filename with date
            const date = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `domeggook_order_${date}.xlsx`);

            // Mark as exported
            const ids = toExport.map(o => o.id);
            await supabase
                .from('orders')
                .update({ procurement_status: 'exported' })
                .in('id', ids);

            await loadOrders();
            setSelected(new Set());
        } catch (err: any) {
            setError(err.message);
        } finally {
            setExporting(false);
        }
    }

    // ─── Update procurement status ───
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Truck size={24} style={{ color: 'var(--accent-blue)' }} />
                        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                            {t('Order Manager', '주문 관리')}
                        </h1>
                    </div>
                    <button
                        onClick={exportToExcel}
                        disabled={selected.size === 0 || exporting}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '10px 20px', fontSize: 13, fontWeight: 700,
                            borderRadius: 'var(--radius-sm)',
                            border: 'none',
                            background: selected.size > 0 ? 'var(--accent-green)' : 'var(--bg-surface)',
                            color: selected.size > 0 ? '#fff' : 'var(--text-tertiary)',
                            cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        {exporting ? <Loader2 size={14} className="spin" /> : <FileSpreadsheet size={14} />}
                        {t(`Export ${selected.size} to Excel`, `${selected.size}건 엑셀 내보내기`)}
                    </button>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>
                    {t(
                        'Manage orders and export to Domeggook Excel bulk order format',
                        '주문을 관리하고 도매꼭 엑셀일괄주문 양식으로 내보냅니다'
                    )}
                </p>
            </div>

            {/* Filter Tabs */}
            <div style={{
                display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap',
                padding: 4, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
            }}>
                {filterTabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => { setFilter(tab.key); setSelected(new Set()); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '6px 14px', fontSize: 12, fontWeight: 600,
                            borderRadius: 'var(--radius-sm)',
                            border: 'none',
                            background: filter === tab.key ? 'var(--bg-card)' : 'transparent',
                            color: filter === tab.key ? 'var(--text-primary)' : 'var(--text-tertiary)',
                            cursor: 'pointer',
                            boxShadow: filter === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.15s',
                        }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Error */}
            {error && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '12px 16px', marginBottom: 16,
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 'var(--radius-md)', color: '#ef4444', fontSize: 13,
                }}>
                    <AlertCircle size={14} /> {error}
                    <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
                </div>
            )}

            {/* Orders Table */}
            <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)', overflow: 'hidden',
            }}>
                <div className="table-scroll">
                    {loading ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                            <Loader2 size={20} className="spin" style={{ marginBottom: 8 }} />
                            <div style={{ fontSize: 13 }}>{t('Loading orders...', '주문 불러오는 중...')}</div>
                        </div>
                    ) : orders.length === 0 ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                            <Package size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
                            <div style={{ fontSize: 13 }}>{t('No orders found', '주문이 없습니다')}</div>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-surface)' }}>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', width: 32 }}>
                                        <input
                                            type="checkbox"
                                            checked={selected.size === orders.length && orders.length > 0}
                                            onChange={selectAll}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    </th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                                        {t('Order ID', '주문번호')}
                                    </th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                                        {t('Items', '상품')}
                                    </th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                                        {t('Recipient', '수령자')}
                                    </th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                                        {t('Amount', '금액')}
                                    </th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                                        {t('Status', '상태')}
                                    </th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                                        {t('Date', '날짜')}
                                    </th>
                                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                                        {t('Actions', '관리')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(order => {
                                    const items = Array.isArray(order.items) ? order.items : [];
                                    const firstItem = items[0];
                                    const product = firstItem ? products.get(firstItem.sku) : null;

                                    return (
                                        <tr
                                            key={order.id}
                                            style={{
                                                borderTop: '1px solid var(--border-subtle)',
                                                background: selected.has(order.id) ? 'rgba(59,130,246,0.05)' : 'transparent',
                                            }}
                                        >
                                            <td style={{ padding: '10px 12px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(order.id)}
                                                    onChange={() => toggleSelect(order.id)}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                            </td>
                                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)' }}>
                                                {order.order_id?.slice(0, 12)}
                                            </td>
                                            <td style={{ padding: '10px 12px', color: 'var(--text-primary)', maxWidth: 200 }}>
                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {product?.title?.slice(0, 25) || firstItem?.sku || '-'}
                                                </div>
                                                {items.length > 1 && (
                                                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                                                        +{items.length - 1} {t('more', '더')}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                                                {order.recipient_name || (
                                                    <span style={{ color: '#ef4444', fontSize: 11 }}>
                                                        {t('Missing', '미입력')}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                ₩{(order.authorized_amount || 0).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <StatusBadge status={order.procurement_status || 'pending'} />
                                            </td>
                                            <td style={{ padding: '10px 12px', color: 'var(--text-tertiary)', fontSize: 11 }}>
                                                {new Date(order.created_at).toLocaleDateString('ko-KR')}
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                {order.procurement_status === 'exported' && (
                                                    <button
                                                        onClick={() => updateStatus(order.id, 'ordered')}
                                                        title={t('Mark as ordered', '발주 완료로 변경')}
                                                        style={{
                                                            padding: '4px 8px', fontSize: 11, fontWeight: 600,
                                                            border: '1px solid rgba(168,85,247,0.3)',
                                                            background: 'rgba(168,85,247,0.1)', color: '#a855f7',
                                                            borderRadius: 4, cursor: 'pointer',
                                                        }}
                                                    >
                                                        {t('Ordered', '발주완료')}
                                                    </button>
                                                )}
                                                {order.procurement_status === 'ordered' && (
                                                    <button
                                                        onClick={() => updateStatus(order.id, 'shipped')}
                                                        title={t('Mark as shipped', '배송 중으로 변경')}
                                                        style={{
                                                            padding: '4px 8px', fontSize: 11, fontWeight: 600,
                                                            border: '1px solid rgba(34,197,94,0.3)',
                                                            background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                                                            borderRadius: 4, cursor: 'pointer',
                                                        }}
                                                    >
                                                        {t('Shipped', '배송중')}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Summary */}
            <div style={{
                marginTop: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
                fontSize: 12, color: 'var(--text-tertiary)',
            }}>
                <span>
                    {t(`${orders.length} orders`, `총 ${orders.length}건`)}
                    {selected.size > 0 && ` · ${t(`${selected.size} selected`, `${selected.size}건 선택`)}`}
                </span>
                <span>
                    {t('Export generates Domeggook bulk order Excel format', '내보내기 시 도매꼭 엑셀일괄주문 양식 생성')}
                </span>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
}

