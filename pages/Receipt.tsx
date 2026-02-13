import React from 'react';
import { useParams } from 'react-router-dom';
import { CodeBlock } from '../components/CodeBlock';
import { FileText, ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const Receipt: React.FC = () => {
  const { t } = useLanguage();
  // Mock data for receipt view
  const receiptData = {
    receiptId: "RCPT-8829",
    orderId: "ORD-20250501-X92",
    agentDecision: {
      logicTrace: [
        "Policy Check: Budget < 20000 KRW (PASS)",
        "Policy Check: ETA < 3 days (PASS)",
        "Constraint: Category == CONSUMABLES (PASS)",
        "Selection: TISSUE-70x20 selected as lowest price candidate among verified sellers."
      ],
      selectedReasonCodes: [
        "stock.in_stock",
        "elig.within_budget_order",
        "trust.source_reliable"
      ]
    },
    fulfillment: {
      provider: "DOMEME",
      status: "PENDING_APPROVAL"
    }
  };

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text p-6 font-mono">
      <div className="max-w-2xl mx-auto border border-gray-800 bg-gray-900/30 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-terminal-green">
            <FileText size={20} />
            <h1 className="text-xl font-bold">{t('receipt.title')}</h1>
          </div>
          <span className="text-xs text-gray-500">{receiptData.receiptId}</span>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-xs text-gray-500 uppercase mb-2">{t('receipt.trace')}</h3>
            <ul className="space-y-2 text-sm">
              {receiptData.agentDecision.logicTrace.map((trace, i) => (
                 <li key={i} className="flex gap-3">
                   <ArrowRight size={14} className="mt-1 text-gray-600" />
                   <span>{trace}</span>
                 </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs text-gray-500 uppercase mb-2">{t('receipt.data')}</h3>
            <CodeBlock data={receiptData} />
          </div>

          <div className="text-xs text-center text-gray-600 pt-4 border-t border-gray-800">
             {t('receipt.footer')}
          </div>
        </div>
      </div>
    </div>
  );
};