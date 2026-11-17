-- Development plan catalog: Basic and Professional only.
-- Premium stays in the table so old payments still resolve, but it is not offered.

INSERT INTO public.subscription_plans (
  name, description, price, billing_period, features,
  max_projects, max_quotes, priority_support, is_active, sort_order
)
VALUES (
  'Basic',
  'Manual quotations for an individual designer.',
  999,
  'monthly',
  '["Manual quotations","Portfolio and customer messaging"]'::jsonb,
  5,
  20,
  false,
  true,
  1
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  is_active = true,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

UPDATE public.subscription_plans
SET description = 'Template quotations, AI quotations, community publishing, offers, and the AI add-on.',
    features = '["Template quotations","AI quotations","Publish projects in the community","Offers and deals","AI add-on plans"]'::jsonb,
    sort_order = 2,
    is_active = true,
    updated_at = now()
WHERE name = 'Professional';

UPDATE public.subscription_plans
SET is_active = false,
    updated_at = now()
WHERE name = 'Premium';
