/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  TEEMA'S COLLECTIONS — CMS MODULE (cms.js)                  ║
 * ║  Supabase-powered dynamic content layer                      ║
 * ║  Replaces Google Sheets CSV with Supabase database           ║
 * ║  Preserves ALL existing frontend render functions            ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * HOW IT WORKS:
 * - This file is loaded BEFORE the main <script> in index.html
 * - It overrides loadProducts() to fetch from Supabase instead of CSV
 * - It fetches site settings (hero, announcement, footer, etc.) from DB
 * - All existing render functions (renderProducts, filterProducts, etc.) remain unchanged
 * - Admin dashboard (admin.html) writes to the same Supabase tables
 *
 * TABLES USED:
 *   products          → main product records
 *   product_images    → multiple images per product
 *   categories        → product categories
 *   settings          → key/value site settings (hero text, announcement, etc.)
 *   homepage_sections → mood cards / curated sections
 *   navigation        → nav links
 *   media             → uploaded banners, videos, gallery
 */

// ─── SUPABASE CONFIG ────────────────────────────────────────────────────────
// ▼ PASTE YOUR SUPABASE URL AND ANON KEY HERE ▼
const SUPABASE_URL  = "https://zvfbkvnbndbptqtjunpt.supabase.co";        // e.g. https://xyzabc.supabase.co
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2ZmJrdm5ibmRicHRxdGp1bnB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NDg4OTksImV4cCI6MjA5NTEyNDg5OX0.K22NFSvkn6pNuWJeR5SclOlgh02kMkE9kWwdBHUSM5A";   // starts with eyJ...
// ▲ SUPABASE CONFIG ▲

