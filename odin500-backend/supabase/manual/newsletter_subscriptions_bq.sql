-- BigQuery: Odin500 newsletter email/in-app subscriptions (auth user_id from Supabase JWT)

CREATE TABLE IF NOT EXISTS `extended-byway-454621-s6.sp500data1.newsletter_subscriptions` (
  user_id STRING NOT NULL,
  email STRING NOT NULL,
  subscribed_at TIMESTAMP NOT NULL,
  unsubscribed_at TIMESTAMP,
  is_active BOOL NOT NULL,
  email_opt_in BOOL NOT NULL,
  in_app_opt_in BOOL NOT NULL,
  source STRING,
  updated_at TIMESTAMP NOT NULL
)
CLUSTER BY user_id, is_active;
