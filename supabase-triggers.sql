-- ============================================
-- JSONMART Agent Stats Auto-Update Triggers
-- Run this in Supabase SQL Editor
-- ============================================

-- Function: Update agent order count when orders are created
-- (Tracks orders made by agents based on decision_trace)
CREATE OR REPLACE FUNCTION update_agent_order_stats()
RETURNS TRIGGER AS $$
DECLARE
  agent_record RECORD;
BEGIN
  -- Check if the order has a decision trace with an agent reference
  IF NEW.decision_trace IS NOT NULL AND NEW.decision_trace->>'agentId' IS NOT NULL THEN
    -- Find the agent and update stats
    UPDATE agents 
    SET 
      total_orders = total_orders + 1,
      last_active_at = now(),
      updated_at = now()
    WHERE agent_id = NEW.decision_trace->>'agentId'
      AND status = 'ACTIVE';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: After inserting an order
CREATE TRIGGER trg_update_agent_order_stats
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_order_stats();

-- Function: Update agent review count when reviews are created
CREATE OR REPLACE FUNCTION update_agent_review_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update agent stats based on reviewer_agent_id
  UPDATE agents
  SET
    total_reviews = total_reviews + 1,
    last_active_at = now(),
    updated_at = now()
  WHERE agent_id = NEW.reviewer_agent_id
    AND status = 'ACTIVE';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: After inserting a review
CREATE TRIGGER trg_update_agent_review_stats
  AFTER INSERT ON agent_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_review_stats();
