/*
  # Create 3D Wallpaper Order System

  1. New Tables
    - `wallpaper_orders`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, references customers table)
      - `customer_name` (text, not null)
      - `customer_phone` (text, not null)
      - `customer_address` (text, not null)
      - `wall_size_length` (numeric, not null) - length in feet
      - `wall_size_height` (numeric, not null) - height in feet
      - `wall_unit` (text, default 'feet') - feet or inches
      - `reference_images` (text array) - Pinterest/Shutterstock URLs
      - `wallpaper_type` (text, not null) - 'normal' or 'golden_foil'
      - `rate_per_sqft` (numeric, not null) - 150 for normal, 200 for golden foil
      - `total_area_sqft` (numeric, not null) - calculated area
      - `total_amount` (numeric, not null) - calculated total
      - `advance_amount` (numeric, not null) - 50% advance payment
      - `payment_screenshot_url` (text) - URL to uploaded payment screenshot
      - `preview_image_url` (text) - URL to preview image provided by admin
      - `status` (text, default 'pending') - pending, preview_sent, confirmed, in_production, completed, cancelled
      - `order_date` (timestamptz, default now())
      - `confirmation_date` (timestamptz)
      - `delivery_date` (timestamptz)
      - `notes` (text)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Storage Bucket
    - Create bucket for payment screenshots and preview images

  3. Security
    - Enable RLS on `wallpaper_orders` table
    - Customers can view their own orders
    - Customers can create orders
    - Customers can update their orders only when status is 'pending'
    - Admins can view, update all orders

  4. Important Notes
    - Rate calculation: 150 rs/sqft for normal 3D wallpaper, 200 rs/sqft for golden foil
    - 50% advance payment required
    - Preview will be provided before confirmation
*/

-- Create wallpaper_orders table
CREATE TABLE IF NOT EXISTS wallpaper_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_address text NOT NULL,
  wall_size_length numeric NOT NULL CHECK (wall_size_length > 0),
  wall_size_height numeric NOT NULL CHECK (wall_size_height > 0),
  wall_unit text NOT NULL DEFAULT 'feet' CHECK (wall_unit IN ('feet', 'inches')),
  reference_images text[] DEFAULT '{}',
  wallpaper_type text NOT NULL CHECK (wallpaper_type IN ('normal', 'golden_foil')),
  rate_per_sqft numeric NOT NULL CHECK (rate_per_sqft > 0),
  total_area_sqft numeric NOT NULL CHECK (total_area_sqft > 0),
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  advance_amount numeric NOT NULL CHECK (advance_amount >= 0),
  payment_screenshot_url text,
  preview_image_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preview_sent', 'confirmed', 'in_production', 'completed', 'cancelled')),
  order_date timestamptz DEFAULT now(),
  confirmation_date timestamptz,
  delivery_date timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_wallpaper_orders_customer_id ON wallpaper_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_wallpaper_orders_status ON wallpaper_orders(status);
CREATE INDEX IF NOT EXISTS idx_wallpaper_orders_order_date ON wallpaper_orders(order_date DESC);

-- Enable RLS
ALTER TABLE wallpaper_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers
DROP POLICY IF EXISTS "Customers can view their own wallpaper orders" ON wallpaper_orders;
CREATE POLICY "Customers can view their own wallpaper orders"
  ON wallpaper_orders FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers can create wallpaper orders" ON wallpaper_orders;
CREATE POLICY "Customers can create wallpaper orders"
  ON wallpaper_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id IN (
      SELECT id FROM customers WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers can update their pending wallpaper orders" ON wallpaper_orders;
CREATE POLICY "Customers can update their pending wallpaper orders"
  ON wallpaper_orders FOR UPDATE
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE user_id = auth.uid()
    ) AND status = 'pending'
  )
  WITH CHECK (
    customer_id IN (
      SELECT id FROM customers WHERE user_id = auth.uid()
    ) AND status = 'pending'
  );

-- RLS Policies for admins
DROP POLICY IF EXISTS "Admins can view all wallpaper orders" ON wallpaper_orders;
CREATE POLICY "Admins can view all wallpaper orders"
  ON wallpaper_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can update wallpaper orders" ON wallpaper_orders;
CREATE POLICY "Admins can update wallpaper orders"
  ON wallpaper_orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_wallpaper_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_wallpaper_orders_updated_at_trigger ON wallpaper_orders;
CREATE TRIGGER update_wallpaper_orders_updated_at_trigger
  BEFORE UPDATE ON wallpaper_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_wallpaper_orders_updated_at();

-- Create storage bucket for wallpaper order files
INSERT INTO storage.buckets (id, name, public)
VALUES ('wallpaper-orders', 'wallpaper-orders', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for wallpaper-orders bucket
DROP POLICY IF EXISTS "Authenticated users can upload wallpaper order files" ON storage.objects;
CREATE POLICY "Authenticated users can upload wallpaper order files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'wallpaper-orders');

DROP POLICY IF EXISTS "Users can view wallpaper order files" ON storage.objects;
CREATE POLICY "Users can view wallpaper order files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'wallpaper-orders');

DROP POLICY IF EXISTS "Admins can update wallpaper order files" ON storage.objects;
CREATE POLICY "Admins can update wallpaper order files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'wallpaper-orders' AND
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete wallpaper order files" ON storage.objects;
CREATE POLICY "Admins can delete wallpaper order files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'wallpaper-orders' AND
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );