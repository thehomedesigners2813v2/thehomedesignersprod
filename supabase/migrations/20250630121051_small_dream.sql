/*
  # Add Vastu Shastra Analysis Support

  1. New Tables
    - `vastu_analyses` - Store Vastu analysis results for customer projects
    - `vastu_recommendations` - Store specific recommendations for each analysis

  2. Security
    - Enable RLS on all tables
    - Add policies for customers to view their own analyses
    - Add policies for assigned designers to view analyses
*/

-- Create vastu analyses table
CREATE TABLE IF NOT EXISTS vastu_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  layout_image_url text NOT NULL,
  vastu_score integer NOT NULL,
  analysis_summary text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create vastu recommendations table
CREATE TABLE IF NOT EXISTS vastu_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES vastu_analyses(id) ON DELETE CASCADE,
  zone text NOT NULL,
  element text NOT NULL,
  status text NOT NULL, -- 'good', 'warning', 'bad'
  recommendation text NOT NULL,
  priority text NOT NULL, -- 'high', 'medium', 'low'
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

-- System policies for inserting analyses and recommendations
DROP POLICY IF EXISTS "System can insert vastu analyses" ON vastu_analyses;
CREATE POLICY "System can insert vastu analyses"
  ON vastu_analyses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert vastu recommendations" ON vastu_recommendations;
CREATE POLICY "System can insert vastu recommendations"
  ON vastu_recommendations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_vastu_analyses_updated_at ON vastu_analyses;
CREATE TRIGGER update_vastu_analyses_updated_at
  BEFORE UPDATE ON vastu_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vastu_analyses_project_id 
ON vastu_analyses(project_id);

CREATE INDEX IF NOT EXISTS idx_vastu_recommendations_analysis_id 
ON vastu_recommendations(analysis_id);