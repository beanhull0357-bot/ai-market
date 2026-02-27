import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../context/LanguageContext';
import { Settings, ShoppingCart, RefreshCw, Wallet, Loader2, Check, AlertCircle, Truck, RotateCcw, XCircle, ChevronDown, ChevronUp, Package } from 'lucide-react';

// ─── Types ───
interface DomeConfig {
    dome_id: string;
    has_password: boolean;
    session_active: boolean;
    session_expires_at: string | null;
    grade: string | null;
    ip_address: string;
    updated_at: string | null;
}

interface PendingOrder {
    order_id: string;
    sku: string;
    product_title: string;
    quantity: number;
    total_price: number;
    recipient_name: string;
    address: string;
    phone: string;
    procurement_status: string;
    created_at: string;
    source_id: string;
}

interface OrderMapping {
    id: string;
    jsonmart_order_id: string;
    dome_order_no: string;
    dome_status: string;
    dome_tracking_company_name: string;
    dome_tracking_code: string;
    updated_at: string;
}

interface SyncLogEntry {
    id: string;
    action: string;
    status: string;
    detail: any;
    created_at: string;
}

const card = {
    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)', padding: '20px', marginBottom: '16px',
};
const label = { fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 600 as const };
const input = {
    width: '100%', padding: '10px 12px', fontSize: 14,
    border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-elevated)', color: 'var(--text-primary)',
    outline: 'none', boxSizing: 'border-box' as const,
};
const btnPrimary = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '10px 20px', fontSize: 13, fontWeight: 700,
    borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
    background: 'var(--accent-green)', color: '#000',
};
const btnSecondary = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', fontSize: 12, fontWeight: 600,
    borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
    background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer',
};
const badge = (color: string) => ({
    display: 'inline-block', fontSize: 11, fontWeight: 700,
    padding: '2px 8px', borderRadius: 99,
    background: `${color}22`, color,
});

type TabType = 'settings' | 'procurement' | 'stock' | 'logs';

