import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LogIn, AlertCircle, Terminal, Loader } from 'lucide-react';

export const Auth: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        console.log('[Auth Page] handleSubmit start');

        try {
            console.log('[Auth Page] calling signIn...');
            const { error: signInError } = await signIn(email, password);
            console.log('[Auth Page] signIn returned:', signInError);
            if (signInError) {
                setError(signInError);
            } else {
                console.log('[Auth Page] navigating to /');
                navigate('/');
            }
        } catch (err: any) {
            console.error('[Auth Page] caught error:', err);
            setError(err?.message || 'Login failed.');
        } finally {
            console.log('[Auth Page] finally - setLoading(false)');
            setLoading(false);
        }
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
                    <p className="text-gray-500 text-sm">{t('auth.signInSubtitle')}</p>
                </div>

                {/* Form */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
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
                </div>

                <p className="text-center text-xs text-gray-600 mt-6">
                    {t('auth.footer')}
                </p>
            </div>
        </div>
    );
};
