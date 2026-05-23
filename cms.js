/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  TEEMA'S COLLECTIONS — CMS MODULE (cms.js)                  ║
 * ║  Supabase-powered dynamic content layer                      ║
 * ║  v2 — Fixed: CSV disabled, auth, image uploads, sync        ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * LOAD ORDER (in index.html):
 *   <script src="cms.js"></script>          ← this file, FIRST
 *   <script src="main.js"></script>         ← (or inline script), SECOND
 *
 * This file MUST load before index.html's main script so that
 * window.loadProducts is already replaced before it gets called.
 *
 * TABLES USED:
 *   products            → main product records
 *   product_images      → multiple images per product (with sort + primary)
 *   categories          → product categories
 *   settings            → key/value site settings
 *   homepage_sections   → mood cards
 *   navigation          → nav links
 *   media               → media library entries
 */

// ─── SUPABASE CONFIG ────────────────────────────────────────────────────────
const SUPABASE_URL  = "https://zvfbkvnbndbptqtjunpt.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2ZmJrdm5ibmRicHRxdGp1bnB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NDg4OTksImV4cCI6MjA5NTEyNDg5OX0.K22NFSvkn6pNuWJeR5SclOlgh02kMkE9kWwdBHUSM5A";

// ─── KILL CSV SYSTEM IMMEDIATELY ────────────────────────────────────────────
// Stub out every legacy CSV/demo function before the main script loads.
// This runs at parse time (synchronous) so it wins the race condition.
window.loadProductsFromCSV = () => { console.log("[CMS] CSV loader disabled — using Supabase"); };
window.showDemo            = () => { console.log("[CMS] Demo suppressed — using Supabase"); };
// Also stub fetchCSV / parseCSV if they exist
window.fetchCSV            = () => Promise.resolve([]);
window.parseCSV            = () => [];

