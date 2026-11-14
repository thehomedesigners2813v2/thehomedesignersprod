/*
  # Fix Designer Rating Calculation
  
  1. Changes
    - Recreate the trigger function with better logic
    - Add function to manually recalculate all designer ratings
    - Ensure ratings update properly when reviews are added/updated/deleted
  
  2. Security
    - No RLS changes needed
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS update_designer_rating_trigger ON reviews;
DROP FUNCTION IF EXISTS update_designer_rating();

-- Recreate function to update designer rating
CREATE OR REPLACE FUNCTION update_designer_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_designer_id uuid;
BEGIN
  -- Determine which designer_id to update
  IF TG_OP = 'DELETE' THEN
    target_designer_id := OLD.designer_id;
  ELSE
    target_designer_id := NEW.designer_id;
  END IF;
  
  -- Update the designer's rating and review count
  UPDATE designers 
  SET 
    rating = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM reviews 
      WHERE designer_id = target_designer_id
    ), 0),
    total_reviews = (
      SELECT COUNT(*) 
      FROM reviews 
      WHERE designer_id = target_designer_id
    ),
    updated_at = now()
  WHERE id = target_designer_id;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS update_designer_rating_trigger ON reviews;
CREATE TRIGGER update_designer_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_designer_rating();

-- Function to recalculate all designer ratings (can be called manually)
CREATE OR REPLACE FUNCTION recalculate_all_designer_ratings()
RETURNS void AS $$
BEGIN
  UPDATE designers 
  SET 
    rating = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM reviews 
      WHERE reviews.designer_id = designers.id
    ), 0),
    total_reviews = (
      SELECT COUNT(*) 
      FROM reviews 
      WHERE reviews.designer_id = designers.id
    ),
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the recalculation for all existing designers
SELECT recalculate_all_designer_ratings();