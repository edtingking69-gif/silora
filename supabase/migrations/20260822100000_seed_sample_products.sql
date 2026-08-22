-- Seed a small catalog for development and initial deployment.
-- The schema stores stock on products.stock and images in product_images.url.

INSERT INTO public.categories (name, slug, description, display_order, is_active)
SELECT seed.name, seed.slug, seed.description, seed.display_order, true
FROM (VALUES
  ('Fashion', 'fashion', 'Everyday clothing and accessories', 1),
  ('Electronics', 'electronics', 'Useful devices and accessories', 2),
  ('Home', 'home', 'Simple upgrades for every room', 3),
  ('Beauty', 'beauty', 'Personal care and wellness essentials', 4),
  ('Gadgets', 'gadgets', 'Clever tools for daily life', 5)
) AS seed(name, slug, description, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories existing WHERE existing.slug = seed.slug
);

WITH seed_products (name, slug, description, price, category_slug, image_url, stock_quantity, is_active) AS (
  VALUES
    ('Classic Cotton Shirt', 'classic-cotton-shirt', 'Soft, breathable cotton shirt for everyday wear.', 1299.00, 'fashion', 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=900&q=80', 40, true),
    ('Wireless Earbuds', 'wireless-earbuds', 'Compact Bluetooth earbuds with a charging case.', 2499.00, 'electronics', 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=900&q=80', 25, true),
    ('Ceramic Table Lamp', 'ceramic-table-lamp', 'Warm light and a clean silhouette for bedside tables.', 1899.00, 'home', 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80', 18, true),
    ('Daily Glow Skincare Set', 'daily-glow-skincare-set', 'A gentle cleanser and moisturizer for a simple routine.', 1599.00, 'beauty', 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=80', 30, true),
    ('Smart Fitness Band', 'smart-fitness-band', 'Lightweight activity tracking with an all-day battery.', 3299.00, 'gadgets', 'https://images.unsplash.com/photo-1557935728-e6d1eaabe558?auto=format&fit=crop&w=900&q=80', 22, true)
)
INSERT INTO public.products (name, slug, description, price, category_id, is_active, stock)
SELECT seed.name, seed.slug, seed.description, seed.price, categories.id, seed.is_active, seed.stock_quantity
FROM seed_products seed
JOIN public.categories categories ON categories.slug = seed.category_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.products existing WHERE existing.slug = seed.slug
);

WITH seed_products (slug, image_url, name) AS (
  VALUES
    ('classic-cotton-shirt', 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=900&q=80', 'Classic Cotton Shirt'),
    ('wireless-earbuds', 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=900&q=80', 'Wireless Earbuds'),
    ('ceramic-table-lamp', 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80', 'Ceramic Table Lamp'),
    ('daily-glow-skincare-set', 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=80', 'Daily Glow Skincare Set'),
    ('smart-fitness-band', 'https://images.unsplash.com/photo-1557935728-e6d1eaabe558?auto=format&fit=crop&w=900&q=80', 'Smart Fitness Band')
)
INSERT INTO public.product_images (product_id, url, alt, display_order)
SELECT products.id, seed.image_url, seed.name, 0
FROM seed_products seed
JOIN public.products products ON products.slug = seed.slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_images existing
  WHERE existing.product_id = products.id AND existing.url = seed.image_url
);
