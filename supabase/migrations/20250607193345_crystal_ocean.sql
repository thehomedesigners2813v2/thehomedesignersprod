/*
  # Create designers table and authentication

  1. New Tables
    - `designers`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `email` (text, unique)
      - `phone` (text)
      - `specialization` (text)
      - `experience` (integer)
      - `location` (text)
      - `bio` (text)
      - `website` (text)
      - `starting_price` (text)
      - `profile_image` (text)
      - `portfolio_images` (text array)
      - `services` (text array)
      - `materials_expertise` (text array)
      - `awards` (text array)
      - `rating` (decimal, default 0)
      - `total_reviews` (integer, default 0)
      - `total_projects` (integer, default 0)
      - `is_verified` (boolean, default false)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `designers` table
    - Add policies for designers to manage their own profiles
    - Add policies for public read access to active designers
*/

CREATE TABLE IF NOT EXISTS designers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  specialization text NOT NULL,
  experience integer NOT NULL DEFAULT 0,
  location text NOT NULL,
  bio text,
  website text,
  starting_price text,
  profile_image text,
  portfolio_images text[] DEFAULT '{}',
  services text[] DEFAULT '{}',
  materials_expertise text[] DEFAULT '{}',
  awards text[] DEFAULT '{}',
  rating decimal(3,2) DEFAULT 0,
  total_reviews integer DEFAULT 0,
  total_projects integer DEFAULT 0,
  is_verified boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE designers ENABLE ROW LEVEL SECURITY;

-- Policies for designers to manage their own profiles
DROP POLICY IF EXISTS "Designers can read own profile" ON designers;
CREATE POLICY "Designers can read own profile"
  ON designers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Designers can update own profile" ON designers;
CREATE POLICY "Designers can update own profile"
  ON designers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Designers can insert own profile" ON designers;
CREATE POLICY "Designers can insert own profile"
  ON designers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy for public read access to active designers
DROP POLICY IF EXISTS "Public can read active designers" ON designers;
CREATE POLICY "Public can read active designers"
  ON designers
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_designers_updated_at ON designers;
CREATE TRIGGER update_designers_updated_at
  BEFORE UPDATE ON designers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();