// ─── SUPABASE REST HELPERS ───────────────────────────────────────────────────
const sb = {

  // Standard GET query
  async from(table, select = "*", filters = {}, opts = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
    Object.entries(filters).forEach(([col, val]) => {
      url += `&${col}=eq.${encodeURIComponent(val)}`;
    });
    if (opts.order)  url += `&order=${opts.order}`;
    if (opts.limit)  url += `&limit=${opts.limit}`;
    const headers = {
      "apikey":        SUPABASE_ANON,
      "Authorization": `Bearer ${SUPABASE_ANON}`,
      "Content-Type":  "application/json",
    };
    if (opts.single) headers["Accept"] = "application/vnd.pgrst.object+json";
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Supabase ${table}: ${res.status}`);
    }
    return res.json();
  },

  // INSERT — accepts single object or array
  async insert(table, data, token = null) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method:  "POST",
      headers: {
        "apikey":        SUPABASE_ANON,
        "Authorization": `Bearer ${token || SUPABASE_ANON}`,
        "Content-Type":  "application/json",
        "Prefer":        "return=representation",
      },
      body: JSON.stringify(Array.isArray(data) ? data : [data]),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Supabase insert ${table}: ${res.status}`);
    }
    return res.json();
  },

  // PATCH by id
  async update(table, id, data, token = null) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method:  "PATCH",
      headers: {
        "apikey":        SUPABASE_ANON,
        "Authorization": `Bearer ${token || SUPABASE_ANON}`,
        "Content-Type":  "application/json",
        "Prefer":        "return=representation",
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Supabase update ${table}: ${res.status}`);
    }
    return res.json();
  },

  // DELETE by id
  async delete(table, id, token = null) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method:  "DELETE",
      headers: {
        "apikey":        SUPABASE_ANON,
        "Authorization": `Bearer ${token || SUPABASE_ANON}`,
        "Content-Type":  "application/json",
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Supabase delete ${table}: ${res.status}`);
    }
    return true;
  },

  /**
   * Upload a file to Supabase Storage and return its public URL.
   * Requires the bucket to have public read access.
   * Uses upsert (x-upsert: true) so re-uploading the same path replaces the file.
   *
   * @param {string} bucket  - storage bucket name (e.g. "products", "banners")
   * @param {string} path    - file path inside bucket (e.g. "abc123_photo.jpg")
   * @param {File}   file    - File object from input[type=file]
   * @param {string} token   - optional auth token for authenticated uploads
   * @returns {string}       - public URL
   */
  async upload(bucket, path, file, token = null) {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
      {
        method:  "POST",
        headers: {
          "apikey":        SUPABASE_ANON,
          "Authorization": `Bearer ${token || SUPABASE_ANON}`,
          "Content-Type":  file.type || "application/octet-stream",
          "Cache-Control": "3600",
          "x-upsert":      "true",
        },
        body: file,
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Storage upload ${path}: ${res.status}`);
    }
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  },
};

// Expose sb globally so admin.html inline scripts can share it
window._sb = sb;

// ─── SETTINGS CACHE ─────────────────────────────────────────────────────────
let _siteSettings = {};

async function loadSiteSettings() {
  if (!SUPABASE_URL || SUPABASE_URL.includes("PASTE_YOUR")) return;
  try {
    const rows = await sb.from("settings");
    rows.forEach(r => { _siteSettings[r.key] = r.value; });
    applySiteSettings();
    console.log("[CMS] Settings loaded:", Object.keys(_siteSettings).length, "keys");
  } catch (e) {
    console.warn("[CMS] Settings load failed (using static fallback):", e.message);
  }
}

/**
 * Apply DB settings to DOM.
 *
 * NOTE on "(html)" labels in admin:
 * Keys like shipping_info / returns_policy / sustainability_info store raw HTML.
 * The admin panel previously showed the raw key name. In admin.html these are now
 * rendered with friendly labels. The "(html)" indicator has been removed from labels.
 * The values are applied via innerHTML so rich text is preserved.
 */
function applySiteSettings() {
  const s = _siteSettings;

  // Helper: set DOM property safely
  const set = (sel, val, prop = "textContent") => {
    if (!val) return;
    const el = typeof sel === "string" ? document.querySelector(sel) : sel;
    if (!el) return;
    if      (prop === "innerHTML")   el.innerHTML   = val;
    else if (prop === "src")         el.src         = val;
    else if (prop === "href")        el.href        = val;
    else                             el.textContent = val;
  };

  if (s.announcement_text)    set(".announcement", s.announcement_text);
  if (s.hero_tag)             set(".hero-text .tag", s.hero_tag);
  if (s.hero_h1)              set(".hero-text h1", s.hero_h1, "innerHTML");
  if (s.hero_p)               set(".hero-text > p", s.hero_p);
  if (s.hero_btn_primary)     set("#heroBtnPrimary", s.hero_btn_primary);
  if (s.hero_btn_outline)     set("#heroBtnOutline", s.hero_btn_outline);
  // FIX: image URLs must NOT go through sanitize() — sanitize() escapes colons/slashes
  if (s.hero_image_url)       set(".hero-image img", s.hero_image_url, "src");
  if (s.hero_badge_label)     set(".hero-badge p", s.hero_badge_label);
  if (s.hero_badge_quote)     set(".hero-badge strong", s.hero_badge_quote);
  if (s.quote_strip_text)     set(".quote-strip blockquote", `"${s.quote_strip_text}"`);
  if (s.products_section_tag) set("#productsSectionTag", s.products_section_tag);
  if (s.products_section_h2)  set("#productsSectionH2",  s.products_section_h2);
  if (s.promise_h2)           set(".promise-text h2", s.promise_h2);
  if (s.promise_p)            set(".promise-text > p", s.promise_p);
  if (s.newsletter_h2)        set(".newsletter h2", s.newsletter_h2);
  if (s.newsletter_p)         set(".newsletter p",  s.newsletter_p);
  if (s.footer_tagline)       set(".footer-brand > p", s.footer_tagline);
  if (s.footer_copyright)     set(".footer-bottom p:first-child", s.footer_copyright);
  if (s.site_title)           document.title = s.site_title;
  if (s.site_description) {
    const md = document.querySelector("meta[name='description']");
    if (md) md.content = s.site_description;
  }
  if (s.instagram_url) set(".footer-socials a[aria-label='Instagram']", s.instagram_url, "href");
  if (s.tiktok_url)    set(".footer-socials a[aria-label='TikTok']",    s.tiktok_url,    "href");

  // Marquee — pipe-separated words "Word One|Word Two|..."
  if (s.marquee_text) {
    const words   = s.marquee_text.split("|").map(w => w.trim()).filter(Boolean);
    const doubled = [...words, ...words];
    const track   = document.querySelector(".marquee-track");
    if (track) track.innerHTML = doubled.map(w => `<span>${w}</span>`).join("");
  }

  // Override JS constants used in cart / WhatsApp flows
  if (s.wa_number) window.WA_NUMBER = s.wa_number;
  if (s.logo_url && s.logo_url !== window.LOGO_URL) {
    window.LOGO_URL = s.logo_url;
    const navLogo = document.getElementById("navLogo");
    if (navLogo) {
      navLogo.innerHTML = `<img src="${s.logo_url}" alt="Teema's Collections" class="logo-img" />`;
      navLogo.style.cssText = "display:flex;align-items:center;padding:0";
    }
    const footerLogo = document.getElementById("footerLogo");
    if (footerLogo) {
      footerLogo.innerHTML = `<img src="${s.logo_url}" alt="Teema's Collections" class="logo-img-footer" />`;
      footerLogo.className = "";
    }
  }

  // Info modal content — applied as innerHTML so HTML formatting is preserved
  // These keys store rich HTML edited in the admin Settings panel
  if (typeof INFO_CONTENT !== "undefined") {
    if (s.shipping_info)       INFO_CONTENT.shipping.body      = s.shipping_info;
    if (s.returns_policy)      INFO_CONTENT.returns.body       = s.returns_policy;
    if (s.sustainability_info) INFO_CONTENT.sustainability.body = s.sustainability_info;
  }
}

// ─── HOMEPAGE SECTIONS (MOOD CARDS) ─────────────────────────────────────────
async function loadHomepageSections() {
  if (!SUPABASE_URL || SUPABASE_URL.includes("PASTE_YOUR")) return;
  try {
    const sections = await sb.from(
      "homepage_sections", "*", { is_active: true }, { order: "sort_order.asc" }
    );
    if (!sections || sections.length === 0) return; // keep static HTML fallback
    const grid = document.querySelector(".mood-grid");
    if (!grid) return;
    grid.innerHTML = sections.map(s => `
      <div class="mood-card">
        <img src="${s.image_url || ''}"
             alt="${sanitize(s.title)}"
             loading="lazy"
             onerror="this.src='https://via.placeholder.com/600x800/F0E8FA/8B5CC8?text=TC'" />
        <div class="mood-card-overlay">
          <span class="tag">${sanitize(s.label || "Collection")}</span>
          <h3>${sanitize(s.title)}</h3>
          <p>${sanitize(s.description || "")}</p>
          <button class="mood-link"
            onclick="filterProducts('${sanitize(s.filter_category || "")}');scrollToSection('products')">
            ${sanitize(s.button_text || "View Collection →")}
          </button>
        </div>
      </div>`).join("");
    if (typeof refreshMoodNewDots === "function") refreshMoodNewDots();
    console.log("[CMS] Mood cards loaded:", sections.length);
  } catch (e) {
    console.warn("[CMS] Homepage sections failed (static fallback):", e.message);
  }
}

// ─── PRODUCTS — SUPABASE OVERRIDE ───────────────────────────────────────────
/**
 * This replaces the original loadProducts() defined in index.html's main script.
 *
 * FIX — Race condition: we assign window.loadProducts SYNCHRONOUSLY at parse
 * time here, before DOMContentLoaded. The main script's DOMContentLoaded
 * listener will then call THIS version, not the CSV one.
 *
 * FIX — Empty database: when DB has 0 active products we show an empty state
 * message instead of falling through to CSV/demo data.
 *
 * FIX — Image URLs were passed through sanitize() which escapes colons and
 * slashes, breaking <img src>. Image URLs are now used raw.
 */
window.loadProducts = async function loadProducts() {
  console.log("[CMS] loadProducts() — fetching from Supabase");

  if (!SUPABASE_URL || SUPABASE_URL.includes("PASTE_YOUR")) {
    console.warn("[CMS] Supabase not configured");
    return;
  }

  try {
    // ── 1. Fetch all active products ──
    const products = await sb.from(
      "products",
      "id,name,description,category,price,discount_price,status,size,tags,slug,is_featured,is_sale,date_added,sort_order",
      { is_active: true },
      { order: "sort_order.asc,created_at.desc" }
    );

    console.log("[CMS] Products fetched from Supabase:", products ? products.length : 0);

    // ── 2. Empty database → show friendly empty state (NO CSV fallback) ──
    if (!products || products.length === 0) {
      console.log("[CMS] No products in database. Showing empty state.");
      cmsShowEmptyState();
      return;
    }

    // ── 3. Fetch all product images, index by product_id ──
    const images = await sb.from(
      "product_images",
      "product_id,url,is_primary,sort_order",
      {},
      { order: "product_id.asc,is_primary.desc,sort_order.asc" }
    );

    // Build a map: product_id → [url, url, ...] (primary first)
    const imgMap = {};
    (images || []).forEach(img => {
      if (!img.product_id) return;
      if (!imgMap[img.product_id]) imgMap[img.product_id] = [];
      imgMap[img.product_id].push(img.url);
    });

    // ── 4. Normalize to shape expected by renderProducts() ──
    window.allProducts = products.map(p => ({
      ...p,
      // Primary image — use raw URL, NOT sanitize() which breaks image paths
      image:         (imgMap[p.id]?.[0]) || "",
      image_link:    (imgMap[p.id]?.[0]) || "",
      // All images for gallery/lightbox
      _images:       imgMap[p.id] || [],
      // Ensure price is string (some render functions do string ops on it)
      price:         p.price != null ? String(p.price) : "",
      discount_price: p.discount_price != null ? String(p.discount_price) : "",
      status:        p.status || "Available",
      tags:          p.tags   || "",
    }));

    console.log("[CMS] Normalized products:", window.allProducts.length);

    // ── 5. Render ──
    if (typeof renderProducts   === "function") renderProducts(window.allProducts);
    if (typeof buildFilterButtons === "function") buildFilterButtons();
    if (typeof refreshMoodNewDots === "function") refreshMoodNewDots();

  } catch (e) {
    console.error("[CMS] Products fetch failed:", e.message);
    // Show error state — still no CSV fallback
    cmsShowErrorState(e.message);
  }
};

/**
 * Show an empty-state message in the product grid.
 * Called when the database has no active products yet.
 */
function cmsShowEmptyState() {
  const grid = document.querySelector(".product-grid, #productGrid, [data-product-grid]");
  if (!grid) return;
  grid.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:4rem 1rem;color:#7B6A90;">
      <p style="font-size:1.1rem;margin-bottom:0.5rem">No products yet.</p>
      <p style="font-size:0.85rem">Add your first product in the admin dashboard.</p>
    </div>`;
}

/**
 * Show an error-state message in the product grid.
 */
function cmsShowErrorState(msg) {
  const grid = document.querySelector(".product-grid, #productGrid, [data-product-grid]");
  if (!grid) return;
  grid.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:4rem 1rem;color:#dc3545;">
      <p style="font-size:1rem">Could not load products.</p>
      <p style="font-size:0.75rem;margin-top:0.3rem;opacity:0.7">${sanitize(msg)}</p>
    </div>`;
}

// ─── NAVIGATION ─────────────────────────────────────────────────────────────
async function loadNavigation() {
  if (!SUPABASE_URL || SUPABASE_URL.includes("PASTE_YOUR")) return;
  try {
    const links = await sb.from("navigation", "*", { is_active: true }, { order: "sort_order.asc" });
    if (!links || links.length === 0) return;

    const desktopNav = document.querySelector(".nav-links");
    const mobileNav  = document.querySelector("#mobileNav ul");
    if (!desktopNav && !mobileNav) return;

    const makeLink = (l, mobile = false) => {
      const label = sanitize(l.label);
      if (l.type === "filter") {
        const fn = mobile
          ? `filterProducts('${sanitize(l.filter_value || "")}');scrollToSection('products');closeMobileNav()`
          : `filterProducts('${sanitize(l.filter_value || "")}');scrollToSection('products')`;
        return `<li><a href="javascript:void(0)" onclick="${fn}">${label}</a></li>`;
      }
      if (l.type === "scroll") {
        const fn = mobile
          ? `scrollToSection('${sanitize(l.target_id || "")}');closeMobileNav()`
          : `scrollToSection('${sanitize(l.target_id || "")}')`;
        return `<li><a href="javascript:void(0)" onclick="${fn}">${label}</a></li>`;
      }
      if (l.type === "overlay") {
        const fn = mobile ? `${sanitize(l.target_id)}();closeMobileNav()` : `${sanitize(l.target_id)}()`;
        return `<li><a href="javascript:void(0)" onclick="${fn}">${label}</a></li>`;
      }
      return `<li><a href="${l.url || '#'}" target="_blank" rel="noopener">${label}</a></li>`;
    };

    if (desktopNav) {
      desktopNav.innerHTML = links.map(l => makeLink(l, false)
        .replace(/^<li>/, "").replace(/<\/li>$/, "")).join("");
    }
    if (mobileNav) {
      mobileNav.innerHTML = links.map(l => makeLink(l, true)).join("");
    }
    console.log("[CMS] Navigation loaded:", links.length, "links");
  } catch (e) {
    console.warn("[CMS] Navigation failed (static fallback):", e.message);
  }
}

// ─── NEWSLETTER PATCH ────────────────────────────────────────────────────────
// Runs after DOMContentLoaded so window.subscribeNewsletter is already defined
function patchNewsletter() {
  if (typeof window.subscribeNewsletter !== "function") return;
  const _orig = window.subscribeNewsletter;
  window.subscribeNewsletter = async function () {
    await _orig();
    if (!SUPABASE_URL || SUPABASE_URL.includes("PASTE_YOUR")) return;
    const email = document.getElementById("newsletterEmail")?.value?.trim();
    if (!email || !email.includes("@")) return;
    try {
      await sb.insert("newsletter_subscribers", {
        email,
        subscribed_at: new Date().toISOString(),
      });
    } catch { /* Silently fail — Formspree already captured it */ }
  };
}

// ─── UTILITY ─────────────────────────────────────────────────────────────────
/**
 * HTML-escape for inserting untrusted strings into HTML text nodes / attributes.
 * DO NOT use on URLs that go into src/href — it will break them.
 * Use raw values for src/href and validate them separately if needed.
 */
function sanitize(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ─── IMAGE UPLOAD HELPER (PUBLIC) ────────────────────────────────────────────
/**
 * Upload a single File to Supabase Storage.
 * Exposed on window so admin.html and any inline script can call it.
 *
 * Usage:
 *   const url = await cmsUploadImage(file, "products");
 *   // returns full public URL like https://…/storage/v1/object/public/products/123_photo.jpg
 *
 * Buckets expected (create in Supabase Storage → New bucket → Public):
 *   products   → product images
 *   banners    → hero / banner images
 *   sections   → mood card images
 *   general    → logos, misc
 *   videos     → product / promo videos
 *
 * @param {File}   file    - File object
 * @param {string} bucket  - bucket name
 * @param {string} token   - optional admin auth token for authenticated uploads
 * @returns {string}       - public URL
 */
window.cmsUploadImage = async function (file, bucket = "products", token = null) {
  if (!file) throw new Error("No file provided");
  const ext  = file.name.split(".").pop().toLowerCase();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${Date.now()}_${safe}`;
  return sb.upload(bucket, path, file, token);
};

/**
 * Upload multiple files and return array of public URLs.
 * @param {FileList|File[]} files
 * @param {string} bucket
 * @param {string} token
 * @returns {string[]}
 */
window.cmsUploadImages = async function (files, bucket = "products", token = null) {
  const arr = Array.from(files);
  return Promise.all(arr.map(f => window.cmsUploadImage(f, bucket, token)));
};

// ─── INIT ────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  console.log("[CMS] DOMContentLoaded — initialising");
  loadSiteSettings();
  loadHomepageSections();
  loadNavigation();
  patchNewsletter();
  // loadProducts() is called by index.html's own init — we've already
  // replaced window.loadProducts above so it will use Supabase.
});
