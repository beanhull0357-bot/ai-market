import React, { useState, useEffect } from 'react';
import { Shield, Save, RotateCcw, Truck, CreditCard, Package, Clock, AlertTriangle, Check, Loader } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../supabaseClient';

interface MerchantPolicy {
    // 반품/환불
    returnWindowDays: number;
    returnFeeKrw: number;
    refundMethod: 'ORIGINAL' | 'WALLET' | 'BOTH';
    nonReturnableCategories: string[];
    // 배송
    freeShippingMinKrw: number;
    standardDeliveryDays: number;
    expressAvailable: boolean;
    expressDeliveryDays: number;
    expressFeeKrw: number;
    // 결제
    paymentDeadlineHours: number;
    acceptedMethods: string[];
    autoCaptureEnabled: boolean;
    // 주문 제한
    minOrderKrw: number;
    maxOrderKrw: number;
    maxQuantityPerItem: number;
    dailyOrderLimitPerAgent: number;
}

const DEFAULT_POLICY: MerchantPolicy = {
    returnWindowDays: 7,
    returnFeeKrw: 3000,
    refundMethod: 'ORIGINAL',
    nonReturnableCategories: ['FOOD', 'MEDICAL'],
    freeShippingMinKrw: 30000,
    standardDeliveryDays: 3,
    expressAvailable: true,
    expressDeliveryDays: 1,
    expressFeeKrw: 5000,
    paymentDeadlineHours: 24,
    acceptedMethods: ['wallet', 'payapp'],
    autoCaptureEnabled: false,
    minOrderKrw: 1000,
    maxOrderKrw: 5000000,
    maxQuantityPerItem: 100,
    dailyOrderLimitPerAgent: 10,
};

const CATEGORIES = [
    'CONSUMABLES', 'MRO', 'OFFICE', 'FOOD', 'HOUSEHOLD',
    'BEAUTY', 'FASHION', 'DIGITAL', 'SPORTS', 'FURNITURE',
    'AUTOMOTIVE', 'MEDICAL', 'INDUSTRIAL',
];

const Section: React.FC<{ icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }> = ({ icon, title, desc, children }) => (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-1">
            {icon}
            <h2 className="text-lg font-bold text-white">{title}</h2>
        </div>
        <p className="text-xs text-gray-500 mb-5 ml-9">{desc}</p>
        <div className="space-y-4 ml-1">{children}</div>
    </div>
);

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
    <div>
        <label className="block text-xs text-gray-400 uppercase mb-1.5">{label}</label>
        {children}
        {hint && <p className="text-[10px] text-gray-600 mt-1">{hint}</p>}
    </div>
);

const NumberInput: React.FC<{ value: number; onChange: (v: number) => void; min?: number; max?: number; suffix?: string }> = ({ value, onChange, min, max, suffix }) => (
    <div className="flex items-center gap-2">
        <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} min={min} max={max}
            className="flex-1 bg-black border border-gray-700 rounded px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" />
        {suffix && <span className="text-xs text-gray-500 whitespace-nowrap">{suffix}</span>}
    </div>
);

