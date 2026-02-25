import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Package, ShoppingCart, Users, Zap, RefreshCw, BarChart3, DollarSign, Bot, ArrowUpCircle, ArrowDownCircle, Activity } from 'lucide-react';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Seller AI Dashboard — AI 자동 분석 대시보드
   셀러센터 탭에 추가되어 판매 현황, 재고 경고,
   구매 에이전트 분석, 가격 최적화 제안 등 AI 통찰 제공
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface SellerAIDashboardProps {
    apiKey: string;
    sellerInfo: any;
}

// ━━━ AI Analysis Engine (client-side) ━━━
function analyzeProducts(products: any[]) {
    const lowStock = products.filter(p => p.stock_qty > 0 && p.stock_qty <= 5);
    const outOfStock = products.filter(p => p.stock_qty <= 0 || p.stock_status === 'out_of_stock');
    const highStock = products.filter(p => p.stock_qty >= 100);

    // Price distribution
    const prices = products.map(p => p.price).filter(Boolean);
    const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
    const maxPrice = Math.max(...prices, 0);
    const minPrice = prices.length ? Math.min(...prices) : 0;

    // Category distribution
    const categories: Record<string, number> = {};
    products.forEach(p => { categories[p.category] = (categories[p.category] || 0) + 1; });

    return { lowStock, outOfStock, highStock, avgPrice, maxPrice, minPrice, categories, total: products.length };
}

function analyzeOrders(orders: any[]) {
    const now = Date.now();
    const today = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString());

    // Status breakdown
    const statusMap: Record<string, number> = {};
    orders.forEach(o => { statusMap[o.status] = (statusMap[o.status] || 0) + 1; });

    // Revenue
    const activeOrders = orders.filter(o => o.status !== 'VOIDED');
    const totalRevenue = activeOrders.reduce((s, o) => s + (o.total_price || 0), 0);

    // Agent analysis
    const agentMap: Record<string, { count: number; revenue: number; products: Set<string> }> = {};
    activeOrders.forEach(o => {
        const a = o.agent_id || 'unknown';
        if (!agentMap[a]) agentMap[a] = { count: 0, revenue: 0, products: new Set() };
        agentMap[a].count++;
        agentMap[a].revenue += o.total_price || 0;
        agentMap[a].products.add(o.sku || o.product_title);
    });

    const topAgents = Object.entries(agentMap)
        .map(([id, info]) => ({ id, ...info, products: info.products.size }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

    // Top products
    const prodMap: Record<string, { title: string; qty: number; revenue: number }> = {};
    activeOrders.forEach(o => {
        const k = o.sku || o.product_title;
        if (!prodMap[k]) prodMap[k] = { title: o.product_title || o.sku, qty: 0, revenue: 0 };
        prodMap[k].qty += o.quantity || 0;
        prodMap[k].revenue += o.total_price || 0;
    });
    const topProducts = Object.entries(prodMap)
        .map(([sku, info]) => ({ sku, ...info }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

    // Daily trend (last 7 days)
    const dailyRevenue: { date: string; revenue: number; orders: number }[] = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now - i * 86400000);
        const dateStr = d.toISOString().slice(0, 10);
        const dayOrders = activeOrders.filter(o => o.created_at?.startsWith(dateStr));
        dailyRevenue.push({
            date: `${d.getMonth() + 1}/${d.getDate()}`,
            revenue: dayOrders.reduce((s, o) => s + (o.total_price || 0), 0),
            orders: dayOrders.length,
        });
    }

    // Pending actions
    const pendingShip = orders.filter(o => o.status === 'PAYMENT_AUTHORIZED' || o.status === 'ORDER_CREATED');

    return { today, statusMap, totalRevenue, topAgents, topProducts, dailyRevenue, pendingShip, totalOrders: activeOrders.length };
}

function generateInsights(prodAnalysis: any, orderAnalysis: any) {
    const insights: { type: 'warning' | 'info' | 'success' | 'tip'; icon: string; title: string; detail: string }[] = [];

    // Inventory alerts
    if (prodAnalysis.outOfStock.length > 0) {
        insights.push({
            type: 'warning', icon: '🚨',
            title: `품절 상품 ${prodAnalysis.outOfStock.length}개`,
            detail: prodAnalysis.outOfStock.slice(0, 3).map((p: any) => p.title).join(', ') + (prodAnalysis.outOfStock.length > 3 ? ' 외' : ''),
        });
    }
    if (prodAnalysis.lowStock.length > 0) {
        insights.push({
            type: 'warning', icon: '⚠️',
            title: `재고 부족 경고 ${prodAnalysis.lowStock.length}개`,
            detail: prodAnalysis.lowStock.slice(0, 3).map((p: any) => `${p.title} (${p.stock_qty}개)`).join(', '),
        });
    }

    // Order alerts
    if (orderAnalysis.pendingShip.length > 0) {
        insights.push({
            type: 'info', icon: '📦',
            title: `발송 대기 주문 ${orderAnalysis.pendingShip.length}건`,
            detail: '빠른 발송 처리가 신뢰도 향상에 도움이 됩니다',
        });
    }

    // Success metrics
    if (orderAnalysis.today.length > 0) {
        insights.push({
            type: 'success', icon: '🎉',
            title: `오늘 주문 ${orderAnalysis.today.length}건`,
            detail: `오늘 매출 ₩${orderAnalysis.today.reduce((s: number, o: any) => s + (o.total_price || 0), 0).toLocaleString()}`,
        });
    }

    // Tips
    if (orderAnalysis.topAgents.length > 0) {
        const topAgent = orderAnalysis.topAgents[0];
        insights.push({
            type: 'tip', icon: '🤖',
            title: `VIP 에이전트: ${topAgent.id}`,
            detail: `${topAgent.count}건 주문, ₩${topAgent.revenue.toLocaleString()} — 맞춤 프로모션 고려`,
        });
    }

    if (prodAnalysis.highStock.length > 0 && orderAnalysis.totalOrders > 0) {
        insights.push({
            type: 'tip', icon: '💡',
            title: `과다 재고 ${prodAnalysis.highStock.length}개`,
            detail: '할인 프로모션으로 빠른 소진 고려',
        });
    }

    return insights;
}

// ━━━ Mini Bar Chart ━━━
function MiniBarChart({ data, height = 80 }: { data: { label: string; value: number }[]; height?: number }) {
    const maxVal = Math.max(...data.map(d => d.value), 1);
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height, padding: '0 4px' }}>
            {data.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                        width: '100%', minWidth: 12, maxWidth: 32,
                        height: Math.max(4, (d.value / maxVal) * (height - 20)),
                        background: `linear-gradient(180deg, var(--accent-cyan), rgba(6,182,212,0.3))`,
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease',
                    }} />
                    <span style={{ fontSize: 8, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{d.label}</span>
                </div>
            ))}
        </div>
    );
}

