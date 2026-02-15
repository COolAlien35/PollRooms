-- 002_add_deadlines_and_multiple_choice.sql
-- Phase 6: Time & Choice Logic Expansion
-- Run this in your Supabase SQL Editor BEFORE deploying the new code.

-- 1. Add new settings columns to 'polls'
ALTER TABLE polls
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS allow_multiple BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN polls.expires_at IS
  'When set, the poll automatically closes after this timestamp. NULL = no expiry.';

COMMENT ON COLUMN polls.allow_multiple IS
  'When TRUE, voters may select more than one option in a single ballot.';

-- 2. Drop the strict "one fingerprint per poll" constraint.
--    This allows a user to cast votes on multiple options (multi-select).
ALTER TABLE votes DROP CONSTRAINT IF EXISTS unique_fingerprint_per_poll;

-- 3. Add a new constraint: one vote per OPTION per user.
--    Prevents clicking the same option twice while allowing multi-select.
ALTER TABLE votes
ADD CONSTRAINT unique_option_vote UNIQUE (poll_id, option_id, voter_fingerprint);
