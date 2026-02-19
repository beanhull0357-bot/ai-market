import React from 'react';
import { Shield, Truck, RotateCcw, Clock, AlertTriangle, CheckCircle, Mail, Globe } from 'lucide-react';

export const MerchantPolicies: React.FC = () => {
    return (
        <div className="min-h-screen bg-terminal-bg text-terminal-text p-6">
            <div className="max-w-3xl mx-auto space-y-10">
                {/* Header */}
                <header className="border-b border-gray-800 pb-6">
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Shield className="text-terminal-green" size={28} />
                        Merchant Policies
                    </h1>
                    <p className="text-gray-400 text-sm mt-2">
                        JSONMart Agent-Native Marketplace — Shipping, Returns, and Customer Service policies.
                        Required for Google Merchant Center and ACP compliance.
                    </p>
                </header>

                {/* Shipping Policy */}
                <section>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                        <Truck size={20} className="text-blue-400" /> Shipping Policy
                    </h2>
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h4 className="text-xs text-gray-500 uppercase mb-1">Coverage</h4>
                                <p className="text-white">South Korea (KR) nationwide</p>
                            </div>
                            <div>
                                <h4 className="text-xs text-gray-500 uppercase mb-1">Shipping Cost</h4>
                                <p className="text-terminal-green font-bold">Free Shipping (₩0)</p>
                            </div>
                            <div>
                                <h4 className="text-xs text-gray-500 uppercase mb-1">Handling Time</h4>
                                <p className="text-white">1–2 business days</p>
                            </div>
                            <div>
                                <h4 className="text-xs text-gray-500 uppercase mb-1">Estimated Delivery</h4>
                                <p className="text-white">2–5 business days (product dependent)</p>
                            </div>
                        </div>
                        <div className="border-t border-gray-800 pt-4">
                            <h4 className="text-xs text-gray-500 uppercase mb-2">Carrier</h4>
                            <p className="text-gray-400">Standard domestic courier (CJ Logistics / Hanjin Express). Tracking number provided upon shipment.</p>
                        </div>
                        <div className="border-t border-gray-800 pt-4">
                            <h4 className="text-xs text-gray-500 uppercase mb-2">Restrictions</h4>
                            <ul className="text-gray-400 list-disc pl-4 space-y-1">
                                <li>Domestic (KR) only. International shipping not available.</li>
                                <li>Jeju island and remote areas may require +1 business day.</li>
                                <li>Orders placed after 2:00 PM KST may ship next business day.</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Return Policy */}
                <section>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                        <RotateCcw size={20} className="text-orange-400" /> Return & Refund Policy
                    </h2>
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h4 className="text-xs text-gray-500 uppercase mb-1">Return Window</h4>
                                <p className="text-white font-bold">7–30 days</p>
                                <p className="text-gray-500 text-xs">Varies by product. Check individual listing.</p>
                            </div>
                            <div>
                                <h4 className="text-xs text-gray-500 uppercase mb-1">Return Shipping Fee</h4>
                                <p className="text-white">₩0 – ₩10,000</p>
                                <p className="text-gray-500 text-xs">Per product. Buyer responsible unless defective.</p>
                            </div>
                        </div>

                        <div className="border-t border-gray-800 pt-4">
                            <h4 className="text-xs text-gray-500 uppercase mb-2">Return Process</h4>
                            <ol className="text-gray-400 list-decimal pl-4 space-y-1">
                                <li>Contact support within the return window</li>
                                <li>Receive return authorization and shipping label</li>
                                <li>Ship item back in original packaging</li>
                                <li>Refund processed within 3–5 business days of receipt</li>
                            </ol>
                        </div>

                        <div className="border-t border-gray-800 pt-4">
                            <h4 className="text-xs text-gray-500 uppercase mb-2 flex items-center gap-1">
                                <AlertTriangle size={12} className="text-yellow-500" /> Non-Returnable Items
                            </h4>
                            <ul className="text-gray-400 list-disc pl-4 space-y-1">
                                <li><strong>opened</strong> — Hygiene products once opened (wipes, masks, gloves)</li>
                                <li><strong>no_return</strong> — Non-returnable per manufacturer policy (some toners)</li>
                                <li><strong>installed</strong> — Products that have been installed (LED panels, caster wheels)</li>
                                <li><strong>used</strong> — Safety equipment that has been deployed (fire extinguishers)</li>
                                <li><strong>hygiene</strong> — Products with hygiene seal broken</li>
                                <li><strong>box_damaged</strong> — Returns accepted only if original box is intact</li>
                                <li><strong>defective_only</strong> — Returns accepted only for manufacturing defects</li>
                            </ul>
                        </div>

                        <div className="border-t border-gray-800 pt-4 flex items-start gap-2">
                            <CheckCircle size={14} className="text-green-500 mt-0.5" />
                            <p className="text-gray-400">Defective items are always eligible for full refund or replacement, regardless of return exceptions.</p>
                        </div>
                    </div>
                </section>

                {/* Payment Policy */}
                <section>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                        <Clock size={20} className="text-yellow-400" /> Payment Policy
                    </h2>
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h4 className="text-xs text-gray-500 uppercase mb-1">Model</h4>
                                <p className="text-white font-bold">Authorize / Capture</p>
                            </div>
                            <div>
                                <h4 className="text-xs text-gray-500 uppercase mb-1">Authorization Hold</h4>
                                <p className="text-white">24 hours</p>
                            </div>
                        </div>
                        <div className="border-t border-gray-800 pt-4">
                            <p className="text-gray-400">
                                All orders start with a 24-hour authorization hold. An admin reviews the order and either
                                captures payment (confirms) or allows the hold to expire (auto-void). This ensures human
                                oversight for all AI-initiated transactions.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Customer Service */}
                <section>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                        <Mail size={20} className="text-purple-400" /> Customer Service
                    </h2>
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-3 text-sm">
                        <div className="flex items-center gap-3">
                            <Mail size={14} className="text-gray-500" />
                            <span className="text-gray-400">Email:</span>
                            <span className="text-white">support@jsonmart.xyz</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Globe size={14} className="text-gray-500" />
                            <span className="text-gray-400">GitHub:</span>
                            <a href="https://github.com/beanhull0357-bot/ai-market" className="text-terminal-green hover:underline">
                                beanhull0357-bot/ai-market
                            </a>
                        </div>
                        <div className="flex items-center gap-3">
                            <Clock size={14} className="text-gray-500" />
                            <span className="text-gray-400">Response Time:</span>
                            <span className="text-white">Within 24 hours (Mon–Fri)</span>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="border-t border-gray-800 pt-6 text-center text-xs text-gray-600">
                    <p>JSONMart Agent-Native Marketplace · Last updated: February 2026</p>
                    <p className="mt-1">These policies apply to all orders placed via the API, Playground, and UCP checkout.</p>
                </footer>
            </div>
        </div>
    );
};
