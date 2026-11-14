/*
  # Add Reviews and Rating System

  1. New Tables
    - `reviews` - Store customer reviews for designers
    - `review_responses` - Store designer responses to reviews
    - `review_votes` - Store helpful votes for reviews

  2. Security
    - Enable RLS on all tables
    - Add policies for customers to create reviews
    - Add policies for designers to respond to reviews
    - Add policies for public read access
*/

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid REFERENCES designers(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text NOT NULL,
  comment text NOT NULL,
  would_recommend boolean DEFAULT true,
  helpful_votes integer DEFAULT 0,
  verified_purchase boolean DEFAULT false,
  is_featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create review responses table
CREATE TABLE IF NOT EXISTS review_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid REFERENCES reviews(id) ON DELETE CASCADE,
  designer_id uuid REFERENCES designers(id) ON DELETE CASCADE,
  response text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create review votes table (for helpful votes)
CREATE TABLE IF NOT EXISTS review_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid REFERENCES reviews(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type text NOT NULL CHECK (vote_type IN ('helpful', 'not_helpful')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(review_id, user_id)
);

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_votes ENABLE ROW LEVEL SECURITY;

-- Policies for reviews
DROP POLICY IF EXISTS "Anyone can read reviews" ON reviews;
CREATE POLICY "Anyone can read reviews"
  ON reviews
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Customers can create reviews for their projects" ON reviews;
CREATE POLICY "Customers can create reviews for their projects"
  ON reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = customer_id AND
    EXISTS (
      SELECT 1 FROM customers 
      WHERE customers.id = reviews.project_id 
      AND customers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers can update own reviews" ON reviews;
CREATE POLICY "Customers can update own reviews"
  ON reviews
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = customer_id);

-- Policies for review responses
DROP POLICY IF EXISTS "Anyone can read review responses" ON review_responses;
CREATE POLICY "Anyone can read review responses"
  ON review_responses
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Designers can respond to their reviews" ON review_responses;
CREATE POLICY "Designers can respond to their reviews"
  ON review_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designers  
      WHERE designers.id = review_responses.designer_id 
      AND designers.user_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM reviews 
      WHERE reviews.id = review_responses.review_id 
      AND reviews.designer_id = review_responses.designer_id
    )
  );

DROP POLICY IF EXISTS "Designers can update own responses" ON review_responses;
CREATE POLICY "Designers can update own responses"
  ON review_responses
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designers 
      WHERE designers.id = review_responses.designer_id 
      AND designers.user_id = auth.uid()
    )
  );

-- Policies for review votes
DROP POLICY IF EXISTS "Anyone can read review votes" ON review_votes;
CREATE POLICY "Anyone can read review votes"
  ON review_votes
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can vote on reviews" ON review_votes;
CREATE POLICY "Users can vote on reviews"
  ON review_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own votes" ON review_votes;
CREATE POLICY "Users can update own votes"
  ON review_votes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_review_responses_updated_at ON review_responses;
CREATE TRIGGER update_review_responses_updated_at
  BEFORE UPDATE ON review_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update designer rating when reviews are added/updated
CREATE OR REPLACE FUNCTION update_designer_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the designer's rating and review count
  UPDATE designers 
  SET 
    rating = (
      SELECT COALESCE(AVG(rating), 0) 
      FROM reviews 
      WHERE designer_id = COALESCE(NEW.designer_id, OLD.designer_id)
    ),
    total_reviews = (
      SELECT COUNT(*) 
      FROM reviews 
      WHERE designer_id = COALESCE(NEW.designer_id, OLD.designer_id)
    )
  WHERE id = COALESCE(NEW.designer_id, OLD.designer_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update designer rating
DROP TRIGGER IF EXISTS update_designer_rating_trigger ON reviews;
CREATE TRIGGER update_designer_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_designer_rating();

-- Function to update helpful votes count
CREATE OR REPLACE FUNCTION update_review_helpful_votes()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the review's helpful votes count
  UPDATE reviews 
  SET helpful_votes = (
    SELECT COUNT(*) 
    FROM review_votes 
    WHERE review_id = COALESCE(NEW.review_id, OLD.review_id)
    AND vote_type = 'helpful'
  )
  WHERE id = COALESCE(NEW.review_id, OLD.review_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update helpful votes
DROP TRIGGER IF EXISTS update_review_helpful_votes_trigger ON review_votes;
CREATE TRIGGER update_review_helpful_votes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON review_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_review_helpful_votes();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reviews_designer_id ON reviews(designer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer_id ON reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_project_id ON reviews(project_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_responses_review_id ON review_responses(review_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_review_id ON review_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_user_id ON review_votes(user_id);