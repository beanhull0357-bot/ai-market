import React, { useState, useEffect } from 'react';
import { Bell, Send, Users, User, Package, TrendingDown, Gift, AlertTriangle, Megaphone, Wrench, Loader, CheckCircle, Clock, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

const NTYPES = [
    { value: 'NEW_PRODUCT', label: '🆕 신상품', icon: <Package size={14} />, color: '#60a5fa' },
    { value: 'PRICE_DROP', label: '💰 가격인하', icon: <TrendingDown size={14} />, color: '#22c55e' },
    { value: 'PROMOTION', label: '🎁 프로모션', icon: <Gift size={14} />, color: '#eab308' },
    { value: 'RESTOCK', label: '📦 재입고', icon: <Package size={14} />, color: '#a855f7' },
    { value: 'ANNOUNCEMENT', label: '📢 공지', icon: <Megaphone size={14} />, color: '#3b82f6' },
    { value: 'MAINTENANCE', label: '🔧 점검', icon: <Wrench size={14} />, color: '#ef4444' },
    { value: 'SYSTEM', label: '⚙️ 시스템', icon: <AlertTriangle size={14} />, color: '#94a3b8' },
];

export const AdminNotifications: React.FC = () => {
    const [ntype, setNtype] = useState('ANNOUNCEMENT');
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [targetAgent, setTargetAgent] = useState('');
    const [expiresIn, setExpiresIn] = useState('');
    const [dataJson, setDataJson] = useState('');
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    // Load recent notifications
    useEffect(() => {
        (async () => {
            const { data } = await supabase.from('agent_notifications')
                .select('*').order('created_at', { ascending: false }).limit(20);
            setHistory(data || []);
            setLoadingHistory(false);
        })();
    }, [result]);

    const handleSend = async () => {
        if (!title.trim() || !message.trim()) return;
        setSending(true);
        setResult(null);

        let parsedData = {};
        if (dataJson.trim()) {
            try { parsedData = JSON.parse(dataJson); }
            catch { setResult({ error: 'JSON 데이터 형식 오류' }); setSending(false); return; }
        }

        let expiresAt = null;
        if (expiresIn) {
            const hours = parseInt(expiresIn);
            if (!isNaN(hours)) expiresAt = new Date(Date.now() + hours * 3600000).toISOString();
        }

        const { data, error } = await supabase.rpc('admin_send_notification', {
            p_ntype: ntype,
            p_title: title.trim(),
            p_message: message.trim(),
            p_data: parsedData,
            p_agent_id: targetAgent.trim() || null,
            p_expires_at: expiresAt,
        });

        if (error) { setResult({ error: error.message }); }
        else { setResult(data); setTitle(''); setMessage(''); setDataJson(''); }
        setSending(false);
    };

    const inputStyle = {
        width: '100%', padding: '10px 14px', borderRadius: 8,
        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
        color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const,
    };

    const labelStyle = {
        fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 as const,
        textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6, display: 'block',
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: 24 }}>
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: 'linear-gradient(135deg, rgba(234,179,8,0.2), rgba(239,68,68,0.2))',
                        border: '1px solid rgba(234,179,8,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Bell size={22} style={{ color: '#eab308' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>에이전트 알림 발송</h1>
                        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>등록된 에이전트들에게 공지·신상품·프로모션 알림을 보냅니다</p>
                    </div>
                </div>

                {/* Send Form */}
                <div style={{
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14, padding: 24, marginBottom: 24,
                }}>
                    {/* Type */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>알림 유형</label>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {NTYPES.map(t => (
                                <button key={t.value} onClick={() => setNtype(t.value)} style={{
                                    padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: 'none',
                                    background: ntype === t.value ? `${t.color}20` : 'rgba(255,255,255,0.05)',
                                    color: ntype === t.value ? t.color : 'var(--text-tertiary)',
                                    fontWeight: ntype === t.value ? 600 : 400,
                                    display: 'flex', alignItems: 'center', gap: 4,
                                }}>
                                    {t.icon} {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Target */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>
                            <Users size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                            대상 (비워두면 전체 에이전트)
                        </label>
                        <input type="text" placeholder="특정 에이전트 ID (예: AGT-xxxx)" value={targetAgent}
                            onChange={e => setTargetAgent(e.target.value)} style={inputStyle} />
                    </div>

                    {/* Title */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>제목 *</label>
                        <input type="text" placeholder="예: 🆕 신상품 입고! USB-C 허브 할인" value={title}
                            onChange={e => setTitle(e.target.value)} style={inputStyle} />
                    </div>

                    {/* Message */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>내용 *</label>
                        <textarea placeholder="알림 메시지 내용..." value={message}
                            onChange={e => setMessage(e.target.value)} rows={3}
                            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                    </div>

                    {/* Data JSON */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>첨부 데이터 (JSON, 선택)</label>
                        <textarea placeholder='{"sku": "PROD-001", "discount_pct": 20}' value={dataJson}
                            onChange={e => setDataJson(e.target.value)} rows={2}
                            style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} />
                    </div>

                    {/* Expires */}
                    <div style={{ marginBottom: 20 }}>
                        <label style={labelStyle}>유효기간 (시간, 선택)</label>
                        <input type="number" placeholder="예: 72 (3일)" value={expiresIn}
                            onChange={e => setExpiresIn(e.target.value)} style={{ ...inputStyle, maxWidth: 200 }} />
                    </div>

                    {/* Send Button */}
                    <button onClick={handleSend} disabled={sending || !title.trim() || !message.trim()} style={{
                        width: '100%', padding: '12px 0', borderRadius: 10,
                        background: title.trim() && message.trim() ? 'linear-gradient(135deg, #eab308, #ef4444)' : 'rgba(255,255,255,0.05)',
                        border: 'none', color: title.trim() && message.trim() ? 'white' : 'var(--text-tertiary)',
                        fontSize: 14, fontWeight: 600, cursor: title.trim() && message.trim() ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                        {sending ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
                        {sending ? '발송 중...' : '알림 발송'}
                    </button>

                    {/* Result */}
                    {result && (
                        <div style={{
                            marginTop: 12, padding: '10px 14px', borderRadius: 8,
                            background: result.error ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                            border: `1px solid ${result.error ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
                            fontSize: 12, color: result.error ? '#ef4444' : '#22c55e',
                        }}>
                            {result.error ? `오류: ${result.error}` : (
                                <>
                                    <CheckCircle size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                                    발송 완료! (ID: {result.notification_id}, 대상: {result.target}, 웹훅 Push: {result.webhook_push_count}건)
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* History */}
                <div style={{
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14, padding: 24,
                }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                        발송 내역
                    </h3>
                    {loadingHistory ? (
                        <div style={{ textAlign: 'center', padding: 20 }}><Loader size={16} className="animate-spin" /></div>
                    ) : history.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                            아직 발송된 알림이 없습니다
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {history.map((n: any) => {
                                const t = NTYPES.find(t => t.value === n.ntype);
                                return (
                                    <div key={n.id} style={{
                                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                                        borderRadius: 8,
                                    }}>
                                        <span style={{
                                            fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                                            background: `${t?.color || '#94a3b8'}20`, color: t?.color || '#94a3b8',
                                        }}>{n.ntype}</span>
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                                {n.agent_id ? `→ ${n.agent_id}` : '→ 전체'} · 읽음: {(n.read_by || []).length}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                                            {new Date(n.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