export function DomeggookManager() {
    const { language } = useLanguage();
    const t = (en: string, ko: string) => language === 'ko' ? ko : en;

    const [tab, setTab] = useState<TabType>('settings');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    // ── Settings ──
    const [config, setConfig] = useState<DomeConfig | null>(null);
    const [domeId, setDomeId] = useState('');
    const [domePw, setDomePw] = useState('');
    const [domeIp, setDomeIp] = useState('127.0.0.1');
    const [asset, setAsset] = useState<{ point: string; emoney_total: string; emoney_cash: string } | null>(null);

    // ── Procurement ──
    const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
    const [orderMappings, setOrderMappings] = useState<OrderMapping[]>([]);

    // ── Logs ──
    const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);

    const showMsg = (msg: string) => { setMessage(msg); setError(''); setTimeout(() => setMessage(''), 5000); };
    const showErr = (msg: string) => { setError(msg); setMessage(''); setTimeout(() => setError(''), 5000); };

    const loadConfig = useCallback(async () => {
        const { data } = await supabase.rpc('dome_get_config');
        if (data && !data.error) {
            setConfig(data);
            setDomeId(data.dome_id || '');
            setDomeIp(data.ip_address || '127.0.0.1');
        }
    }, []);

    const loadPendingOrders = useCallback(async () => {
        const { data } = await supabase.rpc('dome_get_pending_orders');
        if (data?.orders) setPendingOrders(data.orders);
    }, []);

    const loadOrderMappings = useCallback(async () => {
        const { data } = await supabase.from('domeggook_order_map')
            .select('*').order('created_at', { ascending: false }).limit(50);
        if (data) setOrderMappings(data);
    }, []);

    const loadLogs = useCallback(async () => {
        const { data } = await supabase.from('domeggook_sync_log')
            .select('*').order('created_at', { ascending: false }).limit(100);
        if (data) setSyncLogs(data);
    }, []);

    useEffect(() => {
        loadConfig();
    }, [loadConfig]);

    useEffect(() => {
        if (tab === 'procurement') { loadPendingOrders(); loadOrderMappings(); }
        if (tab === 'logs') loadLogs();
    }, [tab, loadPendingOrders, loadOrderMappings, loadLogs]);

    // ── Actions ──
    const handleSaveConfig = async () => {
        setLoading(true);
        const { data } = await supabase.rpc('dome_save_config', {
            p_dome_id: domeId, p_dome_pw: domePw, p_ip: domeIp,
        });
        setLoading(false);
        if (data?.success) { showMsg('✅ 설정 저장 완료'); setDomePw(''); loadConfig(); }
        else showErr(data?.message || '저장 실패');
    };

    const handleLogin = async () => {
        setLoading(true);
        const { data } = await supabase.rpc('dome_login');
        setLoading(false);
        if (data?.success) { showMsg(`✅ 로그인 성공 (등급: ${data.grade})`); loadConfig(); }
        else showErr(`❌ 로그인 실패: ${data?.message || data?.error || '알 수 없는 오류'}`);
    };

    const handleGetAsset = async () => {
        setLoading(true);
        const { data } = await supabase.rpc('dome_get_asset');
        setLoading(false);
        if (data?.success) setAsset(data);
        else showErr(`이머니 조회 실패: ${data?.error || '오류'}`);
    };

    const handleSingleOrder = async (orderId: string) => {
        setLoading(true);
        const { data } = await supabase.rpc('dome_create_order', { p_order_id: orderId });
        setLoading(false);
        if (data?.success) {
            showMsg(`✅ 발주 완료: ${data.dome_order_no}`);
            loadPendingOrders(); loadOrderMappings();
        } else showErr(`❌ 발주 실패: ${data?.error || '오류'}`);
    };

    const handleBulkOrder = async () => {
        setLoading(true);
        const { data } = await supabase.rpc('dome_bulk_order');
        setLoading(false);
        if (data?.success) {
            showMsg(`✅ 일괄 발주 완료: 성공 ${data.ordered}건, 실패 ${data.failed}건`);
            loadPendingOrders(); loadOrderMappings();
        } else showErr(`❌ 일괄 발주 실패: ${data?.error || '오류'}`);
    };

    const handleSyncStatus = async () => {
        setLoading(true);
        const { data } = await supabase.rpc('dome_sync_order_status');
        setLoading(false);
        if (data?.success) {
            showMsg(`✅ 동기화 완료: ${data.synced}건 갱신, ${data.errors}건 오류`);
            loadOrderMappings();
        } else showErr(`❌ 동기화 실패: ${data?.error || '오류'}`);
    };

    const handleSyncSoldout = async () => {
        setLoading(true);
        const { data } = await supabase.rpc('dome_check_soldout', {
            p_status: 'SOLDOUT_CLOSE_DEL_AMT', p_page: 1,
        });
        setLoading(false);
        if (data?.success) {
            showMsg(`✅ 재고동기화 완료: ${data.updated}건 업데이트 (전체 ${data.total_items}건 중)`);
        } else showErr(`❌ 재고동기화 실패: ${data?.error || '오류'}`);
    };

    const handleCancelOrder = async (domeOrderNo: string) => {
        if (!confirm(`도매꾹 주문 ${domeOrderNo}을 취소하시겠습니까?`)) return;
        setLoading(true);
        const { data } = await supabase.rpc('dome_cancel_order', { p_order_no: domeOrderNo });
        setLoading(false);
        if (data?.success) { showMsg('✅ 취소 완료'); loadOrderMappings(); }
        else showErr(`❌ 취소 실패: ${data?.error || '오류'}`);
    };

    const tabItems: { key: TabType; label: string; icon: React.ReactNode }[] = [
        { key: 'settings', label: t('Settings', '⚙️ 설정'), icon: <Settings size={14} /> },
        { key: 'procurement', label: t('Orders', '📦 발주관리'), icon: <ShoppingCart size={14} /> },
        { key: 'stock', label: t('Stock Sync', '🔄 재고동기화'), icon: <RefreshCw size={14} /> },
        { key: 'logs', label: t('Logs', '📋 로그'), icon: <Package size={14} /> },
    ];

    return (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            {/* Tab Bar */}
            <div style={{
                display: 'flex', borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-elevated)',
            }}>
                {tabItems.map(ti => (
                    <button
                        key={ti.key}
                        onClick={() => setTab(ti.key)}
                        style={{
                            flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            fontSize: 13, fontWeight: tab === ti.key ? 700 : 500,
                            color: tab === ti.key ? 'var(--accent-green)' : 'var(--text-tertiary)',
                            background: 'transparent',
                            borderBottom: tab === ti.key ? '2px solid var(--accent-green)' : '2px solid transparent',
                        }}
                    >
                        {ti.icon} {ti.label}
                    </button>
                ))}
            </div>

            {/* Status Messages */}
            {message && <div style={{ padding: '10px 16px', background: 'rgba(0,255,136,0.1)', color: 'var(--accent-green)', fontSize: 13 }}>{message}</div>}
            {error && <div style={{ padding: '10px 16px', background: 'rgba(255,50,50,0.1)', color: '#ff5555', fontSize: 13 }}>{error}</div>}

            <div style={{ padding: 20 }}>
                {/* ━━ SETTINGS TAB ━━ */}
                {tab === 'settings' && (
                    <div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
                            {t('Domeggook Account Settings', '도매꾹 계정 설정')}
                        </h3>

                        {/* Session Status */}
                        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <div style={label}>{t('Session Status', '세션 상태')}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {config?.session_active
                                        ? <span style={badge('var(--accent-green)')}>● 활성</span>
                                        : <span style={badge('#ff5555')}>● 비활성</span>
                                    }
                                    {config?.grade && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>등급: {config.grade}</span>}
                                    {config?.session_expires_at && (
                                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                            만료: {new Date(config.session_expires_at).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button onClick={handleLogin} disabled={loading} style={btnSecondary}>
                                {loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                                {t('Login', '로그인')}
                            </button>
                        </div>

                        {/* Config Form */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                            <div>
                                <div style={label}>{t('Domeggook ID', '도매꾹 ID')}</div>
                                <input style={input} value={domeId} onChange={e => setDomeId(e.target.value)} placeholder="도매꾹 회원 ID" />
                            </div>
                            <div>
                                <div style={label}>{t('Password', '비밀번호')}</div>
                                <input style={input} type="password" value={domePw} onChange={e => setDomePw(e.target.value)}
                                    placeholder={config?.has_password ? '●●●●●●●● (변경 시 입력)' : '비밀번호 입력'} />
                            </div>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <div style={label}>{t('IP Address', 'IP 주소')} <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(보안 설정용)</span></div>
                            <input style={{ ...input, maxWidth: 300 }} value={domeIp} onChange={e => setDomeIp(e.target.value)} />
                        </div>
                        <button onClick={handleSaveConfig} disabled={loading || !domeId} style={btnPrimary}>
                            {loading ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                            {t('Save Settings', '설정 저장')}
                        </button>

                        {/* E-Money */}
                        <div style={{ ...card, marginTop: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                                    <Wallet size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                                    {t('E-Money Balance', '이머니 잔액')}
                                </h4>
                                <button onClick={handleGetAsset} disabled={loading || !config?.session_active} style={btnSecondary}>
                                    {loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                                    {t('Check', '조회')}
                                </button>
                            </div>
                            {asset ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                    <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>포인트</div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-green)' }}>
                                            {Number(asset.point || 0).toLocaleString()}
                                        </div>
                                    </div>
                                    <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>이머니 (전체)</div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                                            {Number(asset.emoney_total || 0).toLocaleString()}
                                        </div>
                                    </div>
                                    <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>이머니 (현금)</div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                                            {Number(asset.emoney_cash || 0).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                                    {config?.session_active ? t('Click Check to view balance', '조회를 클릭하세요') : t('Login required', '로그인이 필요합니다')}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ━━ PROCUREMENT TAB ━━ */}
                {tab === 'procurement' && (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                                {t('Procurement Management', '발주 관리')}
                            </h3>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={handleSyncStatus} disabled={loading} style={btnSecondary}>
                                    {loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                                    {t('Sync Status', '상태 동기화')}
                                </button>
                                <button onClick={handleBulkOrder} disabled={loading || pendingOrders.length === 0} style={btnPrimary}>
                                    {loading ? <Loader2 size={14} className="spin" /> : <ShoppingCart size={14} />}
                                    {t('Order All', '일괄 발주')} ({pendingOrders.length})
                                </button>
                            </div>
                        </div>

                        {/* Pending Orders */}
                        {pendingOrders.length > 0 ? (
                            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                                <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                        ⏳ {t('Pending Orders', '미발주 주문')} ({pendingOrders.length})
                                    </span>
                                </div>
                                <div style={{ maxHeight: 400, overflow: 'auto' }}>
                                    {pendingOrders.map(o => (
                                        <div key={o.order_id} style={{
                                            padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    {o.product_title?.slice(0, 40)}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                                    {o.order_id} · {o.quantity}개 · ₩{(o.total_price || 0).toLocaleString()}
                                                    {o.recipient_name && ` · ${o.recipient_name}`}
                                                </div>
                                            </div>
                                            <button onClick={() => handleSingleOrder(o.order_id)} disabled={loading} style={btnSecondary}>
                                                <Truck size={12} /> {t('Order', '발주')}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div style={{ ...card, textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>
                                <Check size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
                                <div style={{ fontSize: 14 }}>{t('No pending orders', '미발주 주문이 없습니다')}</div>
                            </div>
                        )}

                        {/* Order Mappings */}
                        {orderMappings.length > 0 && (
                            <div style={{ ...card, padding: 0, overflow: 'hidden', marginTop: 16 }}>
                                <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                        📋 {t('Order History', '발주 이력')} ({orderMappings.length})
                                    </span>
                                </div>
                                <div style={{ maxHeight: 400, overflow: 'auto' }}>
                                    {orderMappings.map(m => (
                                        <div key={m.id} style={{
                                            padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12,
                                        }}>
                                            <div style={{ flex: 1 }}>
                                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.jsonmart_order_id}</span>
                                                <span style={{ margin: '0 6px', color: 'var(--text-tertiary)' }}>→</span>
                                                <span style={{ fontWeight: 600, color: 'var(--accent-green)' }}>{m.dome_order_no || '발주대기'}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={badge(m.dome_status === '배송완료' ? 'var(--accent-green)' : m.dome_status === '배송중' ? '#ffa500' : '#888')}>
                                                    {m.dome_status || '처리중'}
                                                </span>
                                                {m.dome_tracking_code && (
                                                    <span style={{ fontSize: 11, color: 'var(--accent-green)' }}>
                                                        {m.dome_tracking_company_name} {m.dome_tracking_code}
                                                    </span>
                                                )}
                                                {m.dome_order_no && !['구매취소', '배송완료'].includes(m.dome_status || '') && (
                                                    <button onClick={() => handleCancelOrder(m.dome_order_no)} style={{ ...btnSecondary, padding: '4px 8px', fontSize: 11 }}>
                                                        <XCircle size={10} /> {t('Cancel', '취소')}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ━━ STOCK SYNC TAB ━━ */}
                {tab === 'stock' && (
                    <div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
                            {t('Stock & Price Sync', '재고/가격 동기화')}
                        </h3>
                        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20, lineHeight: 1.6 }}>
                            {t(
                                'Check for soldout, price changes, delisted products from Domeggook and update JSONMart products automatically.',
                                '도매꾹에서 품절, 가격변경, 판매종료된 상품을 확인하고 JSONMart 상품을 자동으로 업데이트합니다.'
                            )}
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div style={card}>
                                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                                    🔴 {t('Soldout / Delisted / Price Changes', '품절/종료/가격변경')}
                                </div>
                                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
                                    {t('Detect all changes at once', '모든 변경사항 한번에 감지')}
                                </p>
                                <button onClick={handleSyncSoldout} disabled={loading} style={btnPrimary}>
                                    {loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                                    {t('Run Sync', '동기화 실행')}
                                </button>
                            </div>
                            <div style={card}>
                                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                                    📦 {t('Order Status Sync', '주문 배송상태 동기화')}
                                </div>
                                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
                                    {t('Update tracking info for active orders', '진행중인 주문의 배송정보 갱신')}
                                </p>
                                <button onClick={handleSyncStatus} disabled={loading} style={btnSecondary}>
                                    {loading ? <Loader2 size={14} className="spin" /> : <Truck size={14} />}
                                    {t('Sync Delivery', '배송상태 동기화')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ━━ LOGS TAB ━━ */}
                {tab === 'logs' && (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                                {t('Sync Logs', '동기화 로그')}
                            </h3>
                            <button onClick={loadLogs} style={btnSecondary}>
                                <RotateCcw size={14} /> {t('Refresh', '새로고침')}
                            </button>
                        </div>
                        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                            <div style={{ maxHeight: 500, overflow: 'auto' }}>
                                {syncLogs.length === 0 ? (
                                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                                        {t('No logs yet', '로그가 없습니다')}
                                    </div>
                                ) : syncLogs.map(log => (
                                    <div key={log.id} style={{
                                        padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)',
                                        display: 'flex', alignItems: 'center', gap: 12, fontSize: 12,
                                    }}>
                                        <span style={badge(log.status === 'success' ? 'var(--accent-green)' : '#ff5555')}>
                                            {log.status}
                                        </span>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', minWidth: 120 }}>
                                            {log.action}
                                        </span>
                                        <span style={{ flex: 1, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {typeof log.detail === 'object' ? JSON.stringify(log.detail) : log.detail}
                                        </span>
                                        <span style={{ color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                                            {new Date(log.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
