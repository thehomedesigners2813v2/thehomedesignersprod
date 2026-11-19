ALTER TABLE public.wallpaper_orders DROP CONSTRAINT IF EXISTS wallpaper_orders_wallpaper_type_check;
ALTER TABLE public.wallpaper_orders
  ADD CONSTRAINT wallpaper_orders_wallpaper_type_check
  CHECK (wallpaper_type IN ('normal', 'luxury', 'golden_foil'));
