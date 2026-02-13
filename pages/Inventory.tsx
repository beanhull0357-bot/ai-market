import React, { useState } from 'react';
import { Package, Plus, Bot, ScanBarcode, User, Database, X } from 'lucide-react';
import { MOCK_PRODUCTS } from '../data';
import { ProductPack } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { CodeBlock } from '../components/CodeBlock';

export const Inventory: React.FC = () => {
  const { t } = useLanguage();
  const [products, setProducts] = useState<ProductPack[]>(MOCK_PRODUCTS);
  const [isSourcing, setIsSourcing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    sku: '',
    title: '',
    price: 0,
    stock: 0
  });

  const handleAutoSource = async () => {
    if (isSourcing) return;
    setIsSourcing(true);
    
    // Simulate AI Latency
    await new Promise(r => setTimeout(r, 2000));

    const newProduct: ProductPack = {
      sku: `AI-SRC-${Math.floor(Math.random() * 9000) + 1000}`,
      category: 'MRO',
      title: `Auto-Sourced Industrial Components Batch #${Math.floor(Math.random() * 100)}`,
      identifiers: { brand: "Generic-Ind", gtin: "00000000" },
      offer: {
        price: Math.floor(Math.random() * 50000) + 5000,
        currency: "KRW",
        stockStatus: 'in_stock',
        stockQty: Math.floor(Math.random() * 100),
        shipByDays: 2,
        etaDays: 3
      },
      policies: {
        returnDays: 7,
        returnFee: 3000,
        returnExceptions: []
      },
      qualitySignals: {
        aiReadinessScore: Math.floor(Math.random() * 20) + 80, // AI sources high quality data
        sellerTrust: 85
      },
      attributes: {
        source_market: "B2B_Wholesale_Net",
        auto_verified: true
      },
      sourcingType: 'AI'
    };

    setProducts(prev => [newProduct, ...prev]);
    setIsSourcing(false);
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const newProduct: ProductPack = {
      sku: formData.sku || `MANUAL-${Date.now()}`,
      category: 'CONSUMABLES',
      title: formData.title,
      identifiers: { brand: "ManualEntry" },
      offer: {
        price: Number(formData.price),
        currency: "KRW",
        stockStatus: 'in_stock',
        stockQty: Number(formData.stock),
        shipByDays: 1,
        etaDays: 3
      },
      policies: { returnDays: 7, returnFee: 0, returnExceptions: [] },
      qualitySignals: { aiReadinessScore: 70, sellerTrust: 100 },
      attributes: { manually_added: true },
      sourcingType: 'HUMAN'
    };
    
    setProducts(prev => [newProduct, ...prev]);
    setShowAddForm(false);
    setFormData({ sku: '', title: '', price: 0, stock: 0 });
  };

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text p-6">
      {/* Header */}
      <header className="mb-8 border-b border-gray-800 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Database className="text-blue-500" />
            {t('inventory.title')}
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {t('inventory.subtitle')}
          </p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-600 transition-colors"
          >
            <Plus size={16} /> {t('inventory.btnAdd')}
          </button>
          <button 
            onClick={handleAutoSource}
            disabled={isSourcing}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded text-black transition-colors ${
              isSourcing ? 'bg-purple-900 text-gray-400 cursor-wait' : 'bg-purple-500 hover:bg-purple-400'
            }`}
          >
            {isSourcing ? <ScanBarcode className="animate-spin" size={16} /> : <Bot size={16} />}
            {isSourcing ? t('inventory.sourcing') : t('inventory.btnAutoSource')}
          </button>
        </div>
      </header>

      {/* Stats / Evolution Visualization */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-gray-900/50 rounded border border-gray-800">
           <div className="text-xs text-gray-500 uppercase mb-1">Total SKUs</div>
           <div className="text-2xl font-bold text-white">{products.length}</div>
        </div>
        <div className="p-4 bg-gray-900/50 rounded border border-gray-800">
           <div className="text-xs text-gray-500 uppercase mb-1">AI Automation Rate</div>
           <div className="text-2xl font-bold text-purple-400">
             {((products.filter(p => p.sourcingType === 'AI').length / products.length) * 100).toFixed(0)}%
           </div>
        </div>
      </div>

      {/* Product List */}
      <div className="bg-black/30 rounded border border-gray-800 overflow-hidden">
        <table className="w-full text-left text-sm font-mono">
          <thead className="bg-gray-900 text-gray-400">
            <tr>
              <th className="p-4">{t('inventory.tableSource')}</th>
              <th className="p-4">{t('inventory.tableSku')}</th>
              <th className="p-4">{t('inventory.tableProduct')}</th>
              <th className="p-4">{t('inventory.tablePrice')}</th>
              <th className="p-4">{t('inventory.tableStock')}</th>
              <th className="p-4 text-right">{t('inventory.tableAiScore')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {products.map((p, idx) => (
              <tr key={idx} className="hover:bg-gray-900/50 transition-colors">
                <td className="p-4">
                  <span className={`flex items-center gap-2 text-xs font-bold px-2 py-1 rounded w-max border ${
                    p.sourcingType === 'AI' 
                      ? 'bg-purple-900/20 text-purple-400 border-purple-900' 
                      : 'bg-blue-900/20 text-blue-400 border-blue-900'
                  }`}>
                    {p.sourcingType === 'AI' ? <Bot size={12} /> : <User size={12} />}
                    {p.sourcingType === 'AI' ? t('inventory.sourceAi') : t('inventory.sourceHuman')}
                  </span>
                </td>
                <td className="p-4 text-gray-300">{p.sku}</td>
                <td className="p-4 text-white font-medium">{p.title}</td>
                <td className="p-4 text-green-400">KRW {p.offer.price.toLocaleString()}</td>
                <td className="p-4 text-gray-300">{p.offer.stockQty}</td>
                <td className="p-4 text-right">
                  <span className={`font-bold ${p.qualitySignals.aiReadinessScore >= 90 ? 'text-green-500' : 'text-yellow-500'}`}>
                    {p.qualitySignals.aiReadinessScore}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Manual Add Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">{t('inventory.formTitle')}</h3>
              <button onClick={() => setShowAddForm(false)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleManualAdd} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 uppercase mb-1">{t('inventory.formSku')}</label>
                <input 
                  type="text" 
                  value={formData.sku}
                  onChange={e => setFormData({...formData, sku: e.target.value})}
                  className="w-full bg-black border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                  placeholder="AUTO-GEN-IF-EMPTY"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase mb-1">{t('inventory.formName')}</label>
                <input 
                  type="text" 
                  required
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-black border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 uppercase mb-1">{t('inventory.formPrice')}</label>
                  <input 
                    type="number" 
                    required
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                    className="w-full bg-black border border-gray-700 rounded p-2 text-green-400 font-bold focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase mb-1">{t('inventory.formStock')}</label>
                  <input 
                    type="number" 
                    required
                    value={formData.stock}
                    onChange={e => setFormData({...formData, stock: Number(e.target.value)})}
                    className="w-full bg-black border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              
              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-3 text-gray-400 border border-gray-700 rounded hover:bg-gray-800"
                >
                  {t('inventory.btnCancel')}
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded hover:bg-blue-500"
                >
                  {t('inventory.btnSave')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};