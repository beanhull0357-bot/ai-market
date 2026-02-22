import React, { useState } from 'react';
import { RiskBadge } from '../components/RiskBadge';
import { Clock, CheckSquare, XSquare, AlertOctagon, Loader, Bot, ShoppingCart, Cpu, CreditCard } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useOrders, useAgents } from '../hooks';
import { requestPayment } from '../payappService';

type TabType = 'orders' | 'agents';

export const AdminQueue: React.FC = () => {
  const { t } = useLanguage();
  const { orders, loading: ordersLoading, updateOrderStatus } = useOrders();
  const { pendingAgents, loading: agentsLoading, approveAgent, rejectAgent } = useAgents();
  const [activeTab, setActiveTab] = useState<TabType>('orders');
  const [approvedKeys, setApprovedKeys] = useState<Record<string, string>>({});
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const pendingOrders = orders.filter(o =>
    o.status === 'PROCUREMENT_PENDING' || o.status === 'PAYMENT_AUTHORIZED'
  );

  const calculateTimeLeft = (deadline: string) => {
    const diff = new Date(deadline).getTime() - new Date().getTime();
    if (diff <= 0) return "EXPIRED";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const [paymentStatus, setPaymentStatus] = useState<Record<string, string>>({});

  const handleApprove = async (orderId: string) => {
    // Find the order to get payment details
    const order = orders.find(o => o.orderId === orderId);
    if (!order) return;

    setPaymentStatus(prev => ({ ...prev, [orderId]: 'REQUESTING' }));

    // Trigger PayApp payment request
    const payResult = await requestPayment({
      orderId,
      price: order.payment.authorizedAmount,
      goodname: order.items.map((i: any) => i.sku).join(', '),
    });

    if (payResult.success) {
      setPaymentStatus(prev => ({ ...prev, [orderId]: 'PAYMENT_REQUESTED' }));
      await updateOrderStatus(orderId, 'PROCUREMENT_SENT', 'PAYMENT_REQUESTED');
    } else {
      setPaymentStatus(prev => ({ ...prev, [orderId]: 'FAILED' }));
      console.error('Payment request failed:', payResult.errorMessage);
      // Still approve the order even if payment fails (can retry later)
      await updateOrderStatus(orderId, 'PROCUREMENT_SENT', 'CAPTURED');
    }
  };

  const handleReject = async (orderId: string) => {
    await updateOrderStatus(orderId, 'VOIDED', 'VOIDED');
  };

  const handleApproveAgent = async (agentId: string) => {
    setProcessingIds(prev => new Set(prev).add(agentId));
    const result = await approveAgent(agentId);
    if (result?.success) {
      setApprovedKeys(prev => ({ ...prev, [agentId]: result.api_key }));
    }
    setProcessingIds(prev => { const s = new Set(prev); s.delete(agentId); return s; });
  };

  const handleRejectAgent = async (agentId: string) => {
    setProcessingIds(prev => new Set(prev).add(agentId));
    await rejectAgent(agentId);
    setProcessingIds(prev => { const s = new Set(prev); s.delete(agentId); return s; });
  };

  const loading = ordersLoading || agentsLoading;

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text p-6">
      <header className="mb-6 border-b border-gray-800 pb-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <AlertOctagon className="text-yellow-500" />
          {t('admin.title')}
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          {t('admin.subtitle')}
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900/50 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded transition-colors ${activeTab === 'orders'
            ? 'bg-gray-800 text-white'
            : 'text-gray-500 hover:text-gray-300'
            }`}
        >
          <ShoppingCart size={14} />
          {t('admin.tabOrders')}
          {pendingOrders.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-blue-600 text-white">
              {pendingOrders.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('agents')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded transition-colors ${activeTab === 'agents'
            ? 'bg-gray-800 text-white'
            : 'text-gray-500 hover:text-gray-300'
            }`}
        >
          <Bot size={14} />
          {t('admin.tabAgents')}
          {pendingAgents.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-orange-600 text-white animate-pulse">
              {pendingAgents.length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20 text-gray-500">
          <Loader className="animate-spin" size={20} /> Loading...
        </div>
      ) : activeTab === 'orders' ? (
        /* ==================== ORDERS TAB ==================== */
        pendingOrders.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            {t('admin.noOrders')}
          </div>
        ) : (
          <div className="grid gap-4">
            {pendingOrders.map((order) => {
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
                        {paymentStatus[order.orderId] && (
                          <span className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${paymentStatus[order.orderId] === 'REQUESTING' ? 'bg-yellow-900 text-yellow-300 border border-yellow-800' :
                              paymentStatus[order.orderId] === 'PAYMENT_REQUESTED' ? 'bg-emerald-900 text-emerald-300 border border-emerald-800' :
                                'bg-red-900 text-red-300 border border-red-800'
                            }`}>
                            <CreditCard size={10} />
                            {paymentStatus[order.orderId] === 'REQUESTING' ? 'PayApp 결제요청중...' :
                              paymentStatus[order.orderId] === 'PAYMENT_REQUESTED' ? 'PayApp 결제대기' :
                                'PayApp 요청실패'}
                          </span>
                        )}
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
                    {order.items.map((item: any, idx: number) => (
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
                    <button
                      onClick={() => handleReject(order.orderId)}
                      className="flex items-center gap-2 px-4 py-2 text-sm border border-red-800 text-red-500 hover:bg-red-900/20 rounded"
                    >
                      <XSquare size={16} /> {t('admin.btnReject')}
                    </button>
                    <button
                      onClick={() => handleApprove(order.orderId)}
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
        )
      ) : (
        /* ==================== AGENTS TAB ==================== */
        pendingAgents.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <Bot size={48} className="mx-auto mb-4 opacity-30" />
            <p>{t('admin.noAgentRequests')}</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pendingAgents.map((agent) => (
              <div key={agent.agentId} className="bg-gray-900 border border-orange-900/50 rounded-lg p-6 hover:border-orange-700/50 transition-colors">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <Cpu size={18} className="text-orange-400" />
                      <span className="text-lg font-bold text-white">{agent.name}</span>
                      <span className="px-2 py-0.5 rounded text-xs bg-orange-900/50 text-orange-300 border border-orange-800">
                        PENDING
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      {agent.agentId} · {t('admin.created')}: {new Date(agent.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Agent Details */}
                <div className="mb-4 bg-black/50 p-3 rounded border border-gray-800 space-y-2">
                  {agent.capabilities.length > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-gray-500 min-w-[90px]">{t('admin.capabilities')}:</span>
                      <div className="flex flex-wrap gap-1">
                        {agent.capabilities.map((cap, i) => (
                          <span key={i} className="px-2 py-0.5 text-xs rounded bg-gray-800 text-gray-300 border border-gray-700">
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {agent.contactUri && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500 min-w-[90px]">{t('admin.contactUri')}:</span>
                      <span className="text-blue-400 font-mono text-xs">{agent.contactUri}</span>
                    </div>
                  )}
                </div>

                {/* Approved Key Display */}
                {approvedKeys[agent.agentId] && (
                  <div className="mb-4 p-3 bg-green-900/20 border border-green-800 rounded">
                    <div className="text-xs text-green-400 mb-1">✅ {t('admin.agentApproved')}</div>
                    <div className="font-mono text-xs text-green-300 break-all">
                      API Key: {approvedKeys[agent.agentId]}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {!approvedKeys[agent.agentId] && (
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => handleRejectAgent(agent.agentId)}
                      disabled={processingIds.has(agent.agentId)}
                      className="flex items-center gap-2 px-4 py-2 text-sm border border-red-800 text-red-500 hover:bg-red-900/20 rounded disabled:opacity-50"
                    >
                      {processingIds.has(agent.agentId) ? <Loader className="animate-spin" size={14} /> : <XSquare size={16} />}
                      {t('admin.btnRejectAgent')}
                    </button>
                    <button
                      onClick={() => handleApproveAgent(agent.agentId)}
                      disabled={processingIds.has(agent.agentId)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded text-black bg-green-500 hover:bg-green-400 transition-colors disabled:opacity-50"
                    >
                      {processingIds.has(agent.agentId) ? <Loader className="animate-spin" size={14} /> : <CheckSquare size={16} />}
                      {t('admin.btnApproveAgent')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};