const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void; label: string }> = ({ value, onChange, label }) => (
    <button type="button" onClick={() => onChange(!value)}
        className={`flex items-center gap-2 px-3 py-2 rounded border text-sm transition-colors ${value ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
        <div className={`w-3 h-3 rounded-full ${value ? 'bg-blue-400' : 'bg-gray-600'}`} />
        {label}
    </button>
);

export const PolicyManager: React.FC = () => {
    const { t } = useLanguage();
    const [policy, setPolicy] = useState<MerchantPolicy>(DEFAULT_POLICY);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    // Load saved policy from Supabase
    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await supabase
                    .from('merchant_policies')
                    .select('policy_data')
                    .eq('policy_type', 'GLOBAL')
                    .single();
                if (data?.policy_data) {
                    setPolicy({ ...DEFAULT_POLICY, ...data.policy_data });
                }
            } catch {
                // Use defaults if table doesn't exist yet
            }
            setLoading(false);
        };
        load();
    }, []);

    const update = <K extends keyof MerchantPolicy>(key: K, value: MerchantPolicy[K]) => {
        setPolicy(prev => ({ ...prev, [key]: value }));
        setSaved(false);
    };

    const toggleNonReturnable = (cat: string) => {
        update('nonReturnableCategories',
            policy.nonReturnableCategories.includes(cat)
                ? policy.nonReturnableCategories.filter(c => c !== cat)
                : [...policy.nonReturnableCategories, cat]
        );
    };

    const togglePaymentMethod = (method: string) => {
        update('acceptedMethods',
            policy.acceptedMethods.includes(method)
                ? policy.acceptedMethods.filter(m => m !== method)
                : [...policy.acceptedMethods, method]
        );
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Upsert to merchant_policies table
            const { error } = await supabase
                .from('merchant_policies')
                .upsert({
                    policy_type: 'GLOBAL',
                    policy_data: policy,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'policy_type' });

            if (error) {
                // If table doesn't exist, save to localStorage as fallback
                localStorage.setItem('jsonmart_merchant_policy', JSON.stringify(policy));
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch {
            localStorage.setItem('jsonmart_merchant_policy', JSON.stringify(policy));
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        }
        setSaving(false);
    };

    const handleReset = () => {
        setPolicy(DEFAULT_POLICY);
        setSaved(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-terminal-bg flex items-center justify-center">
                <Loader className="animate-spin text-gray-500" size={24} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-terminal-bg text-terminal-text p-6">
            {/* Header */}
            <header className="mb-8 border-b border-gray-800 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Shield className="text-blue-400" />
                        판매 정책 관리
                    </h1>
                    <p className="text-sm text-gray-500 mt-2">반품, 배송, 결제, 주문 제한 등 마켓플레이스 정책을 설정합니다.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded hover:bg-gray-800 transition-colors">
                        <RotateCcw size={14} /> 초기화
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className={`flex items-center gap-2 px-5 py-2 text-sm font-bold rounded transition-colors ${saved
                            ? 'bg-green-600 text-white'
                            : saving ? 'bg-gray-700 text-gray-500'
                                : 'bg-blue-600 hover:bg-blue-500 text-white'
                            }`}>
                        {saving ? <Loader className="animate-spin" size={14} />
                            : saved ? <Check size={14} />
                                : <Save size={14} />}
                        {saving ? '저장 중...' : saved ? '저장됨!' : '정책 저장'}
                    </button>
                </div>
            </header>

            <div className="grid md:grid-cols-2 gap-6">
                {/* 반품/환불 정책 */}
                <Section
                    icon={<RotateCcw size={18} className="text-orange-400" />}
                    title="반품/환불 정책"
                    desc="에이전트의 반품 및 환불 요청 처리 기준을 설정합니다."
                >
                    <Field label="반품 가능 기간" hint="배송 완료일로부터 반품 가능한 일수">
                        <NumberInput value={policy.returnWindowDays} onChange={v => update('returnWindowDays', v)} min={0} max={30} suffix="일" />
                    </Field>
                    <Field label="반품 수수료" hint="반품 시 에이전트에게 부과되는 수수료">
                        <NumberInput value={policy.returnFeeKrw} onChange={v => update('returnFeeKrw', v)} min={0} suffix="원" />
                    </Field>
                    <Field label="환불 방식">
                        <div className="flex gap-2">
                            {(['ORIGINAL', 'WALLET', 'BOTH'] as const).map(method => (
                                <button key={method} onClick={() => update('refundMethod', method)}
                                    className={`flex-1 px-3 py-2 text-xs rounded border transition-colors ${policy.refundMethod === method
                                        ? 'bg-orange-900/30 text-orange-300 border-orange-700'
                                        : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                                    {method === 'ORIGINAL' ? '원래 결제수단' : method === 'WALLET' ? '월렛 환불' : '선택 가능'}
                                </button>
                            ))}
                        </div>
                    </Field>
                    <Field label="반품 불가 카테고리" hint="선택된 카테고리는 반품이 불가능합니다">
                        <div className="flex gap-1.5 flex-wrap">
                            {CATEGORIES.map(cat => (
                                <button key={cat} onClick={() => toggleNonReturnable(cat)}
                                    className={`px-2 py-1 text-[10px] rounded border transition-colors ${policy.nonReturnableCategories.includes(cat)
                                        ? 'bg-red-900/30 text-red-300 border-red-800'
                                        : 'bg-gray-800 text-gray-600 border-gray-700'}`}>
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </Field>
                </Section>

                {/* 배송 정책 */}
                <Section
                    icon={<Truck size={18} className="text-blue-400" />}
                    title="배송 정책"
                    desc="배송 조건 및 무료배송 기준을 설정합니다."
                >
                    <Field label="무료배송 기준 금액" hint="이 금액 이상 주문 시 배송비 무료">
                        <NumberInput value={policy.freeShippingMinKrw} onChange={v => update('freeShippingMinKrw', v)} min={0} suffix="원" />
                    </Field>
                    <Field label="기본 배송 소요일">
                        <NumberInput value={policy.standardDeliveryDays} onChange={v => update('standardDeliveryDays', v)} min={1} max={14} suffix="영업일" />
                    </Field>
                    <div className="border-t border-gray-800 pt-4">
                        <Toggle value={policy.expressAvailable} onChange={v => update('expressAvailable', v)} label="빠른 배송(익스프레스) 제공" />
                    </div>
                    {policy.expressAvailable && (
                        <div className="grid grid-cols-2 gap-3 pl-5 border-l-2 border-blue-800">
                            <Field label="배송 소요일">
                                <NumberInput value={policy.expressDeliveryDays} onChange={v => update('expressDeliveryDays', v)} min={1} max={3} suffix="일" />
                            </Field>
                            <Field label="추가 배송비">
                                <NumberInput value={policy.expressFeeKrw} onChange={v => update('expressFeeKrw', v)} min={0} suffix="원" />
                            </Field>
                        </div>
                    )}
                </Section>

                {/* 결제 정책 */}
                <Section
                    icon={<CreditCard size={18} className="text-green-400" />}
                    title="결제 정책"
                    desc="결제 수단 및 결제 기한을 설정합니다."
                >
                    <Field label="결제 기한" hint="주문 생성 후 이 시간 내에 결제를 완료해야 합니다">
                        <NumberInput value={policy.paymentDeadlineHours} onChange={v => update('paymentDeadlineHours', v)} min={1} max={72} suffix="시간" />
                    </Field>
                    <Field label="결제 수단">
                        <div className="flex gap-2">
                            {[
                                { id: 'wallet', label: '💰 월렛' },
                                { id: 'payapp', label: '💳 PayApp' },
                            ].map(method => (
                                <button key={method.id} onClick={() => togglePaymentMethod(method.id)}
                                    className={`flex-1 px-3 py-2 text-sm rounded border transition-colors ${policy.acceptedMethods.includes(method.id)
                                        ? 'bg-green-900/30 text-green-300 border-green-700'
                                        : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                                    {method.label}
                                </button>
                            ))}
                        </div>
                    </Field>
                    <Toggle
                        value={policy.autoCaptureEnabled}
                        onChange={v => update('autoCaptureEnabled', v)}
                        label="월렛 결제 시 자동 확정 (수동 확인 불필요)"
                    />
                </Section>

                {/* 주문 제한 */}
                <Section
                    icon={<Package size={18} className="text-purple-400" />}
                    title="주문 제한"
                    desc="에이전트의 구매 행위에 제한을 설정하여 비정상 주문을 방지합니다."
                >
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="최소 주문 금액">
                            <NumberInput value={policy.minOrderKrw} onChange={v => update('minOrderKrw', v)} min={0} suffix="원" />
                        </Field>
                        <Field label="최대 주문 금액">
                            <NumberInput value={policy.maxOrderKrw} onChange={v => update('maxOrderKrw', v)} min={0} suffix="원" />
                        </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="상품당 최대 수량" hint="한 주문에서 한 상품의 최대 주문 수량">
                            <NumberInput value={policy.maxQuantityPerItem} onChange={v => update('maxQuantityPerItem', v)} min={1} max={9999} suffix="개" />
                        </Field>
                        <Field label="에이전트 일일 주문 한도" hint="에이전트 1개당 하루 최대 주문 수">
                            <NumberInput value={policy.dailyOrderLimitPerAgent} onChange={v => update('dailyOrderLimitPerAgent', v)} min={1} max={100} suffix="건" />
                        </Field>
                    </div>
                    <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3 flex gap-2 items-start">
                        <AlertTriangle size={14} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-yellow-300/80">
                            주문 제한은 비정상 구매를 방지합니다. 일일 한도를 너무 낮게 설정하면 정상적인 에이전트의 구매가 차단될 수 있습니다.
                        </p>
                    </div>
                </Section>
            </div>

            {/* Preview JSON */}
            <div className="mt-6 bg-gray-900 border border-gray-800 rounded-lg p-6">
                <h3 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
                    <Clock size={14} /> 에이전트에게 공개될 정책 JSON
                </h3>
                <pre className="bg-black rounded p-4 text-xs text-green-400 overflow-x-auto font-mono">
                    {JSON.stringify({
                        merchant: 'JSONMart',
                        return_policy: {
                            window_days: policy.returnWindowDays,
                            fee_krw: policy.returnFeeKrw,
                            refund_method: policy.refundMethod,
                            non_returnable: policy.nonReturnableCategories,
                        },
                        shipping: {
                            free_above_krw: policy.freeShippingMinKrw,
                            standard_days: policy.standardDeliveryDays,
                            express: policy.expressAvailable ? {
                                days: policy.expressDeliveryDays,
                                fee_krw: policy.expressFeeKrw,
                            } : null,
                        },
                        payment: {
                            deadline_hours: policy.paymentDeadlineHours,
                            methods: policy.acceptedMethods,
                            auto_capture: policy.autoCaptureEnabled,
                        },
                        order_limits: {
                            min_krw: policy.minOrderKrw,
                            max_krw: policy.maxOrderKrw,
                            max_qty_per_item: policy.maxQuantityPerItem,
                            daily_limit_per_agent: policy.dailyOrderLimitPerAgent,
                        },
                    }, null, 2)}
                </pre>
                <p className="text-[10px] text-gray-600 mt-2">
                    이 JSON은 에이전트가 API로 정책을 조회할 때 반환되는 형식입니다.
                </p>
            </div>
        </div>
    );
};
