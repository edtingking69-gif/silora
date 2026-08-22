-- Seed the SILORA test catalog using the existing product and category tables.
-- Re-running this migration updates the named samples instead of creating duplicates.

INSERT INTO public.categories (name, slug, description, display_order, is_active)
VALUES
  ('Fashion', 'fashion', 'Everyday clothing and accessories', 1, true),
  ('Electronics', 'electronics', 'Useful devices and accessories', 2, true),
  ('Home & Kitchen', 'home', 'Simple upgrades for every room', 3, true),
  ('Beauty', 'beauty', 'Personal care and wellness essentials', 4, true)
ON CONFLICT (slug) DO UPDATE SET is_active = true;

WITH sample_products (name, slug, description, price, original_price, category_slug, image_url, stock, is_featured, is_bestseller, is_trending, is_new) AS (
  VALUES
    ('Men''s Casual Cotton Shirt', 'mens-casual-cotton-shirt', 'A breathable cotton shirt with a relaxed fit for everyday wear.', 799.00, 999.00, 'fashion', 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=900&q=80', 35, true, false, false, true),
    ('Men''s Premium T-Shirt', 'mens-premium-t-shirt', 'A soft premium cotton T-shirt with a clean, versatile silhouette.', 499.00, 699.00, 'fashion', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80', 45, false, true, true, false),
    ('Women''s Casual Kurti', 'womens-casual-kurti', 'A comfortable printed kurti made for easy everyday styling.', 899.00, 1199.00, 'fashion', 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=80', 28, true, false, false, true),
    ('Classic Denim Jeans', 'classic-denim-jeans', 'Durable mid-rise denim jeans with a comfortable straight fit.', 1299.00, 1699.00, 'fashion', 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=900&q=80', 30, false, true, true, false),
    ('Wireless Bluetooth Earbuds', 'wireless-bluetooth-earbuds', 'Compact wireless earbuds with a charging case and clear sound.', 1499.00, 1999.00, 'electronics', 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=900&q=80', 24, true, true, false, true),
    ('Fast Charging USB-C Cable', 'fast-charging-usb-c-cable', 'A durable USB-C cable for fast charging and reliable data transfer.', 299.00, 399.00, 'electronics', 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=900&q=80', 60, false, false, true, true),
    ('Wireless Mouse', 'wireless-mouse', 'A quiet, ergonomic wireless mouse for work and study.', 599.00, 799.00, 'electronics', 'https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=900&q=80', 32, false, true, true, false),
    ('Portable Bluetooth Speaker', 'portable-bluetooth-speaker', 'A compact Bluetooth speaker with rich sound for home or travel.', 1199.00, 1599.00, 'electronics', 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=80', 20, true, false, true, false),
    ('Stainless Steel Water Bottle', 'stainless-steel-water-bottle', 'A leak-resistant stainless steel bottle that keeps drinks cool.', 499.00, 699.00, 'home', 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=80', 40, false, true, false, true),
    ('Kitchen Storage Container Set', 'kitchen-storage-container-set', 'A practical set of stackable containers for an organised kitchen.', 699.00, 899.00, 'home', 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=900&q=80', 25, true, false, false, true),
    ('Everyday Beauty Care Kit', 'everyday-beauty-care-kit', 'A simple daily care kit with gentle essentials for your routine.', 999.00, 1299.00, 'beauty', 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=80', 22, true, true, false, true),
    ('Personal Care Organizer', 'personal-care-organizer', 'A compact organiser with room for everyday grooming essentials.', 599.00, 799.00, 'beauty', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=80', 27, false, false, true, false)
), updated AS (
  UPDATE public.products products
  SET name = sample.name,
      description = sample.description,
      price = sample.price,
      original_price = sample.original_price,
      category_id = categories.id,
      stock = sample.stock,
      is_active = true,
      is_featured = sample.is_featured,
      is_bestseller = sample.is_bestseller,
      is_trending = sample.is_trending,
      is_new = sample.is_new,
      updated_at = now()
  FROM sample_products sample
  JOIN public.categories categories ON categories.slug = sample.category_slug
  WHERE products.slug = sample.slug
  RETURNING products.id, products.slug
)
INSERT INTO public.products (name, slug, description, price, original_price, category_id, stock, is_active, is_featured, is_bestseller, is_trending, is_new)
SELECT sample.name, sample.slug, sample.description, sample.price, sample.original_price, categories.id, sample.stock, true, sample.is_featured, sample.is_bestseller, sample.is_trending, sample.is_new
FROM sample_products sample
JOIN public.categories categories ON categories.slug = sample.category_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.products products WHERE products.slug = sample.slug
);

WITH sample_images (slug, image_url, name) AS (
  VALUES
    ('mens-casual-cotton-shirt', 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=900&q=80', 'Men''s Casual Cotton Shirt'),
    ('mens-premium-t-shirt', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80', 'Men''s Premium T-Shirt'),
    ('womens-casual-kurti', 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=80', 'Women''s Casual Kurti'),
    ('classic-denim-jeans', 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=900&q=80', 'Classic Denim Jeans'),
    ('wireless-bluetooth-earbuds', 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=900&q=80', 'Wireless Bluetooth Earbuds'),
    ('fast-charging-usb-c-cable', 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=900&q=80', 'Fast Charging USB-C Cable'),
    ('wireless-mouse', 'https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=900&q=80', 'Wireless Mouse'),
    ('portable-bluetooth-speaker', 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=80', 'Portable Bluetooth Speaker'),
    ('stainless-steel-water-bottle', 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=80', 'Stainless Steel Water Bottle'),
    ('kitchen-storage-container-set', 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=900&q=80', 'Kitchen Storage Container Set'),
    ('everyday-beauty-care-kit', 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=80', 'Everyday Beauty Care Kit'),
    ('personal-care-organizer', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=80', 'Personal Care Organizer')
)
INSERT INTO public.product_images (product_id, url, alt, display_order)
SELECT products.id, sample.image_url, sample.name, 0
FROM sample_images sample
JOIN public.products products ON products.slug = sample.slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_images images
  WHERE images.product_id = products.id AND images.url = sample.image_url
);