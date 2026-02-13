import React from 'react';
import { MOCK_ORDERS } from '../data';
import { RiskBadge } from '../components/RiskBadge';
import { Clock, CheckSquare, XSquare, AlertOctagon } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const AdminQueue: React.FC = () => {
  const { t } = useLanguage();
  
  const calculateTimeLeft = (deadline: string) => {
    const diff = new Date(deadline).getTime() - new Date().getTime();
    if (diff <= 0) return "EXPIRED";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text p-6">
      <header className="mb-8 border-b border-gray-800 pb-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <AlertOctagon className="text-yellow-500" />
          {t('admin.title')}
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          {t('admin.subtitle')}
        </p>
      </header>

      <div className="grid gap-4">
        {MOCK_ORDERS.map((order) => {
          const timeLeft = calculateTimeLeft(order.payment.captureDeadline);
          const isCritical = timeLeft !== "EXPIRED" && parseInt(timeLeft) < 1;
          const displayTime = timeLeft === "EXPIRED" ? t('admin.expired') : `${t('admin.expiresIn')}: ${timeLeft}`;

          return (
            <div key={order.orderId} className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-600 transition-colors">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-lg font-bold text-white">{order.orderId}</span>
                    <span className="px-2 py-0.5 rounded text-xs bg-blue-900 text-blue-300 border border-blue-800">
                      {order.payment.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                     {t('admin.created')}: {new Date(order.createdAt).toLocaleString()}
                  </div>
                </div>
                
                <div className={`flex items-center gap-2 font-mono text-sm px-3 py-1 rounded border ${isCritical ? 'bg-red-900/20 text-red-500 border-red-900' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                  <Clock size={14} />
                  {timeLeft === "EXPIRED" ? t('admin.voided') : displayTime}
                </div>
              </div>

              {/* Items */}
              <div className="mb-4 bg-black/50 p-3 rounded border border-gray-800">
                 {order.items.map((item, idx) => (
                   <div key={idx} className="flex justify-between text-sm">
                      <span>{item.sku} <span className="text-gray-500">x{item.qty}</span></span>
                      <span className="font-mono text-green-400">
                        KRW {(order.payment.authorizedAmount / item.qty).toLocaleString()}
                      </span>
                   </div>
                 ))}
                 <div className="mt-2 pt-2 border-t border-gray-800 flex justify-between text-sm font-bold">
                    <span>{t('admin.totalAuth')}</span>
                    <span>KRW {order.payment.authorizedAmount.toLocaleString()}</span>
                 </div>
              </div>

              {/* Risk Analysis */}
              <div className="mb-6">
                <h4 className="text-xs text-gray-500 uppercase mb-2">{t('admin.riskFlags')}</h4>
                <div className="flex flex-wrap">
                  <RiskBadge label="STOCK" level={order.risks.stock} />
                  <RiskBadge label="PRICE" level={order.risks.price} />
                  <RiskBadge label="POLICY" level={order.risks.policy} />
                  <RiskBadge label="CONSENT" level={order.risks.consent} />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button className="flex items-center gap-2 px-4 py-2 text-sm border border-red-800 text-red-500 hover:bg-red-900/20 rounded">
                   <XSquare size={16} /> {t('admin.btnReject')}
                </button>
                <button 
                  disabled={order.risks.consent === 'RED'}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded text-black transition-colors
                    ${order.risks.consent === 'RED' ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-500 hover:bg-green-400'}
                  `}
                >
                   <CheckSquare size={16} /> {t('admin.btnApprove')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};