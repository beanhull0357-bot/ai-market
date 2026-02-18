import React, { useState, useEffect, useCallback } from 'react';
import { Bell, X, MessageSquare, ShoppingCart, Bot, AlertTriangle, CheckCircle2, Clock, Package, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

/* ━━━ Types ━━━ */
export interface Notification {
    id: string;
    type: 'order' | 'qa' | 'agent' | 'warning' | 'info';
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
    link?: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
    order: { icon: <ShoppingCart size={14} />, color: 'var(--accent-green)' },
    qa: { icon: <MessageSquare size={14} />, color: 'var(--accent-cyan)' },
    agent: { icon: <Bot size={14} />, color: 'var(--accent-purple)' },
    warning: { icon: <AlertTriangle size={14} />, color: 'var(--accent-amber)' },
    info: { icon: <CheckCircle2 size={14} />, color: 'var(--text-muted)' },
};

function timeSince(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
}

/* ━━━ Hook: useNotifications ━━━ */
export function useNotifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    const generateNotifications = useCallback(async () => {
        setLoading(true);
        const notifs: Notification[] = [];
        const now = new Date();

        // Check pending orders
        try {
            const { data: orders } = await supabase
                .from('orders')
                .select('order_id, created_at, authorized_amount')
                .eq('status', 'ORDER_CREATED')
                .order('created_at', { ascending: false })
                .limit(5);

            if (orders && orders.length > 0) {
                orders.forEach((o: any) => {
                    const created = new Date(o.created_at);
                    const hoursLeft = 24 - (now.getTime() - created.getTime()) / 3600000;
                    notifs.push({
                        id: `order-${o.order_id}`,
                        type: hoursLeft < 4 ? 'warning' : 'order',
                        title: hoursLeft < 4 ? '⚠️ 주문 만료 임박' : '📦 신규 주문 대기',
                        message: `${o.order_id} - ₩${(o.authorized_amount || 0).toLocaleString()} (${hoursLeft < 0 ? '만료됨' : Math.floor(hoursLeft) + '시간 남음'})`,
                        read: false,
                        createdAt: o.created_at,
                        link: '/admin-queue',
                    });
                });
            }
        } catch { /* table may not exist yet */ }

        // Check pending Q&A
        try {
            const { data: questions, count } = await supabase
                .from('agent_questions')
                .select('ticket_id, question, created_at', { count: 'exact' })
                .eq('status', 'PENDING')
                .order('created_at', { ascending: false })
                .limit(3);

            if (count && count > 0) {
                notifs.push({
                    id: 'qa-pending',
                    type: 'qa',
                    title: `💬 미답변 질문 ${count}건`,
                    message: questions?.[0]?.question?.slice(0, 60) + '...' || '',
                    read: false,
                    createdAt: questions?.[0]?.created_at || now.toISOString(),
                    link: '/agent-qa',
                });
            }
        } catch { /* table may not exist yet */ }

        // Check pending agent registrations
        try {
            const { data: pendingAgents, count: agentCount } = await supabase
                .from('agents')
                .select('name, created_at', { count: 'exact' })
                .eq('status', 'PENDING_APPROVAL')
                .order('created_at', { ascending: false })
                .limit(3);

            if (agentCount && agentCount > 0) {
                notifs.push({
                    id: 'agent-pending',
                    type: 'agent',
                    title: `🤖 에이전트 등록 대기 ${agentCount}건`,
                    message: pendingAgents?.[0]?.name || '',
                    read: false,
                    createdAt: pendingAgents?.[0]?.created_at || now.toISOString(),
                    link: '/admin-queue',
                });
            }
        } catch { /* table may not exist yet */ }

        setNotifications(notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setLoading(false);
    }, []);

    useEffect(() => {
        generateNotifications();
        const interval = setInterval(generateNotifications, 30000);
        return () => clearInterval(interval);
    }, [generateNotifications]);

    const markRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return { notifications, loading, unreadCount, markRead, markAllRead, refresh: generateNotifications };
}

/* ━━━ Notification Bell Component ━━━ */
export const NotificationBell: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
    const [open, setOpen] = useState(false);
    const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(!open)}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 6, border: 'none', background: 'transparent',
                    color: unreadCount > 0 ? 'var(--accent-amber)' : 'var(--text-muted)',
                    cursor: 'pointer', position: 'relative',
                }}
            >
                <Bell size={16} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute', top: 0, right: 0,
                        width: 14, height: 14, borderRadius: '50%',
                        background: 'var(--accent-red)', color: '#fff',
                        fontSize: 8, fontWeight: 900, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                    }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <>
                    <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                    <div style={{
                        position: 'absolute', top: '100%', right: 0, marginTop: 8,
                        width: 320, maxHeight: 400, overflowY: 'auto',
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                        zIndex: 100,
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)',
                        }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>알림</span>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllRead}
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        fontSize: 11, color: 'var(--accent-cyan)', fontWeight: 600,
                                    }}
                                >
                                    모두 읽음
                                </button>
                            )}
                        </div>

                        {notifications.length === 0 ? (
                            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                                알림이 없습니다
                            </div>
                        ) : (
                            notifications.map(n => {
                                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
                                return (
                                    <div
                                        key={n.id}
                                        onClick={() => {
                                            markRead(n.id);
                                            if (n.link) { navigate(n.link); setOpen(false); }
                                        }}
                                        style={{
                                            display: 'flex', gap: 10, padding: '10px 14px',
                                            borderBottom: '1px solid var(--border-subtle)',
                                            background: n.read ? 'transparent' : 'rgba(34,211,238,0.03)',
                                            cursor: n.link ? 'pointer' : 'default',
                                            transition: 'background 0.15s',
                                        }}
                                    >
                                        <div style={{ color: cfg.color, flexShrink: 0, marginTop: 2 }}>{cfg.icon}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{n.title}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</div>
                                            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>{timeSince(n.createdAt)}</div>
                                        </div>
                                        {!n.read && (
                                            <div style={{
                                                width: 6, height: 6, borderRadius: '50%',
                                                background: 'var(--accent-cyan)', flexShrink: 0, marginTop: 6,
                                            }} />
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
