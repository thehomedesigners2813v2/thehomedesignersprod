/*
  # Create Vastu Analysis System with Design Consistency

  1. New Tables
    - `vastu_analyses` - Store Vastu analysis results with design hash for consistency
    - `vastu_recommendations` - Store specific recommendations for each analysis

  2. Design Consistency
    - Uses `design_hash` to identify unique designs
    - Same design always returns same analysis for consistency
    - Hash is created from layout image URL

  3. Security
    - Enable RLS on all tables
    - Customers can view their own analyses
    - Designers can view analyses for assigned projects
    - System can insert new analyses
*/

-- Create vastu analyses table with design hash for consistency
CREATE TABLE IF NOT EXISTS vastu_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  design_hash text NOT NULL,
  layout_image_url text NOT NULL,
  vastu_score integer NOT NULL CHECK (vastu_score >= 0 AND vastu_score <= 100),
  analysis_summary text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(design_hash)
);

-- The table already exists from an earlier migration, so CREATE TABLE IF NOT EXISTS
-- does not add design_hash. Add it before the index below.
ALTER TABLE vastu_analyses ADD COLUMN IF NOT EXISTS design_hash text;
UPDATE vastu_analyses SET design_hash = md5(id::text) WHERE design_hash IS NULL;
ALTER TABLE vastu_analyses ALTER COLUMN design_hash SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS vastu_analyses_design_hash_key ON vastu_analyses (design_hash);

-- Create vastu recommendations table
CREATE TABLE IF NOT EXISTS vastu_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES vastu_analyses(id) ON DELETE CASCADE NOT NULL,
  zone text NOT NULL,
  element text NOT NULL,
  status text NOT NULL CHECK (status IN ('good', 'warning', 'bad')),
  recommendation text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE vastu_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE vastu_recommendations ENABLE ROW LEVEL SECURITY;

-- Policies for vastu_analyses
DROP POLICY IF EXISTS "Customers can view their own vastu analyses" ON vastu_analyses;
CREATE POLICY "Customers can view their own vastu analyses"
  ON vastu_analyses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers 
      WHERE customers.id = vastu_analyses.project_id 
      AND customers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Designers can view vastu analyses for assigned projects" ON vastu_analyses;
CREATE POLICY "Designers can view vastu analyses for assigned projects"
  ON vastu_analyses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers 
      WHERE customers.id = vastu_analyses.project_id 
      AND customers.assigned_designer_id IN (
        SELECT id FROM designers WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "System can insert vastu analyses" ON vastu_analyses;
CREATE POLICY "System can insert vastu analyses"
  ON vastu_analyses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policies for vastu_recommendations
DROP POLICY IF EXISTS "Customers can view their own vastu recommendations" ON vastu_recommendations;
CREATE POLICY "Customers can view their own vastu recommendations"
  ON vastu_recommendations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vastu_analyses
      JOIN customers ON customers.id = vastu_analyses.project_id
      WHERE vastu_analyses.id = vastu_recommendations.analysis_id
      AND customers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Designers can view vastu recommendations for assigned projects" ON vastu_recommendations;
CREATE POLICY "Designers can view vastu recommendations for assigned projects"
  ON vastu_recommendations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vastu_analyses
      JOIN customers ON customers.id = vastu_analyses.project_id
      WHERE vastu_analyses.id = vastu_recommendations.analysis_id
      AND customers.assigned_designer_id IN (
        SELECT id FROM designers WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "System can insert vastu recommendations" ON vastu_recommendations;
CREATE POLICY "System can insert vastu recommendations"
  ON vastu_recommendations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_vastu_analyses_updated_at ON vastu_analyses;
CREATE TRIGGER update_vastu_analyses_updated_at
  BEFORE UPDATE ON vastu_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vastu_analyses_project_id 
  ON vastu_analyses(project_id);

CREATE INDEX IF NOT EXISTS idx_vastu_analyses_design_hash 
  ON vastu_analyses(design_hash);

CREATE INDEX IF NOT EXISTS idx_vastu_recommendations_analysis_id 
  ON vastu_recommendations(analysis_id);

COMMENT ON COLUMN vastu_analyses.design_hash IS 'SHA-256 hash of layout_image_url to ensure same design returns consistent results';
COMMENT ON TABLE vastu_analyses IS 'Stores Vastu Shastra analysis results with design hash for consistency';
COMMENT ON TABLE vastu_recommendations IS 'Stores specific zone-based recommendations for each Vastu analysis';