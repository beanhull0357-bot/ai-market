import React, { useState, useEffect, useMemo } from 'react';
import { Search, Users, MapPin, Phone, Package, ChevronDown, ChevronRight, Loader2, AlertCircle, Copy, Check, Truck, Mail } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../supabaseClient';

// ─── Types ───
interface OrderWithCustomer {
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

// ─── Helpers ───
function formatPhone(phone: string | null): string {
    if (!phone) return '-';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    return phone;
}

function getStatusStyle(status: string): { bg: string; color: string; label: string } {
    const map: Record<string, { bg: string; color: string; label: string }> = {
        ORDER_CREATED: { bg: 'rgba(234,179,8,0.12)', color: '#eab308', label: '주문생성' },
        PAYMENT_AUTHORIZED: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', label: '결제승인' },
        PROCUREMENT_PENDING: { bg: 'rgba(249,115,22,0.12)', color: '#f97316', label: '조달대기' },
        PROCUREMENT_SENT: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', label: '발주완료' },
        SHIPPED: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', label: '배송중' },
        DELIVERED: { bg: 'rgba(34,197,94,0.15)', color: '#16a34a', label: '배송완료' },
        VOIDED: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', label: '취소' },
    };
    return map[status] || { bg: 'rgba(156,163,175,0.12)', color: '#9ca3af', label: status };
}

// ─── Copy Button ───
function CopyBtn({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <button
            onClick={handleCopy}
            title="복사"
            style={{
                padding: 2, border: 'none', background: 'none',
                color: copied ? '#22c55e' : 'var(--text-tertiary)',
                cursor: 'pointer', display: 'inline-flex', verticalAlign: 'middle',
            }}
        >
            {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
    );
}

// ─── Main Component ───
export function CustomerManagement() {
    const { language } = useLanguage();
    const t = (en: string, ko: string) => language === 'ko' ? ko : en;

    const [orders, setOrders] = useState<OrderWithCustomer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => { loadOrders(); }, []);

    async function loadOrders() {
        setLoading(true);
        try {
            const { data, error: err } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });
            if (err) throw err;
            setOrders(data || []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    // ─── Filter & Search ───
    const filtered = useMemo(() => {
        let result = orders;

        // Status filter
        if (statusFilter !== 'all') {
            result = result.filter(o => o.status === statusFilter);
        }

        // Search
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            result = result.filter(o =>
                (o.recipient_name || '').toLowerCase().includes(q) ||
                (o.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
                (o.address || '').toLowerCase().includes(q) ||
                (o.order_id || '').toLowerCase().includes(q)
            );
        }
        return result;
    }, [orders, search, statusFilter]);

    // ─── Stats ───
    const stats = useMemo(() => {
        const withAddress = orders.filter(o => o.address);
        const withPhone = orders.filter(o => o.phone);
        const uniqueRecipients = new Set(orders.filter(o => o.recipient_name).map(o => o.recipient_name));
        return {
            total: orders.length,
            withAddress: withAddress.length,
            withPhone: withPhone.length,
            uniqueRecipients: uniqueRecipients.size,
            missingInfo: orders.filter(o => !o.recipient_name || !o.phone || !o.address).length,
        };
    }, [orders]);

    const statusOptions = [
        { value: 'all', label: t('All', '전체') },
        { value: 'ORDER_CREATED', label: t('Created', '주문생성') },
        { value: 'PAYMENT_AUTHORIZED', label: t('Authorized', '결제승인') },
        { value: 'PROCUREMENT_PENDING', label: t('Pending', '조달대기') },
        { value: 'PROCUREMENT_SENT', label: t('Ordered', '발주완료') },
        { value: 'SHIPPED', label: t('Shipped', '배송중') },
        { value: 'DELIVERED', label: t('Delivered', '배송완료') },
    ];

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <Users size={20} style={{ color: 'var(--accent-blue, #3b82f6)' }} />
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
                        {t('Customer Management', '고객정보 관리')}
                    </h2>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>
                    {t(
                        'View customer shipping info and order details for all orders',
                        '주문별 고객 배송정보(수령자, 주소, 연락처)와 주문 상세를 통합 조회합니다'
                    )}
                </p>
            </div>

            {/* Stats Cards */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 12, marginBottom: 20,
            }}>
                {[
                    { label: t('Total Orders', '총 주문'), value: stats.total, icon: <Package size={16} />, color: '#3b82f6' },
                    { label: t('Unique Recipients', '수령자 수'), value: stats.uniqueRecipients, icon: <Users size={16} />, color: '#8b5cf6' },
                    { label: t('Has Address', '주소 등록'), value: stats.withAddress, icon: <MapPin size={16} />, color: '#22c55e' },
                    { label: t('Missing Info', '정보 미입력'), value: stats.missingInfo, icon: <AlertCircle size={16} />, color: '#ef4444' },
                ].map((s, i) => (
                    <div key={i} style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)', padding: '14px 16px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <span style={{ color: s.color }}>{s.icon}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>{s.label}</span>
                        </div>
                        <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</span>
                    </div>
                ))}
            </div>

