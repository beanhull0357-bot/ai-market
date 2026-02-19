import React, { useState, useEffect } from 'react';
import { X, Lightbulb, Sparkles } from 'lucide-react';

interface GuidePopupProps {
    pageKey: string;
    title: string;
    subtitle: string;
    description: string;
    highlights: { icon: string; text: string }[];
    whyNeeded: string;
}

export const GuidePopup: React.FC<GuidePopupProps> = ({ pageKey, title, subtitle, description, highlights, whyNeeded }) => {
    const storageKey = `guide_seen_${pageKey}`;
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!sessionStorage.getItem(storageKey)) {
            const timer = setTimeout(() => setVisible(true), 300);
            return () => clearTimeout(timer);
        }
    }, [storageKey]);

    const dismiss = () => {
        setVisible(false);
        sessionStorage.setItem(storageKey, '1');
    };

    if (!visible) return null;

    return (
        <div onClick={dismiss} style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, animation: 'fadeIn 0.3s ease',
        }}>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
            <div onClick={e => e.stopPropagation()} style={{
                width: '100%', maxWidth: 520,
                background: 'linear-gradient(145deg, #111318, #0d0f13)',
                border: '1px solid rgba(0,255,200,0.15)',
                borderRadius: 16, padding: 0, overflow: 'hidden',
                boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 40px rgba(0,255,200,0.05)',
                animation: 'slideUp 0.4s ease',
            }}>
                {/* Header with gradient */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(0,255,200,0.08), rgba(168,85,247,0.08))',
                    padding: '24px 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <Sparkles size={18} style={{ color: '#00ffc8' }} />
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#00ffc8', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                                    📘 기능 가이드
                                </span>
                            </div>
                            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.3 }}>{title}</h2>
                            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '4px 0 0', fontFamily: 'var(--font-mono)' }}>{subtitle}</p>
                        </div>
                        <button onClick={dismiss} style={{
                            background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8,
                            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: 'rgba(255,255,255,0.3)', flexShrink: 0,
                        }}>
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '20px 28px 24px' }}>
                    {/* Description */}
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, margin: '0 0 16px', wordBreak: 'keep-all' }}>
                        {description}
                    </p>

                    {/* Highlights */}
                    {highlights.length > 0 && (
                        <div style={{
                            background: 'rgba(0,255,200,0.03)', border: '1px solid rgba(0,255,200,0.08)',
                            borderRadius: 10, padding: '14px 16px', marginBottom: 16,
                        }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#00ffc8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                                주요 기능
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {highlights.map((h, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                        <span style={{ fontSize: 14, lineHeight: 1.4, flexShrink: 0 }}>{h.icon}</span>
                                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, wordBreak: 'keep-all' }}>{h.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Why Needed */}
                    <div style={{
                        background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.1)',
                        borderRadius: 10, padding: '14px 16px', marginBottom: 20,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <Lightbulb size={13} style={{ color: '#a855f7' }} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', textTransform: 'uppercase', letterSpacing: 1 }}>
                                왜 필요한가?
                            </span>
                        </div>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, margin: 0, wordBreak: 'keep-all' }}>
                            {whyNeeded}
                        </p>
                    </div>

                    {/* Confirm Button */}
                    <button onClick={dismiss} style={{
                        width: '100%', padding: '12px 0',
                        background: 'linear-gradient(135deg, #00ffc8, #00d4a8)',
                        border: 'none', borderRadius: 10, cursor: 'pointer',
                        fontSize: 14, fontWeight: 800, color: '#000',
                        transition: 'all 0.2s', letterSpacing: 0.5,
                    }}>
                        확인
                    </button>
                    <p style={{ textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 8 }}>
                        이 가이드는 첫 방문 시에만 표시됩니다
                    </p>
                </div>
            </div>
        </div>
    );
};
