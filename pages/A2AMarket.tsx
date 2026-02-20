import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Radio, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, Activity, Bot, Zap, Package, Clock, BarChart3, RefreshCw } from 'lucide-react';
import { useProducts } from '../hooks';
import { useLanguage } from '../context/LanguageContext';

// ━━━ A2A Market Simulation Engine ━━━

const AGENTS = [
    'PROCURE-BOT-v2.1', 'SOURCING-AI-v1.0', 'AUTO-RESTOCK-v2', 'BULK-BUY-v3',
    'SMART-PURCHASE-v1', 'SUPPLY-CHAIN-v3', 'PRINT-FLEET-X', 'OFFICE-MGR-AI-09',
    'VENDOR-AGENT-v2', 'WHOLESALE-BOT-v3', 'SUPPLIER-AI-v1.0', 'RESTOCK-PRO-v4',
];

interface OrderEntry {
    id: string;
    agentId: string;
    side: 'BID' | 'ASK';
    price: number;
    qty: number;
    timestamp: string;
}

interface Trade {
    id: string;
    buyerAgent: string;
    sellerAgent: string;
    price: number;
    qty: number;
    timestamp: string;
}

interface MarketState {
    sku: string;
    title: string;
    basePrice: number;
    bids: OrderEntry[];
    asks: OrderEntry[];
    trades: Trade[];
    lastPrice: number;
    high24h: number;
    low24h: number;
    volume24h: number;
    tradeCount24h: number;
}

function generateInitialMarket(sku: string, title: string, basePrice: number): MarketState {
    const spread = basePrice * 0.02;
    const bids: OrderEntry[] = [];
    const asks: OrderEntry[] = [];

    for (let i = 0; i < 8; i++) {
        const bidPrice = Math.round(basePrice - spread * (0.5 + i * 0.3) + (Math.random() - 0.5) * 100);
        const askPrice = Math.round(basePrice + spread * (0.5 + i * 0.3) + (Math.random() - 0.5) * 100);
        bids.push({
            id: `B-${Date.now()}-${i}`, agentId: AGENTS[Math.floor(Math.random() * AGENTS.length)],
            side: 'BID', price: bidPrice, qty: 1 + Math.floor(Math.random() * 15),
            timestamp: new Date(Date.now() - Math.random() * 600000).toISOString(),
        });
        asks.push({
            id: `A-${Date.now()}-${i}`, agentId: AGENTS[Math.floor(Math.random() * AGENTS.length)],
            side: 'ASK', price: askPrice, qty: 1 + Math.floor(Math.random() * 15),
            timestamp: new Date(Date.now() - Math.random() * 600000).toISOString(),
        });
    }
    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);

    const volume = 400 + Math.floor(Math.random() * 600);
    const tradeCount = 50 + Math.floor(Math.random() * 200);

    return {
        sku, title, basePrice, bids, asks, trades: [],
        lastPrice: basePrice, high24h: Math.round(basePrice * 1.04), low24h: Math.round(basePrice * 0.96),
        volume24h: volume, tradeCount24h: tradeCount,
    };
}

