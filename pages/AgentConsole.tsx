import React, { useState, useEffect, useRef } from 'react';
import { Play, Loader, CheckCircle, AlertTriangle, FileText, PackageCheck, Star, RefreshCcw, Terminal } from 'lucide-react';
import { CodeBlock } from '../components/CodeBlock';
import { AgentPolicy, AgentReview } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useProducts, useReviews, useOrders } from '../hooks';

export const AgentConsole: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [stage, setStage] = useState<'IDLE' | 'THINKING' | 'FETCHING' | 'DECIDING' | 'ORDERING' | 'DONE' | 'REVIEWING' | 'REVIEW_DONE'>('IDLE');
  const [resultOrder, setResultOrder] = useState<any>(null);
  const [resultReview, setResultReview] = useState<any>(null);
  const [simulateDefect, setSimulateDefect] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  const { products } = useProducts();
  const { reviews, addReview } = useReviews();
  const { createOrder } = useOrders();

  const defaultPolicy: AgentPolicy = {
    policyId: "POL-USER-001",
    maxBudget: 20000,
    allowedCategories: ["CONSUMABLES"],
    maxDeliveryDays: 3,
    minSellerTrust: 80
  };

  const [policyInput, setPolicyInput] = useState(JSON.stringify(defaultPolicy, null, 2));

  const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${msg}`]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const runAgent = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setLogs([]);
    setResultOrder(null);
    setResultReview(null);
    setStage('THINKING');

    try {
      const policy = JSON.parse(policyInput);

      addLog("Initializing Agent...");
      await new Promise(r => setTimeout(r, 800));
      addLog(`Loaded Policy: ${policy.policyId}`);
      addLog(`Constraints: Budget < ${policy.maxBudget}, ETA < ${policy.maxDeliveryDays} days`);

      setStage('FETCHING');
      addLog("GET /catalog?category=CONSUMABLES (Supabase)...");
      await new Promise(r => setTimeout(r, 1200));
      addLog(`Received ${products.length} candidates from database.`);

      setStage('DECIDING');
      addLog("Evaluating candidates against constraints...");

      // Find best candidate from Supabase products
      const candidates = products.filter(p =>
        policy.allowedCategories.includes(p.category)
      );

      const candidate = candidates[0];
      await new Promise(r => setTimeout(r, 1000));

      if (!candidate) {
        addLog("ERROR: No candidates match policy constraints.");
        setStage('DONE');
        setIsRunning(false);
        return;
      }

      // Check reviews from Supabase
      const peerReviews = reviews.filter(r => r.targetSku === candidate.sku);
      const endorsedCount = peerReviews.filter(r => r.verdict === 'ENDORSE').length;
      const blockCount = peerReviews.filter(r => r.verdict === 'BLOCKLIST').length;

      addLog(`> Analyzing peer reviews for ${candidate.sku}...`);
      await new Promise(r => setTimeout(r, 500));

      if (blockCount > 0) {
        addLog(`WARN: Found ${blockCount} BLOCKLIST verdicts from peer agents.`);
        addLog(`RISK: Peer consensus indicates critical defects.`);
      } else {
        addLog(`INFO: ${endorsedCount} ENDORSE verdicts found. Trust Signal Verified.`);
      }

      const isPriceOk = candidate.offer.price <= policy.maxBudget;
      const isEtaOk = candidate.offer.etaDays <= policy.maxDeliveryDays;
      const isTrustOk = blockCount === 0;

      if (isPriceOk && isEtaOk && isTrustOk) {
        addLog(`Match Found: ${candidate.sku}`);
        addLog(`Score: ${candidate.qualitySignals.aiReadinessScore} | Price: ${candidate.offer.price}`);
        addLog(`Reason: stock.in_stock, policy.return_ok, peer.trust_verified`);

        setStage('ORDERING');
        addLog("Generating Order Intent...");
        await new Promise(r => setTimeout(r, 1000));
        addLog("POST /orders (Supabase)");
        addLog("Payment Authorization: HOLD (24h)");

        const orderId = "ORD-" + Date.now().toString(36).toUpperCase();
        const captureDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const orderData = {
          orderId,
          status: "PROCUREMENT_PENDING",
          items: [{ sku: candidate.sku, qty: 1, reasonCodes: ["stock.in_stock", "elig.within_budget"] }],
          paymentStatus: "AUTHORIZED",
          authorizedAmount: candidate.offer.price,
          captureDeadline,
          risks: { stock: "GREEN", price: "GREEN", policy: "GREEN", consent: "GREEN", timeLeft: "GREEN" },
          thirdPartySharing: true,
          decisionTrace: {
            policyId: policy.policyId,
            candidatesEvaluated: candidates.length,
            selectedSku: candidate.sku,
            reasonCodes: ["stock.in_stock", "elig.within_budget", "peer.trust_verified"]
          }
        };

        // Save to Supabase
        const success = await createOrder(orderData);

        const orderMock = {
          orderId,
          status: "PROCUREMENT_PENDING",
          sku: candidate.sku,
          amount: candidate.offer.price,
          paymentStatus: "AUTHORIZED",
          captureDeadline,
          savedToDb: success
        };

        setResultOrder(orderMock);
        setStage('DONE');
        addLog(success ? "SUCCESS: Order saved to Supabase & placed in queue." : "WARN: Order created but DB save failed.");
      } else {
        addLog("DECISION: REJECTED");
        if (!isPriceOk) addLog(`Reason: Price ${candidate.offer.price} > Budget`);
        if (!isEtaOk) addLog(`Reason: ETA ${candidate.offer.etaDays} > Limit`);
        if (!isTrustOk) addLog(`Reason: BLOCKLISTED by peer agent review.`);
        setStage('DONE');
      }

    } catch (e) {
      addLog("ERROR: Invalid Policy JSON");
      setStage('IDLE');
    }
    setIsRunning(false);
  };

  const runReviewGeneration = async () => {
    if (!resultOrder) return;
    setStage('REVIEWING');

    addLog("--- SIMULATION: 48 HOURS LATER ---");
    addLog("Event: Package Delivered (Tracking #DK-9921)");
    await new Promise(r => setTimeout(r, 800));

    addLog("Action: Verifying Specs...");
    await new Promise(r => setTimeout(r, 600));

    if (simulateDefect) {
      addLog("MEASURE: Weight = 10.2kg (Expected: 13.5kg)");
      addLog("MEASURE: Critical deviation detected (-24%)");
    } else {
      addLog("MEASURE: Weight = 13.5kg (Expected: 13.5kg)");
      addLog("MEASURE: API Latency = 120ms (Threshold: 500ms)");
    }

    addLog("Generating Protocol Review JSON...");
    await new Promise(r => setTimeout(r, 800));

    const reviewData: AgentReview = {
      reviewId: "REV-" + Date.now().toString(36).toUpperCase(),
      targetSku: resultOrder.sku,
      reviewerAgentId: "THIS-SESSION-AGENT",
      timestamp: new Date().toISOString(),
      metrics: {
        fulfillmentDelta: simulateDefect ? 48 : 0,
        specCompliance: simulateDefect ? 0.75 : 1.0,
        apiLatencyMs: simulateDefect ? 2500 : 120
      },
      verdict: simulateDefect ? "BLOCKLIST" : "ENDORSE",
      structuredLog: simulateDefect ? [
        { event: "WEIGHT_CHECK", level: "ERROR", details: "Weight mismatch 10.2kg vs 13.5kg" },
        { event: "POLICY_EVAL", level: "ERROR", details: "Violation of spec tolerance." }
      ] : [
        { event: "WEIGHT_CHECK", level: "INFO", details: "Measured 13.5kg. Matches spec." },
        { event: "ETA_CHECK", level: "INFO", details: "On time delivery." }
      ]
    };

    addLog(`POST /reviews/protocol (Supabase)`);
    addLog(`Broadcasting verdict: ${reviewData.verdict} to Agent Network...`);

    // Save review to Supabase
    const success = await addReview(reviewData);

    setResultReview(reviewData);
    setStage('REVIEW_DONE');
    addLog(success ? "SUCCESS: Review saved to Supabase. Influence active." : "WARN: Review generated but DB save failed.");
  }

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text font-mono flex flex-col md:flex-row">
      {/* Left Panel: Controls */}
      <div className="w-full md:w-1/3 border-r border-gray-800 p-6 flex flex-col">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Terminal size={20} /> {t('console.title')}
        </h2>

        <div className="mb-4">
          <label className="text-xs text-gray-500 uppercase block mb-2">{t('console.labelPolicy')}</label>
          <textarea
            className="w-full h-64 bg-gray-900 border border-gray-700 rounded p-4 text-xs font-mono text-green-400 focus:outline-none focus:border-green-500"
            value={policyInput}
            onChange={(e) => setPolicyInput(e.target.value)}
          />
        </div>

        <div className="mb-4 flex items-center gap-2 p-3 bg-red-900/10 border border-red-900/30 rounded">
          <input
            type="checkbox"
            id="defect-sim"
            checked={simulateDefect}
            onChange={(e) => setSimulateDefect(e.target.checked)}
            className="w-4 h-4 accent-red-500 bg-gray-900 border-gray-700 rounded focus:ring-red-500"
          />
          <label htmlFor="defect-sim" className="text-xs text-red-400 font-bold select-none cursor-pointer">
            {t('console.simulateDefect')}
          </label>
        </div>

        <button
          onClick={runAgent}
          disabled={isRunning || stage === 'REVIEWING'}
          className={`w-full py-4 font-bold flex items-center justify-center gap-2 transition-all mb-4
            ${(isRunning || stage === 'REVIEWING') ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-terminal-blue text-black hover:bg-blue-400'}
          `}
        >
          {isRunning ? <Loader className="animate-spin" size={18} /> : <Play size={18} />}
          {isRunning ? t('console.btnWorking') : t('console.btnRun')}
        </button>

        <div className="p-4 bg-gray-900/50 rounded border border-gray-800">
          <h3 className="text-sm font-bold text-white mb-2">{t('console.capabilityTitle')}</h3>
          <ul className="text-xs text-gray-500 space-y-2">
            <li>• {t('console.cap1')}</li>
            <li>• {t('console.cap2')}</li>
            <li>• {t('console.cap3')}</li>
            <li>• {t('console.cap4')}</li>
          </ul>
        </div>
      </div>

      {/* Right Panel: Output */}
      <div className="w-full md:w-2/3 p-6 bg-black flex flex-col">
        <div className="flex-1 overflow-y-auto mb-4 font-mono text-sm space-y-1">
          {logs.length === 0 && (
            <div className="text-gray-700 mt-20 text-center">
              {t('console.waiting')}
            </div>
          )}
          {logs.map((log, i) => (
            <div key={i} className="break-all border-l-2 border-transparent hover:border-gray-700 pl-2">
              <span className="text-gray-600 mr-2">{log.substring(0, 11)}</span>
              <span className={log.includes("ERROR") || log.includes("WARN") || log.includes("REJECTED") ? "text-red-500" : "text-terminal-text"}>
                {log.substring(11)}
              </span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>

        {/* Result Area */}
        <div className="space-y-4">
          {resultOrder && (
            <div className="border-t border-gray-800 pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-500 font-bold flex items-center gap-2">
                  <CheckCircle size={16} /> {t('console.orderCreated')}
                </span>
                <span className="text-xs text-gray-500">{t('console.timerStarted')}</span>
              </div>
              <CodeBlock data={resultOrder} className="max-h-32 overflow-y-auto" />

              <div className="flex justify-between items-center mt-2">
                <a href="#/receipt" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                  <FileText size={12} /> {t('console.viewReceipt')}
                </a>

                {stage === 'DONE' && (
                  <button
                    onClick={runReviewGeneration}
                    className="flex items-center gap-2 px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-600 transition-colors"
                  >
                    <PackageCheck size={14} />
                    {t('console.btnSimulateReview')}
                  </button>
                )}
              </div>
            </div>
          )}

          {resultReview && (
            <div className="border-t border-gray-800 pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`${simulateDefect ? 'text-red-500' : 'text-purple-400'} font-bold flex items-center gap-2`}>
                  {simulateDefect ? <AlertTriangle size={16} /> : <Star size={16} />}
                  {t('console.reviewGenerated')}
                </span>
                {simulateDefect && <span className="text-xs text-red-500 uppercase font-bold">[Blocklist Active]</span>}
              </div>
              <CodeBlock data={resultReview} className="max-h-32 overflow-y-auto" />

              <div className="mt-2 text-center">
                <button
                  onClick={() => {
                    setResultOrder(null);
                    setResultReview(null);
                    setLogs([]);
                    setStage('IDLE');
                  }}
                  className="text-xs text-gray-500 hover:text-white flex items-center justify-center gap-1 w-full"
                >
                  <RefreshCcw size={10} /> Reset for Next Run
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};