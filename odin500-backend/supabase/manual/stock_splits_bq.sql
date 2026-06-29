-- BigQuery: stock split registry (Phase 1 — Massive.com ingest)
-- Phase 2 paper adjustments: supabase/manual/paper_split_adjustments.sql
-- Run in dataset sp500data1 (or your BIGQUERY_DATASET).
-- Tables are also auto-created on first sync via services/splits/stockSplitsStore.js.

CREATE TABLE IF NOT EXISTS `extended-byway-454621-s6.sp500data1.stock_splits` (
  split_id STRING NOT NULL,
  ticker STRING NOT NULL,
  execution_date DATE NOT NULL,
  split_from FLOAT64 NOT NULL,
  split_to FLOAT64 NOT NULL,
  split_ratio STRING,
  ratio_factor FLOAT64,
  adjustment_type STRING,
  historical_adjustment_factor FLOAT64,
  source STRING,
  ingested_at TIMESTAMP NOT NULL
)
CLUSTER BY ticker, execution_date;

CREATE TABLE IF NOT EXISTS `extended-byway-454621-s6.sp500data1.stock_splits_sync_state` (
  sync_key STRING NOT NULL,
  last_execution_date DATE,
  last_run_at TIMESTAMP,
  last_new_count INT64,
  last_total_fetched INT64
);

-- Env (odin500-backend/.env):
-- MASSIVE_API_KEY=your_key_here
-- MASSIVE_API_BASE=https://api.massive.com
-- ENABLE_SPLIT_SYNC=1
-- SPLITS_SYNC_INTERVAL_MS=86400000
-- SPLITS_INITIAL_SYNC_YEARS=10
-- SPLITS_SYNC_OVERLAP_DAYS=7
