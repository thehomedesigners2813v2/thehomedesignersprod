/*
# Let a customer share one project with more than one designer

The share row stores the customer's auth user id. The insert check must
match that, and must also confirm the customer owns the project.
*/

DROP POLICY IF EXISTS "Customers can insert own shares" ON public.project_shares;
CREATE POLICY "Customers can insert own shares"
  ON public.project_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = customer_id
    AND EXISTS (
      SELECT 1 FROM public.customers
      WHERE customers.id = project_id
        AND customers.user_id = auth.uid()
    )
  );
