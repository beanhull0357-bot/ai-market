import React from 'react';
import { Terminal, ShieldCheck, Zap, Code2, Lock, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CodeBlock } from '../components/CodeBlock';
import { AgentReviewList } from '../components/AgentReviewList';
import { useProducts, useReviews } from '../hooks';
import { useLanguage } from '../context/LanguageContext';

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { products, loading: productsLoading } = useProducts();
  const { reviews: tissueReviews, loading: reviewsLoading } = useReviews('TISSUE-70x20');

  const firstProduct = products[0];

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text font-mono selection:bg-terminal-green selection:text-black">
      {/* Hero Section */}
      <div className="container mx-auto px-6 py-24 flex flex-col items-center text-center border-b border-gray-900">
        <div className="mb-6 flex items-center justify-center space-x-2 text-terminal-green animate-pulse">
          <Terminal size={24} />
          <span className="text-sm font-bold uppercase tracking-widest">{t('landing.systemOnline')}</span>
        </div>

        <h1 className="text-4xl md:text-7xl font-bold mb-8 leading-tight">
          <span className="block text-white">{t('landing.heroTitle1')}</span>
          <span className="block text-gray-600">{t('landing.heroTitle2')}</span>
        </h1>

        <p className="max-w-2xl text-lg text-gray-400 mb-12">
          {t('landing.heroSubtitle')}
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => navigate('/agent-console')}
            className="px-8 py-4 bg-terminal-green text-black font-bold hover:bg-green-400 transition-colors flex items-center justify-center gap-2"
          >
            <Zap size={18} />
            {t('landing.btnConnect')}
          </button>
          <button
            onClick={() => document.getElementById('store-as-code')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-8 py-4 border border-gray-700 hover:border-gray-500 transition-colors flex items-center justify-center gap-2"
          >
            <Code2 size={18} />
            {t('landing.btnViewCode')}
          </button>
        </div>
      </div>

      {/* Value Props */}
      <div className="container mx-auto px-6 py-20 grid md:grid-cols-3 gap-12">
        <div className="space-y-4">
          <Code2 className="text-terminal-blue" size={32} />
          <h3 className="text-xl font-bold text-white">{t('landing.feature1Title')}</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            {t('landing.feature1Desc')}
          </p>
        </div>
        <div className="space-y-4">
          <Lock className="text-terminal-red" size={32} />
          <h3 className="text-xl font-bold text-white">{t('landing.feature2Title')}</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            {t('landing.feature2Desc')}
          </p>
        </div>
        <div className="space-y-4">
          <ShieldCheck className="text-terminal-yellow" size={32} />
          <h3 className="text-xl font-bold text-white">{t('landing.feature3Title')}</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            {t('landing.feature3Desc')}
          </p>
        </div>
      </div>

      {/* Store As Code Teaser */}
      <div id="store-as-code" className="container mx-auto px-6 py-20 border-t border-gray-900">
        <div className="flex flex-col md:flex-row gap-12 items-start">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-white mb-6">{t('landing.catalogPreview')}</h2>
            <p className="text-gray-400 mb-8">
              {t('landing.catalogDesc')}
            </p>
            <ul className="space-y-4 text-sm text-gray-500 mb-8">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> {t('landing.list1')}
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> {t('landing.list2')}
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> {t('landing.list3')}
              </li>
            </ul>

            <div className="p-6 bg-gray-900/30 rounded border border-gray-800">
              <div className="flex items-center gap-2 text-white mb-4">
                <Activity size={20} className="text-terminal-purple" />
                <h3 className="text-lg font-bold">{t('landing.agentReviews')}</h3>
              </div>
              <p className="text-sm text-gray-500 mb-4">{t('landing.agentReviewsDesc')}</p>
              {reviewsLoading ? (
                <div className="text-gray-600 text-sm">Loading reviews...</div>
              ) : (
                <AgentReviewList reviews={tissueReviews} />
              )}
            </div>
          </div>
          <div className="flex-1 w-full">
            <div className="mb-2 text-xs text-gray-500">GET /api/v1/catalog/consumables?limit=1</div>
            {productsLoading ? (
              <div className="text-gray-600 text-sm p-4">Loading catalog...</div>
            ) : firstProduct ? (
              <CodeBlock data={firstProduct} />
            ) : (
              <div className="text-gray-600 text-sm p-4">No products found</div>
            )}
          </div>
        </div>
      </div>

      <footer className="border-t border-gray-900 py-12 text-center text-xs text-gray-600">
        <p>{t('landing.footerCopyright')}</p>
        <p className="mt-2">{t('landing.footerPrivacy')}</p>
      </footer>
    </div>
  );
};