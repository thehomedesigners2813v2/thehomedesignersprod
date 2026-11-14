/*
  # Add Delete Policy to Notifications

  1. Changes
    - Add DELETE policy to notifications table
    - Allow users to delete their own notifications

  2. Security
    - Users can only delete their own notifications
    - Ensures proper cleanup of notification data
*/

-- Add DELETE policy for notifications
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
