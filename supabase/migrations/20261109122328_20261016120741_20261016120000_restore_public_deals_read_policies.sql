/*
# Restore secure public deal visibility

1. Public (anonymous and signed-in) visitors can read only active deals whose validity window includes the current time.
2. Active administrators with the manage_deals permission can read, create, update, and delete all deals.
3. Designers can read and manage only deals linked to their own designer profile.
4. Redemption records stay private.

Only policies on designer_deals are replaced. Existing deal records, prices, and relationships are unchanged.
*/

ALTER TABLE designer_deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all deals" ON designer_deals;
DROP POLICY IF EXISTS "Designers can manage own deals" ON designer_deals;
DROP POLICY IF EXISTS "Public can read active deals" ON designer_deals;
DROP POLICY IF EXISTS "Admins can view all deals" ON designer_deals;
DROP POLICY IF EXISTS "Admins can insert deals" ON designer_deals;
DROP POLICY IF EXISTS "Admins can update deals" ON designer_deals;
DROP POLICY IF EXISTS "Admins can delete deals" ON designer_deals;
DROP POLICY IF EXISTS "deals_public_select" ON designer_deals;
DROP POLICY IF EXISTS "deals_admin_select" ON designer_deals;
DROP POLICY IF EXISTS "deals_admin_insert" ON designer_deals;
DROP POLICY IF EXISTS "deals_admin_update" ON designer_deals;
DROP POLICY IF EXISTS "deals_admin_delete" ON designer_deals;
DROP POLICY IF EXISTS "deals_designer_select" ON designer_deals;
DROP POLICY IF EXISTS "deals_designer_insert" ON designer_deals;
DROP POLICY IF EXISTS "deals_designer_update" ON designer_deals;
DROP POLICY IF EXISTS "deals_designer_delete" ON designer_deals;

DROP POLICY IF EXISTS "deals_public_select" ON designer_deals;
CREATE POLICY "deals_public_select"
  ON designer_deals FOR SELECT
  TO anon, authenticated
  USING (is_active = true AND valid_from <= now() AND valid_until >= now());

DROP POLICY IF EXISTS "deals_admin_select" ON designer_deals;
CREATE POLICY "deals_admin_select"
  ON designer_deals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = (select auth.uid())
        AND admin_users.is_active = true
        AND COALESCE((admin_users.permissions ->> 'manage_deals')::boolean, false) = true
    )
  );

DROP POLICY IF EXISTS "deals_designer_select" ON designer_deals;
CREATE POLICY "deals_designer_select"
  ON designer_deals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.id = designer_deals.designer_id
        AND designers.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "deals_admin_insert" ON designer_deals;
CREATE POLICY "deals_admin_insert"
  ON designer_deals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = (select auth.uid())
        AND admin_users.is_active = true
        AND COALESCE((admin_users.permissions ->> 'manage_deals')::boolean, false) = true
    )
  );

DROP POLICY IF EXISTS "deals_designer_insert" ON designer_deals;
CREATE POLICY "deals_designer_insert"
  ON designer_deals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.id = designer_deals.designer_id
        AND designers.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "deals_admin_update" ON designer_deals;
CREATE POLICY "deals_admin_update"
  ON designer_deals FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = (select auth.uid())
        AND admin_users.is_active = true
        AND COALESCE((admin_users.permissions ->> 'manage_deals')::boolean, false) = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = (select auth.uid())
        AND admin_users.is_active = true
        AND COALESCE((admin_users.permissions ->> 'manage_deals')::boolean, false) = true
    )
  );

DROP POLICY IF EXISTS "deals_designer_update" ON designer_deals;
CREATE POLICY "deals_designer_update"
  ON designer_deals FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.id = designer_deals.designer_id
        AND designers.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.id = designer_deals.designer_id
        AND designers.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "deals_admin_delete" ON designer_deals;
CREATE POLICY "deals_admin_delete"
  ON designer_deals FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = (select auth.uid())
        AND admin_users.is_active = true
        AND COALESCE((admin_users.permissions ->> 'manage_deals')::boolean, false) = true
    )
  );

DROP POLICY IF EXISTS "deals_designer_delete" ON designer_deals;
CREATE POLICY "deals_designer_delete"
  ON designer_deals FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM designers
      WHERE designers.id = designer_deals.designer_id
        AND designers.user_id = (select auth.uid())
    )
  );
