-- Local-only seed. Supabase runs this on `supabase db reset`, not on the hosted project.
-- host.docker.internal reaches the published local API from inside Postgres.

INSERT INTO site_settings (setting_key, video_url, video_title, is_active)
VALUES
  (
    'edge_function_base_url',
    'http://host.docker.internal:54321',
    'Local Edge Functions base URL',
    true
  ),
  (
    'edge_function_anon_key',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    'Local anon key for Edge Function calls',
    true
  )
ON CONFLICT (setting_key) DO UPDATE
SET video_url = EXCLUDED.video_url,
    video_title = EXCLUDED.video_title,
    is_active = EXCLUDED.is_active;
