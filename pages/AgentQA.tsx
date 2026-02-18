import React, { useState } from 'react';
import { MessageSquare, Send, Clock, CheckCircle2, XCircle, Package, Tag, ChevronDown, ChevronUp, Filter, Search, Loader2, Archive } from 'lucide-react';
import { useAgentQuestions } from '../hooks';
import { AgentQuestion, QuestionStatus } from '../types';
import { useLanguage } from '../context/LanguageContext';

/* ━━━ Category Labels ━━━ */
const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
    SPEC: { label: '스펙 확인', color: 'var(--accent-cyan)' },
    COMPATIBILITY: { label: '호환성', color: 'var(--accent-purple)' },
    BULK_PRICING: { label: '대량 할인', color: 'var(--accent-green)' },
    SHIPPING: { label: '배송', color: 'var(--accent-amber)' },
    RESTOCK: { label: '재입고', color: 'var(--accent-blue, #3b82f6)' },
    POLICY: { label: '정책', color: 'var(--accent-red)' },
    OTHER: { label: '기타', color: 'var(--text-muted)' },
};

const STATUS_CONFIG: Record<QuestionStatus, { label: string; icon: React.ReactNode; color: string }> = {
    PENDING: { label: '대기중', icon: <Clock size={14} />, color: 'var(--accent-amber)' },
    ANSWERED: { label: '답변완료', icon: <CheckCircle2 size={14} />, color: 'var(--accent-green)' },
    CLOSED: { label: '종료', icon: <XCircle size={14} />, color: 'var(--text-muted)' },
};

