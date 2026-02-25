import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Store, Zap, Shield, Settings, MessageCircle, TrendingDown, Package, DollarSign, Users, Send, RotateCcw, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { useProducts } from '../hooks';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Seller Agent Storefront
    셀러 AI 에이전트가 구매 에이전트와 직접 대화하는 쇼룸
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

// ━━━ Seller Agent Profiles ━━━
interface SellerAgent {
    id: string;
    name: string;
    style: string;
    avatar: string;
    color: string;
    trustScore: number;
    config: {
        auto_negotiate: boolean;
        min_margin: number;
        bulk_discount_threshold: number;
        bulk_discount_rate: number;
        auto_confirm_under: number;
        response_style: 'friendly' | 'professional' | 'aggressive';
        specialties: string[];
    };
    stats: { deals: number; avg_discount: number; response_time: string };
}

const SELLER_AGENTS: SellerAgent[] = [
    {
        id: 'SA-ALPHA', name: '알파 트레이더', style: '전문적 · 정확한 견적', avatar: '🤖', color: '#06b6d4',
        trustScore: 92, config: { auto_negotiate: true, min_margin: 15, bulk_discount_threshold: 10, bulk_discount_rate: 5, auto_confirm_under: 100000, response_style: 'professional', specialties: ['CONSUMABLES', 'MRO'] },
        stats: { deals: 847, avg_discount: 8.3, response_time: '< 2s' },
    },
    {
        id: 'SA-OMEGA', name: '오메가 딜러', style: '적극적 · 빠른 체결', avatar: '⚡', color: '#a855f7',
        trustScore: 88, config: { auto_negotiate: true, min_margin: 10, bulk_discount_threshold: 5, bulk_discount_rate: 8, auto_confirm_under: 200000, response_style: 'aggressive', specialties: ['FOOD', 'HOUSEHOLD'] },
        stats: { deals: 1203, avg_discount: 12.1, response_time: '< 1s' },
    },
    {
        id: 'SA-SIGMA', name: '시그마 어드바이저', style: '친절 · 맞춤 추천', avatar: '🧠', color: '#22c55e',
        trustScore: 95, config: { auto_negotiate: true, min_margin: 20, bulk_discount_threshold: 20, bulk_discount_rate: 3, auto_confirm_under: 50000, response_style: 'friendly', specialties: ['OFFICE', 'DIGITAL'] },
        stats: { deals: 562, avg_discount: 5.7, response_time: '< 3s' },
    },
];

const BUYER_AGENTS = ['PROCURE-BOT-v2.1', 'SOURCING-AI-v1.0', 'AUTO-RESTOCK-v2', 'SMART-PURCHASE-v1', 'BULK-BUY-v3'];

// ━━━ Chat Engine ━━━
interface ChatMessage {
    id: string;
    sender: 'buyer' | 'seller' | 'system';
    text: string;
    timestamp: string;
    metadata?: any;
}

function seededRand(seed: string): number {
    let h = 0xdeadbeef;
    for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 0x9e3779b9); h ^= h >>> 16; }
    return (h >>> 0) / 0xffffffff;
}

