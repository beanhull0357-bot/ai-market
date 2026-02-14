import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Key, Send, ShoppingCart, Star, Loader, CheckCircle, XCircle, Zap, Bot, Clock, Database } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../supabaseClient';
import { useProducts } from '../hooks';

interface LogEntry {
    time: string;
    type: 'request' | 'response' | 'error' | 'info';
    message: string;
    data?: any;
}

export const AgentPlayground: React.FC = () => {
    const { t } = useLanguage();
    const { products } = useProducts();

    // Self-registration state
    const [regName, setRegName] = useState('');
    const [regCapabilities, setRegCapabilities] = useState('browse, order, review');
    const [regContact, setRegContact] = useState('');
    const [regLoading, setRegLoading] = useState(false);
    const [registeredAgentId, setRegisteredAgentId] = useState<string | null>(null);

    // Auth state
    const [apiKey, setApiKey] = useState('');
    const [authenticated, setAuthenticated] = useState(false);
    const [agentInfo, setAgentInfo] = useState<any>(null);

    // Order form
    const [orderSku, setOrderSku] = useState('');
    const [orderQty, setOrderQty] = useState(1);
    const [orderLoading, setOrderLoading] = useState(false);

    // Review form
    const [reviewSku, setReviewSku] = useState('');
    const [reviewVerdict, setReviewVerdict] = useState<'ENDORSE' | 'WARN' | 'BLOCKLIST'>('ENDORSE');
    const [reviewLoading, setReviewLoading] = useState(false);

    // Logs
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [authLoading, setAuthLoading] = useState(false);
    const [feedLoading, setFeedLoading] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const timestamp = () => new Date().toISOString().split('T')[1].slice(0, 8);

    const addLog = (type: LogEntry['type'], message: string, data?: any) => {
        setLogs(prev => [...prev, { time: timestamp(), type, message, data }]);
    };

    // 0. Self-Register
    const handleSelfRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!regName.trim()) return;
        setRegLoading(true);
        const capabilities = regCapabilities.split(',').map(s => s.trim()).filter(Boolean);
        addLog('request', `POST /rpc/agent_self_register`, { name: regName, capabilities, contact_uri: regContact || null });

        const { data, error } = await supabase.rpc('agent_self_register', {
            p_agent_name: regName.trim(),
            p_capabilities: capabilities,
            p_contact_uri: regContact.trim() || null,
        });

        if (error) {
            addLog('error', `RPC Error: ${error.message}`);
        } else if (data?.success) {
            addLog('response', `✅ ${data.message}`, data);
            setRegisteredAgentId(data.agent_id);
        } else {
            addLog('error', `❌ ${data?.error}: ${data?.message || ''}`, data);
        }
        setRegLoading(false);
    };

    // 1. Authenticate
    const handleAuth = async () => {
        if (!apiKey.trim()) return;
        setAuthLoading(true);
        addLog('request', `POST /rpc/authenticate_agent`, { api_key: '***' + apiKey.slice(-8) });

        const { data, error } = await supabase.rpc('authenticate_agent', { p_api_key: apiKey });

        if (error) {
            addLog('error', `RPC Error: ${error.message}`);
            setAuthenticated(false);
        } else if (data?.success) {
            addLog('response', `✅ Authenticated as ${data.name} (${data.agent_id})`, data);
            setAgentInfo(data);
            setAuthenticated(true);
        } else {
            addLog('error', `❌ ${data?.error || 'Unknown error'}`, data);
            setAuthenticated(false);
        }
        setAuthLoading(false);
    };

    // 2. Create Order
    const handleCreateOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orderSku) return;
        setOrderLoading(true);
        addLog('request', `POST /rpc/agent_create_order`, { sku: orderSku, qty: orderQty });

        const { data, error } = await supabase.rpc('agent_create_order', {
            p_api_key: apiKey,
            p_sku: orderSku,
            p_qty: orderQty,
        });

        if (error) {
            addLog('error', `RPC Error: ${error.message}`);
        } else if (data?.success) {
            addLog('response', `✅ Order created: ${data.order_id} — ₩${data.amount?.toLocaleString()}`, data);
            setAgentInfo((prev: any) => prev ? { ...prev, total_orders: (prev.total_orders || 0) + 1 } : prev);
        } else {
            addLog('error', `❌ ${data?.error}: ${JSON.stringify(data?.violations || '')}`, data);
        }
        setOrderLoading(false);
    };

    // 3. Create Review
    const handleCreateReview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reviewSku) return;
        setReviewLoading(true);
        addLog('request', `POST /rpc/agent_create_review`, { sku: reviewSku, verdict: reviewVerdict });

        const { data, error } = await supabase.rpc('agent_create_review', {
            p_api_key: apiKey,
            p_sku: reviewSku,
            p_verdict: reviewVerdict,
            p_fulfillment_delta: reviewVerdict === 'BLOCKLIST' ? 24 : 0,
            p_spec_compliance: reviewVerdict === 'BLOCKLIST' ? 0.75 : 1.0,
            p_api_latency_ms: Math.floor(Math.random() * 500) + 100,
            p_log: JSON.stringify([{ event: 'API_TEST', level: reviewVerdict === 'ENDORSE' ? 'INFO' : 'WARN', details: 'Submitted via Playground' }]),
        });

        if (error) {
            addLog('error', `RPC Error: ${error.message}`);
        } else if (data?.success) {
            addLog('response', `✅ Review ${data.review_id}: ${reviewVerdict} for ${reviewSku}`, data);
            setAgentInfo((prev: any) => prev ? { ...prev, total_reviews: (prev.total_reviews || 0) + 1 } : prev);
        } else {
            addLog('error', `❌ ${data?.error}`, data);
        }
        setReviewLoading(false);
    };

    const logColorMap: Record<string, string> = {
        request: 'text-blue-400',
        response: 'text-green-400',
        error: 'text-red-400',
        info: 'text-gray-400',
    };

    return (
        <div className="min-h-screen bg-terminal-bg text-terminal-text">
            <div className="flex flex-col md:flex-row h-[calc(100vh-3.5rem)]">
                {/* Left Panel: Controls */}
                <div className="w-full md:w-1/3 border-r border-gray-800 p-6 overflow-y-auto">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
                        <Zap className="text-yellow-400" size={20} /> {t('playground.title')}
                    </h2>

                    {/* Step 0: Self-Register */}
                    <div className="mb-6 p-4 bg-gray-900 rounded-lg border border-orange-900/50">
                        <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                            <Bot size={14} className="text-orange-400" /> {t('playground.registerTitle')}
                        </h3>
                        <p className="text-[10px] text-gray-500 mb-3">{t('playground.registerDesc')}</p>

                        {registeredAgentId ? (
                            <div className="p-3 bg-orange-900/20 border border-orange-800 rounded text-xs space-y-1">
                                <div className="text-orange-300 flex items-center gap-1">
                                    <Clock size={12} /> {t('playground.registerPending')}
                                </div>
                                <div className="text-gray-400 font-mono">ID: {registeredAgentId}</div>
                                <p className="text-gray-500">{t('playground.registerWaitApproval')}</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSelfRegister} className="space-y-2">
                                <input
                                    type="text"
                                    value={regName}
                                    onChange={e => setRegName(e.target.value)}
                                    placeholder={t('playground.registerNamePlaceholder')}
                                    className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-xs font-mono text-white focus:border-orange-500 outline-none"
                                />
                                <input
                                    type="text"
                                    value={regCapabilities}
                                    onChange={e => setRegCapabilities(e.target.value)}
                                    placeholder={t('playground.registerCapPlaceholder')}
                                    className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-xs font-mono text-white focus:border-orange-500 outline-none"
                                />
                                <input
                                    type="text"
                                    value={regContact}
                                    onChange={e => setRegContact(e.target.value)}
                                    placeholder={t('playground.registerContactPlaceholder')}
                                    className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-xs font-mono text-white focus:border-orange-500 outline-none"
                                />
                                <button type="submit" disabled={regLoading || !regName.trim()}
                                    className="w-full py-2 text-xs font-bold bg-orange-600 text-white rounded hover:bg-orange-500 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
                                    {regLoading ? <Loader className="animate-spin" size={12} /> : <Bot size={12} />}
                                    {t('playground.registerBtn')}
                                </button>
                            </form>
                        )}
                    </div>

                    {/* Fetch Product Feed */}
                    <div className="mb-6 p-4 bg-gray-900 rounded-lg border border-green-900/50">
                        <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                            <Database size={14} className="text-green-400" /> Product Feed (Public)
                        </h3>
                        <p className="text-[10px] text-gray-500 mb-3">No auth required — fetch structured catalog with trust scores.</p>
                        <button
                            onClick={async () => {
                                setFeedLoading(true);
                                addLog('request', 'POST /rpc/get_product_feed', {});
                                const { data, error } = await supabase.rpc('get_product_feed');
                                if (error) {
                                    addLog('error', `RPC Error: ${error.message}`);
                                } else {
                                    addLog('response', `✅ Feed v${data.feed_version} — ${data.product_count} products`, data);
                                }
                                setFeedLoading(false);
                            }}
                            disabled={feedLoading}
                            className="w-full py-2 text-xs font-bold bg-green-700 text-white rounded hover:bg-green-600 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                        >
                            {feedLoading ? <Loader className="animate-spin" size={12} /> : <Database size={12} />}
                            Fetch Product Feed
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex-1 border-t border-gray-800"></div>
                        <span className="text-[10px] text-gray-600 uppercase tracking-widest">{t('playground.orUseApiKey')}</span>
                        <div className="flex-1 border-t border-gray-800"></div>
                    </div>

                    {/* API Key Auth */}
                    <div className="mb-6 p-4 bg-gray-900 rounded-lg border border-gray-800">
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <Key size={14} className="text-yellow-400" /> {t('playground.authTitle')}
                        </h3>
                        <div className="flex gap-2">
                            <input
                                type="password"
                                value={apiKey}
                                onChange={e => setApiKey(e.target.value)}
                                placeholder={t('playground.apiKeyPlaceholder')}
                                className="flex-1 bg-black border border-gray-700 rounded px-3 py-2 text-xs font-mono text-white focus:border-yellow-500 outline-none"
                            />
                            <button
                                onClick={handleAuth}
                                disabled={authLoading || !apiKey.trim()}
                                className={`px-4 py-2 text-xs font-bold rounded flex items-center gap-1 transition-colors ${authenticated
                                    ? 'bg-green-800 text-green-300 border border-green-700'
                                    : 'bg-yellow-600 text-black hover:bg-yellow-500'
                                    }`}
                            >
                                {authLoading ? <Loader className="animate-spin" size={12} /> :
                                    authenticated ? <CheckCircle size={12} /> : <Key size={12} />}
                                {authenticated ? 'OK' : t('playground.authBtn')}
                            </button>
                        </div>
                        {agentInfo && (
                            <div className="mt-3 p-2 bg-black/50 rounded text-xs space-y-1">
                                <div className="text-green-400">● {agentInfo.name} ({agentInfo.agent_id})</div>
                                <div className="text-gray-500">
                                    {t('playground.orders')}: {agentInfo.total_orders} · {t('playground.reviews')}: {agentInfo.total_reviews}
                                    {agentInfo.policy_id && <span> · Policy: {agentInfo.policy_id}</span>}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Create Order */}
                    <div className={`mb-6 p-4 rounded-lg border transition-opacity ${authenticated ? 'bg-gray-900 border-gray-800' : 'bg-gray-900/50 border-gray-800/50 opacity-50 pointer-events-none'}`}>
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <ShoppingCart size={14} className="text-blue-400" /> {t('playground.orderTitle')}
                        </h3>
                        <form onSubmit={handleCreateOrder} className="space-y-3">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">SKU</label>
                                <select
                                    value={orderSku}
                                    onChange={e => setOrderSku(e.target.value)}
                                    className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-xs text-white focus:border-blue-500 outline-none"
                                >
                                    <option value="">{t('playground.selectProduct')}</option>
                                    {products.map(p => (
                                        <option key={p.sku} value={p.sku}>
                                            {p.sku} — ₩{p.offer.price.toLocaleString()} ({p.category})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">{t('playground.quantity')}</label>
                                <input type="number" value={orderQty} onChange={e => setOrderQty(Number(e.target.value))} min={1} max={100}
                                    className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-xs text-white focus:border-blue-500 outline-none" />
                            </div>
                            <button type="submit" disabled={orderLoading || !orderSku}
                                className="w-full py-2 text-xs font-bold bg-blue-600 text-white rounded hover:bg-blue-500 flex items-center justify-center gap-2 disabled:opacity-50">
                                {orderLoading ? <Loader className="animate-spin" size={12} /> : <Send size={12} />}
                                {t('playground.createOrder')}
                            </button>
                        </form>
                    </div>

                    {/* Create Review */}
                    <div className={`mb-6 p-4 rounded-lg border transition-opacity ${authenticated ? 'bg-gray-900 border-gray-800' : 'bg-gray-900/50 border-gray-800/50 opacity-50 pointer-events-none'}`}>
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <Star size={14} className="text-purple-400" /> {t('playground.reviewTitle')}
                        </h3>
                        <form onSubmit={handleCreateReview} className="space-y-3">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">SKU</label>
                                <select
                                    value={reviewSku}
                                    onChange={e => setReviewSku(e.target.value)}
                                    className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-xs text-white focus:border-purple-500 outline-none"
                                >
                                    <option value="">{t('playground.selectProduct')}</option>
                                    {products.map(p => (
                                        <option key={p.sku} value={p.sku}>{p.sku} — {p.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Verdict</label>
                                <div className="flex gap-2">
                                    {(['ENDORSE', 'WARN', 'BLOCKLIST'] as const).map(v => (
                                        <button key={v} type="button"
                                            onClick={() => setReviewVerdict(v)}
                                            className={`flex-1 py-1.5 text-xs rounded border transition-colors ${reviewVerdict === v
                                                ? v === 'ENDORSE' ? 'bg-green-900/30 text-green-300 border-green-700'
                                                    : v === 'WARN' ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700'
                                                        : 'bg-red-900/30 text-red-300 border-red-700'
                                                : 'bg-gray-800 text-gray-500 border-gray-700'
                                                }`}>
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button type="submit" disabled={reviewLoading || !reviewSku}
                                className="w-full py-2 text-xs font-bold bg-purple-600 text-white rounded hover:bg-purple-500 flex items-center justify-center gap-2 disabled:opacity-50">
                                {reviewLoading ? <Loader className="animate-spin" size={12} /> : <Send size={12} />}
                                {t('playground.submitReview')}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Right Panel: Response Log */}
                <div className="w-full md:w-2/3 p-6 bg-black flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Terminal size={14} /> {t('playground.logTitle')}
                        </h3>
                        <button onClick={() => setLogs([])} className="text-xs text-gray-600 hover:text-gray-400">Clear</button>
                    </div>

                    <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1 bg-gray-950 rounded-lg p-4 border border-gray-900">
                        {logs.length === 0 && (
                            <div className="text-gray-700 text-center py-10">
                                {t('playground.emptyLog')}
                            </div>
                        )}
                        {logs.map((log, i) => (
                            <div key={i} className="border-l-2 border-transparent hover:border-gray-700 pl-2 py-0.5">
                                <span className="text-gray-600">[{log.time}]</span>
                                <span className={` ml-1 ${logColorMap[log.type]}`}>
                                    {log.type === 'request' ? '→' : log.type === 'response' ? '←' : '✗'} {log.message}
                                </span>
                                {log.data && (
                                    <pre className="text-gray-600 ml-10 mt-1 text-[10px] leading-tight overflow-x-auto">
                                        {JSON.stringify(log.data, null, 2)}
                                    </pre>
                                )}
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </div>
        </div>
    );
};
