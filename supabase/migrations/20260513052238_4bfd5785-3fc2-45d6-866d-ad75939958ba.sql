-- Remove any existing job with the same name to avoid duplicates
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'keep-alive-every-3-days';

-- Schedule keep-alive to run every 3 days at 3:00 AM UTC
SELECT cron.schedule(
  'keep-alive-every-3-days',
  '0 3 */3 * *',
  $$
  SELECT net.http_post(
    url := 'https://fxjjqjqnuryixsonnkzx.supabase.co/functions/v1/keep-alive',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4ampxanFudXJ5aXhzb25ua3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3ODUzMzksImV4cCI6MjA5MzM2MTMzOX0.WtWTplXUJ61t9hTWskg5_EBmO0GkZp3XPpBGfEXJEZc"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  ) AS request_id;
  $$
);