import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LogIn, AlertCircle, Terminal, Loader } from 'lucide-react';

const BUILD_VERSION = 'v5-fix-relogin';

export const Auth: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn, user } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();

    // If already logged in, redirect to home
    useEffect(() => {
        if (user) {
            navigate('/');
        }
    }, [user, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await signIn(email, password);
            if (result.error) {
                setError(result.error);
            } else {
                navigate('/');
            }
        } catch (err: any) {
            setError(err?.message || 'Login failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#0c0c0c',
            color: '#cccccc',
            fontFamily: '"JetBrains Mono", monospace',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
        }}>
            <div style={{ width: '100%', maxWidth: '400px' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Terminal color="#22c55e" size={28} />
                        <span style={{ fontSize: '24px', fontWeight: 700, color: 'white' }}>
                            <span style={{ color: '#22c55e' }}>{'{'}</span>
                            JSONMart
                            <span style={{ color: '#22c55e' }}>{'}'}</span>
                        </span>
                    </div>
                    <p style={{ color: '#666', fontSize: '14px' }}>{t('auth.signInSubtitle')}</p>
                </div>

                {/* Form */}
                <div style={{
                    backgroundColor: '#111',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    padding: '24px',
                }}>
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '11px', color: '#666', textTransform: 'uppercase', marginBottom: '8px' }}>
                                {t('auth.email')}
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{
                                    width: '100%',
                                    backgroundColor: '#000',
                                    border: '1px solid #444',
                                    borderRadius: '4px',
                                    padding: '12px',
                                    color: 'white',
                                    fontSize: '14px',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                                placeholder="admin@jsonmart.io"
                            />
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '11px', color: '#666', textTransform: 'uppercase', marginBottom: '8px' }}>
                                {t('auth.password')}
                            </label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{
                                    width: '100%',
                                    backgroundColor: '#000',
                                    border: '1px solid #444',
                                    borderRadius: '4px',
                                    padding: '12px',
                                    color: 'white',
                                    fontSize: '14px',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                                placeholder="••••••••"
                            />
                        </div>

                        {error && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#f87171',
                                fontSize: '12px',
                                backgroundColor: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                borderRadius: '4px',
                                padding: '12px',
                                marginBottom: '16px',
                            }}>
                                <AlertCircle size={14} />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '12px',
                                fontWeight: 700,
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                border: 'none',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                backgroundColor: loading ? '#444' : '#22c55e',
                                color: loading ? '#888' : '#000',
                                fontSize: '14px',
                                transition: 'all 150ms',
                            }}
                        >
                            {loading ? (
                                <Loader className="animate-spin" size={16} />
                            ) : (
                                <LogIn size={16} />
                            )}
                            {loading ? t('auth.processing') : t('auth.signIn')}
                        </button>
                    </form>
                </div>

                <p style={{ textAlign: 'center', fontSize: '12px', color: '#444', marginTop: '24px' }}>
                    {t('auth.footer')}
                </p>

                {/* Version indicator - for debugging */}
                <p style={{ textAlign: 'center', fontSize: '10px', color: '#333', marginTop: '8px' }}>
                    {BUILD_VERSION}
                </p>
            </div>
        </div>
    );
};