function generateSellerResponse(seller: SellerAgent, product: any, buyerMessage: string, round: number): ChatMessage {
    const price = product?.offer?.price || product?.price || 10000;
    const cfg = seller.config;
    const seed = `${seller.id}-${product?.sku}-${round}`;

    // Determine response based on buyer message and seller config
    const lowerMsg = buyerMessage.toLowerCase();
    let text = '';
    let metadata: any = {};

    if (round === 0 || lowerMsg.includes('hello') || lowerMsg.includes('안녕') || lowerMsg.includes('상품')) {
        // Greeting + product intro
        const greeting = cfg.response_style === 'friendly' ? '안녕하세요! 반갑습니다 😊' :
            cfg.response_style === 'aggressive' ? `${seller.name}입니다. 바로 본론으로 가시죠.` :
                `${seller.name} 셀러 에이전트입니다. 무엇을 도와드릴까요?`;

        text = `${greeting}\n\n📦 **${product?.title || 'N/A'}**\n- 가격: ₩${price.toLocaleString()}\n- 재고: ${product?.stock_qty || product?.fulfillment?.stock_qty || 'available'}\n- 배송: ${product?.fulfillment?.eta_days || 3}일 이내\n\n궁금하신 점이 있으시면 말씀해주세요!`;
        metadata = { type: 'product_info', price };
    } else if (lowerMsg.includes('할인') || lowerMsg.includes('discount') || lowerMsg.includes('싸게') || lowerMsg.includes('가격')) {
        // Price negotiation
        const minPrice = price * (1 - cfg.min_margin / 100);
        const offerDiscount = cfg.response_style === 'aggressive' ? cfg.bulk_discount_rate + 2 :
            cfg.response_style === 'friendly' ? cfg.bulk_discount_rate :
                cfg.bulk_discount_rate - 1;
        const offerPrice = Math.round(price * (1 - offerDiscount / 100));

        if (offerPrice >= minPrice) {
            text = cfg.response_style === 'aggressive'
                ? `즉시 결정하시면 **${offerDiscount}% 할인** 가능합니다!\n\n💰 특별가: **₩${offerPrice.toLocaleString()}** (정가 ₩${price.toLocaleString()})\n\n${cfg.bulk_discount_threshold}개 이상 대량구매 시 추가 할인 협의 가능합니다.`
                : `할인 제안드립니다.\n\n📊 기본 할인: **${offerDiscount}%** → **₩${offerPrice.toLocaleString()}**\n📦 ${cfg.bulk_discount_threshold}개 이상 주문 시: 추가 ${cfg.bulk_discount_rate}% 할인\n\n이 조건이 괜찮으시면 주문 진행해드리겠습니다.`;
            metadata = { type: 'price_offer', original: price, offered: offerPrice, discount: offerDiscount };
        } else {
            text = `죄송합니다. 현재 가격이 이미 최적화되어 추가 할인이 어렵습니다.\n\n대신 ${cfg.bulk_discount_threshold}개 이상 대량 주문 시 **${cfg.bulk_discount_rate}% 할인**을 제공해드립니다.\n\n다른 도움이 필요하시면 말씀해주세요.`;
            metadata = { type: 'price_limit' };
        }
    } else if (lowerMsg.includes('대량') || lowerMsg.includes('bulk') || lowerMsg.includes('수량')) {
        // Bulk order
        const bulkPrice = Math.round(price * (1 - (cfg.bulk_discount_rate + 3) / 100));
        text = `대량 주문 특별 조건을 안내드립니다:\n\n| 수량 | 할인율 | 단가 |\n|------|--------|------|\n| ${cfg.bulk_discount_threshold}+ | ${cfg.bulk_discount_rate}% | ₩${Math.round(price * (1 - cfg.bulk_discount_rate / 100)).toLocaleString()} |\n| ${cfg.bulk_discount_threshold * 3}+ | ${cfg.bulk_discount_rate + 3}% | ₩${bulkPrice.toLocaleString()} |\n| ${cfg.bulk_discount_threshold * 5}+ | 협의 | 별도 견적 |\n\n자동 주문 확인 한도: ₩${cfg.auto_confirm_under.toLocaleString()} 이하`;
        metadata = { type: 'bulk_offer' };
    } else if (lowerMsg.includes('주문') || lowerMsg.includes('order') || lowerMsg.includes('구매')) {
        // Order intent
        const autoLimit = cfg.auto_confirm_under;
        text = price <= autoLimit
            ? `✅ 자동 주문 확인 범위 내입니다!\n\n주문 즉시 처리됩니다:\n- 결제 확인: 자동\n- 출고: ${product?.fulfillment?.ship_by_days || 1}일 이내\n- 배송: ${product?.fulfillment?.eta_days || 3}일 예상\n\n수량과 배송지를 알려주시면 바로 처리하겠습니다.`
            : `주문 요청 확인했습니다.\n\n금액이 자동확인 한도(₩${autoLimit.toLocaleString()})를 초과하여 셀러 승인이 필요합니다.\n평균 응답시간: ${seller.stats.response_time}\n\n진행하시겠습니까?`;
        metadata = { type: 'order_intent' };
    } else {
        // Default response
        const responses = [
            `이해했습니다. ${product?.title}에 대해 더 구체적으로 알려주시면 최적의 조건을 제안드리겠습니다.`,
            `네, 말씀하세요. 가격, 배송, 대량구매 등 어떤 내용이든 도와드리겠습니다.`,
            `감사합니다. 추가로 필요하신 정보가 있으시면 편하게 물어봐주세요. 할인 조건이나 대량 구매 혜택도 안내 가능합니다.`,
        ];
        text = responses[Math.floor(seededRand(seed) * responses.length)];
    }

    return {
        id: `msg-${Date.now()}-${round}`,
        sender: 'seller',
        text,
        timestamp: new Date().toISOString(),
        metadata,
    };
}

