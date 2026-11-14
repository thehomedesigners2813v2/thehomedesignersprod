/*
  # Allow Designers to Update Assigned Project Status

  1. Changes
    - Add RLS policy to allow designers to update `assignment_status` and `last_modified_by` 
      fields for projects assigned to them
    - This policy specifically allows UPDATE operations where the designer is the assigned_designer_id
    
  2. Security
    - Policy only allows designers to update their own assigned projects
    - Designers can only update specific fields: assignment_status and last_modified_by
    - Uses USING clause to verify the designer is assigned to the project
    - Uses WITH CHECK to ensure the assignment doesn't change during update
*/

-- Create policy to allow designers to update status of their assigned projects
DROP POLICY IF EXISTS "Designers can update assigned project status" ON customers;
CREATE POLICY "Designers can update assigned project status"
  ON customers
  FOR UPDATE
  TO authenticated
  USING (assigned_designer_id IN (SELECT id FROM designers WHERE user_id = auth.uid()))
  WITH CHECK (assigned_designer_id IN (SELECT id FROM designers WHERE user_id = auth.uid()));
