import React, { useState } from 'react';
import { Store, Shield, CheckCircle, XCircle, Clock, AlertTriangle, Ban, Search, RefreshCw, Loader2, ChevronDown, ChevronUp, TrendingUp, Package, ShoppingCart, Eye, Save, DollarSign } from 'lucide-react';
import { useSellers, updateSellerStatus, updateSellerCommission } from '../hooks';
import { Seller, SellerStatus } from '../types';

type FilterStatus = SellerStatus | 'ALL';

/* ━━━ Trust Bar ━━━ */
function TrustBar({ score }: { score: number }) {
    const color = score >= 80 ? 'var(--accent-green)' : score >= 50 ? 'var(--accent-amber)' : 'var(--accent-red)';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, height: 6, background: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: 'var(--font-mono)', minWidth: 24 }}>{score}</span>
        </div>
    );
}

/* ━━━ Status Badge ━━━ */
function StatusBadge({ status }: { status: SellerStatus }) {
    const map: Record<SellerStatus, { bg: string; color: string; icon: React.ReactNode; label: string }> = {
        PENDING: { bg: 'rgba(251,191,36,0.12)', color: 'var(--accent-amber)', icon: <Clock size={10} />, label: '대기' },
        ACTIVE: { bg: 'rgba(34,197,94,0.12)', color: 'var(--accent-green)', icon: <CheckCircle size={10} />, label: '활성' },
        SUSPENDED: { bg: 'rgba(239,68,68,0.12)', color: 'var(--accent-red)', icon: <AlertTriangle size={10} />, label: '정지' },
        BANNED: { bg: 'rgba(107,114,128,0.12)', color: 'var(--text-dim)', icon: <Ban size={10} />, label: '차단' },
    };
    const s = map[status];
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: s.bg, color: s.color }}>
            {s.icon} {s.label}
        </span>
    );
}