// ━━━ Main Component ━━━
export default function SellerAgentStorefront() {
    const { products } = useProducts();
    const [selectedAgent, setSelectedAgent] = useState<SellerAgent>(SELLER_AGENTS[0]);
    const [selectedBuyer, setSelectedBuyer] = useState(BUYER_AGENTS[0]);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const chatRef = React.useRef<HTMLDivElement>(null);

    // Auto-select first product when products load
    useEffect(() => {
        if (products.length > 0 && !selectedProduct) setSelectedProduct(products[0]);
    }, [products, selectedProduct]);

    // Scroll chat to bottom
    useEffect(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }, [messages]);

    const startChat = useCallback(() => {
        if (!selectedProduct) return;
        const welcome: ChatMessage = {
            id: `sys-${Date.now()}`,
            sender: 'system',
            text: `🤝 ${selectedBuyer} ↔ ${selectedAgent.name} 대화 시작\n상품: ${selectedProduct.title}`,
            timestamp: new Date().toISOString(),
        };
        setMessages([welcome]);

        // Seller auto-greets
        setTimeout(() => {
            const greeting = generateSellerResponse(selectedAgent, selectedProduct, 'hello', 0);
            setMessages(prev => [...prev, greeting]);
        }, 500);
    }, [selectedAgent, selectedBuyer, selectedProduct]);

    const sendMessage = useCallback(async () => {
        if (!inputText.trim() || !selectedProduct) return;
        const msg: ChatMessage = {
            id: `buyer-${Date.now()}`,
            sender: 'buyer',
            text: inputText,
            timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, msg]);
        setInputText('');
        setIsTyping(true);

        // Simulate seller agent thinking
        await new Promise(r => setTimeout(r, 800 + Math.random() * 400));

        const response = generateSellerResponse(selectedAgent, selectedProduct, inputText, messages.length);
        setMessages(prev => [...prev, response]);
        setIsTyping(false);
    }, [inputText, selectedAgent, selectedProduct, messages.length]);

    const quickActions = [
        { text: '상품 정보 알려주세요', icon: '📦' },
        { text: '할인 가능한가요?', icon: '💰' },
        { text: '대량 구매 조건은?', icon: '📊' },
        { text: '주문하고 싶습니다', icon: '🛒' },
    ];

    const cardStyle = { borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' };

    return (
        <div className="page-enter" style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(16px, 4vw, 32px)' }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(6,182,212,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Store size={22} style={{ color: 'var(--accent-purple)' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Seller Agent Storefront</h1>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>AI 셀러 에이전트와 직접 대화하며 최적의 거래 조건을 협상하세요</p>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
                {/* ━━━ Left: Agent Selection ━━━ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Seller Agents */}
                    <div style={{ ...cardStyle, padding: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Bot size={14} style={{ color: 'var(--accent-purple)' }} /> 셀러 에이전트
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {SELLER_AGENTS.map(agent => (
                                <div key={agent.id} onClick={() => { setSelectedAgent(agent); setMessages([]); }}
                                    style={{
                                        padding: 12, borderRadius: 8, cursor: 'pointer',
                                        background: selectedAgent.id === agent.id ? `rgba(${agent.color === '#06b6d4' ? '6,182,212' : agent.color === '#a855f7' ? '168,85,247' : '34,197,94'},0.08)` : 'transparent',
                                        border: selectedAgent.id === agent.id ? `1px solid ${agent.color}40` : '1px solid transparent',
                                        transition: 'all 150ms',
                                    }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontSize: 20 }}>{agent.avatar}</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{agent.name}</div>
                                            <div style={{ fontSize: 9, color: agent.color }}>{agent.style}</div>
                                        </div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
                                            {agent.trustScore}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, fontSize: 9, color: 'var(--text-muted)' }}>
                                        <span>🤝 {agent.stats.deals} deals</span>
                                        <span>📉 {agent.stats.avg_discount}% avg</span>
                                        <span>⚡ {agent.stats.response_time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Product Selection */}
                    <div style={{ ...cardStyle, padding: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Package size={14} style={{ color: 'var(--accent-cyan)' }} /> 상품 선택
                        </div>
                        <select value={selectedProduct?.sku || ''} onChange={e => { setSelectedProduct(products.find(p => p.sku === e.target.value)); setMessages([]); }}
                            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 11, outline: 'none' }}>
                            {products.map(p => (
                                <option key={p.sku} value={p.sku}>{p.title} (₩{(p.offer?.price || p.price || 0).toLocaleString()})</option>
                            ))}
                        </select>
                    </div>

                    {/* Agent Config */}
                    <div style={{ ...cardStyle, padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showConfig ? 12 : 0, cursor: 'pointer' }} onClick={() => setShowConfig(!showConfig)}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Settings size={14} style={{ color: 'var(--accent-yellow, #f59e0b)' }} /> 에이전트 설정
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', transform: showConfig ? 'rotate(180deg)' : '', transition: 'transform 200ms' }}>▼</span>
                        </div>
                        {showConfig && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
                                {[
                                    { label: '자동 협상', value: selectedAgent.config.auto_negotiate ? '✅ 활성' : '❌ 비활성', color: selectedAgent.config.auto_negotiate ? 'var(--accent-green)' : 'var(--accent-red)' },
                                    { label: '최소 마진', value: `${selectedAgent.config.min_margin}%`, color: 'var(--text-primary)' },
                                    { label: '대량할인 기준', value: `${selectedAgent.config.bulk_discount_threshold}개+`, color: 'var(--text-primary)' },
                                    { label: '대량할인율', value: `${selectedAgent.config.bulk_discount_rate}%`, color: 'var(--accent-purple)' },
                                    { label: '자동승인 한도', value: `₩${selectedAgent.config.auto_confirm_under.toLocaleString()}`, color: 'var(--accent-cyan)' },
                                    { label: '응답 스타일', value: selectedAgent.config.response_style === 'friendly' ? '😊 친절' : selectedAgent.config.response_style === 'aggressive' ? '⚡ 적극' : '📋 전문', color: 'var(--text-primary)' },
                                    { label: '전문 카테고리', value: selectedAgent.config.specialties.join(', '), color: 'var(--accent-yellow, #f59e0b)' },
                                ].map(item => (
                                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                                        <span style={{ fontWeight: 700, color: item.color, fontFamily: 'var(--font-mono)' }}>{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ━━━ Right: Chat Interface ━━━ */}
                <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', height: 620, overflow: 'hidden' }}>
                    {/* Chat Header */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${selectedAgent.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                                {selectedAgent.avatar}
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedAgent.name}</div>
                                <div style={{ fontSize: 9, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block' }} /> 온라인
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <select value={selectedBuyer} onChange={e => setSelectedBuyer(e.target.value)}
                                style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-muted)', fontSize: 10, outline: 'none' }}>
                                {BUYER_AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                            <button onClick={() => { startChat(); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--accent-cyan)', background: 'rgba(6,182,212,0.1)', color: 'var(--accent-cyan)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                                <RotateCcw size={10} /> 새 대화
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {messages.length === 0 ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-muted)' }}>
                                <Sparkles size={40} style={{ opacity: 0.15 }} />
                                <div style={{ fontSize: 14, fontWeight: 600 }}>AI 에이전트 대화 시작</div>
                                <div style={{ fontSize: 11, textAlign: 'center', maxWidth: 300, lineHeight: 1.5 }}>
                                    상품을 선택하고 '새 대화'를 눌러 구매 에이전트와 셀러 에이전트의 대화를 시작하세요
                                </div>
                                <button onClick={startChat} disabled={!selectedProduct}
                                    style={{ marginTop: 8, padding: '8px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                                    <MessageCircle size={12} style={{ marginRight: 6, verticalAlign: -2 }} /> 대화 시작
                                </button>
                            </div>
                        ) : (
                            messages.map(msg => (
                                <div key={msg.id} style={{
                                    display: 'flex',
                                    justifyContent: msg.sender === 'buyer' ? 'flex-end' : msg.sender === 'system' ? 'center' : 'flex-start',
                                }}>
                                    {msg.sender === 'system' ? (
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-primary)', padding: '4px 12px', borderRadius: 20 }}>
                                            {msg.text}
                                        </div>
                                    ) : (
                                        <div style={{ maxWidth: '75%', display: 'flex', gap: 8, flexDirection: msg.sender === 'buyer' ? 'row-reverse' : 'row' }}>
                                            <div style={{
                                                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                                                background: msg.sender === 'buyer' ? 'rgba(34,197,94,0.12)' : `${selectedAgent.color}20`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: msg.sender === 'buyer' ? 12 : 14,
                                            }}>
                                                {msg.sender === 'buyer' ? <Bot size={14} style={{ color: 'var(--accent-green)' }} /> : selectedAgent.avatar}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2, textAlign: msg.sender === 'buyer' ? 'right' : 'left' }}>
                                                    {msg.sender === 'buyer' ? selectedBuyer : selectedAgent.name}
                                                </div>
                                                <div style={{
                                                    padding: '10px 14px', borderRadius: 12,
                                                    background: msg.sender === 'buyer' ? 'rgba(34,197,94,0.08)' : `${selectedAgent.color}08`,
                                                    border: `1px solid ${msg.sender === 'buyer' ? 'rgba(34,197,94,0.15)' : `${selectedAgent.color}20`}`,
                                                    fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                                                }}>
                                                    {msg.text}
                                                </div>
                                                {msg.metadata?.type === 'price_offer' && (
                                                    <div style={{
                                                        marginTop: 6, padding: '6px 10px', borderRadius: 6,
                                                        background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)',
                                                        display: 'flex', alignItems: 'center', gap: 8, fontSize: 10,
                                                    }}>
                                                        <TrendingDown size={12} style={{ color: 'var(--accent-green)' }} />
                                                        <span style={{ color: 'var(--text-muted)' }}>할인가</span>
                                                        <span style={{ fontWeight: 700, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
                                                            ₩{msg.metadata.offered.toLocaleString()} ({msg.metadata.discount}% OFF)
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                        {isTyping && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 7, background: `${selectedAgent.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                                    {selectedAgent.avatar}
                                </div>
                                <div style={{ padding: '8px 14px', borderRadius: 12, background: `${selectedAgent.color}08`, border: `1px solid ${selectedAgent.color}20` }}>
                                    <span style={{ fontSize: 16, animation: 'pulse 1s infinite' }}>···</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quick Actions */}
                    {messages.length > 0 && messages.length <= 3 && (
                        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 6, overflowX: 'auto' }}>
                            {quickActions.map(qa => (
                                <button key={qa.text} onClick={() => { setInputText(qa.text); }}
                                    style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-muted)', fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {qa.icon} {qa.text}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8 }}>
                        <input value={inputText} onChange={e => setInputText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendMessage()}
                            placeholder={messages.length === 0 ? '먼저 \'새 대화\'를 시작하세요...' : `${selectedBuyer}로 메시지 입력...`}
                            disabled={messages.length === 0}
                            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
                        <button onClick={sendMessage} disabled={!inputText.trim() || messages.length === 0}
                            style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: inputText.trim() ? 'var(--accent-cyan)' : 'var(--border-subtle)', color: inputText.trim() ? '#000' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: inputText.trim() ? 'pointer' : 'default' }}>
                            <Send size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