function simulateTick(market: MarketState): MarketState {
    const m = { ...market, bids: [...market.bids], asks: [...market.asks], trades: [...market.trades] };
    const action = Math.random();

    if (action < 0.35 && m.bids.length > 0 && m.asks.length > 0) {
        // Match trade
        const bestBid = m.bids[0];
        const bestAsk = m.asks[0];
        if (bestBid.price >= bestAsk.price) {
            const tradeQty = Math.min(bestBid.qty, bestAsk.qty);
            const tradePrice = Math.round((bestBid.price + bestAsk.price) / 2);
            const trade: Trade = {
                id: `T-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                buyerAgent: bestBid.agentId, sellerAgent: bestAsk.agentId,
                price: tradePrice, qty: tradeQty, timestamp: new Date().toISOString(),
            };
            m.trades = [trade, ...m.trades].slice(0, 50);
            m.lastPrice = tradePrice;
            m.high24h = Math.max(m.high24h, tradePrice);
            m.low24h = Math.min(m.low24h, tradePrice);
            m.volume24h += tradeQty;
            m.tradeCount24h += 1;

            if (bestBid.qty <= tradeQty) m.bids.shift(); else m.bids[0] = { ...bestBid, qty: bestBid.qty - tradeQty };
            if (bestAsk.qty <= tradeQty) m.asks.shift(); else m.asks[0] = { ...bestAsk, qty: bestAsk.qty - tradeQty };
        }
    } else if (action < 0.65) {
        // New bid
        const refPrice = m.bids.length > 0 ? m.bids[0].price : m.basePrice;
        const price = Math.round(refPrice * (0.97 + Math.random() * 0.04));
        m.bids.push({
            id: `B-${Date.now()}`, agentId: AGENTS[Math.floor(Math.random() * AGENTS.length)],
            side: 'BID', price, qty: 1 + Math.floor(Math.random() * 10), timestamp: new Date().toISOString(),
        });
        m.bids.sort((a, b) => b.price - a.price);
        if (m.bids.length > 12) m.bids.pop();
    } else {
        // New ask
        const refPrice = m.asks.length > 0 ? m.asks[0].price : m.basePrice;
        const price = Math.round(refPrice * (0.99 + Math.random() * 0.04));
        m.asks.push({
            id: `A-${Date.now()}`, agentId: AGENTS[Math.floor(Math.random() * AGENTS.length)],
            side: 'ASK', price, qty: 1 + Math.floor(Math.random() * 10), timestamp: new Date().toISOString(),
        });
        m.asks.sort((a, b) => a.price - b.price);
        if (m.asks.length > 12) m.asks.pop();
    }

    return m;
}

// ━━━ Sub-components ━━━

function OrderBookRow({ entry, side, maxQty }: { entry: OrderEntry; side: 'BID' | 'ASK'; maxQty: number }) {
    const pct = maxQty > 0 ? (entry.qty / maxQty) * 100 : 0;
    const isBid = side === 'BID';
    return (
        <div style={{
            display: 'grid', gridTemplateColumns: '90px 60px 1fr 90px', alignItems: 'center',
            padding: '4px 12px', fontSize: 11, fontFamily: 'var(--font-mono)',
            position: 'relative', overflow: 'hidden',
        }}>
            <div style={{
                position: 'absolute', [isBid ? 'right' : 'left']: 0, top: 0, bottom: 0,
                width: `${pct}%`, opacity: 0.06,
                background: isBid ? 'var(--accent-green)' : 'var(--accent-red)',
                transition: 'width 300ms',
            }} />
            <span style={{ color: isBid ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700, position: 'relative' }}>
                ₩{entry.price.toLocaleString()}
            </span>
            <span style={{ color: 'var(--text-secondary)', textAlign: 'right', position: 'relative' }}>{entry.qty}</span>
            <div style={{ position: 'relative', padding: '0 8px' }}>
                <div style={{
                    height: 3, borderRadius: 2,
                    background: isBid ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)',
                    width: `${pct}%`, transition: 'width 300ms',
                }} />
            </div>
            <span style={{ fontSize: 9, color: 'var(--text-dim)', textAlign: 'right', position: 'relative', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.agentId}
            </span>
        </div>
    );
}

function TradeRow({ trade }: { trade: Trade }) {
    const timeAgo = () => {
        const ms = Date.now() - new Date(trade.timestamp).getTime();
        if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
        return `${Math.floor(ms / 60000)}m ago`;
    };
    return (
        <div style={{
            display: 'grid', gridTemplateColumns: '80px 50px 1fr 60px',
            padding: '5px 12px', fontSize: 11, fontFamily: 'var(--font-mono)',
            borderBottom: '1px solid var(--border-subtle)',
            animation: 'fadeSlideIn 300ms var(--ease-out)',
        }}>
            <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>₩{trade.price.toLocaleString()}</span>
            <span style={{ color: 'var(--text-secondary)', textAlign: 'right' }}>x{trade.qty}</span>
            <span style={{ fontSize: 9, color: 'var(--text-dim)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px' }}>
                {trade.buyerAgent} ↔ {trade.sellerAgent}
            </span>
            <span style={{ fontSize: 9, color: 'var(--text-dim)', textAlign: 'right' }}>{timeAgo()}</span>
        </div>
    );
}

function PriceChart({ trades, basePrice }: { trades: Trade[]; basePrice: number }) {
    const recent = [...trades].reverse().slice(-30);
    if (recent.length < 2) return null;
    const prices = recent.map(t => t.price);
    const min = Math.min(...prices) * 0.998;
    const max = Math.max(...prices) * 1.002;
    const range = max - min || 1;
    const w = 280;
    const h = 60;

    const points = prices.map((p, i) => {
        const x = (i / (prices.length - 1)) * w;
        const y = h - ((p - min) / range) * h;
        return `${x},${y}`;
    }).join(' ');

    const lastPrice = prices[prices.length - 1];
    const firstPrice = prices[0];
    const isUp = lastPrice >= firstPrice;
    const color = isUp ? 'var(--accent-green)' : 'var(--accent-red)';

    return (
        <svg width={w} height={h} style={{ display: 'block' }}>
            <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={`0,${h} ${points} ${w},${h}`} fill="url(#chartGrad)" />
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
        </svg>
    );
}

// ━━━ Main Page ━━━

export function A2AMarket() {
    const { t } = useLanguage();
    const { products } = useProducts();
    const [markets, setMarkets] = useState<MarketState[]>([]);
    const [selectedSku, setSelectedSku] = useState<string | null>(null);
    const [isLive, setIsLive] = useState(true);
    const intervalRef = useRef<any>(null);

    // Init markets from products
    useEffect(() => {
        if (products.length > 0 && markets.length === 0) {
            const ms = products.map(p => generateInitialMarket(p.sku, p.title, p.offer.price));
            setMarkets(ms);
            setSelectedSku(ms[0]?.sku || null);
        }
    }, [products]);

    // Live simulation tick
    useEffect(() => {
        if (!isLive || markets.length === 0) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }
        intervalRef.current = setInterval(() => {
            setMarkets(prev => prev.map(m => simulateTick(m)));
        }, 800 + Math.floor(Math.random() * 400));
        return () => clearInterval(intervalRef.current);
    }, [isLive, markets.length]);

    const selected = markets.find(m => m.sku === selectedSku);
    const bidMaxQty = selected ? Math.max(...selected.bids.map(b => b.qty), 1) : 1;
    const askMaxQty = selected ? Math.max(...selected.asks.map(a => a.qty), 1) : 1;
    const spread = selected && selected.bids.length > 0 && selected.asks.length > 0
        ? selected.asks[0].price - selected.bids[0].price : 0;
    const spreadPct = selected && selected.basePrice > 0 ? ((spread / selected.basePrice) * 100).toFixed(2) : '0';

    const totalBidVol = selected ? selected.bids.reduce((a, b) => a + b.qty, 0) : 0;
    const totalAskVol = selected ? selected.asks.reduce((a, b) => a + b.qty, 0) : 0;
    const bidPct = totalBidVol + totalAskVol > 0 ? (totalBidVol / (totalBidVol + totalAskVol)) * 100 : 50;

    return (
        <div className="page-enter" style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(16px, 4vw, 32px)' }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 'var(--radius-md)',
                            background: 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(52,211,153,0.15))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Radio size={20} style={{ color: 'var(--accent-cyan)' }} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>A2A Live Market</h1>
                            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>에이전트 간 실시간 P2P 재고 교환 마켓</p>
                        </div>
                    </div>
                    <button onClick={() => setIsLive(!isLive)} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                        borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                        background: isLive ? 'rgba(52,211,153,0.08)' : 'var(--bg-card)',
                        color: isLive ? 'var(--accent-green)' : 'var(--text-muted)',
                        fontWeight: 700, fontSize: 11, cursor: 'pointer',
                    }}>
                        <div style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: isLive ? 'var(--accent-green)' : 'var(--text-dim)',
                            boxShadow: isLive ? '0 0 8px var(--accent-green)' : 'none',
                            animation: isLive ? 'livePulse 2s infinite' : 'none',
                        }} />
                        {isLive ? 'LIVE' : 'PAUSED'}
                    </button>
                </div>
            </div>

            {/* Product Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {markets.map(m => {
                    const changeFromBase = ((m.lastPrice - m.basePrice) / m.basePrice * 100);
                    const isUp = changeFromBase >= 0;
                    return (
                        <button key={m.sku} onClick={() => setSelectedSku(m.sku)} style={{
                            padding: '10px 16px', borderRadius: 'var(--radius-md)',
                            border: `1px solid ${selectedSku === m.sku ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                            background: selectedSku === m.sku ? 'rgba(34,211,238,0.05)' : 'var(--bg-card)',
                            cursor: 'pointer', transition: 'all 200ms',
                        }}>
                            <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginBottom: 2 }}>{m.sku}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 14, fontWeight: 900, fontFamily: 'var(--font-mono)', color: isUp ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                    ₩{m.lastPrice.toLocaleString()}
                                </span>
                                <span style={{ fontSize: 9, fontWeight: 700, color: isUp ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                    {isUp ? '▲' : '▼'} {Math.abs(changeFromBase).toFixed(1)}%
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {selected && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }} className="grid-responsive-bento">
                    {/* Main Panel: Order Book */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* KPI Bar */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }} className="grid-responsive-4">
                            {[
                                { label: 'Last Price', value: `₩${selected.lastPrice.toLocaleString()}`, color: selected.lastPrice >= selected.basePrice ? 'var(--accent-green)' : 'var(--accent-red)' },
                                { label: 'Spread', value: `₩${spread.toLocaleString()} (${spreadPct}%)`, color: 'var(--accent-amber)' },
                                { label: '24h High', value: `₩${selected.high24h.toLocaleString()}`, color: 'var(--accent-green)' },
                                { label: '24h Low', value: `₩${selected.low24h.toLocaleString()}`, color: 'var(--accent-red)' },
                                { label: '24h Volume', value: `${selected.tradeCount24h} trades`, color: 'var(--accent-cyan)' },
                            ].map(c => (
                                <div key={c.label} style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
                                    <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: 0.5, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 3 }}>{c.label}</div>
                                    <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color: c.color }}>{c.value}</div>
                                </div>
                            ))}
                        </div>

                        {/* Chart */}
                        {selected.trades.length >= 2 && (
                            <div style={{ padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
                                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.5, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Activity size={10} /> Price Chart (recent trades)
                                </div>
                                <PriceChart trades={selected.trades} basePrice={selected.basePrice} />
                            </div>
                        )}

                        {/* Order Book */}
                        <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', overflow: 'hidden' }}>
                            {/* Header */}
                            <div style={{ display: 'grid', gridTemplateColumns: '90px 60px 1fr 90px', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                                {['Price', 'Qty', 'Depth', 'Agent'].map(h => (
                                    <span key={h} style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text-dim)', textTransform: 'uppercase', textAlign: h === 'Qty' || h === 'Agent' ? 'right' : 'left' }}>{h}</span>
                                ))}
                            </div>

                            {/* ASK side (reversed — lowest at bottom) */}
                            <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1, color: 'var(--accent-red)', padding: '4px 12px', background: 'rgba(239,68,68,0.03)', textTransform: 'uppercase' }}>
                                    ASK (Sell Orders)
                                </div>
                                {[...selected.asks].reverse().slice(0, 8).map(a => (
                                    <OrderBookRow key={a.id} entry={a} side="ASK" maxQty={askMaxQty} />
                                ))}
                            </div>

                            {/* Spread indicator */}
                            <div style={{
                                padding: '8px 12px', textAlign: 'center', fontSize: 12, fontWeight: 900,
                                fontFamily: 'var(--font-mono)',
                                color: selected.lastPrice >= selected.basePrice ? 'var(--accent-green)' : 'var(--accent-red)',
                                background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)',
                            }}>
                                ₩{selected.lastPrice.toLocaleString()}
                                <span style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 500, marginLeft: 8 }}>spread: ₩{spread.toLocaleString()}</span>
                            </div>

                            {/* BID side */}
                            <div>
                                <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1, color: 'var(--accent-green)', padding: '4px 12px', background: 'rgba(52,211,153,0.03)', textTransform: 'uppercase' }}>
                                    BID (Buy Orders)
                                </div>
                                {selected.bids.slice(0, 8).map(b => (
                                    <OrderBookRow key={b.id} entry={b} side="BID" maxQty={bidMaxQty} />
                                ))}
                            </div>
                        </div>

                        {/* Buy/Sell Pressure */}
                        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
                            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.5, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>
                                Buy / Sell Pressure
                            </div>
                            <div style={{ height: 8, borderRadius: 4, background: 'var(--border-subtle)', overflow: 'hidden', display: 'flex' }}>
                                <div style={{ height: '100%', width: `${bidPct}%`, background: 'var(--accent-green)', transition: 'width 500ms' }} />
                                <div style={{ height: '100%', flex: 1, background: 'var(--accent-red)', transition: 'width 500ms' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, fontFamily: 'var(--font-mono)' }}>
                                <span style={{ color: 'var(--accent-green)' }}>BID {totalBidVol} ({bidPct.toFixed(0)}%)</span>
                                <span style={{ color: 'var(--accent-red)' }}>ASK {totalAskVol} ({(100 - bidPct).toFixed(0)}%)</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Recent Trades */}
                    <div style={{
                        borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-card)', maxHeight: 700, display: 'flex', flexDirection: 'column',
                    }}>
                        <div style={{
                            padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Zap size={12} style={{ color: 'var(--accent-cyan)' }} />
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Recent Trades</span>
                            </div>
                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{selected.trades.length} total</span>
                        </div>

                        {/* Trade Header */}
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 50px 1fr 60px', padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                            {['Price', 'Qty', 'Agents', 'Time'].map(h => (
                                <span key={h} style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text-dim)', textTransform: 'uppercase', textAlign: h === 'Qty' || h === 'Time' ? 'right' : h === 'Agents' ? 'center' : 'left' }}>{h}</span>
                            ))}
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {selected.trades.length === 0 ? (
                                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)', fontSize: 11 }}>
                                    Waiting for trades...
                                </div>
                            ) : selected.trades.map(tr => (
                                <TradeRow key={tr.id} trade={tr} />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes livePulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
                @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}
