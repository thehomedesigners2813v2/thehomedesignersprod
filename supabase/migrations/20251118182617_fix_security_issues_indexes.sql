/*
  # Fix Security Issues - Part 1: Add Missing Indexes

  1. Changes
    - Add indexes on all unindexed foreign keys for better query performance
    - Improves join performance and foreign key constraint checks
  
  2. Security
    - Performance optimization to prevent query bottlenecks
*/

-- Add indexes on foreign keys in customers table
CREATE INDEX IF NOT EXISTS idx_customers_last_modified_by 
  ON customers(last_modified_by);

CREATE INDEX IF NOT EXISTS idx_customers_user_id 
  ON customers(user_id);

CREATE INDEX IF NOT EXISTS idx_customers_assigned_designer_id 
  ON customers(assigned_designer_id);

-- Add indexes on foreign keys in project_activities table
CREATE INDEX IF NOT EXISTS idx_project_activities_user_id 
  ON project_activities(user_id);

CREATE INDEX IF NOT EXISTS idx_project_activities_project_id 
  ON project_activities(project_id);

-- Add indexes on foreign keys in project_assignments table
CREATE INDEX IF NOT EXISTS idx_project_assignments_customer_id 
  ON project_assignments(customer_id);

CREATE INDEX IF NOT EXISTS idx_project_assignments_designer_id 
  ON project_assignments(designer_id);

-- Add indexes on foreign keys in project_shares table
CREATE INDEX IF NOT EXISTS idx_project_shares_customer_id 
  ON project_shares(customer_id);

CREATE INDEX IF NOT EXISTS idx_project_shares_project_id_fkey 
  ON project_shares(project_id);

-- Add indexes on foreign keys in project_versions table
CREATE INDEX IF NOT EXISTS idx_project_versions_created_by 
  ON project_versions(created_by);

-- Add indexes on foreign keys in quote_acceptance_history table
CREATE INDEX IF NOT EXISTS idx_quote_acceptance_history_changed_by 
  ON quote_acceptance_history(changed_by);

-- Add indexes on foreign keys in review_responses table
CREATE INDEX IF NOT EXISTS idx_review_responses_designer_id_fkey 
  ON review_responses(designer_id);

-- The original create-table migration is not in this history. Later migrations
-- index, secure, clear, and then drop this removed social-wall table.
CREATE TABLE IF NOT EXISTS public.shared_gallery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid REFERENCES public.designers(id)
);

-- Add indexes on foreign keys in shared_gallery_items table
CREATE INDEX IF NOT EXISTS idx_shared_gallery_items_designer_id 
  ON shared_gallery_items(designer_id);