/* ━━━ Question Card ━━━ */
function QuestionCard({
    question,
    onAnswer,
    onClose,
}: {
    key?: string;
    question: AgentQuestion;
    onAnswer: (ticketId: string, answer: string) => Promise<boolean>;
    onClose: (ticketId: string) => Promise<boolean>;
}) {
    const [expanded, setExpanded] = useState(false);
    const [answerText, setAnswerText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const cat = CATEGORY_LABELS[question.category] || CATEGORY_LABELS.OTHER;
    const status = STATUS_CONFIG[question.status];
    const timeSince = getTimeSince(question.createdAt);

    const handleSubmit = async () => {
        if (!answerText.trim()) return;
        setSubmitting(true);
        const ok = await onAnswer(question.ticketId, answerText.trim());
        if (ok) setAnswerText('');
        setSubmitting(false);
    };

    return (
        <div
            style={{
                background: 'var(--bg-card)',
                border: `1px solid ${question.status === 'PENDING' ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                transition: 'border-color 0.2s',
            }}
        >
            {/* Header */}
            <div
                onClick={() => setExpanded(!expanded)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', cursor: 'pointer',
                }}
            >
                {/* Status dot */}
                <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: status.color, flexShrink: 0,
                    boxShadow: question.status === 'PENDING' ? `0 0 8px ${status.color}` : 'none',
                }} />

                {/* Question preview */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            background: `color-mix(in srgb, ${cat.color} 15%, transparent)`,
                            color: cat.color,
                        }}>
                            {cat.label}
                        </span>
                        {question.sku && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                                <Package size={11} /> {question.sku}
                            </span>
                        )}
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>
                            {timeSince}
                        </span>
                    </div>
                    <div style={{
                        fontSize: 13, color: 'var(--text-primary)', fontWeight: 600,
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: expanded ? 'normal' : 'nowrap',
                    }}>
                        {question.question}
                    </div>
                </div>

                {/* Agent ID */}
                <span style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)',
                    color: 'var(--accent-cyan)', background: 'rgba(34,211,238,0.08)',
                    padding: '2px 8px', borderRadius: 'var(--radius-full)',
                    flexShrink: 0,
                }}>
                    {question.agentId}
                </span>

                {expanded ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> :
                    <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
            </div>

            {/* Expanded content */}
            {expanded && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                    {/* Full question */}
                    <div style={{
                        margin: '12px 0', padding: 12, borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-surface)', fontSize: 13, lineHeight: 1.7,
                        color: 'var(--text-secondary)',
                    }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                            Question
                        </div>
                        {question.question}
                    </div>

                    {/* Ticket info */}
                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, flexWrap: 'wrap' }}>
                        <span>Ticket: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{question.ticketId}</span></span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: status.color }}>
                            {status.icon} {status.label}
                        </span>
                    </div>

                    {/* Answer display (if answered) */}
                    {question.answer && (
                        <div style={{
                            padding: 12, borderRadius: 'var(--radius-md)',
                            background: 'rgba(52,211,153,0.05)',
                            border: '1px solid rgba(52,211,153,0.15)',
                            fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)',
                            marginBottom: 12,
                        }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-green)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                                Answer ({question.answeredBy})
                            </div>
                            {question.answer}
                        </div>
                    )}

                    {/* Answer form (if pending) */}
                    {question.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                            <textarea
                                value={answerText}
                                onChange={e => setAnswerText(e.target.value)}
                                placeholder="답변을 입력하세요..."
                                style={{
                                    flex: 1, minHeight: 60, padding: 10,
                                    background: 'var(--bg-surface)', border: '1px solid var(--border-medium)',
                                    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                                    fontSize: 13, resize: 'vertical', fontFamily: 'inherit',
                                }}
                            />
                            <button
                                onClick={handleSubmit}
                                disabled={!answerText.trim() || submitting}
                                className="btn-primary"
                                style={{ padding: '10px 16px', fontSize: 13, flexShrink: 0 }}
                            >
                                {submitting ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                                답변
                            </button>
                        </div>
                    )}

                    {/* Close button (if answered) */}
                    {question.status === 'ANSWERED' && (
                        <button
                            onClick={() => onClose(question.ticketId)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: 'none', border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-md)', padding: '6px 12px',
                                fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer',
                            }}
                        >
                            <Archive size={12} /> 종료 처리
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

/* ━━━ Time Helper ━━━ */
function getTimeSince(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
}

/* ━━━ Main Page ━━━ */
export const AgentQA: React.FC = () => {
    const [activeTab, setActiveTab] = useState<QuestionStatus | 'ALL'>('PENDING');
    const [searchQuery, setSearchQuery] = useState('');
    const filterStatus = activeTab === 'ALL' ? undefined : activeTab;
    const { questions, loading, answerQuestion, closeQuestion } = useAgentQuestions(filterStatus);

    const filtered = searchQuery
        ? questions.filter(q =>
            q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
            q.agentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (q.sku && q.sku.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        : questions;

    const tabs: { key: QuestionStatus | 'ALL'; label: string; count?: number }[] = [
        { key: 'PENDING', label: '⏳ 대기중' },
        { key: 'ANSWERED', label: '✅ 답변완료' },
        { key: 'CLOSED', label: '📁 종료' },
        { key: 'ALL', label: '전체' },
    ];

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <MessageSquare size={24} style={{ color: 'var(--accent-cyan)' }} />
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Agent Q&A</h1>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>에이전트 상품 문의 관리</p>
                    </div>
                </div>

                {/* Search */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 12px', background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                    minWidth: 200,
                }}>
                    <Search size={14} style={{ color: 'var(--text-muted)' }} />
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="검색 (질문, 에이전트, SKU)"
                        style={{
                            background: 'none', border: 'none', outline: 'none',
                            color: 'var(--text-primary)', fontSize: 13, width: '100%',
                        }}
                    />
                </div>
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex', gap: 4, marginBottom: 20,
                padding: 4, background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
            }}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            flex: 1, padding: '8px 12px', fontSize: 12, fontWeight: 600,
                            background: activeTab === tab.key ? 'var(--bg-card)' : 'transparent',
                            color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                            border: activeTab === tab.key ? '1px solid var(--border-medium)' : '1px solid transparent',
                            borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Loading */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                    <Loader2 size={24} className="spin" style={{ margin: '0 auto 12px' }} />
                    <p style={{ fontSize: 13 }}>질문 로딩 중...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: 60,
                    background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-subtle)',
                }}>
                    <MessageSquare size={40} style={{ color: 'var(--text-dim)', margin: '0 auto 12px' }} />
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>
                        {activeTab === 'PENDING' ? '대기중인 질문이 없습니다' : '질문이 없습니다'}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                        에이전트가 ask_question API로 질문을 보내면 여기에 표시됩니다
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
                        {filtered.length}개 질문
                    </div>
                    {filtered.map(q => (
                        <QuestionCard
                            key={q.ticketId}
                            question={q}
                            onAnswer={answerQuestion}
                            onClose={closeQuestion}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
