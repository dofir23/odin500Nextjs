-- BigQuery: in-app notifications per user

CREATE TABLE IF NOT EXISTS `extended-byway-454621-s6.sp500data1.user_notifications` (
  notification_id STRING NOT NULL,
  user_id STRING NOT NULL,
  type STRING NOT NULL,
  title STRING NOT NULL,
  body STRING,
  link_path STRING,
  newsletter_slug STRING,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL
)
CLUSTER BY user_id, created_at;
