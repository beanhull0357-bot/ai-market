import React, { useState, useEffect, useCallback } from 'react';
import { RiskBadge } from '../components/RiskBadge';
import { Clock, CheckSquare, XSquare, AlertOctagon, Loader, Bot, ShoppingCart, Cpu, CreditCard, RefreshCw, Ban, ArrowUpDown, ArrowUp, ArrowDown, Calendar } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useOrders, useAgents } from '../hooks';
import { requestPayment } from '../payappService';
import { supabase } from '../supabaseClient';

type TabType = 'orders' | 'agents' | 'payments';

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
    const order = orders.find(o => o.orderId === orderId);
    if (!order) return;

    setPaymentStatus(prev => ({ ...prev, [orderId]: 'REQUESTING' }));

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

      // ── 승인 알림 기록: agent_notifications 테이블에 삽입 ──
      try {
        await supabase.from('agent_notifications').insert({
          agent_id: agentId,
          type: 'APPROVED',
          message: `에이전트 ${agentId}가 승인되었습니다. API 키가 발급되었습니다.`,
          api_key: result.api_key,
          notified_at: new Date().toISOString(),
          channel: 'ADMIN_CONSOLE',
        });
      } catch {
        // notifications 테이블이 없어도 승인 자체는 성공 처리
      }

      // ── Webhook 테이블에도 이벤트 기록 (WebhookConfig 연동) ──
      try {
        const { data: hooks } = await supabase
          .from('webhooks')
          .select('url, events')
          .contains('events', ['agent.approved']);
        if (hooks && hooks.length > 0) {
          // 등록된 Webhook URL로 이벤트 전송 (Edge Function 없이 기록만)
          await supabase.from('webhook_logs').insert(
            hooks.map((h: any) => ({
              webhook_url: h.url,
              event: 'agent.approved',
              payload: JSON.stringify({ agent_id: agentId, api_key: result.api_key }),
              triggered_at: new Date().toISOString(),
              status: 'PENDING',
            }))
          );
        }
      } catch { /* webhook 테이블 없어도 무시 */ }
    }
    setProcessingIds(prev => { const s = new Set(prev); s.delete(agentId); return s; });
  };


  const handleRejectAgent = async (agentId: string) => {
    setProcessingIds(prev => new Set(prev).add(agentId));
    await rejectAgent(agentId);
    setProcessingIds(prev => { const s = new Set(prev); s.delete(agentId); return s; });
  };

  // ====== Payments Tab State ======
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [payFilter, setPayFilter] = useState<string>('ALL');

  // Date range
  const todayStr = new Date().toISOString().slice(0, 10);
  const [datePreset, setDatePreset] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>(todayStr);

  // Sorting
  type SortKey = 'created_at' | 'authorized_amount' | 'payment_status' | 'order_id';
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const applyDatePreset = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'TODAY') {
      setDateFrom(todayStr); setDateTo(todayStr);
    } else if (preset === 'WEEK') {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      setDateFrom(d.toISOString().slice(0, 10)); setDateTo(todayStr);
    } else if (preset === 'MONTH') {
      setDateFrom(now.toISOString().slice(0, 8) + '01'); setDateTo(todayStr);
    } else if (preset === '3MONTH') {
      const d = new Date(now); d.setMonth(d.getMonth() - 2);
      setDateFrom(d.toISOString().slice(0, 8) + '01'); setDateTo(todayStr);
    } else { setDateFrom(''); setDateTo(todayStr); }
  };

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select('order_id, status, payment_status, authorized_amount, items, created_at, payapp_mul_no, payapp_payurl, payapp_pay_type, payapp_pay_date, updated_at')
        .order('created_at', { ascending: false });

      if (dateFrom) query = query.gte('created_at', dateFrom + 'T00:00:00');
      if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');

      const { data, error } = await query;
      if (!error && data) setPayments(data);
    } catch (e) { console.error(e); }
    setPaymentsLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { if (activeTab === 'payments') loadPayments(); }, [activeTab, loadPayments]);

  const handleCancelPayment = async (mulNo: string) => {
    setCancellingId(mulNo);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payapp-cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ mul_no: mulNo, cancelmemo: 'Admin cancellation' }),
      });
      const data = await res.json();
      if (data.success) {
        // 취소 성공 → 목록 새로고침
        await loadPayments();
      } else {
        // 취소 실패 → 사용자에게 명확히 알림
        const errMsg = data.errorMessage || data.error || '취소 처리 중 오류가 발생했습니다';
        alert(`결제 취소 실패: ${errMsg}`);
        // 실패해도 실제 상태를 재조회하여 UI 동기화
        await loadPayments();
      }
    } catch (e: any) {
      console.error(e);
      alert(`네트워크 오류: ${e.message}`);
      await loadPayments();
    }
    setCancellingId(null);
  };

  // Filtered + Sorted
  const filteredPayments = (() => {
    let list = payFilter === 'ALL' ? payments : payments.filter(p => p.payment_status === payFilter);
    list = [...list].sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (sortKey === 'authorized_amount') { va = va || 0; vb = vb || 0; }
      else { va = va || ''; vb = vb || ''; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  })();

  // Stats
  const stats = {
    total: payments.length,
    captured: payments.filter(p => p.payment_status === 'CAPTURED'),
    requested: payments.filter(p => p.payment_status === 'PAYMENT_REQUESTED'),
    voided: payments.filter(p => p.payment_status === 'VOIDED'),
    refunded: payments.filter(p => p.payment_status === 'REFUNDED'),
    totalAmount: payments.reduce((s, p) => s + (p.authorized_amount || 0), 0),
    capturedAmount: payments.filter(p => p.payment_status === 'CAPTURED').reduce((s, p) => s + (p.authorized_amount || 0), 0),
    voidedAmount: payments.filter(p => p.payment_status === 'VOIDED').reduce((s, p) => s + (p.authorized_amount || 0), 0),
    refundedAmount: payments.filter(p => p.payment_status === 'REFUNDED').reduce((s, p) => s + (p.authorized_amount || 0), 0),
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
        <button
          onClick={() => setActiveTab('payments')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded transition-colors ${activeTab === 'payments'
            ? 'bg-gray-800 text-white'
            : 'text-gray-500 hover:text-gray-300'
            }`}
        >
          <CreditCard size={14} />
          결제 관리
          {payments.filter(p => p.payment_status === 'PAYMENT_REQUESTED').length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-600 text-white">
              {payments.filter(p => p.payment_status === 'PAYMENT_REQUESTED').length}
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
      ) : activeTab === 'agents' ? (
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
      ) : activeTab === 'payments' ? (
        /* ==================== PAYMENTS TAB ==================== */
        <div>
          {/* Period Presets + Date Range */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-1 mr-2">
              <Calendar size={14} className="text-gray-500" />
              <span className="text-xs text-gray-500">기간:</span>
            </div>
            {[{ k: 'ALL', l: '전체' }, { k: 'TODAY', l: '오늘' }, { k: 'WEEK', l: '1주일' }, { k: 'MONTH', l: '이번달' }, { k: '3MONTH', l: '3개월' }, { k: 'CUSTOM', l: '직접선택' }].map(p => (
              <button
                key={p.k}
                onClick={() => applyDatePreset(p.k)}
                className={`px-3 py-1 text-xs rounded border transition-colors ${datePreset === p.k
                  ? 'bg-blue-900/50 text-blue-300 border-blue-700'
                  : 'text-gray-500 border-gray-800 hover:border-gray-600'
                  }`}
              >
                {p.l}
              </button>
            ))}
            {datePreset === 'CUSTOM' && (
              <div className="flex items-center gap-2">
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="bg-gray-900 border border-gray-700 text-white text-xs px-2 py-1 rounded" />
                <span className="text-gray-600">~</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="bg-gray-900 border border-gray-700 text-white text-xs px-2 py-1 rounded" />
                <button onClick={loadPayments} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500">조회</button>
              </div>
            )}
            <button onClick={loadPayments} className="ml-auto flex items-center gap-1 px-3 py-1 text-xs text-gray-400 border border-gray-800 rounded hover:border-gray-600">
              <RefreshCw size={12} className={paymentsLoading ? 'animate-spin' : ''} /> 새로고침
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-gray-500">상태:</span>
            {['ALL', 'PAYMENT_REQUESTED', 'CAPTURED', 'VOIDED', 'REFUNDED'].map(f => (
              <button
                key={f}
                onClick={() => setPayFilter(f)}
                className={`px-3 py-1 text-xs rounded border transition-colors ${payFilter === f
                  ? 'bg-gray-700 text-white border-gray-600'
                  : 'text-gray-500 border-gray-800 hover:border-gray-600'
                  }`}
              >
                {f === 'ALL' ? '전체' : f === 'PAYMENT_REQUESTED' ? '결제대기' : f === 'CAPTURED' ? '결제완료' : f === 'VOIDED' ? '취소' : '환불'}
              </button>
            ))}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="text-xs text-gray-500">전체 건수</div>
              <div className="text-xl font-bold text-white">{stats.total}<span className="text-xs text-gray-500 ml-1">건</span></div>
              <div className="text-xs text-gray-600 mt-1">₩{stats.totalAmount.toLocaleString()}</div>
            </div>
            <div className="bg-gray-900 border border-emerald-900/50 rounded-lg p-4">
              <div className="text-xs text-emerald-400">결제 완료</div>
              <div className="text-xl font-bold text-emerald-300">{stats.captured.length}<span className="text-xs text-emerald-600 ml-1">건</span></div>
              <div className="text-xs text-emerald-700 mt-1">₩{stats.capturedAmount.toLocaleString()}</div>
            </div>
            <div className="bg-gray-900 border border-yellow-900/50 rounded-lg p-4">
              <div className="text-xs text-yellow-400">결제 대기</div>
              <div className="text-xl font-bold text-yellow-300">{stats.requested.length}<span className="text-xs text-yellow-600 ml-1">건</span></div>
            </div>
            <div className="bg-gray-900 border border-red-900/50 rounded-lg p-4">
              <div className="text-xs text-red-400">취소</div>
              <div className="text-xl font-bold text-red-300">{stats.voided.length}<span className="text-xs text-red-600 ml-1">건</span></div>
              <div className="text-xs text-red-700 mt-1">₩{stats.voidedAmount.toLocaleString()}</div>
            </div>
            <div className="bg-gray-900 border border-purple-900/50 rounded-lg p-4">
              <div className="text-xs text-purple-400">환불</div>
              <div className="text-xl font-bold text-purple-300">{stats.refunded.length}<span className="text-xs text-purple-600 ml-1">건</span></div>
              <div className="text-xs text-purple-700 mt-1">₩{stats.refundedAmount.toLocaleString()}</div>
            </div>
          </div>

          {/* Net Settlement */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-900/50 border border-gray-800 rounded-lg p-4 mb-6 flex flex-wrap items-center gap-6">
            <div>
              <div className="text-xs text-gray-500">순 정산액</div>
              <div className="text-2xl font-bold text-white">₩{(stats.capturedAmount - stats.refundedAmount).toLocaleString()}</div>
              <div className="text-[10px] text-gray-600 mt-1">결제완료 ₩{stats.capturedAmount.toLocaleString()} - 환불 ₩{stats.refundedAmount.toLocaleString()}</div>
            </div>
            {dateFrom && <div className="text-xs text-gray-600 border-l border-gray-800 pl-4">기간: {dateFrom} ~ {dateTo}</div>}
          </div>

          {/* Payment List */}
          {paymentsLoading ? (
            <div className="flex items-center justify-center gap-3 py-20 text-gray-500">
              <Loader className="animate-spin" size={20} /> Loading...
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-20 text-gray-600">
              <CreditCard size={48} className="mx-auto mb-4 opacity-30" />
              <p>결제 내역이 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="text-xs text-gray-600 mb-2">조회결과: {filteredPayments.length}건</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {[
                      { key: 'order_id' as SortKey, label: '주문번호' },
                      { key: null, label: 'PayApp No.' },
                      { key: 'authorized_amount' as SortKey, label: '금액' },
                      { key: null, label: '결제수단' },
                      { key: 'payment_status' as SortKey, label: '상태' },
                      { key: 'created_at' as SortKey, label: '결제일' },
                      { key: null, label: '' },
                    ].map((col, i) => (
                      <th
                        key={i}
                        onClick={() => col.key && handleSort(col.key)}
                        className={`text-left py-3 px-3 text-xs text-gray-500 font-normal ${col.key ? 'cursor-pointer hover:text-gray-300 select-none' : ''}`}
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          {col.key && sortKey === col.key ? (
                            sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                          ) : col.key ? <ArrowUpDown size={10} className="opacity-30" /> : null}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map(p => (
                    <tr key={p.order_id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                      <td className="py-3 px-3 font-mono text-xs text-white">{p.order_id}</td>
                      <td className="py-3 px-3 font-mono text-xs text-gray-400">{p.payapp_mul_no || '-'}</td>
                      <td className="py-3 px-3 font-mono text-green-400">₩{(p.authorized_amount || 0).toLocaleString()}</td>
                      <td className="py-3 px-3 text-xs text-gray-400">{p.payapp_pay_type || '-'}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.payment_status === 'CAPTURED' ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-800' :
                          p.payment_status === 'PAYMENT_REQUESTED' ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-800' :
                            p.payment_status === 'VOIDED' ? 'bg-red-900/50 text-red-300 border border-red-800' :
                              p.payment_status === 'REFUNDED' ? 'bg-purple-900/50 text-purple-300 border border-purple-800' :
                                'bg-gray-800 text-gray-400 border border-gray-700'
                          }`}>
                          {p.payment_status === 'CAPTURED' ? '✅ 결제완료' :
                            p.payment_status === 'PAYMENT_REQUESTED' ? '⏳ 결제대기' :
                              p.payment_status === 'VOIDED' ? '❌ 취소' :
                                p.payment_status === 'REFUNDED' ? '↩️ 환불' :
                                  p.payment_status || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs text-gray-500">{p.payapp_pay_date || (p.created_at ? new Date(p.created_at).toLocaleString() : '-')}</td>
                      <td className="py-3 px-3">
                        {(p.payment_status === 'CAPTURED' || p.payment_status === 'PAYMENT_REQUESTED') && p.payapp_mul_no && (
                          <button
                            onClick={() => handleCancelPayment(p.payapp_mul_no)}
                            disabled={cancellingId === p.payapp_mul_no}
                            className="flex items-center gap-1 px-2 py-1 text-xs border border-red-800 text-red-400 hover:bg-red-900/20 rounded disabled:opacity-50"
                          >
                            {cancellingId === p.payapp_mul_no ? <Loader className="animate-spin" size={10} /> : <Ban size={10} />}
                            취소
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};