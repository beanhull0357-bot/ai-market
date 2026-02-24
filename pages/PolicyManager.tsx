import React, { useState } from 'react';
import { Shield, Plus, Trash2, Edit3, Check, X, Loader, Package, Truck, Star, DollarSign } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { usePolicies, AgentPolicy } from '../hooks';

const CATEGORIES = [
    'CONSUMABLES', 'MRO', 'OFFICE', 'FOOD', 'HOUSEHOLD',
    'BEAUTY', 'FASHION', 'DIGITAL', 'SPORTS', 'FURNITURE',
    'AUTOMOTIVE', 'MEDICAL', 'INDUSTRIAL',
] as const;

const PolicyCard: React.FC<{
    policy: AgentPolicy;
    onUpdate: (policyId: string, updates: any) => Promise<boolean>;
    onDelete: (policyId: string) => void;
}> = ({ policy, onUpdate, onDelete }) => {
    const { t } = useLanguage();
    const [editing, setEditing] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [maxBudget, setMaxBudget] = useState(policy.maxBudget);
    const [maxDeliveryDays, setMaxDeliveryDays] = useState(policy.maxDeliveryDays);
    const [minSellerTrust, setMinSellerTrust] = useState(policy.minSellerTrust);
    const [allowedCategories, setAllowedCategories] = useState<string[]>(policy.allowedCategories);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        await onUpdate(policy.policyId, { maxBudget, maxDeliveryDays, minSellerTrust, allowedCategories });
        setSaving(false);
        setEditing(false);
    };

    const toggleCategory = (cat: string) => {
        setAllowedCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    if (editing) {
        return (
            <div className="bg-gray-900 border border-purple-800/50 rounded-lg p-5">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="font-bold text-white text-sm font-mono">{policy.policyId}</h3>
                    <div className="flex gap-2">
                        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-500">
                            {saving ? <Loader className="animate-spin" size={12} /> : <Check size={12} />} {t('policies.save')}
                        </button>
                        <button onClick={() => setEditing(false)} className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600">
                            <X size={12} />
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-gray-500 uppercase mb-1 block">{t('policies.maxBudget')} (₩)</label>
                        <input type="number" value={maxBudget} onChange={e => setMaxBudget(Number(e.target.value))}
                            className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm focus:border-purple-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 uppercase mb-1 block">{t('policies.maxDelivery')} ({t('policies.days')})</label>
                        <input type="number" value={maxDeliveryDays} onChange={e => setMaxDeliveryDays(Number(e.target.value))} min={1} max={30}
                            className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm focus:border-purple-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 uppercase mb-1 block">{t('policies.minTrust')} (0–100)</label>
                        <input type="number" value={minSellerTrust} onChange={e => setMinSellerTrust(Number(e.target.value))} min={0} max={100}
                            className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm focus:border-purple-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 uppercase mb-2 block">{t('policies.categories')}</label>
                        <div className="flex gap-2 flex-wrap">
                            {CATEGORIES.map(cat => (
                                <button key={cat} onClick={() => toggleCategory(cat)}
                                    className={`px-3 py-1.5 text-xs rounded border transition-colors ${allowedCategories.includes(cat)
                                        ? 'bg-purple-900/30 text-purple-300 border-purple-700'
                                        : 'bg-gray-800 text-gray-500 border-gray-700'
                                        }`}>
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 hover:border-gray-600 transition-colors">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="font-bold text-white text-sm font-mono">{policy.policyId}</h3>
                    <span className="text-xs text-gray-600">{new Date(policy.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-1">
                    <button onClick={() => setEditing(true)} className="p-1.5 text-gray-500 hover:text-white transition-colors rounded hover:bg-gray-800">
                        <Edit3 size={14} />
                    </button>
                    {confirming ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                            <div style={{ fontSize: 10, color: '#f87171', textAlign: 'right', maxWidth: 160 }}>
                                ⚠️ 이 정책을 사용 중인 에이전트의 자율 구매가 중단될 수 있습니다.
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => onDelete(policy.policyId)} className="px-2 py-1 text-xs bg-red-600 text-white rounded">
                                    {t('policies.yes')}
                                </button>
                                <button onClick={() => setConfirming(false)} className="px-2 py-1 text-xs bg-gray-700 text-gray-400 rounded">
                                    {t('policies.no')}
                                </button>
                            </div>
                        </div>

                    ) : (
                        <button onClick={() => setConfirming(true)} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors rounded hover:bg-gray-800">
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-black/50 rounded p-3 flex items-center gap-2">
                    <DollarSign size={14} className="text-green-400" />
                    <div>
                        <div className="text-xs text-gray-500">{t('policies.maxBudget')}</div>
                        <div className="text-sm font-bold text-white">₩{policy.maxBudget.toLocaleString()}</div>
                    </div>
                </div>
                <div className="bg-black/50 rounded p-3 flex items-center gap-2">
                    <Truck size={14} className="text-blue-400" />
                    <div>
                        <div className="text-xs text-gray-500">{t('policies.maxDelivery')}</div>
                        <div className="text-sm font-bold text-white">{policy.maxDeliveryDays}{t('policies.days')}</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-black/50 rounded p-3 flex items-center gap-2">
                    <Star size={14} className="text-yellow-400" />
                    <div>
                        <div className="text-xs text-gray-500">{t('policies.minTrust')}</div>
                        <div className="text-sm font-bold text-white">≥ {policy.minSellerTrust}</div>
                    </div>
                </div>
                <div className="bg-black/50 rounded p-3 flex items-center gap-2">
                    <Package size={14} className="text-purple-400" />
                    <div>
                        <div className="text-xs text-gray-500">{t('policies.categories')}</div>
                        <div className="text-xs font-bold text-white">{policy.allowedCategories.join(', ')}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const PolicyManager: React.FC = () => {
    const { t } = useLanguage();
    const { policies, loading, createPolicy, updatePolicy, deletePolicy } = usePolicies();

    const [showCreate, setShowCreate] = useState(false);
    const [newId, setNewId] = useState('');
    const [newBudget, setNewBudget] = useState(50000);
    const [newDelivery, setNewDelivery] = useState(5);
    const [newTrust, setNewTrust] = useState(70);
    const [newCategories, setNewCategories] = useState<string[]>(['CONSUMABLES', 'MRO']);
    const [creating, setCreating] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newId.trim()) return;
        setCreating(true);
        await createPolicy({
            policyId: newId.trim().toUpperCase().replace(/\s+/g, '-'),
            maxBudget: newBudget,
            allowedCategories: newCategories,
            maxDeliveryDays: newDelivery,
            minSellerTrust: newTrust,
        });
        setCreating(false);
        setShowCreate(false);
        setNewId('');
        setNewBudget(50000);
        setNewDelivery(5);
        setNewTrust(70);
        setNewCategories(['CONSUMABLES', 'MRO']);
    };

    const toggleNewCategory = (cat: string) => {
        setNewCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    return (
        <div className="min-h-screen bg-terminal-bg text-terminal-text p-6">
            <header className="mb-8 border-b border-gray-800 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Shield className="text-blue-400" />
                        {t('policies.title')}
                    </h1>
                    <p className="text-sm text-gray-500 mt-2">{t('policies.subtitle')}</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                >
                    <Plus size={16} /> {t('policies.btnCreate')}
                </button>
            </header>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">{t('policies.createTitle')}</h3>
                            <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-xs text-gray-500 uppercase mb-2">{t('policies.policyId')}</label>
                                <input type="text" required value={newId} onChange={e => setNewId(e.target.value)}
                                    className="w-full bg-black border border-gray-700 rounded p-3 text-white text-sm focus:border-blue-500 outline-none"
                                    placeholder="e.g. OFFICE-STANDARD, FRUGAL-MODE" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 uppercase mb-2">{t('policies.maxBudget')} (₩)</label>
                                <input type="number" value={newBudget} onChange={e => setNewBudget(Number(e.target.value))}
                                    className="w-full bg-black border border-gray-700 rounded p-3 text-white text-sm focus:border-blue-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-500 uppercase mb-2">{t('policies.maxDelivery')} ({t('policies.days')})</label>
                                    <input type="number" value={newDelivery} onChange={e => setNewDelivery(Number(e.target.value))} min={1} max={30}
                                        className="w-full bg-black border border-gray-700 rounded p-3 text-white text-sm focus:border-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 uppercase mb-2">{t('policies.minTrust')}</label>
                                    <input type="number" value={newTrust} onChange={e => setNewTrust(Number(e.target.value))} min={0} max={100}
                                        className="w-full bg-black border border-gray-700 rounded p-3 text-white text-sm focus:border-blue-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 uppercase mb-2">{t('policies.categories')}</label>
                                <div className="flex gap-2 flex-wrap">
                                    {CATEGORIES.map(cat => (
                                        <button key={cat} type="button" onClick={() => toggleNewCategory(cat)}
                                            className={`flex-1 px-3 py-2 text-xs rounded border transition-colors ${newCategories.includes(cat)
                                                ? 'bg-blue-900/30 text-blue-300 border-blue-700'
                                                : 'bg-gray-800 text-gray-500 border-gray-700'
                                                }`}>
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreate(false)}
                                    className="flex-1 py-3 text-gray-400 border border-gray-700 rounded hover:bg-gray-800 text-sm">
                                    {t('policies.cancel')}
                                </button>
                                <button type="submit" disabled={creating}
                                    className={`flex-1 py-3 font-bold rounded flex items-center justify-center gap-2 text-sm ${creating ? 'bg-gray-700 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-500'
                                        }`}>
                                    {creating ? <Loader className="animate-spin" size={14} /> : <Shield size={14} />}
                                    {creating ? t('policies.creating') : t('policies.create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Policy Grid */}
            {loading ? (
                <div className="flex items-center justify-center gap-3 py-20 text-gray-500">
                    <Loader className="animate-spin" size={20} /> Loading...
                </div>
            ) : policies.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-gray-800 rounded-lg">
                    <Shield size={48} className="mx-auto text-gray-700 mb-4" />
                    <p className="text-gray-500 mb-2">{t('policies.noPolicies')}</p>
                    <p className="text-xs text-gray-600">{t('policies.noPoliciesDesc')}</p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {policies.map(policy => (
                        <PolicyCard
                            key={policy.policyId}
                            policy={policy}
                            onUpdate={updatePolicy}
                            onDelete={deletePolicy}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
