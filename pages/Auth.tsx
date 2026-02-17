import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LogIn, AlertCircle, Terminal, Loader, Mail, KeyRound } from 'lucide-react';

type AuthStep = 'password' | 'otp';

export const Auth: React.FC = () => {
    const [step, setStep] = useState<AuthStep>('password');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn, sendOtp, verifyOtp, signOut } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Step 1: Verify password (creates session temporarily)
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
            setError(signInError);
            setLoading(false);
            return;
        }

        // Step 2: Sign out immediately — we only verified the password
        // The real session will be created by OTP verification
        await signOut();

        // Step 3: Send OTP code to email
        const { error: otpError } = await sendOtp(email);
        if (otpError) {
            setError(otpError);
            setLoading(false);
            return;
        }

        setStep('otp');
        setLoading(false);
    };

    const handleOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const { error: verifyError } = await verifyOtp(email, otpCode);
        if (verifyError) {
            setError(verifyError);
            setLoading(false);
            return;
        }

        navigate('/');
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-terminal-bg text-terminal-text font-mono flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <Terminal className="text-terminal-green" size={28} />
                        <span className="text-2xl font-bold text-white">
                            <span className="text-terminal-green">{'{'}</span>
                            JSONMart
                            <span className="text-terminal-green">{'}'}</span>
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm">
                        {step === 'password'
                            ? t('auth.signInSubtitle')
                            : (language => language === 'ko'
                                ? '이메일로 전송된 인증 코드를 입력하세요'
                                : 'Enter the verification code sent to your email'
                            )(t('auth.signInSubtitle').includes('관리') ? 'ko' : 'en')
                        }
                    </p>
                </div>

                {/* Form */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                    {step === 'password' ? (
                        /* ──── Step 1: Password Login ──── */
                        <form onSubmit={handlePasswordSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs text-gray-500 uppercase mb-2">
                                    {t('auth.email')}
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-black border border-gray-700 rounded p-3 text-white text-sm focus:border-terminal-green outline-none transition-colors"
                                    placeholder="admin@jsonmart.io"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 uppercase mb-2">
                                    {t('auth.password')}
                                </label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-black border border-gray-700 rounded p-3 text-white text-sm focus:border-terminal-green outline-none transition-colors"
                                    placeholder="••••••••"
                                />
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/10 border border-red-900/30 rounded p-3">
                                    <AlertCircle size={14} />
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full py-3 font-bold rounded flex items-center justify-center gap-2 transition-colors ${loading
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-terminal-green text-black hover:bg-green-400'
                                    }`}
                            >
                                {loading ? (
                                    <Loader className="animate-spin" size={16} />
                                ) : (
                                    <LogIn size={16} />
                                )}
                                {loading ? t('auth.processing') : t('auth.signIn')}
                            </button>
                        </form>
                    ) : (
                        /* ──── Step 2: OTP Verification ──── */
                        <form onSubmit={handleOtpSubmit} className="space-y-4">
                            <div className="text-center mb-4">
                                <div style={{
                                    width: 56, height: 56, borderRadius: '50%',
                                    background: 'rgba(0,255,136,0.1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    margin: '0 auto 12px',
                                }}>
                                    <Mail size={24} style={{ color: 'var(--accent-green, #00ff88)' }} />
                                </div>
                                <p className="text-sm text-gray-400">
                                    <span className="text-terminal-green font-bold">{email}</span>
                                    {' '}으로 인증 코드가 전송되었습니다
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-500 uppercase mb-2">
                                    인증 코드 (Verification Code)
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="w-full bg-black border border-gray-700 rounded p-3 text-white text-2xl text-center tracking-[0.5em] focus:border-terminal-green outline-none transition-colors font-mono"
                                    placeholder="000000"
                                    maxLength={6}
                                    autoFocus
                                />
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/10 border border-red-900/30 rounded p-3">
                                    <AlertCircle size={14} />
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || otpCode.length < 6}
                                className={`w-full py-3 font-bold rounded flex items-center justify-center gap-2 transition-colors ${loading || otpCode.length < 6
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-terminal-green text-black hover:bg-green-400'
                                    }`}
                            >
                                {loading ? (
                                    <Loader className="animate-spin" size={16} />
                                ) : (
                                    <KeyRound size={16} />
                                )}
                                {loading ? t('auth.processing') : '인증 확인'}
                            </button>

                            <button
                                type="button"
                                onClick={() => { setStep('password'); setOtpCode(''); setError(''); }}
                                className="w-full text-sm text-gray-500 hover:text-gray-300 transition-colors py-2"
                            >
                                ← 다시 로그인
                            </button>
                        </form>
                    )}
                </div>

                <p className="text-center text-xs text-gray-600 mt-6">
                    {t('auth.footer')}
                </p>
            </div>
        </div>
    );
};
