-- ============================================
-- Migration: Add "Blind Voting" feature
-- Run in Supabase SQL Editor
-- ============================================

-- Add results_hidden column to polls table
ALTER TABLE polls
ADD COLUMN IF NOT EXISTS results_hidden BOOLEAN DEFAULT FALSE;

-- Comment
COMMENT ON COLUMN polls.results_hidden IS
  'When TRUE, vote counts and bars are hidden until the visitor has voted (Blind Voting / anti-bandwagon)';
