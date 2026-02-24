import React, { useState, useEffect } from 'react';
import { Wallet, ArrowUpCircle, ArrowDownCircle, RotateCcw, Gift, Receipt, Ticket, Star, Loader2, Copy, CheckCircle, Download, Tag, TrendingUp, CreditCard } from 'lucide-react';
import { getWalletInfo, walletDeposit, walletRefund, useCoupons, applyCoupon, useInvoices } from '../hooks';

type Tab = 'wallet' | 'coupons' | 'invoices';

/* ━━━ Tx Row ━━━ */
const TxRow: React.FC<{ tx: any }> = ({ tx }) => {
    const icon: Record<string, React.ReactNode> = {
        DEPOSIT: <ArrowUpCircle size={14} style={{ color: 'var(--accent-green)' }} />,
        SPEND: <ArrowDownCircle size={14} style={{ color: 'var(--accent-red)' }} />,
        REFUND: <RotateCcw size={14} style={{ color: 'var(--accent-cyan)' }} />,
        BONUS: <Gift size={14} style={{ color: 'var(--accent-purple)' }} />,
        COUPON_CREDIT: <Ticket size={14} style={{ color: 'var(--accent-amber)' }} />,
        LOYALTY_EARN: <Star size={14} style={{ color: 'var(--accent-amber)' }} />,
        REVIEW_REWARD: <Star size={14} style={{ color: 'var(--accent-green)' }} />,
    };
    const isPositive = ['DEPOSIT', 'REFUND', 'BONUS', 'COUPON_CREDIT', 'LOYALTY_EARN', 'REVIEW_REWARD', 'REFERRAL_BONUS', 'TIER_UPGRADE_BONUS'].includes(tx.type);
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            {icon[tx.type] || <CreditCard size={14} style={{ color: 'var(--text-dim)' }} />}
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{tx.description || tx.type}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{new Date(tx.created_at).toLocaleString('ko')}{tx.order_id ? ` · ${tx.order_id}` : ''}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color: isPositive ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {isPositive ? '+' : '-'}₩{Math.abs(tx.amount).toLocaleString()}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>잔액 ₩{tx.balance_after?.toLocaleString()}</div>
            </div>
        </div>
    );
}

/* ━━━ Coupon Card ━━━ */
const CouponCard: React.FC<{ coupon: any; onApply: () => Promise<void>; applying: boolean }> = ({ coupon, onApply, applying }) => {
    const isExpired = coupon.valid_until && new Date(coupon.valid_until) < new Date();
    const disabled = isExpired || applying;
    return (
        <div className="glass-card" style={{ padding: 14, opacity: isExpired ? 0.5 : 1, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -10, top: -10, width: 60, height: 60, borderRadius: '50%', background: 'rgba(0,255,200,0.05)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: 'rgba(0,255,200,0.1)', color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>
                        {coupon.coupon_type}
                    </span>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>
                        {coupon.coupon_type === 'FIXED' ? `₩${Number(coupon.value).toLocaleString()}` : `${coupon.value}%`}
                    </div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-purple)', fontWeight: 700, background: 'rgba(168,85,247,0.1)', padding: '3px 8px', borderRadius: 4 }}>
                    {coupon.coupon_code}
                </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{coupon.description}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9, color: 'var(--text-dim)', marginBottom: 8 }}>
                <span>{coupon.min_order_amount > 0 ? `최소 ₩${Number(coupon.min_order_amount).toLocaleString()}` : '제한 없음'} · 사용 {coupon.usage_count}/{coupon.usage_limit}</span>
                <span>{coupon.valid_until ? `~${new Date(coupon.valid_until).toLocaleDateString('ko')}` : '무기한'}</span>
            </div>
            {!isExpired && (
                <button
                    onClick={onApply}
                    disabled={disabled}
                    style={{
                        width: '100%', padding: '6px 0', borderRadius: 6, border: 'none',
                        background: disabled ? 'var(--bg-surface)' : 'var(--accent-cyan)',
                        color: disabled ? 'var(--text-dim)' : '#000',
                        fontWeight: 700, fontSize: 11, cursor: disabled ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    }}
                >
                    {applying ? <Loader2 size={11} className="spin" /> : <Tag size={11} />}
                    {applying ? '적용 중...' : '쿠폰 적용'}
                </button>
            )}
        </div>
    );
}

