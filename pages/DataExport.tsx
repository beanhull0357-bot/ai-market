import React, { useState } from 'react';
import { Download, FileSpreadsheet, ShoppingCart, Bot, Package, Star, CheckCircle2, Tag, Handshake, Webhook } from 'lucide-react';
import { useOrders, useAgents, useProducts, useReviews, usePromotions, useNegotiations, useWebhooks } from '../hooks';

function toCsv(headers: string[], rows: string[][]): string {
    const bom = '\uFEFF';
    return bom + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
}

function downloadCsv(filename: string, csv: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

interface ExportOption { key: string; label: string; desc: string; icon: React.ReactNode; color: string; count: number; }

export const DataExport: React.FC = () => {
    const { orders } = useOrders();
    const { agents } = useAgents();
    const { products } = useProducts();
    const { reviews } = useReviews();
    const { promotions } = usePromotions();
    const { negotiations } = useNegotiations();
    const { webhooks } = useWebhooks();
    const [exported, setExported] = useState<string | null>(null);

    const doExport = (key: string) => {
        const ts = new Date().toISOString().slice(0, 10);
        let csv = '';
        if (key === 'orders') {
            csv = toCsv(
                ['주문번호', '에이전트ID', 'SKU', '수량', '총액', '상태', '생성일'],
                orders.map(o => [o.orderId, o.agentId, o.sku, String(o.quantity), String(o.totalPrice), o.status, o.createdAt])
            );
            downloadCsv(`jsonmart_orders_${ts}.csv`, csv);
        } else if (key === 'agents') {
            csv = toCsv(
                ['에이전트ID', '이름', '신뢰도', 'API키(마스킹)', '등록일'],
                agents.map(a => [a.agentId, a.name, String(a.trustScore || ''), a.apiKey ? `${a.apiKey.slice(0, 8)}...` : '', a.createdAt || ''])
            );
            downloadCsv(`jsonmart_agents_${ts}.csv`, csv);
        } else if (key === 'products') {
            csv = toCsv(
                ['SKU', '상품명', '가격', '재고', '카테고리', '신뢰도'],
                products.map(p => [p.sku, p.title, String(p.price), String(p.stock ?? ''), p.category || '', String(p.trustScore ?? '')])
            );
            downloadCsv(`jsonmart_products_${ts}.csv`, csv);
        } else if (key === 'reviews') {
            csv = toCsv(
                ['에이전트ID', 'SKU', '판결', '스펙일치도', '배송오차', '생성일'],
                reviews.map((r: any) => [r.agentId || '', r.sku || '', r.verdict || '', String(r.specMatch ?? ''), String(r.deliveryDelta ?? ''), r.createdAt || ''])
            );
            downloadCsv(`jsonmart_reviews_${ts}.csv`, csv);
        } else if (key === 'promotions') {
            csv = toCsv(
                ['프로모션ID', '이름', '유형', '할인값', '최소수량', '카테고리', '시작일', '종료일', '활성'],
                promotions.map((p: any) => [p.promo_id, p.name, p.type, String(p.value), String(p.min_qty), (p.categories || []).join(';'), p.valid_from, p.valid_to, p.active ? 'Y' : 'N'])
            );
            downloadCsv(`jsonmart_promotions_${ts}.csv`, csv);
        } else if (key === 'negotiations') {
            csv = toCsv(
                ['협상ID', 'SKU', '상품명', '리스트가', '최종가', '절감률(%)', '상태', '바이어에이전트', '셀러에이전트', '완료일'],
                negotiations.map((n: any) => [n.negotiation_id, n.sku, n.product_title, String(n.list_price), String(n.final_price ?? ''), String(n.savings_pct ?? ''), n.status, n.buyer_agent_id, n.seller_agent_id, n.completed_at?.slice(0, 10) || ''])
            );
            downloadCsv(`jsonmart_negotiations_${ts}.csv`, csv);
        } else if (key === 'webhooks') {
            csv = toCsv(
                ['웹훅ID', '에이전트ID', 'URL', '이벤트', '활성', '실패횟수', '마지막발송', '생성일'],
                webhooks.map((w: any) => [w.webhook_id, w.agent_id || '', w.url, (w.events || []).join(';'), w.active ? 'Y' : 'N', String(w.fail_count), w.last_triggered?.slice(0, 10) || '', w.created_at?.slice(0, 10) || ''])
            );
            downloadCsv(`jsonmart_webhooks_${ts}.csv`, csv);
        }
        setExported(key);
        setTimeout(() => setExported(null), 2000);
    };

    const options: ExportOption[] = [
        { key: 'orders', label: '주문 데이터', desc: '주문번호, 에이전트, SKU, 금액, 상태', icon: <ShoppingCart size={20} />, color: 'var(--accent-green)', count: orders.length },
        { key: 'agents', label: '에이전트 목록', desc: '에이전트ID, 이름, 신뢰도, API키(마스킹)', icon: <Bot size={20} />, color: 'var(--accent-cyan)', count: agents.length },
        { key: 'products', label: '상품 카탈로그', desc: 'SKU, 상품명, 가격, 재고, 카테고리', icon: <Package size={20} />, color: 'var(--accent-purple)', count: products.length },
        { key: 'reviews', label: '리뷰 데이터', desc: '에이전트, SKU, 판결, 스펙일치도', icon: <Star size={20} />, color: 'var(--accent-amber)', count: reviews.length },
        { key: 'promotions', label: '프로모션 목록', desc: '프로모션ID, 유형, 할인값, 유효기간', icon: <Tag size={20} />, color: 'var(--accent-green)', count: promotions.length },
        { key: 'negotiations', label: '협상 이력', desc: '협상ID, SKU, 최종가, 절감률, 상태', icon: <Handshake size={20} />, color: 'var(--accent-cyan)', count: negotiations.length },
        { key: 'webhooks', label: '웹훅 설정', desc: '웹훅ID, URL, 이벤트, 활성상태', icon: <Webhook size={20} />, color: 'var(--accent-purple)', count: webhooks.length },
    ];

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <Download size={24} style={{ color: 'var(--accent-green)' }} />
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Data Export</h1>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>운영 데이터를 CSV로 내보내기</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
                {options.map(opt => (
                    <div key={opt.key} className="glass-card" style={{ padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${opt.color} 12%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: opt.color }}>{opt.icon}</div>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{opt.label}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opt.desc}</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: opt.color }}>{opt.count}건</span>
                            <button onClick={() => doExport(opt.key)} disabled={opt.count === 0} style={{
                                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                                fontSize: 12, fontWeight: 600, borderRadius: 'var(--radius-md)',
                                border: 'none', cursor: opt.count > 0 ? 'pointer' : 'not-allowed',
                                background: exported === opt.key ? 'rgba(52,211,153,0.15)' : 'var(--bg-surface)',
                                color: exported === opt.key ? 'var(--accent-green)' : 'var(--text-primary)',
                                transition: 'all 200ms',
                            }}>
                                {exported === opt.key ? <><CheckCircle2 size={14} /> 완료!</> : <><FileSpreadsheet size={14} /> CSV 다운로드</>}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
