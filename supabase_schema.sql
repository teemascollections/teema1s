-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  TEEMA'S COLLECTIONS — SUPABASE DATABASE SCHEMA                     ║
-- ║  Run this entire file in Supabase → SQL Editor → New Query           ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ──────────────────────────────────────────────────────────
-- 1. PRODUCTS
--    Main product catalog. Fetched by cms.js → renderProducts()
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  category         TEXT,                   -- "Dresses", "Tops", "Skirts", "Trousers" etc.
  price            NUMERIC(12,2) DEFAULT 0,
  discount_price   NUMERIC(12,2),          -- Optional sale price shown as old/new
  status           TEXT DEFAULT 'Available',  -- 'Available' | 'Sold Out' | 'Coming Soon'
  size             TEXT,                   -- "M", "10-12", "One Size" etc.
  tags             TEXT,                   -- comma-separated "summer,casual,sale"
  slug             TEXT UNIQUE,            -- URL-friendly ID e.g. "velvet-evening-gown"
  is_featured      BOOLEAN DEFAULT false,
  is_sale          BOOLEAN DEFAULT false,
  is_active        BOOLEAN DEFAULT true,   -- false = hidden from storefront
  sort_order       INTEGER DEFAULT 0,      -- lower = appears first
  date_added       TIMESTAMPTZ DEFAULT NOW(),
  seo_title        TEXT,
  seo_description  TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- 2. PRODUCT IMAGES
--    Multiple images per product. First is_primary image is shown as main.
--    Fetched alongside products in cms.js loadProducts()
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,              -- Supabase Storage public URL
  is_primary  BOOLEAN DEFAULT false,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- 3. SETTINGS
--    Key/value store for all editable site content.
--    Fetched by cms.js loadSiteSettings() → applySiteSettings()
--    Edited in admin.html → Settings panel
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT UNIQUE NOT NULL,  -- e.g. "hero_h1", "wa_number"
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings so the site has fallback values
INSERT INTO settings (key, value) VALUES
  ('site_title',           'Teema''s Collections | Feminine Luxury Thrift – Nigeria'),
  ('site_description',     'Teema''s Collections is Nigeria''s Feminine Luxury Thrift brand. Shop classy, elegant and affordable luxury clothing for women.'),
  ('announcement_text',    'Free delivery on orders above ₦70,000 ✦ New pieces drop weekly'),
  ('logo_url',             'https://res.cloudinary.com/dqbdcvsmr/image/upload/v1779233956/Logo_hyry63.png'),
  ('hero_tag',             '✦ Established Heritage · Nigeria'),
  ('hero_h1',              'Welcome<br><em>My Queens.</em>'),
  ('hero_p',               'Luxury is defined by the fit, not the price. Discover curated feminine fashion — classy, elegant and effortlessly affordable.'),
  ('hero_btn_primary',     'Shop The Collection'),
  ('hero_btn_outline',     'Explore Moods'),
  ('hero_image_url',       'https://teemahscollection.netlify.app/WhatsApp%20Image%202026-04-13%20at%2011.51.43.jpeg'),
  ('hero_badge_label',     'Our Promise'),
  ('hero_badge_quote',     '"Uncompromised Standards. Unbeatable Prices."'),
  ('marquee_text',         'Teema''s Collections|Feminine Luxury Thrift|Nigeria''s Finest|Hey My Queens|Classy · Elegant · Affordable|New Arrivals Weekly'),
  ('quote_strip_text',     'Uncompromised Standards. Unbeatable Prices.'),
  ('products_section_tag', 'Featured Sector'),
  ('products_section_h2',  'The Teema''s Signature Selection'),
  ('promise_h2',           'Quality in Every Piece'),
  ('promise_p',            'We source the finest thrift and ready-made pieces from UK🇬🇧/US🇺🇸. Every item in our collection is vetted for quality, trend, and ultimate comfort.'),
  ('newsletter_h2',        'Hey My Queens 👑'),
  ('newsletter_p',         'Join our royal list — be the first to know about new arrivals, exclusive drops and special offers.'),
  ('footer_tagline',       'Nigeria''s Feminine Luxury Thrift brand. Curating the best of classy, elegant and affordable fashion for our queens.'),
  ('footer_copyright',     '© 2026 Teema''s Collections. All Rights Reserved. · Nigeria'),
  ('wa_number',            '2348039567566'),
  ('instagram_url',        'https://www.instagram.com/TEEMAS_COLLECTIONS_NG'),
  ('tiktok_url',           'https://www.tiktok.com/@TEEMASCOLLECTIONS1')
ON CONFLICT (key) DO NOTHING;

-- ──────────────────────────────────────────────────────────
-- 4. HOMEPAGE SECTIONS (MOOD CARDS)
--    Replaces the static mood-grid HTML.
--    Fetched by cms.js loadHomepageSections()
--    Edited in admin.html → Mood Cards panel
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS homepage_sections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,          -- "Teema's Escape"
  label            TEXT,                   -- "Collection 01"
  description      TEXT,
  filter_category  TEXT,                   -- must match a product category
  button_text      TEXT DEFAULT 'View Collection →',
  image_url        TEXT,
  sort_order       INTEGER DEFAULT 0,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default mood cards from the original static HTML
