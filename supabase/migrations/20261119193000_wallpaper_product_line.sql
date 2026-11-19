ALTER TABLE public.wallpapers_3d
  ADD COLUMN IF NOT EXISTS product_line text NOT NULL DEFAULT 'customized';

ALTER TABLE public.wallpapers_3d
  DROP CONSTRAINT IF EXISTS wallpapers_3d_product_line_check;

ALTER TABLE public.wallpapers_3d
  ADD CONSTRAINT wallpapers_3d_product_line_check
  CHECK (product_line IN ('customized', 'rolls'));
