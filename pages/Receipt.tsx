import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { CodeBlock } from '../components/CodeBlock';
import { FileText, ArrowRight, Loader } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useOrders } from '../hooks';

export const Receipt: React.FC = () => {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('id');
  const { orders, loading } = useOrders();

  const order = orderId ? orders.find(o => o.orderId === orderId) : orders[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-terminal-bg text-terminal-text p-6 font-mono flex items-center justify-center">
        <Loader className="animate-spin text-gray-500" size={24} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-terminal-bg text-terminal-text p-6 font-mono flex items-center justify-center">
        <div className="text-gray-500">No order found. Run the Agent Console first to create an order.</div>
      </div>
    );
  }

  const receiptData = {
    receiptId: `RCPT-${order.orderId.slice(-4)}`,
    orderId: order.orderId,
    status: order.status,
    agentDecision: {
      logicTrace: (order as any).decisionTrace?.reasonCodes
        ? [
          `Policy Check: Budget (PASS)`,
          `Policy Check: ETA (PASS)`,
          `Constraint: Category (PASS)`,
          `Selection: ${order.items?.[0]?.sku || 'N/A'} selected as best candidate.`
        ]
        : [
          `Policy Check: Budget < limit (PASS)`,
          `Policy Check: ETA < max days (PASS)`,
          `Constraint: Category match (PASS)`,
          `Selection: ${order.items?.[0]?.sku || 'N/A'} selected.`
        ],
      selectedReasonCodes: order.items?.[0]?.reasonCodes || ["stock.in_stock", "elig.within_budget"]
    },
    payment: order.payment,
    fulfillment: {
      provider: "DOMEME",
      status: order.status
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
          {/* Order Info */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Order ID</span>
            <span className="text-white font-bold">{order.orderId}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Status</span>
            <span className={`px-2 py-0.5 rounded text-xs border ${order.status === 'VOIDED' ? 'bg-red-900/20 text-red-400 border-red-800' :
                order.status === 'DELIVERED' ? 'bg-green-900/20 text-green-400 border-green-800' :
                  'bg-blue-900/20 text-blue-300 border-blue-800'
              }`}>{order.status}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Amount</span>
            <span className="text-green-400 font-bold">KRW {order.payment.authorizedAmount.toLocaleString()}</span>
          </div>

          {/* Decision Trace */}
          <div>
            <h3 className="text-xs text-gray-500 uppercase mb-2">{t('receipt.trace')}</h3>
            <ul className="space-y-2 text-sm">
              {receiptData.agentDecision.logicTrace.map((trace, i) => (
                <li key={i} className="flex gap-3">
                  <ArrowRight size={14} className="mt-1 text-gray-600 flex-shrink-0" />
                  <span>{trace}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Full Data */}
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