INSERT INTO homepage_sections (title, label, description, filter_category, button_text, image_url, sort_order) VALUES
  ('Teema''s Escape', 'Collection 01', 'For the wanderer and the dreamer. Lightweight luxury for slow mornings.', 'Dresses', 'View Collection →', 'https://teemahscollection.netlify.app/WhatsApp%20Image%202026-04-13%20at%2011.51.44%20(3).jpeg', 1),
  ('Soft Moments',    'Collection 02', 'Delicate silhouettes for the queen who moves through life with grace.', 'Tops',    'Explore →',          'https://teemahscollection.netlify.app/WhatsApp%20Image%202026-04-13%20at%2011.51.44%20(2).jpeg', 2),
  ('After Dark',      'Collection 03', 'Regal presence. Where confidence meets the craftsmanship of the night.', 'Skirts', 'Shop The Evening →', 'https://teemahscollection.netlify.app/WhatsApp%20Image%202026-04-13%20at%2011.51.44%20(4).jpeg', 3),
  ('Office Edition',  'Collection 04', 'Boss energy in every piece. Dress the part, own the room.',           'Trousers','View →',             'https://teemahscollection.netlify.app/WhatsApp%20Image%202026-04-13%20at%2011.51.44.jpeg',         4)
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────
-- 5. NAVIGATION
--    Dynamic header and mobile nav links.
--    Fetched by cms.js loadNavigation()
--    Edited in admin.html → Navigation panel
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS navigation (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label        TEXT NOT NULL,           -- "New Arrivals"
  type         TEXT DEFAULT 'filter',   -- 'filter' | 'scroll' | 'overlay' | 'external'
  filter_value TEXT,                    -- used when type='filter' e.g. "Dresses"
  target_id    TEXT,                    -- used when type='scroll' (section id) or 'overlay' (function name)
  url          TEXT,                    -- used when type='external'
  sort_order   INTEGER DEFAULT 0,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default nav links
INSERT INTO navigation (label, type, filter_value, target_id, sort_order) VALUES
  ('All Pieces',   'filter', 'all',      NULL,         1),
  ('New Arrivals', 'overlay', NULL,      'openNewArrivals', 2),
  ('Sales',        'overlay', NULL,      'openSales',   3),
  ('Dresses',      'filter', 'Dresses',  NULL,          4),
  ('Tops',         'filter', 'Tops',     NULL,          5),
  ('Skirts',       'filter', 'Skirts',   NULL,          6),
  ('Trousers',     'filter', 'Trousers', NULL,          7),
  ('About',        'scroll',  NULL,      'about',       8)
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────
-- 6. MEDIA
--    Tracks uploaded media files separately from product_images.
--    Useful for banners, hero images, gallery.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url        TEXT NOT NULL,
  filename   TEXT,
  bucket     TEXT,                -- 'products' | 'banners' | 'sections' | 'general'
  media_type TEXT DEFAULT 'image',-- 'image' | 'video'
  label      TEXT,                -- optional human label
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- 7. NEWSLETTER SUBSCRIBERS
--    Saves emails from the newsletter form on the storefront.
--    Written by cms.js patchNewsletter()
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- Public: read products, settings, homepage_sections, navigation
-- Authenticated (admin): full access to everything
-- ══════════════════════════════════════════════════════════

ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images      ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_sections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE navigation          ENABLE ROW LEVEL SECURITY;
ALTER TABLE media               ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Public read for storefront tables
CREATE POLICY "public_read_products"          ON products          FOR SELECT USING (is_active = true);
CREATE POLICY "public_read_product_images"    ON product_images    FOR SELECT USING (true);
CREATE POLICY "public_read_settings"          ON settings          FOR SELECT USING (true);
CREATE POLICY "public_read_homepage_sections" ON homepage_sections FOR SELECT USING (is_active = true);
CREATE POLICY "public_read_navigation"        ON navigation        FOR SELECT USING (is_active = true);

-- Authenticated admin full access
CREATE POLICY "admin_all_products"       ON products            FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_product_images" ON product_images      FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_settings"       ON settings            FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_sections"       ON homepage_sections   FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_navigation"     ON navigation          FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_media"          ON media               FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_read_subscribers"   ON newsletter_subscribers FOR ALL USING (auth.role() = 'authenticated');

-- Allow anonymous newsletter signup inserts
CREATE POLICY "anon_subscribe"           ON newsletter_subscribers FOR INSERT WITH CHECK (true);

-- ══════════════════════════════════════════════════════════
-- STORAGE BUCKETS
-- Run these commands in Supabase → Storage → New bucket
-- OR uncomment and run here if using service role key
-- ══════════════════════════════════════════════════════════
-- INSERT INTO storage.buckets (id, name, public) VALUES ('products', 'products', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('banners',  'banners',  true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('sections', 'sections', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('general',  'general',  true) ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════════
-- STORAGE POLICIES (run in SQL Editor with service role)
-- ══════════════════════════════════════════════════════════
-- CREATE POLICY "public_read_products_bucket"  ON storage.objects FOR SELECT USING (bucket_id = 'products');
-- CREATE POLICY "admin_upload_products_bucket" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'products' AND auth.role() = 'authenticated');
-- CREATE POLICY "admin_delete_products_bucket" ON storage.objects FOR DELETE USING (bucket_id = 'products' AND auth.role() = 'authenticated');
-- (repeat for banners, sections, general)
