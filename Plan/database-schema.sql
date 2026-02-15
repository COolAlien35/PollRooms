-- database/schema.sql
-- Real-Time Poll Rooms Database Schema
-- PostgreSQL / Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- POLLS TABLE
-- ============================================
-- Stores poll questions and metadata
CREATE TABLE polls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(12) UNIQUE NOT NULL,
    question TEXT NOT NULL CHECK (length(trim(question)) > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    creator_ip INET,
    
    -- Constraints
    CONSTRAINT valid_question CHECK (length(trim(question)) <= 500)
);

-- Indexes for polls
CREATE INDEX idx_polls_slug ON polls(slug);
CREATE INDEX idx_polls_created ON polls(created_at DESC);
CREATE INDEX idx_polls_active ON polls(is_active) WHERE is_active = TRUE;

-- ============================================
-- OPTIONS TABLE
-- ============================================
-- Stores poll options/choices
CREATE TABLE options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    text TEXT NOT NULL CHECK (length(trim(text)) > 0),
    vote_count INTEGER DEFAULT 0 CHECK (vote_count >= 0),
    display_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_option_text CHECK (length(trim(text)) <= 200),
    CONSTRAINT valid_display_order CHECK (display_order >= 0),
    UNIQUE(poll_id, display_order)
);

-- Indexes for options
CREATE INDEX idx_options_poll_id ON options(poll_id);
CREATE INDEX idx_options_poll_order ON options(poll_id, display_order);

-- ============================================
-- VOTES TABLE
-- ============================================
-- Audit trail of all votes (for anti-abuse)
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES options(id) ON DELETE CASCADE,
    voter_fingerprint VARCHAR(64),
    ip_address INET,
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT,
    
    -- Anti-abuse constraints
    CONSTRAINT unique_fingerprint_per_poll UNIQUE(poll_id, voter_fingerprint)
);

-- Indexes for votes (critical for performance)
CREATE INDEX idx_votes_poll_id ON votes(poll_id);
CREATE INDEX idx_votes_option_id ON votes(option_id);
CREATE INDEX idx_votes_fingerprint ON votes(voter_fingerprint);
CREATE INDEX idx_votes_ip_time ON votes(ip_address, voted_at DESC);
CREATE INDEX idx_votes_poll_time ON votes(poll_id, voted_at DESC);

-- ============================================
-- FUNCTIONS & STORED PROCEDURES
-- ============================================

-- Function to increment vote count atomically
CREATE OR REPLACE FUNCTION increment_vote_count(
    p_option_id UUID
) RETURNS INTEGER AS $$
DECLARE
    new_count INTEGER;
BEGIN
    UPDATE options
    SET vote_count = vote_count + 1
    WHERE id = p_option_id
    RETURNING vote_count INTO new_count;
    
    RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check if fingerprint voted in poll
CREATE OR REPLACE FUNCTION has_voted_fingerprint(
    p_poll_id UUID,
    p_fingerprint VARCHAR(64)
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM votes
        WHERE poll_id = p_poll_id
        AND voter_fingerprint = p_fingerprint
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check if IP voted recently (rate limiting)
CREATE OR REPLACE FUNCTION has_voted_recently_ip(
    p_poll_id UUID,
    p_ip_address INET,
    p_minutes INTEGER DEFAULT 10
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM votes
        WHERE poll_id = p_poll_id
        AND ip_address = p_ip_address
        AND voted_at > NOW() - (p_minutes || ' minutes')::INTERVAL
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to prevent voting on inactive polls
CREATE OR REPLACE FUNCTION check_poll_active() RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM polls
        WHERE id = NEW.poll_id
        AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Cannot vote on inactive poll';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vote_check_active
    BEFORE INSERT ON votes
    FOR EACH ROW
    EXECUTE FUNCTION check_poll_active();

-- Trigger to validate option belongs to poll
CREATE OR REPLACE FUNCTION validate_option_poll() RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM options
        WHERE id = NEW.option_id
        AND poll_id = NEW.poll_id
    ) THEN
        RAISE EXCEPTION 'Option does not belong to poll';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vote_validate_option
    BEFORE INSERT ON votes
    FOR EACH ROW
    EXECUTE FUNCTION validate_option_poll();

-- ============================================
-- VIEWS (Optional - for analytics)
-- ============================================

-- View for poll statistics
CREATE OR REPLACE VIEW poll_stats AS
SELECT
    p.id AS poll_id,
    p.slug,
    p.question,
    p.created_at,
    COUNT(DISTINCT o.id) AS option_count,
    COUNT(v.id) AS total_votes,
    COUNT(DISTINCT v.ip_address) AS unique_ips,
    MAX(v.voted_at) AS last_vote_at
FROM polls p
LEFT JOIN options o ON o.poll_id = p.id
LEFT JOIN votes v ON v.poll_id = p.id
GROUP BY p.id;

-- ============================================
-- SAMPLE DATA (for testing)
-- ============================================

-- Insert test poll
INSERT INTO polls (slug, question) 
VALUES ('test123456', 'What is your favorite programming language?');

-- Get the poll ID
DO $$
DECLARE
    test_poll_id UUID;
BEGIN
    SELECT id INTO test_poll_id FROM polls WHERE slug = 'test123456';
    
    -- Insert options
    INSERT INTO options (poll_id, text, display_order) VALUES
        (test_poll_id, 'JavaScript', 0),
        (test_poll_id, 'Python', 1),
        (test_poll_id, 'Go', 2),
        (test_poll_id, 'Rust', 3);
END $$;

-- ============================================
-- PERMISSIONS (Supabase RLS - Optional)
-- ============================================

-- Enable Row Level Security
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Public read access to polls and options
CREATE POLICY "Public polls read" ON polls
    FOR SELECT USING (TRUE);

CREATE POLICY "Public options read" ON options
    FOR SELECT USING (TRUE);

-- Anonymous users can create polls
CREATE POLICY "Anonymous poll creation" ON polls
    FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Anonymous option creation" ON options
    FOR INSERT WITH CHECK (TRUE);

-- Anyone can vote (anti-abuse in application logic)
CREATE POLICY "Public voting" ON votes
    FOR INSERT WITH CHECK (TRUE);

-- ============================================
-- MAINTENANCE QUERIES
-- ============================================

-- Clean up old votes (run periodically)
-- DELETE FROM votes WHERE voted_at < NOW() - INTERVAL '90 days';

-- Archive inactive polls
-- UPDATE polls SET is_active = FALSE WHERE expires_at < NOW();

-- ============================================
-- PERFORMANCE NOTES
-- ============================================

-- For high-traffic scenarios, consider:
-- 1. Partitioning votes table by poll_id or date
-- 2. Using materialized views for poll_stats
-- 3. Implementing Redis caching layer
-- 4. Adding read replicas for Supabase

COMMENT ON TABLE polls IS 'Stores poll questions and metadata';
COMMENT ON TABLE options IS 'Stores poll options/choices';
COMMENT ON TABLE votes IS 'Audit trail of all votes for anti-abuse tracking';
COMMENT ON FUNCTION increment_vote_count IS 'Atomically increments vote count for an option';
