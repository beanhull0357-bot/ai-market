-- ============================================================
-- JSONMart: Decision Replay persistent storage
-- Run in Supabase SQL Editor AFTER supabase-p1p7-additions.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS decision_replays (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  text NOT NULL UNIQUE,
    agent_id    text,
    order_id    text,
    policy      jsonb NOT NULL DEFAULT '{}',
    steps       jsonb NOT NULL DEFAULT '[]',
    final_choice jsonb,
    status      text NOT NULL DEFAULT 'PENDING',   -- APPROVED | REJECTED | PENDING
    total_ms    integer,
    created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_replays_agent ON decision_replays(agent_id);
CREATE INDEX IF NOT EXISTS idx_decision_replays_created ON decision_replays(created_at DESC);

ALTER TABLE decision_replays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_replays" ON decision_replays FOR ALL USING (true);