/* ━━━ Seller Card ━━━ */
const SellerCard: React.FC<{ seller: Seller; onStatusChange: () => void }> = ({ seller, onStatusChange }) => {
    const [expanded, setExpanded] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [commissionEdit, setCommissionEdit] = useState<number | null>(null);
    const [savingCommission, setSavingCommission] = useState(false);

    const handleStatus = async (newStatus: SellerStatus) => {
        setUpdating(true);
        try {
            await updateSellerStatus(seller.sellerId, newStatus);
            onStatusChange();
        } catch (e) { alert('상태 변경 실패'); }
        setUpdating(false);
    };

    return (
        <div className="glass-card" style={{ padding: 16, marginBottom: 10 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{seller.businessName}</span>
                        <StatusBadge status={seller.status} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                        {seller.representative} · {seller.email} {seller.businessNumber && `· ${seller.businessNumber}`}
                    </div>
                    <div style={{ width: 160 }}><TrustBar score={seller.trustScore} /></div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>상품</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{seller.totalProducts}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>매출</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>₩{seller.totalRevenue.toLocaleString()}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>반품률</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: seller.returnRate > 5 ? 'var(--accent-red)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{seller.returnRate}%</div>
                    </div>
                    <button onClick={() => setExpanded(!expanded)} style={{ padding: 6, borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>
            </div>

            {/* Expanded Detail */}
            {expanded && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, fontSize: 11, marginBottom: 12 }}>
                        <div><span style={{ color: 'var(--text-dim)' }}>셀러 ID:</span> <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{seller.sellerId}</span></div>
                        <div><span style={{ color: 'var(--text-dim)' }}>연락처:</span> <span style={{ color: 'var(--text-primary)' }}>{seller.phone || '-'}</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ color: 'var(--text-dim)' }}>수수료:</span>
                            <input type="number" value={commissionEdit ?? seller.commissionRate} onChange={e => setCommissionEdit(parseFloat(e.target.value) || 0)}
                                style={{ width: 50, padding: '2px 4px', borderRadius: 4, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 11, fontFamily: 'var(--font-mono)', textAlign: 'right' }} />
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>%</span>
                            {commissionEdit !== null && commissionEdit !== seller.commissionRate && (
                                <button onClick={async () => {
                                    setSavingCommission(true);
                                    try { await updateSellerCommission(seller.sellerId, commissionEdit); setCommissionEdit(null); onStatusChange(); } catch (e) { alert('수수료 변경 실패'); }
                                    setSavingCommission(false);
                                }} disabled={savingCommission}
                                    style={{ padding: '2px 6px', borderRadius: 4, border: 'none', background: 'var(--accent-green)', color: '#000', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>
                                    {savingCommission ? <Loader2 size={9} className="spin" /> : <Save size={9} />} 저장
                                </button>
                            )}
                        </div>
                        <div><span style={{ color: 'var(--text-dim)' }}>평균출고:</span> <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{seller.avgShipDays}일</span></div>
                        <div><span style={{ color: 'var(--text-dim)' }}>정산주기:</span> <span style={{ color: 'var(--text-primary)' }}>{seller.settlementCycle}</span></div>
                        <div><span style={{ color: 'var(--text-dim)' }}>가입일:</span> <span style={{ color: 'var(--text-primary)' }}>{new Date(seller.createdAt).toLocaleDateString('ko')}</span></div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 6 }}>
                        {seller.status === 'PENDING' && (
                            <button onClick={() => handleStatus('ACTIVE')} disabled={updating}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--accent-green)', color: '#000', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                                {updating ? <Loader2 size={12} className="spin" /> : <CheckCircle size={12} />} 승인
                            </button>
                        )}
                        {seller.status === 'ACTIVE' && (
                            <button onClick={() => handleStatus('SUSPENDED')} disabled={updating}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 6, border: '1px solid var(--accent-red)', background: 'rgba(239,68,68,0.08)', color: 'var(--accent-red)', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                                {updating ? <Loader2 size={12} className="spin" /> : <AlertTriangle size={12} />} 정지
                            </button>
                        )}
                        {seller.status === 'SUSPENDED' && (
                            <>
                                <button onClick={() => handleStatus('ACTIVE')} disabled={updating}
                                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--accent-green)', color: '#000', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                                    복구
                                </button>
                                <button onClick={() => handleStatus('BANNED')} disabled={updating}
                                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 6, border: '1px solid var(--text-dim)', background: 'rgba(107,114,128,0.08)', color: 'var(--text-dim)', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                                    <Ban size={12} /> 영구 차단
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ━━━ Main SellerRegistry Component ━━━ */
export const SellerRegistry: React.FC = () => {
    const { sellers, loading, refetch } = useSellers();
    const [filter, setFilter] = useState<FilterStatus>('ALL');
    const [search, setSearch] = useState('');

    const filtered = sellers
        .filter(s => filter === 'ALL' || s.status === filter)
        .filter(s => !search || s.businessName.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase()) || s.sellerId.toLowerCase().includes(search.toLowerCase()));

    const counts: Record<string, number> = { ALL: sellers.length, PENDING: 0, ACTIVE: 0, SUSPENDED: 0, BANNED: 0 };
    sellers.forEach(s => { counts[s.status] = (counts[s.status] || 0) + 1; });

    const filterBtn = (status: FilterStatus, label: string) => (
        <button key={status} onClick={() => setFilter(status)}
            style={{ padding: '6px 12px', borderRadius: 6, border: filter === status ? 'none' : '1px solid var(--border-subtle)', background: filter === status ? 'var(--accent-cyan)' : 'transparent', color: filter === status ? '#000' : 'var(--text-muted)', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>
            {label} <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.7 }}>({counts[status] || 0})</span>
        </button>
    );

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <Shield size={24} style={{ color: 'var(--accent-purple)' }} />
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Seller Registry</h1>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>셀러 가입 승인 및 관리</p>
                </div>
            </div>

            {/* KPI Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>전체</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{counts.ALL}</div>
                </div>
                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>승인 대기</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>{counts.PENDING}</div>
                </div>
                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>활성</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>{counts.ACTIVE}</div>
                </div>
                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>정지/차단</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>{(counts.SUSPENDED || 0) + (counts.BANNED || 0)}</div>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {filterBtn('ALL', '전체')}
                {filterBtn('PENDING', '대기')}
                {filterBtn('ACTIVE', '활성')}
                {filterBtn('SUSPENDED', '정지')}
                {filterBtn('BANNED', '차단')}
            </div>

            {/* Search */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                    <Search size={14} style={{ color: 'var(--text-dim)' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="상호명, 이메일, 셀러ID 검색..."
                        style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
                </div>
                <button onClick={refetch} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <RefreshCw size={14} />
                </button>
            </div>

            {/* Seller List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={24} className="spin" style={{ color: 'var(--accent-cyan)' }} /></div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 12 }}>등록된 셀러가 없습니다</div>
            ) : (
                filtered.map(s => <SellerCard key={s.sellerId} seller={s} onStatusChange={refetch} />)
            )}
        </div>
    );
};
