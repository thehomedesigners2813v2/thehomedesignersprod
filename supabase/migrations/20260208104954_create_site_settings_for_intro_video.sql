/*
  # Create Site Settings Table for Video Management

  1. New Tables
    - `site_settings`
      - `id` (uuid, primary key)
      - `setting_key` (text, unique) - identifier for the setting
      - `video_type` (text) - type of video (youtube, vimeo, hosted)
      - `video_url` (text) - URL of the video
      - `video_title` (text) - title shown in the modal
      - `video_description` (text) - description shown in the modal
      - `is_active` (boolean) - whether the setting is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `site_settings` table
    - Allow anyone to read active settings (for public video display)
    - Only admin users can update settings

  3. Default Data
    - Insert default intro video settings
*/

CREATE TABLE IF NOT EXISTS site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  video_type text DEFAULT 'youtube',
  video_url text,
  video_title text,
  video_description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active site settings" ON site_settings;
CREATE POLICY "Anyone can view active site settings"
  ON site_settings
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admin users can update site settings" ON site_settings;
CREATE POLICY "Admin users can update site settings"
  ON site_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

DROP POLICY IF EXISTS "Admin users can insert site settings" ON site_settings;
CREATE POLICY "Admin users can insert site settings"
  ON site_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.is_active = true
    )
  );

INSERT INTO site_settings (setting_key, video_type, video_url, video_title, video_description)
VALUES (
  'intro_video',
  'youtube',
  'https://www.youtube.com/embed/Zn11vXNRzqE',
  'Welcome to The Home Designers',
  'Discover how we connect homeowners with India''s most talented interior designers. From traditional elegance to modern sophistication, we bring your dream home to life.'
)
ON CONFLICT (setting_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_site_settings_key ON site_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_site_settings_active ON site_settings(is_active);