-- Enable extensions required for scheduled HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Send push notifications every day at 11:00 UTC (08:00 BRT / America/Sao_Paulo).
-- The Edge Function (care-notifications) called without a `plants` body runs in
-- "broadcast mode": it reads every row in push_subscriptions, computes which
-- plants need care that day, and sends real Web Push messages — regardless of
-- whether the PWA is open.
-- The publishable key is intentionally public (already shipped in the frontend JS bundle).
SELECT cron.schedule(
  'daily-push-notifications',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://aonlpickejwjldvaulvz.supabase.co/functions/v1/care-notifications',
    headers := '{"Content-Type":"application/json","apikey":"sb_publishable_yYgFkJVxAU3BLpFg8s6nQQ_RcZwzpEv"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