            {/* Search & Filter */}
            <div style={{
                display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center',
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    flex: '1 1 260px', minWidth: 200,
                    padding: '8px 12px', background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                }}>
                    <Search size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={t('Search by name, phone, address, order ID...', '수령자, 전화번호, 주소, 주문번호 검색...')}
                        style={{
                            flex: 1, background: 'none', border: 'none', outline: 'none',
                            fontSize: 13, color: 'var(--text-primary)',
                        }}
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    style={{
                        padding: '8px 12px', fontSize: 12, fontWeight: 600,
                        background: 'var(--bg-surface)', color: 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                    }}
                >
                    {statusOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
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

            {/* Orders List */}
            <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)', overflow: 'hidden',
            }}>
                {loading ? (
                    <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <Loader2 size={20} className="spin" style={{ marginBottom: 8 }} />
                        <div style={{ fontSize: 13 }}>{t('Loading...', '불러오는 중...')}</div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <Users size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
                        <div style={{ fontSize: 13 }}>{t('No orders found', '검색 결과가 없습니다')}</div>
                    </div>
                ) : (
                    <div>
                        {/* Table Header */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '32px 1fr 1fr 140px 100px 100px',
                            gap: 0, padding: '10px 16px',
                            background: 'var(--bg-surface)',
                            fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
                            textTransform: 'uppercase', letterSpacing: '0.3px',
                            borderBottom: '1px solid var(--border-subtle)',
                        }}>
                            <span />
                            <span>{t('Recipient / Address', '수령자 / 배송지')}</span>
                            <span>{t('Contact', '연락처')}</span>
                            <span>{t('Order ID', '주문번호')}</span>
                            <span style={{ textAlign: 'right' }}>{t('Amount', '금액')}</span>
                            <span style={{ textAlign: 'center' }}>{t('Status', '상태')}</span>
                        </div>

                        {/* Rows */}
                        {filtered.map(order => {
                            const isExpanded = expandedId === order.id;
                            const items = Array.isArray(order.items) ? order.items : [];
                            const status = getStatusStyle(order.status);
                            const hasAddress = order.address || order.postal_code;
                            const hasMissing = !order.recipient_name || !order.phone || !order.address;

                            return (
                                <div key={order.id}>
                                    {/* Summary Row */}
                                    <div
                                        onClick={() => setExpandedId(isExpanded ? null : order.id)}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '32px 1fr 1fr 140px 100px 100px',
                                            gap: 0, padding: '12px 16px',
                                            borderBottom: '1px solid var(--border-subtle)',
                                            cursor: 'pointer',
                                            background: isExpanded ? 'rgba(59,130,246,0.04)' : 'transparent',
                                            transition: 'background 0.15s',
                                            alignItems: 'center',
                                        }}
                                        onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'rgba(59,130,246,0.02)'; }}
                                        onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        {/* Expand icon */}
                                        <span style={{ color: 'var(--text-tertiary)' }}>
                                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </span>

                                        {/* Name + Address preview */}
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{
                                                    fontSize: 13, fontWeight: 600,
                                                    color: order.recipient_name ? 'var(--text-primary)' : '#ef4444',
                                                }}>
                                                    {order.recipient_name || t('No name', '이름 미입력')}
                                                </span>
                                                {hasMissing && (
                                                    <span style={{
                                                        fontSize: 9, padding: '1px 5px', borderRadius: 3,
                                                        background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 600,
                                                    }}>
                                                        {t('INCOMPLETE', '미완성')}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{
                                                fontSize: 11, color: 'var(--text-tertiary)',
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                maxWidth: 280,
                                            }}>
                                                {hasAddress
                                                    ? `${order.postal_code ? `[${order.postal_code}] ` : ''}${order.address || ''}${order.address_detail ? ` ${order.address_detail}` : ''}`
                                                    : t('No address', '주소 미입력')
                                                }
                                            </div>
                                        </div>

                                        {/* Contact */}
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Phone size={11} style={{ color: 'var(--text-tertiary)' }} />
                                                {formatPhone(order.phone)}
                                            </div>
                                            {order.phone_alt && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
                                                    <Phone size={10} />
                                                    {formatPhone(order.phone_alt)}
                                                </div>
                                            )}
                                        </div>

                                        {/* Order ID */}
                                        <div style={{
                                            fontFamily: 'monospace', fontSize: 11,
                                            color: 'var(--text-tertiary)',
                                        }}>
                                            {order.order_id?.slice(0, 12)}
                                        </div>

                                        {/* Amount */}
                                        <div style={{
                                            fontSize: 12, fontWeight: 600,
                                            color: 'var(--text-primary)', textAlign: 'right',
                                        }}>
                                            ₩{(order.authorized_amount || 0).toLocaleString()}
                                        </div>

                                        {/* Status */}
                                        <div style={{ textAlign: 'center' }}>
                                            <span style={{
                                                fontSize: 10, fontWeight: 700, padding: '3px 8px',
                                                borderRadius: 99, background: status.bg, color: status.color,
                                            }}>
                                                {status.label}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Expanded Detail */}
                                    {isExpanded && (
                                        <div style={{
                                            padding: '16px 48px 20px',
                                            background: 'rgba(59,130,246,0.02)',
                                            borderBottom: '1px solid var(--border-subtle)',
                                        }}>
                                            <div style={{
                                                display: 'grid', gridTemplateColumns: '1fr 1fr',
                                                gap: 20,
                                            }}>
                                                {/* Left: Customer Info */}
                                                <div>
                                                    <h4 style={{
                                                        fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
                                                        marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6,
                                                    }}>
                                                        <MapPin size={14} style={{ color: '#3b82f6' }} />
                                                        {t('Shipping Information', '배송 정보')}
                                                    </h4>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                        <InfoRow
                                                            label={t('Recipient', '수령자')}
                                                            value={order.recipient_name}
                                                        />
                                                        <InfoRow
                                                            label={t('Phone', '전화번호')}
                                                            value={formatPhone(order.phone)}
                                                            copyValue={order.phone || ''}
                                                        />
                                                        {order.phone_alt && (
                                                            <InfoRow
                                                                label={t('Alt Phone', '추가연락처')}
                                                                value={formatPhone(order.phone_alt)}
                                                                copyValue={order.phone_alt}
                                                            />
                                                        )}
                                                        <InfoRow
                                                            label={t('Postal Code', '우편번호')}
                                                            value={order.postal_code}
                                                        />
                                                        <InfoRow
                                                            label={t('Address', '주소')}
                                                            value={order.address}
                                                            copyValue={`${order.postal_code || ''} ${order.address || ''} ${order.address_detail || ''}`.trim()}
                                                        />
                                                        {order.address_detail && (
                                                            <InfoRow
                                                                label={t('Detail', '상세주소')}
                                                                value={order.address_detail}
                                                            />
                                                        )}
                                                        {order.delivery_note && (
                                                            <InfoRow
                                                                label={t('Delivery Note', '배송메모')}
                                                                value={order.delivery_note}
                                                            />
                                                        )}
                                                        {order.customs_id && (
                                                            <InfoRow
                                                                label={t('Customs ID', '통관번호')}
                                                                value={order.customs_id}
                                                            />
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Right: Order Items */}
                                                <div>
                                                    <h4 style={{
                                                        fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
                                                        marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6,
                                                    }}>
                                                        <Package size={14} style={{ color: '#8b5cf6' }} />
                                                        {t('Order Items', '주문 상품')} ({items.length})
                                                    </h4>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                        {items.map((item: any, idx: number) => (
                                                            <div key={idx} style={{
                                                                display: 'flex', justifyContent: 'space-between',
                                                                alignItems: 'center', gap: 8,
                                                                padding: '8px 12px',
                                                                background: 'var(--bg-surface)',
                                                                borderRadius: 'var(--radius-sm)',
                                                                fontSize: 12,
                                                            }}>
                                                                <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                                                    {item.sku || item.title || `Item ${idx + 1}`}
                                                                    {item.option_name && (
                                                                        <span style={{ color: 'var(--text-tertiary)', fontSize: 11, marginLeft: 6 }}>
                                                                            [{item.option_name}]
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span style={{
                                                                    fontWeight: 600, color: 'var(--text-secondary)',
                                                                    whiteSpace: 'nowrap',
                                                                }}>
                                                                    ×{item.qty || 1}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Order meta */}
                                                    <div style={{
                                                        marginTop: 12, fontSize: 11,
                                                        color: 'var(--text-tertiary)',
                                                        display: 'flex', flexDirection: 'column', gap: 3,
                                                    }}>
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

            {/* Footer Summary */}
            <div style={{
                marginTop: 14, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
                fontSize: 12, color: 'var(--text-tertiary)',
            }}>
                <span>
                    {t(`Showing ${filtered.length} of ${orders.length} orders`, `${orders.length}건 중 ${filtered.length}건 표시`)}
                </span>
                <span>
                    {t('Click a row to view full details', '행을 클릭하면 상세정보를 확인할 수 있습니다')}
                </span>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
}

// ─── Info Row Component ───
function InfoRow({ label, value, copyValue }: { label: string; value: string | null; copyValue?: string }) {
    return (
        <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
            <span style={{
                minWidth: 70, fontWeight: 600, color: 'var(--text-tertiary)',
                flexShrink: 0,
            }}>
                {label}
            </span>
            <span style={{ color: value ? 'var(--text-primary)' : '#ef4444' }}>
                {value || '-'}
                {value && copyValue && <CopyBtn text={copyValue} />}
            </span>
        </div>
    );
}
