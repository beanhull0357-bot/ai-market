import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LogIn, UserPlus, AlertCircle, Terminal, Loader } from 'lucide-react';

export const Auth: React.FC = () => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [signUpSuccess, setSignUpSuccess] = useState(false);
    const { signIn, signUp } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (isSignUp) {
            const { error } = await signUp(email, password);
            if (error) {
                setError(error);
            } else {
                setSignUpSuccess(true);
            }
        } else {
            const { error } = await signIn(email, password);
            if (error) {
                setError(error);
            } else {
                navigate('/');
            }
        }
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
                        {isSignUp ? t('auth.signUpSubtitle') : t('auth.signInSubtitle')}
                    </p>
                </div>

                {/* Form */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                    {signUpSuccess ? (
                        <div className="text-center space-y-4 py-4">
                            <div className="text-terminal-green text-lg font-bold">✓ {t('auth.signUpSuccess')}</div>
                            <p className="text-gray-400 text-sm">{t('auth.checkEmail')}</p>
                            <button
                                onClick={() => { setIsSignUp(false); setSignUpSuccess(false); }}
                                className="text-terminal-blue text-sm hover:underline"
                            >
                                {t('auth.goToSignIn')}
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs text-gray-500 uppercase mb-2">{t('auth.email')}</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-black border border-gray-700 rounded p-3 text-white text-sm focus:border-terminal-green outline-none transition-colors"
                                    placeholder="agent@jsonmart.io"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 uppercase mb-2">{t('auth.password')}</label>
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
                                ) : isSignUp ? (
                                    <UserPlus size={16} />
                                ) : (
                                    <LogIn size={16} />
                                )}
                                {loading ? t('auth.processing') : isSignUp ? t('auth.signUp') : t('auth.signIn')}
                            </button>
                        </form>
                    )}

                    {!signUpSuccess && (
                        <div className="mt-4 pt-4 border-t border-gray-800 text-center">
                            <button
                                onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
                                className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                            >
                                {isSignUp ? t('auth.hasAccount') : t('auth.noAccount')}
                            </button>
                        </div>
                    )}
                </div>

                <p className="text-center text-xs text-gray-600 mt-6">
                    {t('auth.footer')}
                </p>
            </div>
        </div>
    );
};
