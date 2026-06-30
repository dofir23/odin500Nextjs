-- BigQuery: Odin500 Weekly newsletter issues
-- Run in dataset sp500data1 (or your BIGQUERY_DATASET).
-- Table is also auto-created on first read/write via services/newsletter/newsletterStore.js

CREATE TABLE IF NOT EXISTS `extended-byway-454621-s6.sp500data1.weekly_newsletter` (
  slug STRING NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  published_at DATE NOT NULL,
  week_label STRING NOT NULL,
  title STRING NOT NULL,
  description STRING NOT NULL,
  body_markdown STRING NOT NULL,
  tags_json STRING,
  author STRING,
  generator STRING,
  market_context_json STRING,
  created_at TIMESTAMP NOT NULL
)
CLUSTER BY published_at, slug;