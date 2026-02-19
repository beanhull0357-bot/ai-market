-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- A2A Protocol — Agent-to-Agent Communication
-- JSONMart Agent-Native Marketplace
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ━━━ 1. Tables ━━━

CREATE TABLE IF NOT EXISTS a2a_queries (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query_id        TEXT UNIQUE NOT NULL,
    from_agent      TEXT NOT NULL,
    query_type      TEXT NOT NULL DEFAULT 'PRODUCT_EXPERIENCE',
    sku             TEXT,
    question        TEXT NOT NULL,
    scope           TEXT DEFAULT 'PUBLIC',
    status          TEXT DEFAULT 'OPEN',
    ttl_hours       INT DEFAULT 24,
    response_count  INT DEFAULT 0,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS a2a_responses (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query_id        TEXT NOT NULL,
    from_agent      TEXT NOT NULL,
    verdict         TEXT NOT NULL DEFAULT 'NEUTRAL',
    confidence      NUMERIC(3,2) DEFAULT 0.80,
    evidence        JSONB NOT NULL DEFAULT '{}',
    message         TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ━━━ 2. Indexes ━━━

CREATE INDEX IF NOT EXISTS idx_a2a_queries_status ON a2a_queries(status);
CREATE INDEX IF NOT EXISTS idx_a2a_queries_sku ON a2a_queries(sku);
CREATE INDEX IF NOT EXISTS idx_a2a_queries_from_agent ON a2a_queries(from_agent);
CREATE INDEX IF NOT EXISTS idx_a2a_responses_query_id ON a2a_responses(query_id);
CREATE INDEX IF NOT EXISTS idx_a2a_responses_from_agent ON a2a_responses(from_agent);

-- ━━━ 3. RPC Functions ━━━

-- Broadcast a query to the agent network
CREATE OR REPLACE FUNCTION agent_broadcast_query(
    p_api_key       TEXT,
    p_query_type    TEXT DEFAULT 'PRODUCT_EXPERIENCE',
    p_sku           TEXT DEFAULT NULL,
    p_question      TEXT DEFAULT '',
    p_scope         TEXT DEFAULT 'PUBLIC',
    p_ttl_hours     INT DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
    v_query_id TEXT;
    v_expires TIMESTAMPTZ;
BEGIN
    -- Authenticate agent
    SELECT id, agent_id, name INTO v_agent
    FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid API key or inactive agent');
    END IF;

    -- Generate query ID
    v_query_id := 'A2A-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 8));
    v_expires := NOW() + (p_ttl_hours || ' hours')::INTERVAL;

    -- Insert query
    INSERT INTO a2a_queries (query_id, from_agent, query_type, sku, question, scope, ttl_hours, expires_at)
    VALUES (v_query_id, v_agent.agent_id, p_query_type, p_sku, p_question, p_scope, p_ttl_hours, v_expires);

    RETURN jsonb_build_object(
        'success', true,
        'query_id', v_query_id,
        'from_agent', v_agent.agent_id,
        'query_type', p_query_type,
        'sku', p_sku,
        'scope', p_scope,
        'expires_at', v_expires,
        'message', 'Query broadcast to agent network'
    );
END;
$$;

-- Respond to an A2A query
CREATE OR REPLACE FUNCTION agent_respond_query(
    p_api_key       TEXT,
    p_query_id      TEXT,
    p_verdict       TEXT DEFAULT 'NEUTRAL',
    p_confidence    NUMERIC DEFAULT 0.80,
    p_evidence      JSONB DEFAULT '{}',
    p_message       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
    v_query RECORD;
    v_response_id UUID;
BEGIN
    -- Authenticate agent
    SELECT id, agent_id, name INTO v_agent
    FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid API key or inactive agent');
    END IF;

    -- Validate query exists and is open
    SELECT * INTO v_query FROM a2a_queries WHERE query_id = p_query_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Query not found');
    END IF;

    IF v_query.status != 'OPEN' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Query is no longer open');
    END IF;

    IF v_query.expires_at < NOW() THEN
        UPDATE a2a_queries SET status = 'EXPIRED' WHERE query_id = p_query_id;
        RETURN jsonb_build_object('success', false, 'error', 'Query has expired');
    END IF;

    -- Prevent self-response
    IF v_query.from_agent = v_agent.agent_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot respond to your own query');
    END IF;

    -- Prevent duplicate response
    IF EXISTS (SELECT 1 FROM a2a_responses WHERE query_id = p_query_id AND from_agent = v_agent.agent_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already responded to this query');
    END IF;

    -- Insert response
    INSERT INTO a2a_responses (query_id, from_agent, verdict, confidence, evidence, message)
    VALUES (p_query_id, v_agent.agent_id, p_verdict, p_confidence, p_evidence, p_message)
    RETURNING id INTO v_response_id;

    -- Update response count
    UPDATE a2a_queries SET response_count = response_count + 1 WHERE query_id = p_query_id;

    RETURN jsonb_build_object(
        'success', true,
        'response_id', v_response_id,
        'query_id', p_query_id,
        'from_agent', v_agent.agent_id,
        'verdict', p_verdict,
        'confidence', p_confidence,
        'message', 'Response submitted'
    );
END;
$$;

-- Get A2A queries with responses
CREATE OR REPLACE FUNCTION get_a2a_queries(
    p_status        TEXT DEFAULT 'OPEN',
    p_sku           TEXT DEFAULT NULL,
    p_query_type    TEXT DEFAULT NULL,
    p_limit         INT DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_queries JSONB;
BEGIN
    -- Auto-expire old queries
    UPDATE a2a_queries SET status = 'EXPIRED'
    WHERE status = 'OPEN' AND expires_at < NOW();

    SELECT COALESCE(jsonb_agg(q ORDER BY q->>'created_at' DESC), '[]'::JSONB)
    INTO v_queries
    FROM (
        SELECT jsonb_build_object(
            'query_id', aq.query_id,
            'from_agent', aq.from_agent,
            'query_type', aq.query_type,
            'sku', aq.sku,
            'question', aq.question,
            'scope', aq.scope,
            'status', aq.status,
            'response_count', aq.response_count,
            'ttl_hours', aq.ttl_hours,
            'created_at', aq.created_at,
            'expires_at', aq.expires_at,
            'responses', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', ar.id,
                    'from_agent', ar.from_agent,
                    'verdict', ar.verdict,
                    'confidence', ar.confidence,
                    'evidence', ar.evidence,
                    'message', ar.message,
                    'created_at', ar.created_at
                ) ORDER BY ar.created_at ASC)
                FROM a2a_responses ar WHERE ar.query_id = aq.query_id
            ), '[]'::JSONB)
        ) AS q
        FROM a2a_queries aq
        WHERE (p_status IS NULL OR aq.status = p_status)
          AND (p_sku IS NULL OR aq.sku = p_sku)
          AND (p_query_type IS NULL OR aq.query_type = p_query_type)
        ORDER BY aq.created_at DESC
        LIMIT p_limit
    ) sub;

    RETURN jsonb_build_object(
        'success', true,
        'query_count', jsonb_array_length(v_queries),
        'queries', v_queries
    );
END;
$$;

-- ━━━ 4. Permissions ━━━

GRANT EXECUTE ON FUNCTION agent_broadcast_query(TEXT, TEXT, TEXT, TEXT, TEXT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION agent_respond_query(TEXT, TEXT, TEXT, NUMERIC, JSONB, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_a2a_queries(TEXT, TEXT, TEXT, INT) TO anon, authenticated;

-- ━━━ 5. RLS ━━━

ALTER TABLE a2a_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "A2A queries viewable by all" ON a2a_queries FOR SELECT USING (true);
CREATE POLICY "A2A queries insertable via RPC" ON a2a_queries FOR INSERT WITH CHECK (true);
CREATE POLICY "A2A queries updatable via RPC" ON a2a_queries FOR UPDATE USING (true);
CREATE POLICY "A2A responses viewable by all" ON a2a_responses FOR SELECT USING (true);
CREATE POLICY "A2A responses insertable via RPC" ON a2a_responses FOR INSERT WITH CHECK (true);
