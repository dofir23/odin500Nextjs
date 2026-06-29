-- Phase 2 — paper trading corporate split adjustments (run in Supabase SQL editor)
-- Adjusts open lots + pending orders when a split executes; idempotent via unique (split_id, entity_type, entity_id).

CREATE TABLE IF NOT EXISTS paper_split_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  split_id text NOT NULL,
  ticker text NOT NULL,
  execution_date date NOT NULL,
  ratio_factor numeric(18, 8) NOT NULL,
  adjustment_type text,
  entity_type text NOT NULL CHECK (entity_type IN ('lot', 'order')),
  entity_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES paper_accounts(id) ON DELETE CASCADE,
  before_qty numeric(18, 6),
  after_qty numeric(18, 6),
  before_price numeric(18, 6),
  after_price numeric(18, 6),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  adjusted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (split_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_paper_split_adj_ticker ON paper_split_adjustments (ticker, execution_date DESC);
CREATE INDEX IF NOT EXISTS idx_paper_split_adj_account ON paper_split_adjustments (account_id, adjusted_at DESC);

CREATE TABLE IF NOT EXISTS paper_split_adjustment_state (
  id text PRIMARY KEY DEFAULT 'default',
  last_processed_date date,
  last_run_at timestamptz,
  last_adjustments_count int DEFAULT 0
);

INSERT INTO paper_split_adjustment_state (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;
