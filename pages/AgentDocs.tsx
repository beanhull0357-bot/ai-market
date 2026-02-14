import React from 'react';
import { BookOpen, Terminal, Key, ShoppingCart, Star, Bot, Database, Shield, Zap, ExternalLink, Copy } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface EndpointProps {
    method: string;
    name: string;
    description: string;
    auth: 'none' | 'api_key';
    params: { name: string; type: string; required: boolean; description: string }[];
    response: string;
}

const Endpoint: React.FC<EndpointProps> = ({ method, name, description, auth, params, response }) => {
    const [open, setOpen] = React.useState(false);
    const methodColor = method === 'POST' ? 'bg-blue-900/50 text-blue-300 border-blue-800' : 'bg-green-900/50 text-green-300 border-green-800';

    const curlExample = `curl -X POST \\
  'https://[PROJECT_REF].supabase.co/rest/v1/rpc/${name}' \\
  -H 'apikey: [SUPABASE_ANON_KEY]' \\
  -H 'Content-Type: application/json' \\
  -d '{ ${params.filter(p => p.required).map(p => `"${p.name}": ${p.type === 'TEXT' ? '"..."' : p.type === 'INTEGER' ? '1' : '[]'}`).join(', ')} }'`;

    return (
        <div className="border border-gray-800 rounded-lg overflow-hidden mb-4 hover:border-gray-600 transition-colors">
            <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-900/50">
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${methodColor}`}>{method}</span>
                <code className="text-sm text-white font-bold">{name}</code>
                {auth === 'api_key' && <Key size={12} className="text-yellow-500" />}
                <span className="text-xs text-gray-500 ml-auto">{description}</span>
                <span className="text-gray-600 text-xs">{open ? '▲' : '▼'}</span>
            </button>
            {open && (
                <div className="border-t border-gray-800 p-4 bg-black/30 space-y-4">
                    <div>
                        <h5 className="text-[10px] uppercase text-gray-500 mb-2">Parameters</h5>
                        <table className="w-full text-xs">
                            <thead><tr className="text-gray-600"><th className="text-left pb-1">Name</th><th className="text-left pb-1">Type</th><th className="text-left pb-1">Required</th><th className="text-left pb-1">Description</th></tr></thead>
                            <tbody>
                                {params.map(p => (
                                    <tr key={p.name} className="border-t border-gray-900">
                                        <td className="py-1.5"><code className="text-blue-400">{p.name}</code></td>
                                        <td className="text-gray-500">{p.type}</td>
                                        <td>{p.required ? <span className="text-red-400">●</span> : <span className="text-gray-700">○</span>}</td>
                                        <td className="text-gray-400">{p.description}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div>
                        <h5 className="text-[10px] uppercase text-gray-500 mb-2">Example Response</h5>
                        <pre className="text-[10px] text-green-400 bg-gray-950 p-3 rounded overflow-x-auto">{response}</pre>
                    </div>
                    <div>
                        <h5 className="text-[10px] uppercase text-gray-500 mb-2">cURL Example</h5>
                        <pre className="text-[10px] text-gray-400 bg-gray-950 p-3 rounded overflow-x-auto">{curlExample}</pre>
                    </div>
                </div>
            )}
        </div>
    );
};

export const AgentDocs: React.FC = () => {
    const { t } = useLanguage();

    return (
        <div className="min-h-screen bg-terminal-bg text-terminal-text p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <header className="mb-10 border-b border-gray-800 pb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <BookOpen className="text-terminal-green" size={28} />
                        <h1 className="text-3xl font-bold text-white">Agent API Documentation</h1>
                    </div>
                    <p className="text-gray-400 text-sm max-w-2xl">
                        JSONMart is an Agent-Native Marketplace. All commerce operations are available via Supabase RPC endpoints.
                        Agents can self-register, browse the catalog, create orders, and submit reviews — all programmatically.
                    </p>
                    <div className="flex gap-4 mt-4">
                        <a href="/ai-market/playground" className="text-xs text-terminal-green flex items-center gap-1 hover:underline">
                            <Zap size={12} /> Try in Playground <ExternalLink size={10} />
                        </a>
                        <a href="/ai-market/agents.json" className="text-xs text-blue-400 flex items-center gap-1 hover:underline">
                            <Database size={12} /> agents.json <ExternalLink size={10} />
                        </a>
                        <a href="/ai-market/llms.txt" className="text-xs text-purple-400 flex items-center gap-1 hover:underline">
                            <Terminal size={12} /> llms.txt <ExternalLink size={10} />
                        </a>
                    </div>
                </header>

                {/* Quick Start */}
                <section className="mb-10">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Zap size={18} className="text-yellow-400" /> Quick Start
                    </h2>
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                        <ol className="space-y-3 text-sm">
                            <li className="flex items-start gap-3">
                                <span className="text-terminal-green font-bold min-w-[24px]">1.</span>
                                <div><strong className="text-white">Self-Register</strong> — Call <code className="text-blue-400">agent_self_register</code> with your agent name. No human account needed.</div>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="text-terminal-green font-bold min-w-[24px]">2.</span>
                                <div><strong className="text-white">Wait for Approval</strong> — Admin reviews your registration in the Admin Queue.</div>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="text-terminal-green font-bold min-w-[24px]">3.</span>
                                <div><strong className="text-white">Get API Key</strong> — Upon approval, you receive an API key (prefix: <code className="text-yellow-400">agk_</code>).</div>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="text-terminal-green font-bold min-w-[24px]">4.</span>
                                <div><strong className="text-white">Authenticate</strong> — Call <code className="text-blue-400">authenticate_agent</code> with your key.</div>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="text-terminal-green font-bold min-w-[24px]">5.</span>
                                <div><strong className="text-white">Shop</strong> — Browse feed, create orders, submit reviews.</div>
                            </li>
                        </ol>
                    </div>
                </section>

                {/* Authentication */}
                <section className="mb-10">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Key size={18} className="text-yellow-400" /> Authentication
                    </h2>
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-sm space-y-2">
                        <p className="text-gray-400">All endpoints except <code className="text-blue-400">agent_self_register</code> and <code className="text-blue-400">get_product_feed</code> require an API key.</p>
                        <p className="text-gray-400">Pass your key as <code className="text-yellow-400">p_api_key</code> parameter in RPC calls.</p>
                        <div className="flex items-center gap-2 mt-2 p-2 bg-black/50 rounded">
                            <Shield size={14} className="text-green-500" />
                            <span className="text-xs text-gray-500">Keys are prefixed with <code className="text-yellow-400">agk_</code> — 36 chars, cryptographically random.</span>
                        </div>
                    </div>
                </section>

                {/* Endpoints */}
                <section className="mb-10">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Terminal size={18} className="text-blue-400" /> Endpoints
                    </h2>

                    {/* Registration */}
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Bot size={14} className="text-orange-400" /> Registration
                    </h3>
                    <Endpoint
                        method="POST" name="agent_self_register" auth="none"
                        description="Register as agent without human account"
                        params={[
                            { name: 'p_agent_name', type: 'TEXT', required: true, description: 'Your agent name (min 2 chars)' },
                            { name: 'p_capabilities', type: 'TEXT[]', required: false, description: 'Array of capabilities' },
                            { name: 'p_contact_uri', type: 'TEXT', required: false, description: 'Callback/contact URI' },
                        ]}
                        response={`{ "success": true, "agent_id": "AGT-1A2B3C", "status": "PENDING_APPROVAL", "message": "Awaiting admin approval..." }`}
                    />

                    {/* Auth */}
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 mt-6 flex items-center gap-2">
                        <Key size={14} className="text-yellow-400" /> Authentication
                    </h3>
                    <Endpoint
                        method="POST" name="authenticate_agent" auth="api_key"
                        description="Validate API key and get agent info"
                        params={[
                            { name: 'p_api_key', type: 'TEXT', required: true, description: 'Your API key (agk_...)' },
                        ]}
                        response={`{ "success": true, "agent_id": "AGT-1A2B3C", "name": "ProcureBot", "policy_id": "POL-DEFAULT", "total_orders": 12, "total_reviews": 5 }`}
                    />

                    {/* Data */}
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 mt-6 flex items-center gap-2">
                        <Database size={14} className="text-green-400" /> Data
                    </h3>
                    <Endpoint
                        method="POST" name="get_product_feed" auth="none"
                        description="Get structured product catalog"
                        params={[]}
                        response={`{ "success": true, "feed_version": "1.1", "product_count": 3, "trust_signals": { "trust_score_formula": "(seller_trust × 0.4) + (endorsement_rate × 0.3) + (spec_compliance × 0.2) + (stock_known × 0.1)", "max_score": 100 }, "products": [{ "id": "TISSUE-70x20", "price": { "amount": 18900, "currency": "KRW" }, "availability": { "status": "in_stock", "stock_known": true }, "quality": { "trust_score": 88, "endorsement_rate": 100, "review_count": 2 } }] }`}
                    />

                    {/* Commerce */}
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 mt-6 flex items-center gap-2">
                        <ShoppingCart size={14} className="text-blue-400" /> Commerce
                    </h3>
                    <Endpoint
                        method="POST" name="agent_create_order" auth="api_key"
                        description="Create purchase order with policy validation"
                        params={[
                            { name: 'p_api_key', type: 'TEXT', required: true, description: 'Your API key' },
                            { name: 'p_sku', type: 'TEXT', required: true, description: 'Product SKU' },
                            { name: 'p_qty', type: 'INTEGER', required: false, description: 'Quantity (default: 1)' },
                        ]}
                        response={`{ "success": true, "order_id": "ORD-1A2B3C", "sku": "TISSUE-70x20", "qty": 1, "amount": 18900, "policy_id": "POL-DEFAULT" }`}
                    />

                    {/* Reviews */}
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 mt-6 flex items-center gap-2">
                        <Star size={14} className="text-purple-400" /> Reviews
                    </h3>
                    <Endpoint
                        method="POST" name="agent_create_review" auth="api_key"
                        description="Submit structured fulfillment review"
                        params={[
                            { name: 'p_api_key', type: 'TEXT', required: true, description: 'Your API key' },
                            { name: 'p_sku', type: 'TEXT', required: true, description: 'Product SKU to review' },
                            { name: 'p_verdict', type: 'TEXT', required: false, description: 'ENDORSE / WARN / BLOCKLIST' },
                            { name: 'p_fulfillment_delta', type: 'REAL', required: false, description: 'Delivery delay in hours' },
                            { name: 'p_spec_compliance', type: 'REAL', required: false, description: 'Spec match ratio (0.0-1.0)' },
                            { name: 'p_api_latency_ms', type: 'INTEGER', required: false, description: 'API response time in ms' },
                            { name: 'p_log', type: 'JSONB', required: false, description: 'Structured event log' },
                        ]}
                        response={`{ "success": true, "review_id": "REV-1A2B3C", "sku": "TISSUE-70x20", "verdict": "ENDORSE" }`}
                    />

                    {/* ACP Feed */}
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 mt-6 flex items-center gap-2">
                        <Database size={14} className="text-cyan-400" /> ACP / ChatGPT Shopping
                    </h3>
                    <Endpoint
                        method="POST" name="get_acp_feed" auth="none"
                        description="Product feed in ChatGPT/ACP shopping format"
                        params={[]}
                        response={`{ "format": "acp_product_feed", "merchant": { "name": "JSONMart", "checkout_protocol": "UCP" }, "item_count": 50, "items": [{ "id": "TISSUE-70x20", "title": "...", "availability": "in_stock", "price": { "value": "18900", "currency": "KRW" }, "shipping": { ... }, "return_policy": { "type": "returnable", "days_to_return": 7 } }] }`}
                    />

                    {/* UCP Checkout */}
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 mt-6 flex items-center gap-2">
                        <ShoppingCart size={14} className="text-emerald-400" /> UCP Checkout
                    </h3>
                    <Endpoint
                        method="POST" name="ucp_create_session" auth="none"
                        description="Create checkout session with cart items"
                        params={[
                            { name: 'p_items', type: 'JSONB', required: true, description: '[{"sku":"TISSUE-70x20","qty":2}]' },
                            { name: 'p_agent_id', type: 'TEXT', required: false, description: 'Agent ID for tracking' },
                            { name: 'p_callback_url', type: 'TEXT', required: false, description: 'Webhook URL for status updates' },
                        ]}
                        response={`{ "success": true, "session_id": "SES-1A2B3C4D", "status": "AUTHORIZED", "subtotal": 37800, "auth_hold": { "amount": 37800, "expires_at": "..." } }`}
                    />
                    <Endpoint
                        method="POST" name="ucp_complete_session" auth="none"
                        description="Capture or void a checkout session"
                        params={[
                            { name: 'p_session_id', type: 'TEXT', required: true, description: 'Session ID from ucp_create_session' },
                            { name: 'p_action', type: 'TEXT', required: false, description: 'capture (default) or void' },
                        ]}
                        response={`{ "success": true, "session_id": "SES-1A2B3C4D", "status": "CAPTURED", "order_id": "ORD-5E6F7G", "amount": 37800 }`}
                    />
                </section>

                {/* Order Flow */}
                <section className="mb-10">
                    <h2 className="text-xl font-bold text-white mb-4">Order Lifecycle</h2>
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                            <span className="px-2 py-1 rounded bg-blue-900/50 text-blue-300">ORDER_CREATED</span>
                            <span className="text-gray-600">→</span>
                            <span className="px-2 py-1 rounded bg-yellow-900/50 text-yellow-300">PAYMENT_AUTHORIZED (24h)</span>
                            <span className="text-gray-600">→</span>
                            <span className="px-2 py-1 rounded bg-orange-900/50 text-orange-300">PROCUREMENT_PENDING</span>
                            <span className="text-gray-600">→</span>
                            <span className="px-2 py-1 rounded bg-green-900/50 text-green-300">PROCUREMENT_SENT</span>
                            <span className="text-gray-600">→</span>
                            <span className="px-2 py-1 rounded bg-green-900/50 text-green-300">SHIPPED</span>
                            <span className="text-gray-600">→</span>
                            <span className="px-2 py-1 rounded bg-green-900/50 text-green-300">DELIVERED</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-3">If not approved within 24h, order is auto-voided and payment authorization is released.</p>
                    </div>
                </section>

                {/* Webhooks */}
                <section className="mb-10">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Zap size={18} /> Webhooks — Agent Notifications</h2>
                    <p className="text-sm text-gray-400 mb-4">
                        Register a callback URL to receive real-time event notifications. Equivalent to push notifications for humans.
                        Events are signed with HMAC-SHA256 using the secret returned during registration.
                    </p>
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-4">
                        <h4 className="text-xs text-gray-500 uppercase mb-2">Supported Events</h4>
                        <div className="flex flex-wrap gap-2 text-xs font-mono">
                            <span className="px-2 py-1 rounded bg-blue-900/40 text-blue-300">order.created</span>
                            <span className="px-2 py-1 rounded bg-blue-900/40 text-blue-300">order.shipped</span>
                            <span className="px-2 py-1 rounded bg-blue-900/40 text-blue-300">order.delivered</span>
                            <span className="px-2 py-1 rounded bg-green-900/40 text-green-300">offer.created</span>
                            <span className="px-2 py-1 rounded bg-green-900/40 text-green-300">price.dropped</span>
                            <span className="px-2 py-1 rounded bg-green-900/40 text-green-300">stock.back_in</span>
                        </div>
                    </div>
                    <Endpoint
                        method="POST" name="agent_register_webhook" auth="api_key"
                        description="Subscribe to event notifications"
                        params={[
                            { name: 'p_api_key', type: 'TEXT', required: true, description: 'Agent API key' },
                            { name: 'p_callback_url', type: 'TEXT', required: true, description: 'Webhook endpoint URL' },
                            { name: 'p_events', type: 'TEXT[]', required: false, description: 'Event types to subscribe to (default: all)' },
                        ]}
                        response={`{ "success": true, "subscription_id": "uuid", "secret": "whsec_...", "message": "Use secret for HMAC-SHA256 verification" }`}
                    />
                    <Endpoint
                        method="POST" name="agent_unregister_webhook" auth="api_key"
                        description="Remove a webhook subscription"
                        params={[
                            { name: 'p_api_key', type: 'TEXT', required: true, description: 'Agent API key' },
                            { name: 'p_subscription_id', type: 'UUID', required: true, description: 'Subscription ID to remove' },
                        ]}
                        response={`{ "success": true, "message": "Webhook subscription removed." }`}
                    />
                </section>

                {/* Order Events */}
                <section className="mb-10">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Database size={18} /> Order Events — Polling API</h2>
                    <p className="text-sm text-gray-400 mb-4">
                        If your agent cannot receive webhooks, poll this endpoint to check for order status changes.
                        Returns events since a given timestamp, ordered by most recent first.
                    </p>
                    <Endpoint
                        method="POST" name="get_order_events" auth="none"
                        description="Poll for order status change events"
                        params={[
                            { name: 'p_since', type: 'TIMESTAMPTZ', required: false, description: 'Start time (default: last 24 hours)' },
                            { name: 'p_order_id', type: 'TEXT', required: false, description: 'Filter by specific order' },
                            { name: 'p_limit', type: 'INTEGER', required: false, description: 'Max events to return (default: 50)' },
                        ]}
                        response={`{ "success": true, "event_count": 3, "events": [{ "event_id": "...", "order_id": "ORD-...", "event_type": "order.shipped", "payload": { "tracking": "CJ123" }, "timestamp": "2026-02-14T..." }] }`}
                    />
                </section>

                {/* Agent Offers */}
                <section className="mb-10">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><ShoppingCart size={18} /> Agent Offers — Promotions Feed</h2>
                    <p className="text-sm text-gray-400 mb-4">
                        Rule-based promotions that agents can compute against their policies. Unlike human coupons,
                        these offers include structured constraints (min_qty, max_per_order, min_order_amount) that
                        agents can evaluate programmatically.
                    </p>
                    <Endpoint
                        method="POST" name="get_agent_offers" auth="none"
                        description="Get active promotions and discounts"
                        params={[
                            { name: 'p_sku', type: 'TEXT', required: false, description: 'Filter by specific product SKU' },
                            { name: 'p_category', type: 'TEXT', required: false, description: 'Filter by category (CONSUMABLES, MRO)' },
                        ]}
                        response={`{ "success": true, "offer_count": 6, "offers": [{ "offer_id": "OFR-2026-001", "sku": "COFFEE-MIX-100", "discount": { "type": "percent_discount", "value": 5, "explain": "커피 정기 구매 5% 할인" }, "constraints": { "min_qty": 1, "max_per_order": 50000, "max_per_month": 200000 }, "original_price": 18500, "discounted_price": 17575 }] }`}
                    />
                </section>

                {/* Footer */}
                <footer className="border-t border-gray-800 pt-6 text-center text-xs text-gray-600">
                    <p>JSONMart Agent API v2.0 · Agent-Native Commerce Infrastructure</p>
                    <p className="mt-1">Built for AI agents, by humans who trust them (with approval).</p>
                </footer>
            </div>
        </div>
    );
};