/* ━━━ Main Component ━━━ */
export const AgentWallet: React.FC = () => {
    const [tab, setTab] = useState<Tab>('wallet');
    const [apiKey, setApiKey] = useState('');
    const [walletData, setWalletData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [depositAmt, setDepositAmt] = useState('');
    const [depositing, setDepositing] = useState(false);
    // 쿠폰 적용 상태
    const [applyingCouponId, setApplyingCouponId] = useState<string | null>(null);
    const [couponMsg, setCouponMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
    // 환불 상태
    const [refundOrderId, setRefundOrderId] = useState('');
    const [refundAmt, setRefundAmt] = useState('');
    const [refundReason, setRefundReason] = useState('');
    const [refunding, setRefunding] = useState(false);
    const { coupons, loading: couponsLoading } = useCoupons();
    const { invoices, loading: invoicesLoading } = useInvoices();

    const loadWallet = async () => {
        if (!apiKey) return;
        setLoading(true);
        try {
            const data = await getWalletInfo(apiKey);
            setWalletData(data);
        } catch { setWalletData(null); }
        setLoading(false);
    };

    const handleDeposit = async () => {
        const amt = parseInt(depositAmt);
        if (!amt || amt <= 0) return;
        setDepositing(true);
        try {
            await walletDeposit(apiKey, amt, '크레딧 충전');
            setDepositAmt('');
            await loadWallet();
        } catch (e) { alert('충전 실패'); }
        setDepositing(false);
    };

    const handleApplyCoupon = async (couponCode: string, couponId: string) => {
        if (!apiKey) { setCouponMsg({ type: 'err', text: 'API 키를 먼저 입력하세요' }); return; }
        setApplyingCouponId(couponId);
        setCouponMsg(null);
        try {
            // orderAmount 0 = 지갑 단독 쿠폰 적용 (주문 연계 없이)
            const res = await applyCoupon(apiKey, couponCode, 0);
            if (res?.success) {
                setCouponMsg({ type: 'ok', text: `쿠폰 적용 완료: ${couponCode}` });
                await loadWallet();
            } else {
                setCouponMsg({ type: 'err', text: res?.error || '쿠폰 적용 실패' });
            }
        } catch (e: any) {
            setCouponMsg({ type: 'err', text: e.message || '쿠폰 적용 실패' });
        }
        setApplyingCouponId(null);
    };

    const handleRefund = async () => {
        const amt = parseInt(refundAmt);
        if (!apiKey || !refundOrderId || !amt || amt <= 0) return;
        setRefunding(true);
        try {
            await walletRefund(apiKey, refundOrderId, amt);
            setRefundOrderId(''); setRefundAmt(''); setRefundReason('');
            await loadWallet();
            alert('환불이 처리되었습니다');
        } catch (e: any) { alert('환불 실패: ' + e.message); }
        setRefunding(false);
    };

    const tabBtn = (t: Tab, label: string, icon: React.ReactNode) => (
        <button key={t} onClick={() => setTab(t)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 16px', borderRadius: 8, border: 'none', background: tab === t ? 'var(--accent-cyan)' : 'var(--bg-surface)', color: tab === t ? '#000' : 'var(--text-muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s' }}>
            {icon} {label}
        </button>
    );

    const w = walletData?.wallet;
    const tier = walletData?.tier;
    const txs = walletData?.transactions || [];

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <Wallet size={24} style={{ color: 'var(--accent-green)' }} />
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Agent Wallet</h1>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>크레딧 지갑 · 쿠폰 · 인보이스 · 적립금</p>
                </div>
            </div>

            {/* API Key Input */}
            <div className="glass-card" style={{ padding: 14, marginBottom: 16, display: 'flex', gap: 8 }}>
                <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="에이전트 API 키 입력..."
                    style={{ flex: 1, border: 'none', background: 'var(--bg-surface)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }} />
                <button onClick={loadWallet} disabled={!apiKey || loading}
                    style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'var(--accent-cyan)', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    {loading ? <Loader2 size={14} className="spin" /> : '조회'}
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {tabBtn('wallet', '지갑', <Wallet size={13} />)}
                {tabBtn('coupons', '쿠폰', <Ticket size={13} />)}
                {tabBtn('invoices', '인보이스', <Receipt size={13} />)}
            </div>

            {/* ━━━ Wallet Tab ━━━ */}
            {tab === 'wallet' && (
                <>
                    {w ? (
                        <>
                            {/* KPI Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                                <div className="glass-card" style={{ padding: 14, textAlign: 'center', borderLeft: '3px solid var(--accent-green)' }}>
                                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>잔액</div>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>₩{Number(w.balance).toLocaleString()}</div>
                                </div>
                                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}>
                                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>누적 충전</div>
                                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>₩{Number(w.total_deposited).toLocaleString()}</div>
                                </div>
                                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}>
                                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>누적 사용</div>
                                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>₩{Number(w.total_spent).toLocaleString()}</div>
                                </div>
                                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}>
                                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>적립 포인트</div>
                                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>{Number(w.loyalty_points).toLocaleString()} P</div>
                                </div>
                            </div>

                            {/* Tier Badge */}
                            {tier && (
                                <div className="glass-card" style={{ padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <TrendingUp size={16} style={{ color: 'var(--accent-purple)' }} />
                                        <div>
                                            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-purple)' }}>{tier.name}</span>
                                            <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 8 }}>Tier</span>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                        API {tier.monthly_calls_used?.toLocaleString()} / {tier.calls_per_month?.toLocaleString()} calls
                                    </div>
                                </div>
                            )}

                            {/* Deposit */}
                            <div className="glass-card" style={{ padding: 14, marginBottom: 12 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>💰 크레딧 충전 (관리자 직접 지급)</div>
                                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>에이전트는 지갑 잔액으로 자동 구매 · Computer Use 에이전트는 주문 시 발급되는 payurl로 PG 결제 가능</div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {[10000, 50000, 100000, 500000].map(a => (
                                        <button key={a} onClick={() => setDepositAmt(String(a))}
                                            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: depositAmt === String(a) ? 'var(--accent-cyan)' : 'transparent', color: depositAmt === String(a) ? '#000' : 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                            ₩{a.toLocaleString()}
                                        </button>
                                    ))}
                                    <input value={depositAmt} onChange={e => setDepositAmt(e.target.value.replace(/\D/g, ''))} placeholder="직접 입력"
                                        style={{ flex: 1, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', minWidth: 80 }} />
                                    <button onClick={handleDeposit} disabled={!depositAmt || depositing}
                                        style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: 'var(--accent-green)', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                                        {depositing ? <Loader2 size={12} className="spin" /> : '충전'}
                                    </button>
                                </div>
                            </div>

                            {/* Refund */}
                            <div className="glass-card" style={{ padding: 14, marginBottom: 16, border: '1px solid rgba(239,68,68,0.2)' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-red)', marginBottom: 8 }}>↩️ 환불 처리</div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    <input value={refundOrderId} onChange={e => setRefundOrderId(e.target.value)} placeholder="주문 ID"
                                        style={{ flex: 2, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', minWidth: 120 }} />
                                    <input value={refundAmt} onChange={e => setRefundAmt(e.target.value.replace(/\D/g, ''))} placeholder="환불금액"
                                        style={{ flex: 1, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', minWidth: 80 }} />
                                    <input value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder="사유 (선택)"
                                        style={{ flex: 2, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 6, fontSize: 12, outline: 'none', minWidth: 100 }} />
                                    <button onClick={handleRefund} disabled={!refundOrderId || !refundAmt || refunding}
                                        style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: 'var(--accent-red)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                                        {refunding ? <Loader2 size={12} className="spin" /> : '환불'}
                                    </button>
                                </div>
                            </div>

                            {/* Transactions */}
                            <div className="glass-card" style={{ padding: 14 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>📋 거래 내역 (최근 50건)</div>
                                {txs.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)', fontSize: 11 }}>거래 내역이 없습니다</div>
                                ) : txs.map((tx: any, i: number) => <TxRow key={i} tx={tx} />)}
                            </div>
                        </>
                    ) : (
                        <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                            에이전트 API 키를 입력하고 조회를 클릭하세요
                        </div>
                    )}
                </>
            )}

            {/* ━━━ Coupons Tab ━━━ */}
            {tab === 'coupons' && (
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>🎫 사용 가능한 쿠폰</div>
                    {couponMsg && (
                        <div style={{
                            padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12,
                            background: couponMsg.type === 'ok' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                            color: couponMsg.type === 'ok' ? 'var(--accent-green)' : 'var(--accent-red)',
                            border: `1px solid ${couponMsg.type === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        }}>
                            {couponMsg.type === 'ok' ? '✅ ' : '❌ '}{couponMsg.text}
                        </div>
                    )}
                    {couponsLoading ? (
                        <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={24} className="spin" style={{ color: 'var(--accent-cyan)' }} /></div>
                    ) : coupons.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 12 }}>사용 가능한 쿠폰이 없습니다</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                            {coupons.map((c: any) => (
                                <CouponCard
                                    key={c.id}
                                    coupon={c}
                                    applying={applyingCouponId === c.id}
                                    onApply={() => handleApplyCoupon(c.coupon_code, c.id)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Agent-specific coupon perks info */}
                    <div className="glass-card" style={{ padding: 14, marginTop: 16, background: 'rgba(168,85,247,0.05)' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-purple)', marginBottom: 8 }}>🤖 에이전트 전용 혜택</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                            <div>✅ 첫 주문 자동 10% 할인 (WELCOME2026)</div>
                            <div>✅ 대량구매 20% 할인 (50만원 이상)</div>
                            <div>✅ 리뷰 작성 시 ₩500 크레딧 적립</div>
                            <div>✅ A2A 네트워크 활동 보너스 5%</div>
                            <div>✅ Pro/Enterprise 전용 쿠폰</div>
                            <div>✅ 시즌 프로모션 (봄 12% 할인)</div>
                            <div>✅ 구매금액 1,000원당 1포인트 적립</div>
                            <div>✅ 포인트 → 쿠폰 교환 (1000P = ₩1,000)</div>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ Invoices Tab ━━━ */}
            {tab === 'invoices' && (
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>🧾 인보이스 목록</div>
                    {invoicesLoading ? (
                        <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={24} className="spin" style={{ color: 'var(--accent-cyan)' }} /></div>
                    ) : invoices.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 12 }}>발행된 인보이스가 없습니다</div>
                    ) : (
                        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-surface)' }}>
                                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-dim)', fontSize: 10 }}>인보이스 ID</th>
                                        <th style={{ padding: '8px', textAlign: 'left', fontWeight: 700, color: 'var(--text-dim)', fontSize: 10 }}>주문</th>
                                        <th style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: 'var(--text-dim)', fontSize: 10 }}>소계</th>
                                        <th style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: 'var(--text-dim)', fontSize: 10 }}>할인</th>
                                        <th style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: 'var(--text-dim)', fontSize: 10 }}>합계</th>
                                        <th style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: 'var(--text-dim)', fontSize: 10 }}>상태</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-dim)', fontSize: 10 }}>발행일</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map((inv: any) => (
                                        <tr key={inv.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 600 }}>{inv.invoice_id}</td>
                                            <td style={{ padding: 8, color: 'var(--text-muted)' }}>{inv.order_id}</td>
                                            <td style={{ padding: 8, textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>₩{Number(inv.subtotal).toLocaleString()}</td>
                                            <td style={{ padding: 8, textAlign: 'right', fontFamily: 'var(--font-mono)', color: inv.discount > 0 ? 'var(--accent-red)' : 'var(--text-dim)' }}>-₩{Number(inv.discount || 0).toLocaleString()}</td>
                                            <td style={{ padding: 8, textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--text-primary)' }}>₩{Number(inv.total).toLocaleString()}</td>
                                            <td style={{ padding: 8, textAlign: 'center' }}>
                                                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: inv.status === 'PAID' ? 'rgba(34,197,94,0.12)' : 'rgba(251,191,36,0.12)', color: inv.status === 'PAID' ? 'var(--accent-green)' : 'var(--accent-amber)' }}>{inv.status}</span>
                                            </td>
                                            <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-dim)', fontSize: 10 }}>{new Date(inv.issued_at).toLocaleDateString('ko')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
