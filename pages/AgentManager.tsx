import React, { useState } from 'react';
import { Bot, Plus, Key, RefreshCcw, Trash2, ShieldOff, ShieldCheck, Copy, Check, Eye, EyeOff, X, Loader, Link2, Unlink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useAgents, usePolicies, Agent, AgentPolicy } from '../hooks';

const ApiKeyDisplay: React.FC<{ apiKey: string }> = ({ apiKey }) => {
    const [visible, setVisible] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(apiKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex items-center gap-2 bg-black rounded px-3 py-2 border border-gray-800">
            <code className="text-xs text-terminal-green flex-1 font-mono">
                {visible ? apiKey : `${apiKey.slice(0, 8)}${'•'.repeat(24)}`}
            </code>
            <button onClick={() => setVisible(!visible)} className="text-gray-500 hover:text-white transition-colors" title="Toggle visibility">
                {visible ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button onClick={handleCopy} className="text-gray-500 hover:text-terminal-green transition-colors" title="Copy">
                {copied ? <Check size={14} className="text-terminal-green" /> : <Copy size={14} />}
            </button>
        </div>
    );
};

const PolicySelector: React.FC<{
    policies: AgentPolicy[];
    currentPolicyId: string | null;
    onLink: (policyId: string | null) => void;
}> = ({ policies, currentPolicyId, onLink }) => {
    const { t } = useLanguage();
    const [open, setOpen] = useState(false);

    if (!open) {
        return (
            <div className="mb-4 flex items-center gap-2">
                {currentPolicyId ? (
                    <div className="flex-1 flex items-center gap-2 text-xs text-gray-400">
                        <ShieldCheck size={12} className="text-blue-400" />
                        <span>{t('agents.linkedPolicy')}: <code className="text-terminal-blue">{currentPolicyId}</code></span>
                        <button onClick={() => onLink(null)} className="text-red-400 hover:text-red-300 ml-1" title="Unlink">
                            <Unlink size={12} />
                        </button>
                        <button onClick={() => setOpen(true)} className="text-blue-400 hover:text-blue-300" title="Change">
                            <RefreshCcw size={10} />
                        </button>
                    </div>
                ) : (
                    <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-400 transition-colors">
                        <Link2 size={12} /> {t('agents.assignPolicy')}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="mb-4 bg-black/40 border border-gray-800 rounded p-3">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 uppercase">{t('agents.selectPolicy')}</span>
                <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white">
                    <X size={14} />
                </button>
            </div>
            {policies.length === 0 ? (
                <p className="text-xs text-gray-600">{t('agents.noPolicies')}</p>
            ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                    {policies.map(p => (
                        <button
                            key={p.policyId}
                            onClick={() => { onLink(p.policyId); setOpen(false); }}
                            className={`w-full text-left px-3 py-2 rounded text-xs transition-colors flex items-center justify-between ${p.policyId === currentPolicyId
                                ? 'bg-blue-900/30 text-blue-300 border border-blue-800'
                                : 'hover:bg-gray-800 text-gray-400'
                                }`}
                        >
                            <span className="font-mono">{p.policyId}</span>
                            <span className="text-gray-600">
                                ₩{p.maxBudget.toLocaleString()} · {p.maxDeliveryDays}d · Trust≥{p.minSellerTrust}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const AgentCard: React.FC<{
    agent: Agent;
    policies: AgentPolicy[];
    onRevoke: () => void;
    onActivate: () => void;
    onRegenerate: () => void;
    onDelete: () => void;
    onLinkPolicy: (policyId: string | null) => void;
}> = ({ agent, policies, onRevoke, onActivate, onRegenerate, onDelete, onLinkPolicy }) => {
    const { t } = useLanguage();
    const [confirming, setConfirming] = useState<'delete' | 'regen' | null>(null);
    const isActive = agent.status === 'ACTIVE';

    return (
        <div className={`bg-gray-900 border rounded-lg p-5 transition-colors ${isActive ? 'border-gray-800 hover:border-gray-600' : 'border-red-900/30 opacity-70'
            }`}>
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isActive ? 'bg-purple-900/30 text-purple-400' : 'bg-gray-800 text-gray-500'
                        }`}>
                        <Bot size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-sm">{agent.name}</h3>
                        <span className="text-xs text-gray-500 font-mono">{agent.agentId}</span>
                    </div>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded border ${isActive
                    ? 'text-green-400 bg-green-900/20 border-green-900'
                    : 'text-red-400 bg-red-900/20 border-red-900'
                    }`}>
                    {isActive ? t('agents.active') : t('agents.revoked')}
                </span>
            </div>

            {/* API Key */}
            <div className="mb-4">
                <label className="text-xs text-gray-500 uppercase mb-1 block">{t('agents.apiKey')}</label>
                <ApiKeyDisplay apiKey={agent.apiKey} />
            </div>

            {/* Policy Selector */}
            <PolicySelector
                policies={policies}
                currentPolicyId={agent.policyId}
                onLink={onLinkPolicy}
            />

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-black/50 rounded p-2 text-center">
                    <div className="text-xs text-gray-500">{t('agents.orders')}</div>
                    <div className="text-sm font-bold text-white">{agent.totalOrders}</div>
                </div>
                <div className="bg-black/50 rounded p-2 text-center">
                    <div className="text-xs text-gray-500">{t('agents.reviews')}</div>
                    <div className="text-sm font-bold text-white">{agent.totalReviews}</div>
                </div>
                <div className="bg-black/50 rounded p-2 text-center">
                    <div className="text-xs text-gray-500">{t('agents.lastActive')}</div>
                    <div className="text-xs font-bold text-white">
                        {agent.lastActiveAt ? new Date(agent.lastActiveAt).toLocaleDateString() : '—'}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-3 border-t border-gray-800">
                {confirming ? (
                    <div className="flex-1 flex items-center gap-2">
                        <span className="text-xs text-red-400">
                            {confirming === 'delete' ? t('agents.confirmDelete') : t('agents.confirmRegen')}
                        </span>
                        <button
                            onClick={() => {
                                if (confirming === 'delete') onDelete();
                                else onRegenerate();
                                setConfirming(null);
                            }}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-500"
                        >
                            {t('agents.yes')}
                        </button>
                        <button
                            onClick={() => setConfirming(null)}
                            className="px-2 py-1 text-xs bg-gray-800 text-gray-400 rounded hover:bg-gray-700"
                        >
                            {t('agents.no')}
                        </button>
                    </div>
                ) : (
                    <>
                        {isActive ? (
                            <button onClick={onRevoke} className="flex items-center gap-1 px-3 py-1.5 text-xs text-yellow-500 border border-yellow-900/50 rounded hover:bg-yellow-900/10 transition-colors">
                                <ShieldOff size={12} /> {t('agents.revoke')}
                            </button>
                        ) : (
                            <button onClick={onActivate} className="flex items-center gap-1 px-3 py-1.5 text-xs text-green-400 border border-green-900/50 rounded hover:bg-green-900/10 transition-colors">
                                <ShieldCheck size={12} /> {t('agents.activate')}
                            </button>
                        )}
                        <button onClick={() => setConfirming('regen')} className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-400 border border-blue-900/50 rounded hover:bg-blue-900/10 transition-colors">
                            <RefreshCcw size={12} /> {t('agents.regenKey')}
                        </button>
                        <button onClick={() => setConfirming('delete')} className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-400 border border-red-900/50 rounded hover:bg-red-900/10 transition-colors ml-auto">
                            <Trash2 size={12} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export const AgentManager: React.FC = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const { agents, loading, createAgent, revokeAgent, activateAgent, regenerateKey, deleteAgent, linkPolicy } = useAgents();
    const { policies } = usePolicies();

    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [selectedPolicy, setSelectedPolicy] = useState('');
    const [creating, setCreating] = useState(false);
    const [createdKey, setCreatedKey] = useState<string | null>(null);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setCreating(true);

        const ownerId = user?.id || 'anon-' + Date.now().toString(36);
        const result = await createAgent(newName.trim(), ownerId, selectedPolicy || undefined);

        if (result) {
            setCreatedKey(result.apiKey);
            setNewName('');
            setSelectedPolicy('');
        }
        setCreating(false);
    };

    return (
        <div className="min-h-screen bg-terminal-bg text-terminal-text p-6">
            <header className="mb-8 border-b border-gray-800 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Key className="text-purple-400" />
                        {t('agents.title')}
                    </h1>
                    <p className="text-sm text-gray-500 mt-2">
                        {t('agents.subtitle')}
                    </p>
                </div>

                <button
                    onClick={() => { setShowCreate(true); setCreatedKey(null); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors"
                >
                    <Plus size={16} /> {t('agents.btnCreate')}
                </button>
            </header>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">{t('agents.createTitle')}</h3>
                            <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        {createdKey ? (
                            <div className="space-y-4">
                                <div className="text-terminal-green font-bold flex items-center gap-2">
                                    <Check size={16} /> {t('agents.created')}
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase mb-2 block">{t('agents.newApiKey')}</label>
                                    <ApiKeyDisplay apiKey={createdKey} />
                                </div>
                                <div className="p-3 bg-yellow-900/10 border border-yellow-900/30 rounded text-xs text-yellow-400">
                                    ⚠️ {t('agents.saveKeyWarning')}
                                </div>
                                <button
                                    onClick={() => { setShowCreate(false); setCreatedKey(null); }}
                                    className="w-full py-3 bg-gray-800 text-white rounded hover:bg-gray-700 text-sm"
                                >
                                    {t('agents.done')}
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleCreate} className="space-y-4">
                                <div>
                                    <label className="block text-xs text-gray-500 uppercase mb-2">{t('agents.agentName')}</label>
                                    <input
                                        type="text"
                                        required
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        className="w-full bg-black border border-gray-700 rounded p-3 text-white text-sm focus:border-purple-500 outline-none"
                                        placeholder="e.g. PROCURE-BOT-v3, OFFICE-SUPPLY-AI"
                                    />
                                </div>
                                {/* Policy Selector */}
                                <div>
                                    <label className="block text-xs text-gray-500 uppercase mb-2">{t('agents.assignPolicy')}</label>
                                    <select
                                        value={selectedPolicy}
                                        onChange={(e) => setSelectedPolicy(e.target.value)}
                                        className="w-full bg-black border border-gray-700 rounded p-3 text-white text-sm focus:border-purple-500 outline-none"
                                    >
                                        <option value="">{t('agents.noPolicy')}</option>
                                        {policies.map(p => (
                                            <option key={p.policyId} value={p.policyId}>
                                                {p.policyId} — ₩{p.maxBudget.toLocaleString()} (Trust≥{p.minSellerTrust})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreate(false)}
                                        className="flex-1 py-3 text-gray-400 border border-gray-700 rounded hover:bg-gray-800 text-sm"
                                    >
                                        {t('agents.cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={creating}
                                        className={`flex-1 py-3 font-bold rounded flex items-center justify-center gap-2 text-sm ${creating ? 'bg-gray-700 text-gray-500' : 'bg-purple-600 text-white hover:bg-purple-500'
                                            }`}
                                    >
                                        {creating ? <Loader className="animate-spin" size={14} /> : <Bot size={14} />}
                                        {creating ? t('agents.generating') : t('agents.generate')}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Agents Grid */}
            {loading ? (
                <div className="flex items-center justify-center gap-3 py-20 text-gray-500">
                    <Loader className="animate-spin" size={20} /> Loading agents...
                </div>
            ) : agents.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-gray-800 rounded-lg">
                    <Bot size={48} className="mx-auto text-gray-700 mb-4" />
                    <p className="text-gray-500 mb-2">{t('agents.noAgents')}</p>
                    <p className="text-xs text-gray-600">{t('agents.noAgentsDesc')}</p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {agents.map((agent) => (
                        <AgentCard
                            key={agent.agentId}
                            agent={agent}
                            policies={policies}
                            onRevoke={() => revokeAgent(agent.agentId)}
                            onActivate={() => activateAgent(agent.agentId)}
                            onRegenerate={() => regenerateKey(agent.agentId)}
                            onDelete={() => deleteAgent(agent.agentId)}
                            onLinkPolicy={(policyId) => linkPolicy(agent.agentId, policyId)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