// Supabase REST helper — no SDK needed, pure fetch
const sb = {
  /**
   * Query a Supabase table.
   * @param {string} table  - table name
   * @param {string} select - columns (default *)
   * @param {object} filters - { column: value } for eq filters
   * @param {object} opts   - { order, limit, single }
   */
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
    if (!res.ok) throw new Error(`Supabase ${table}: ${res.status}`);
    return res.json();
  },

  /**
   * Insert rows into a table.
   */
  async insert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method:  "POST",
      headers: {
        "apikey":        SUPABASE_ANON,
        "Authorization": `Bearer ${SUPABASE_ANON}`,
        "Content-Type":  "application/json",
        "Prefer":        "return=representation",
      },
      body: JSON.stringify(Array.isArray(data) ? data : [data]),
    });
    if (!res.ok) throw new Error(`Supabase insert ${table}: ${res.status}`);
    return res.json();
  },

  /**
   * Update rows in a table by id.
   */
  async update(table, id, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method:  "PATCH",
      headers: {
        "apikey":        SUPABASE_ANON,
        "Authorization": `Bearer ${SUPABASE_ANON}`,
        "Content-Type":  "application/json",
        "Prefer":        "return=representation",
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Supabase update ${table}: ${res.status}`);
    return res.json();
  },

  /**
   * Delete rows in a table by id.
   */
  async delete(table, id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method:  "DELETE",
      headers: {
        "apikey":        SUPABASE_ANON,
        "Authorization": `Bearer ${SUPABASE_ANON}`,
        "Content-Type":  "application/json",
      },
    });
    if (!res.ok) throw new Error(`Supabase delete ${table}: ${res.status}`);
    return true;
  },

  /**
   * Upload a file to Supabase Storage.
   * @param {string} bucket   - storage bucket name
   * @param {string} path     - file path inside bucket
   * @param {File}   file     - File object
   * @returns {string}        - public URL
   */
  async upload(bucket, path, file) {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
      {
        method:  "POST",
        headers: {
          "apikey":        SUPABASE_ANON,
          "Authorization": `Bearer ${SUPABASE_ANON}`,
          "Content-Type":  file.type,
          "Cache-Control": "3600",
        },
        body: file,
      }
    );
    if (!res.ok) throw new Error(`Storage upload ${path}: ${res.status}`);
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  },
};

// ─── SETTINGS CACHE ─────────────────────────────────────────────────────────
// Loaded once on page init, used to patch DOM with CMS content
let _siteSettings = {};

/**
 * Load all key/value settings from the `settings` table into _siteSettings.
 * Falls back gracefully if Supabase is not configured.
 */
async function loadSiteSettings() {
  if (!SUPABASE_URL || SUPABASE_URL.includes("PASTE_YOUR")) return;
  try {
    const rows = await sb.from("settings");
    rows.forEach(r => { _siteSettings[r.key] = r.value; });
    applySiteSettings();
  } catch (e) {
    console.warn("CMS settings load failed (using static fallback):", e.message);
  }
}

/**
 * Apply settings from DB to DOM elements.
 * Each setting key maps to a data-cms attribute or known element ID.
 *
 * Settings keys used:
 *   announcement_text    → .announcement text
 *   hero_tag             → .hero-text .tag
 *   hero_h1              → .hero-text h1 (supports <em> via HTML)
 *   hero_p               → .hero-text p
 *   hero_btn_primary     → #heroBtnPrimary text
 *   hero_btn_outline     → #heroBtnOutline text
 *   hero_image_url       → .hero-image img src
 *   hero_badge_label     → .hero-badge p
 *   hero_badge_quote     → .hero-badge strong
 *   marquee_text         → replaces marquee track items (pipe-separated)
 *   quote_strip_text     → blockquote
 *   products_section_tag → #productsSectionTag
 *   products_section_h2  → #productsSectionH2
 *   promise_h2           → promise section heading
 *   promise_p            → promise section paragraph
 *   newsletter_h2        → newsletter heading
 *   newsletter_p         → newsletter paragraph
 *   footer_tagline       → footer brand paragraph
 *   footer_copyright     → footer bottom copyright
 *   wa_number            → overrides WA_NUMBER constant
 *   instagram_url        → footer instagram link
 *   tiktok_url           → footer tiktok link
 *   logo_url             → overrides LOGO_URL constant
 *   site_title           → document.title
 *   site_description     → meta description
 *   shipping_info        → INFO_CONTENT.shipping.body (HTML)
 *   returns_policy       → INFO_CONTENT.returns.body (HTML)
 *   sustainability_info  → INFO_CONTENT.sustainability.body (HTML)
 */
function applySiteSettings() {
  const s = _siteSettings;
  const set = (sel, val, prop = "textContent") => {
    if (!val) return;
    const el = typeof sel === "string" ? document.querySelector(sel) : sel;
    if (!el) return;
    if (prop === "innerHTML") el.innerHTML = val;
    else if (prop === "src")  el.src = val;
    else if (prop === "href") el.href = val;
    else el.textContent = val;
  };

  if (s.announcement_text) set(".announcement", s.announcement_text);
  if (s.hero_tag)           set(".hero-text .tag", s.hero_tag);
  if (s.hero_h1)            set(".hero-text h1", s.hero_h1, "innerHTML");
  if (s.hero_p)             set(".hero-text > p", s.hero_p);
  if (s.hero_btn_primary)   set("#heroBtnPrimary", s.hero_btn_primary);
  if (s.hero_btn_outline)   set("#heroBtnOutline", s.hero_btn_outline);
  if (s.hero_image_url)     set(".hero-image img", s.hero_image_url, "src");
  if (s.hero_badge_label)   set(".hero-badge p", s.hero_badge_label);
  if (s.hero_badge_quote)   set(".hero-badge strong", s.hero_badge_quote);
  if (s.quote_strip_text)   set(".quote-strip blockquote", `"${s.quote_strip_text}"`, "textContent");
  if (s.products_section_tag) set("#productsSectionTag", s.products_section_tag);
  if (s.products_section_h2)  set("#productsSectionH2", s.products_section_h2);
  if (s.promise_h2)         set(".promise-text h2", s.promise_h2);
  if (s.promise_p)          set(".promise-text > p", s.promise_p);
  if (s.newsletter_h2)      set(".newsletter h2", s.newsletter_h2);
  if (s.newsletter_p)       set(".newsletter p", s.newsletter_p);
  if (s.footer_tagline)     set(".footer-brand > p", s.footer_tagline);
  if (s.footer_copyright)   set(".footer-bottom p:first-child", s.footer_copyright);
  if (s.site_title)         document.title = s.site_title;
  if (s.site_description) {
    const md = document.querySelector("meta[name='description']");
    if (md) md.content = s.site_description;
  }
  if (s.instagram_url) set(".footer-socials a[aria-label='Instagram']", s.instagram_url, "href");
  if (s.tiktok_url)    set(".footer-socials a[aria-label='TikTok']",    s.tiktok_url,    "href");

  // marquee — pipe-separated words e.g. "Teema's Collections|Feminine Luxury|..."
  if (s.marquee_text) {
    const words = s.marquee_text.split("|").map(w => w.trim()).filter(Boolean);
    const doubled = [...words, ...words]; // loop effect needs doubled set
    const track = document.querySelector(".marquee-track");
    if (track) track.innerHTML = doubled.map(w => `<span>${w}</span>`).join("");
  }

  // Override JS constants so cart/WA flows use DB values
  if (s.wa_number && typeof WA_NUMBER !== "undefined") {
    window.WA_NUMBER = s.wa_number;
  }
  if (s.logo_url && typeof LOGO_URL !== "undefined" && s.logo_url !== LOGO_URL) {
    window.LOGO_URL = s.logo_url;
    // Re-run logo init
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

  // Override info modal content if set
  if (s.shipping_info && typeof INFO_CONTENT !== "undefined")
    INFO_CONTENT.shipping.body = s.shipping_info;
  if (s.returns_policy && typeof INFO_CONTENT !== "undefined")
    INFO_CONTENT.returns.body = s.returns_policy;
  if (s.sustainability_info && typeof INFO_CONTENT !== "undefined")
    INFO_CONTENT.sustainability.body = s.sustainability_info;
}

// ─── HOMEPAGE SECTIONS (MOOD CARDS) ─────────────────────────────────────────
/**
 * Load homepage_sections from DB and replace static mood cards.
 * Falls back to existing static HTML if DB has no rows.
 */
async function loadHomepageSections() {
  if (!SUPABASE_URL || SUPABASE_URL.includes("PASTE_YOUR")) return;
  try {
    const sections = await sb.from(
      "homepage_sections",
      "*",
      { is_active: true },
      { order: "sort_order.asc" }
    );
    if (!sections || sections.length === 0) return; // keep static fallback
    const grid = document.querySelector(".mood-grid");
    if (!grid) return;
    grid.innerHTML = sections.map(s => `
      <div class="mood-card">
        <img src="${sanitize(s.image_url)}" alt="${sanitize(s.title)}" loading="lazy"
             onerror="this.src='https://via.placeholder.com/600x800/F0E8FA/8B5CC8?text=TC'" />
        <div class="mood-card-overlay">
          <span class="tag">${sanitize(s.label || "Collection")}</span>
          <h3>${sanitize(s.title)}</h3>
          <p>${sanitize(s.description || "")}</p>
          <button class="mood-link"
            onclick="filterProducts('${sanitize(s.filter_category)}');scrollToSection('products')">
            ${sanitize(s.button_text || "View Collection →")}
          </button>
        </div>
      </div>`).join("");
    // Refresh new-arrival dots after reload
    if (typeof refreshMoodNewDots === "function") refreshMoodNewDots();
  } catch (e) {
    console.warn("CMS homepage sections failed (using static fallback):", e.message);
  }
}

// ─── PRODUCTS ───────────────────────────────────────────────────────────────
/**
 * Override the main loadProducts() function to fetch from Supabase.
 * Maps Supabase columns to the format existing render functions expect:
 *   name, price, description, category, image, status, size, date_added, discount_price, tags, slug, is_featured, is_sale
 *
 * This is called by the original init code at the bottom of index.html.
 * The original CSV loadProducts() is replaced by reassigning window.loadProducts.
 */
window.loadProducts = async function loadProducts() {
  // If Supabase not configured, fall through to demo
  if (!SUPABASE_URL || SUPABASE_URL.includes("PASTE_YOUR")) {
    if (typeof showDemo === "function") showDemo();
    return;
  }
  try {
    // Fetch products with their primary image joined
    const products = await sb.from(
      "products",
      "id,name,description,category,price,discount_price,status,size,tags,slug,is_featured,is_sale,date_added,sort_order",
      { is_active: true },
      { order: "sort_order.asc,created_at.desc" }
    );

    if (!products || products.length === 0) {
      if (typeof showDemo === "function") showDemo();
      return;
    }

    // Fetch all product images and index by product_id
    const images = await sb.from(
      "product_images",
      "product_id,url,is_primary,sort_order",
      {},
      { order: "product_id.asc,is_primary.desc,sort_order.asc" }
    );
    const imgMap = {};
    (images || []).forEach(img => {
      if (!imgMap[img.product_id]) imgMap[img.product_id] = [];
      imgMap[img.product_id].push(img.url);
    });

    // Normalize to shape expected by renderProducts()
    window.allProducts = products.map(p => ({
      ...p,
      image:      (imgMap[p.id] && imgMap[p.id][0]) || "",
      image_link: (imgMap[p.id] && imgMap[p.id][0]) || "",
      // Preserve extra images for gallery
      _images:    imgMap[p.id] || [],
      price:      p.price      ? String(p.price)      : "",
      status:     p.status     || "Available",
    }));

    if (typeof renderProducts === "function")   renderProducts(window.allProducts);
    if (typeof buildFilterButtons === "function") buildFilterButtons();
    if (typeof refreshMoodNewDots === "function") refreshMoodNewDots();

  } catch (e) {
    console.warn("Supabase products failed, using demo:", e.message);
    if (typeof showDemo === "function") showDemo();
  }
};

// ─── NAVIGATION ─────────────────────────────────────────────────────────────
async function loadNavigation() {
  if (!SUPABASE_URL || SUPABASE_URL.includes("PASTE_YOUR")) return;
  try {
    const links = await sb.from("navigation", "*", { is_active: true }, { order: "sort_order.asc" });
    if (!links || links.length === 0) return;
    // Desktop nav links
    const desktopNav = document.querySelector(".nav-links");
    // Mobile nav ul (second ul in mobile nav)
    const mobileNav  = document.querySelector("#mobileNav ul");
    if (!desktopNav && !mobileNav) return;
    const makeLink = (l, mobile = false) => {
      if (l.type === "filter") {
        const onclick = mobile
          ? `filterProducts('${l.filter_value}');scrollToSection('products');closeMobileNav()`
          : `filterProducts('${l.filter_value}');scrollToSection('products')`;
        return `<li><a href="javascript:void(0)" onclick="${onclick}">${sanitize(l.label)}</a></li>`;
      }
      if (l.type === "scroll") {
        const onclick = mobile
          ? `scrollToSection('${l.target_id}');closeMobileNav()`
          : `scrollToSection('${l.target_id}')`;
        return `<li><a href="javascript:void(0)" onclick="${onclick}">${sanitize(l.label)}</a></li>`;
      }
      if (l.type === "overlay") {
        const onclick = mobile
          ? `${l.target_id}();closeMobileNav()`
          : `${l.target_id}()`;
        return `<li><a href="javascript:void(0)" onclick="${onclick}">${sanitize(l.label)}</a></li>`;
      }
      // External link
      return `<li><a href="${sanitize(l.url || '#')}" target="_blank" rel="noopener">${sanitize(l.label)}</a></li>`;
    };
    if (desktopNav) {
      desktopNav.innerHTML = links.map(l => {
        const tag = makeLink(l, false);
        return tag.replace(/^<li>/, "").replace(/<\/li>$/, "");
      }).join("");
    }
    if (mobileNav) {
      mobileNav.innerHTML = links.map(l => makeLink(l, true)).join("");
    }
  } catch (e) {
    console.warn("CMS navigation failed (using static fallback):", e.message);
  }
}

// ─── NEWSLETTER — SAVE TO SUPABASE ──────────────────────────────────────────
/**
 * Patch subscribeNewsletter() to also save to Supabase newsletter_subscribers table.
 * The original function still runs (calls Formspree + localStorage).
 */
(function patchNewsletter() {
  if (!window.subscribeNewsletter) return;
  const _orig = window.subscribeNewsletter;
  window.subscribeNewsletter = async function() {
    await _orig();
    if (!SUPABASE_URL || SUPABASE_URL.includes("PASTE_YOUR")) return;
    const email = document.getElementById("newsletterEmail")?.value?.trim();
    if (!email || !email.includes("@")) return;
    try {
      await sb.insert("newsletter_subscribers", { email, subscribed_at: new Date().toISOString() });
    } catch (e) {
      // Silently fail — email already saved via Formspree
    }
  };
})();

// ─── UTILITY ────────────────────────────────────────────────────────────────
/** Basic HTML escape to prevent XSS in dynamic content */
function sanitize(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ─── INIT ────────────────────────────────────────────────────────────────────
/**
 * Run CMS init after DOM is ready but before the main script's loadProducts() call.
 * We use DOMContentLoaded. The main script's loadProducts() call at the bottom of
 * index.html fires after this file is parsed, so window.loadProducts is already
 * overridden by the time it runs.
 */
document.addEventListener("DOMContentLoaded", () => {
  loadSiteSettings();
  loadHomepageSections();
  loadNavigation();
});