// ━━━ Main Component ━━━
export const SellerAIDashboard: React.FC<SellerAIDashboardProps> = ({ apiKey, sellerInfo }) => {
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [prodAnalysis, setProdAnalysis] = useState<any>(null);
    const [orderAnalysis, setOrderAnalysis] = useState<any>(null);
    const [insights, setInsights] = useState<any[]>([]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // Dynamic import to avoid circular deps
            const hooks = await import('../hooks');

            const [prodRes, orderRes] = await Promise.all([
                hooks.getSellerProducts(apiKey),
                hooks.getSellerOrders(apiKey),
            ]);

            const prods = prodRes?.products || [];
            const ords = orderRes?.orders || [];
            setProducts(prods);
            setOrders(ords);

            const pa = analyzeProducts(prods);
            const oa = analyzeOrders(ords);
            setProdAnalysis(pa);
            setOrderAnalysis(oa);
            setInsights(generateInsights(pa, oa));
        } catch (e) {
            console.error('AI Dashboard load error:', e);
        }
        setLoading(false);
    }, [apiKey]);

    useEffect(() => { loadData(); }, [loadData]);

    const cardStyle = {
        padding: 20, borderRadius: 12,
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
    };

    const insightColors: Record<string, { bg: string; border: string; text: string }> = {
        warning: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)', text: 'var(--accent-yellow, #f59e0b)' },
        info: { bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.3)', text: 'var(--accent-cyan)' },
        success: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.3)', text: 'var(--accent-green)' },
        tip: { bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.3)', text: 'var(--accent-purple)' },
    };

    if (loading) return (
        <div style={{ textAlign: 'center', padding: 60 }}>
            <RefreshCw size={24} className="spin" style={{ color: 'var(--accent-cyan)', marginBottom: 12 }} />
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>AI가 판매 데이터를 분석 중...</div>
        </div>
    );

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Bot size={20} style={{ color: 'var(--accent-purple)' }} />
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>AI 판매 분석</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>실시간 데이터 기반 자동 분석</div>
                    </div>
                </div>
                <button onClick={loadData}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
                    <RefreshCw size={12} /> 새로고침
                </button>
            </div>

            {/* ━━━ AI Insights ━━━ */}
            {insights.length > 0 && (
                <div style={{ ...cardStyle, marginBottom: 16, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Zap size={14} style={{ color: 'var(--accent-purple)' }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>🧠 AI 인사이트</span>
                    </div>
                    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {insights.map((insight, i) => {
                            const c = insightColors[insight.type] || insightColors.info;
                            return (
                                <div key={i} style={{
                                    padding: '10px 14px', borderRadius: 8,
                                    background: c.bg, border: `1px solid ${c.border}`,
                                    display: 'flex', alignItems: 'flex-start', gap: 10,
                                }}>
                                    <span style={{ fontSize: 16, flexShrink: 0 }}>{insight.icon}</span>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: c.text }}>{insight.title}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{insight.detail}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ━━━ KPI Cards ━━━ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(6,182,212,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <DollarSign size={20} style={{ color: 'var(--accent-cyan)' }} />
                    </div>
                    <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>총 매출 (30일)</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                            ₩{(orderAnalysis?.totalRevenue || 0).toLocaleString()}
                        </div>
                    </div>
                </div>
                <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(168,85,247,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ShoppingCart size={20} style={{ color: 'var(--accent-purple)' }} />
                    </div>
                    <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>총 주문</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                            {orderAnalysis?.totalOrders || 0}건
                        </div>
                    </div>
                </div>
                <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package size={20} style={{ color: 'var(--accent-green)' }} />
                    </div>
                    <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>등록 상품</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                            {prodAnalysis?.total || 0}개
                        </div>
                    </div>
                </div>
                <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={20} style={{ color: 'var(--accent-yellow, #f59e0b)' }} />
                    </div>
                    <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>구매 에이전트</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                            {orderAnalysis?.topAgents?.length || 0}개
                        </div>
                    </div>
                </div>
            </div>

            {/* ━━━ Charts Row ━━━ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {/* Daily Revenue */}
                <div style={cardStyle}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <BarChart3 size={14} style={{ color: 'var(--accent-cyan)' }} /> 일별 매출 (7일)
                    </div>
                    {orderAnalysis?.dailyRevenue?.length > 0 ? (
                        <div>
                            <MiniBarChart
                                data={orderAnalysis.dailyRevenue.map((d: any) => ({ label: d.date, value: d.revenue }))}
                                height={100}
                            />
                            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                                <span>최고: ₩{Math.max(...orderAnalysis.dailyRevenue.map((d: any) => d.revenue)).toLocaleString()}</span>
                                <span>평균: ₩{Math.round(orderAnalysis.dailyRevenue.reduce((s: number, d: any) => s + d.revenue, 0) / 7).toLocaleString()}</span>
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 12 }}>데이터 없음</div>
                    )}
                </div>

                {/* Order Status */}
                <div style={cardStyle}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Activity size={14} style={{ color: 'var(--accent-purple)' }} /> 주문 현황
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[
                            { key: 'ORDER_CREATED', label: '주문 접수', color: '#60a5fa', icon: '🆕' },
                            { key: 'PAYMENT_AUTHORIZED', label: '결제 완료', color: '#a78bfa', icon: '💳' },
                            { key: 'SHIPPED', label: '배송 중', color: '#34d399', icon: '🚚' },
                            { key: 'DELIVERED', label: '배송 완료', color: '#22c55e', icon: '✅' },
                            { key: 'VOIDED', label: '취소', color: '#ef4444', icon: '❌' },
                        ].map(s => {
                            const count = orderAnalysis?.statusMap?.[s.key] || 0;
                            const total = orders.length || 1;
                            return (
                                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 12, width: 20, textAlign: 'center' }}>{s.icon}</span>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 70 }}>{s.label}</span>
                                    <div style={{ flex: 1, height: 8, background: 'var(--bg-primary)', borderRadius: 4, overflow: 'hidden' }}>
                                        <div style={{ width: `${(count / total) * 100}%`, height: '100%', background: s.color, borderRadius: 4, transition: 'width 0.3s ease' }} />
                                    </div>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', width: 30, textAlign: 'right' }}>{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ━━━ Bottom Row: Top Products + Buyer Agents ━━━ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {/* Top Products */}
                <div style={cardStyle}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <TrendingUp size={14} style={{ color: 'var(--accent-green)' }} /> 인기 상품 TOP 5
                    </div>
                    {orderAnalysis?.topProducts?.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {orderAnalysis.topProducts.map((p: any, i: number) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                                    <span style={{ fontSize: 14, fontWeight: 900, color: i === 0 ? 'var(--accent-cyan)' : 'var(--text-muted)', width: 20, textAlign: 'center' }}>
                                        {i + 1}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{p.qty}개 판매</div>
                                    </div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
                                        ₩{p.revenue.toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 12 }}>아직 주문 데이터 없음</div>
                    )}
                </div>

                {/* Buyer Agents */}
                <div style={cardStyle}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Bot size={14} style={{ color: 'var(--accent-purple)' }} /> 구매 AI 에이전트
                    </div>
                    {orderAnalysis?.topAgents?.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {orderAnalysis.topAgents.map((a: any, i: number) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                                    <div style={{
                                        width: 28, height: 28, borderRadius: 6,
                                        background: `hsl(${(i * 60 + 200) % 360}, 60%, 20%)`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 12, fontWeight: 700, color: `hsl(${(i * 60 + 200) % 360}, 80%, 70%)`,
                                    }}>
                                        {a.id.slice(0, 2)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {a.id}
                                        </div>
                                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{a.count}건 · {a.products}종</div>
                                    </div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-purple)', fontFamily: 'var(--font-mono)' }}>
                                        ₩{a.revenue.toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 12 }}>아직 구매 에이전트 없음</div>
                    )}
                </div>
            </div>

            {/* ━━━ Inventory Health ━━━ */}
            <div style={cardStyle}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={14} style={{ color: 'var(--accent-yellow, #f59e0b)' }} /> 재고 현황 분석
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                    <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 900, color: '#ef4444', fontFamily: 'var(--font-mono)' }}>{prodAnalysis?.outOfStock?.length || 0}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>품절 상품</div>
                    </div>
                    <div style={{ padding: 12, borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 900, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>{prodAnalysis?.lowStock?.length || 0}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>재고 부족 (5개 이하)</div>
                    </div>
                    <div style={{ padding: 12, borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 900, color: '#22c55e', fontFamily: 'var(--font-mono)' }}>{(prodAnalysis?.total || 0) - (prodAnalysis?.outOfStock?.length || 0) - (prodAnalysis?.lowStock?.length || 0)}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>정상 재고</div>
                    </div>
                    <div style={{ padding: 12, borderRadius: 8, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 900, color: '#a78bfa', fontFamily: 'var(--font-mono)' }}>{prodAnalysis?.highStock?.length || 0}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>과다 재고 (100+)</div>
                    </div>
                </div>

                {/* Low stock items list */}
                {prodAnalysis?.lowStock?.length > 0 && (
                    <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-yellow, #f59e0b)', marginBottom: 8 }}>⚠️ 재고 부족 상품 — 보충 필요</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {prodAnalysis.lowStock.slice(0, 5).map((p: any, i: number) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{p.title}</span>
                                    <span style={{ fontWeight: 700, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>{p.stock_qty}개 남음</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ━━━ MCP Integration Guide ━━━ */}
            <div style={{ ...cardStyle, marginTop: 16, background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.2)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-purple)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Zap size={14} /> AI 에이전트 연동 가이드
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Claude Desktop에 Seller MCP 서버를 연결하면 대화만으로 위 모든 데이터를 관리할 수 있습니다.
                </div>
                <div style={{ marginTop: 8, padding: 12, borderRadius: 6, background: 'var(--bg-primary)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-primary)', overflow: 'auto', whiteSpace: 'pre' }}>
                    {`{
  "mcpServers": {
    "jsonmart-seller": {
      "url": "https://psiysvvcusfyfsfozywn.supabase.co/functions/v1/seller-mcp",
      "headers": { "x-seller-key": "${apiKey.slice(0, 8)}..." }
    }
  }
}`}
                </div>
            </div>
        </div>
    );
};
