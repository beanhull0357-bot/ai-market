-- ============================================
-- JSONMART Merchant Policy Table
-- 🔧 Run this in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS merchant_policies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    policy_type TEXT UNIQUE NOT NULL DEFAULT 'GLOBAL',
    policy_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE merchant_policies ENABLE ROW LEVEL SECURITY;

-- Admin only: read/write
CREATE POLICY "Auth manage merchant_policies" ON merchant_policies
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Agents can read policies (public read)
CREATE POLICY "Public read merchant_policies" ON merchant_policies
    FOR SELECT USING (true);

-- Insert default policy
INSERT INTO merchant_policies (policy_type, policy_data) VALUES
('GLOBAL', '{
    "returnWindowDays": 7,
    "returnFeeKrw": 3000,
    "refundMethod": "ORIGINAL",
    "nonReturnableCategories": ["FOOD", "MEDICAL"],
    "freeShippingMinKrw": 30000,
    "standardDeliveryDays": 3,
    "expressAvailable": true,
    "expressDeliveryDays": 1,
    "expressFeeKrw": 5000,
    "paymentDeadlineHours": 24,
    "acceptedMethods": ["wallet", "payapp"],
    "autoCaptureEnabled": false,
    "minOrderKrw": 1000,
    "maxOrderKrw": 5000000,
    "maxQuantityPerItem": 100,
    "dailyOrderLimitPerAgent": 10
}'::jsonb)
ON CONFLICT (policy_type) DO NOTHING;
