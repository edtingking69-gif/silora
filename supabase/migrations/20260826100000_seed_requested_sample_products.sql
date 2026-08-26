-- Add requested customer-facing sample products. Safe to rerun by slug.
WITH sample_products (name, slug, description, price, original_price, image_url, stock, is_featured) AS (
  VALUES
    ('Women''s Ribbed Everyday Top', 'womens-ribbed-everyday-top', 'A soft ribbed top with a flattering fit for everyday outfits.', 649.00, 799.00, 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=900&q=80', 32, true),
    ('Women''s Floral Midi Dress', 'womens-floral-midi-dress', 'A light floral midi dress with an easy silhouette for weekends and occasions.', 1199.00, 1599.00, 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=900&q=80', 20, true),
    ('Everyday Canvas Sneakers', 'everyday-canvas-sneakers', 'Cushioned low-top canvas sneakers designed for comfortable daily wear.', 999.00, 1299.00, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80', 26, false),
    ('Urban Travel Backpack', 'urban-travel-backpack', 'A durable everyday backpack with room for a laptop and daily essentials.', 1099.00, 1399.00, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80', 18, true),
    ('Minimalist Steel Watch', 'minimalist-steel-watch', 'A clean analogue watch with a stainless steel case and adjustable strap.', 1499.00, 1999.00, 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=900&q=80', 15, false)
), upserted AS (
  UPDATE public.products products
  SET name = sample.name,
      description = sample.description,
      price = sample.price,
      original_price = sample.original_price,
      category_id = categories.id,
      stock = sample.stock,
      is_active = true,
      is_featured = sample.is_featured,
      updated_at = now()
  FROM sample_products sample
  JOIN public.categories categories ON categories.slug = 'fashion'
  WHERE products.slug = sample.slug
  RETURNING products.id
)
INSERT INTO public.products (name, slug, description, price, original_price, category_id, stock, is_active, is_featured)
SELECT sample.name, sample.slug, sample.description, sample.price, sample.original_price,
       categories.id, sample.stock, true, sample.is_featured
FROM sample_products sample
JOIN public.categories categories ON categories.slug = 'fashion'
WHERE NOT EXISTS (SELECT 1 FROM public.products products WHERE products.slug = sample.slug);

WITH sample_images (slug, image_url, product_name) AS (
  VALUES
    ('womens-ribbed-everyday-top', 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=900&q=80', 'Women''s Ribbed Everyday Top'),
    ('womens-floral-midi-dress', 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=900&q=80', 'Women''s Floral Midi Dress'),
    ('everyday-canvas-sneakers', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80', 'Everyday Canvas Sneakers'),
    ('urban-travel-backpack', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80', 'Urban Travel Backpack'),
    ('minimalist-steel-watch', 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=900&q=80', 'Minimalist Steel Watch')
)
INSERT INTO public.product_images (product_id, url, alt, display_order)
SELECT products.id, sample.image_url, sample.product_name, 0
FROM sample_images sample
JOIN public.products products ON products.slug = sample.slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_images images
  WHERE images.product_id = products.id AND images.url = sample.image_url
);