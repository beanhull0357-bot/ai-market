-- =============================================
-- Agent Q&A (상품 문의) System
-- =============================================

-- 1. Create agent_questions table
CREATE TABLE IF NOT EXISTS agent_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id text UNIQUE NOT NULL,
  agent_id text NOT NULL,
  sku text,
  category text NOT NULL DEFAULT 'OTHER'
    CHECK (category IN ('SPEC', 'COMPATIBILITY', 'BULK_PRICING', 'SHIPPING', 'RESTOCK', 'POLICY', 'OTHER')),
  question text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ANSWERED', 'CLOSED')),
  answer text,
  structured_data jsonb DEFAULT '{}',
  answered_by text CHECK (answered_by IN ('ADMIN', 'AUTO')),
  created_at timestamptz DEFAULT now(),
  answered_at timestamptz
);

-- 2. Enable RLS
ALTER TABLE agent_questions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Anyone can read questions"
  ON agent_questions FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to insert
CREATE POLICY "Anyone can insert questions"
  ON agent_questions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow all authenticated users to update (for answering)
CREATE POLICY "Anyone can update questions"
  ON agent_questions FOR UPDATE
  TO authenticated
  USING (true);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_agent_questions_agent_id ON agent_questions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_questions_status ON agent_questions(status);
CREATE INDEX IF NOT EXISTS idx_agent_questions_sku ON agent_questions(sku);
CREATE INDEX IF NOT EXISTS idx_agent_questions_created_at ON agent_questions(created_at DESC);

-- 4. RPC: ask_question
CREATE OR REPLACE FUNCTION ask_question(
  p_agent_id text,
  p_sku text DEFAULT NULL,
  p_category text DEFAULT 'OTHER',
  p_question text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket_id text;
  v_result jsonb;
BEGIN
  -- Generate ticket ID
  v_ticket_id := 'Q-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 8);

  INSERT INTO agent_questions (ticket_id, agent_id, sku, category, question)
  VALUES (v_ticket_id, p_agent_id, p_sku, p_category, p_question);

  v_result := jsonb_build_object(
    'ticketId', v_ticket_id,
    'status', 'PENDING',
    'message', 'Question submitted successfully. You will be notified when answered.'
  );

  RETURN v_result;
END;
$$;

-- 5. RPC: answer_question
CREATE OR REPLACE FUNCTION answer_question(
  p_ticket_id text,
  p_answer text,
  p_structured_data jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_question record;
BEGIN
  SELECT * INTO v_question FROM agent_questions WHERE ticket_id = p_ticket_id;

  IF v_question IS NULL THEN
    RETURN jsonb_build_object('error', 'Question not found', 'ticketId', p_ticket_id);
  END IF;

  UPDATE agent_questions
  SET answer = p_answer,
      structured_data = p_structured_data,
      status = 'ANSWERED',
      answered_by = 'ADMIN',
      answered_at = now()
  WHERE ticket_id = p_ticket_id;

  RETURN jsonb_build_object(
    'ticketId', p_ticket_id,
    'status', 'ANSWERED',
    'message', 'Answer submitted successfully.'
  );
END;
$$;

-- 6. RPC: get_agent_questions (for agent to check their own questions)
CREATE OR REPLACE FUNCTION get_agent_questions(
  p_agent_id text,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'ticketId', q.ticket_id,
      'sku', q.sku,
      'category', q.category,
      'question', q.question,
      'status', q.status,
      'answer', q.answer,
      'structuredData', q.structured_data,
      'answeredBy', q.answered_by,
      'createdAt', q.created_at,
      'answeredAt', q.answered_at
    ) ORDER BY q.created_at DESC
  )
  INTO v_result
  FROM agent_questions q
  WHERE q.agent_id = p_agent_id
    AND (p_status IS NULL OR q.status = p_status);

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 7. RPC: get_all_questions (admin)
CREATE OR REPLACE FUNCTION get_all_questions(
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'ticketId', q.ticket_id,
      'agentId', q.agent_id,
      'sku', q.sku,
      'category', q.category,
      'question', q.question,
      'status', q.status,
      'answer', q.answer,
      'structuredData', q.structured_data,
      'answeredBy', q.answered_by,
      'createdAt', q.created_at,
      'answeredAt', q.answered_at
    ) ORDER BY q.created_at DESC
  )
  INTO v_result
  FROM agent_questions q
  WHERE (p_status IS NULL OR q.status = p_status);

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Enable realtime for agent_questions
ALTER PUBLICATION supabase_realtime ADD TABLE agent_questions;
