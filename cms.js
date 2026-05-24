/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  TEEMA'S COLLECTIONS — CMS MODULE (cms.js)  v2.0            ║
 * ║  Supabase-powered dynamic content layer                      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ─── SUPABASE CONFIG ────────────────────────────────────────────────────────
const SUPABASE_URL  = "https://zvfbkvnbndbptqtjunpt.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2ZmJrdm5ibmRicHRxdGp1bnB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NDg4OTksImV4cCI6MjA5NTEyNDg5OX0.K22NFSvkn6pNuWJeR5SclOlgh02kMkE9kWwdBHUSM5A";

// ─── SUPABASE REST HELPER ────────────────────────────────────────────────────
const sb = {
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
let _siteSettings = {};

async function loadSiteSettings() {
  if (!SUPABASE_URL || SUPABASE_URL.includes("PASTE_YOUR")) return;
  try {
    const rows = await sb.from("settings");
    rows.forEach(r => { _siteSettings[r.key] = r.value; });
    applySiteSettings();
  } catch (e) {
    console.warn("CMS settings load failed:", e.message);
  }
}

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

  // Promise section images (CMS-controlled)
  if (s.promise_img1) {
    const imgs = document.querySelectorAll(".promise-image-grid img");
    if (imgs[0]) imgs[0].src = s.promise_img1;
  }
  if (s.promise_img2) {
    const imgs = document.querySelectorAll(".promise-image-grid img");
    if (imgs[1]) imgs[1].src = s.promise_img2;
  }
  if (s.promise_img3) {
    const imgs = document.querySelectorAll(".promise-image-grid img");
    if (imgs[2]) imgs[2].src = s.promise_img3;
  }

  // Marquee
  if (s.marquee_text) {
    const words = s.marquee_text.split("|").map(w => w.trim()).filter(Boolean);
    const doubled = [...words, ...words];
    const track = document.querySelector(".marquee-track");
    if (track) track.innerHTML = doubled.map(w => `<span>${w}</span>`).join("");
  }

  // Override JS constants
  if (s.wa_number && typeof WA_NUMBER !== "undefined") {
    window.WA_NUMBER = s.wa_number;
  }
  if (s.logo_url && typeof LOGO_URL !== "undefined" && s.logo_url !== LOGO_URL) {
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

  // Override info modal content
  if (typeof INFO_CONTENT !== "undefined") {
    if (s.shipping_info)      INFO_CONTENT.shipping.body = s.shipping_info;
    if (s.returns_policy)     INFO_CONTENT.returns.body = s.returns_policy;
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
    if (!sections || sections.length === 0) return;
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
    if (typeof refreshMoodNewDots === "function") refreshMoodNewDots();
  } catch (e) {
    console.warn("CMS homepage sections failed:", e.message);
  }
}

// ─── PRODUCT GALLERY HELPER ──────────────────────────────────────────────────
/**
 * Builds the inline gallery HTML for a product card.
 * If product has multiple images → shows image with dot nav + swipe support.
 * If product has a video → shows video player.
 */
function buildProductMediaHTML(p) {
  const images = p._images || [];
  const videoUrl = p.video_url || "";

  // Video takes priority if present
  if (videoUrl) {
    const imgFallback = images[0] || "";
    return `
      <div class="product-media-wrap" data-product-id="${p.id || ""}">
        <video class="product-video" controls preload="metadata" playsinline
               poster="${imgFallback}"
               onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
          <source src="${videoUrl}" type="video/mp4" />
        </video>
        ${imgFallback ? `<img src="${imgFallback}" alt="${p.name}" loading="lazy" style="display:none" onerror="this.src='https://via.placeholder.com/400x500/F0E8FA/8B5CC8?text=TC'" />` : ""}
        ${images.length > 1 ? buildGalleryDots(images, p.id, 0, true) : ""}
      </div>`;
  }

  if (images.length === 0) {
    return `<div class="product-media-wrap"><div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--purple-light);font-style:italic;font-family:'Cormorant Garamond',serif;">No image yet</div></div>`;
  }

  if (images.length === 1) {
    return `
      <div class="product-media-wrap" data-product-id="${p.id || ""}">
        <img src="${images[0]}" alt="${p.name}" loading="lazy"
             onerror="this.src='https://via.placeholder.com/400x500/F0E8FA/8B5CC8?text=TC'" />
      </div>`;
  }

  // Multiple images — build gallery
  return `
    <div class="product-media-wrap product-gallery" data-idx="0" data-product-id="${p.id || ""}">
      <div class="gallery-track" style="display:flex;width:${images.length * 100}%;transition:transform 0.35s ease;">
        ${images.map((url, i) => `
          <div style="width:${100 / images.length}%;flex-shrink:0;">
            <img src="${url}" alt="${p.name} ${i + 1}" loading="${i === 0 ? "eager" : "lazy"}"
                 onerror="this.src='https://via.placeholder.com/400x500/F0E8FA/8B5CC8?text=TC'" />
          </div>`).join("")}
      </div>
      ${buildGalleryDots(images, p.id, 0, false)}
      <button class="gallery-prev" onclick="galleryNav(this,-1)" aria-label="Previous">‹</button>
      <button class="gallery-next" onclick="galleryNav(this,1)"  aria-label="Next">›</button>
    </div>`;
}

function buildGalleryDots(images, productId, activeIdx, isVideo) {
  if (images.length <= 1 && !isVideo) return "";
  return `<div class="gallery-dots">
    ${images.map((_, i) => `<span class="gallery-dot${i === activeIdx ? " active" : ""}" onclick="galleryGoTo(this,${i})"></span>`).join("")}
  </div>`;
}

// ─── GALLERY NAV FUNCTIONS (global, called from onclick) ────────────────────
window.galleryNav = function(btn, dir) {
  const wrap = btn.closest(".product-gallery");
  if (!wrap) return;
  const track = wrap.querySelector(".gallery-track");
  const imgs  = wrap.querySelectorAll(".gallery-track img");
  const total = imgs.length;
  if (!total) return;
  let idx = parseInt(wrap.dataset.idx || "0") + dir;
  if (idx < 0) idx = total - 1;
  if (idx >= total) idx = 0;
  wrap.dataset.idx = idx;
  track.style.transform = `translateX(-${idx * (100 / total)}%)`;
  wrap.querySelectorAll(".gallery-dot").forEach((d, i) =>
    d.classList.toggle("active", i === idx)
  );
};

window.galleryGoTo = function(dot, idx) {
  const wrap = dot.closest(".product-gallery, .product-media-wrap");
  if (!wrap) return;
  const track = wrap.querySelector(".gallery-track");
  const imgs  = wrap.querySelectorAll(".gallery-track img");
  const total = imgs.length;
  if (!total) return;
  wrap.dataset.idx = idx;
  track.style.transform = `translateX(-${idx * (100 / total)}%)`;
  wrap.querySelectorAll(".gallery-dot").forEach((d, i) =>
    d.classList.toggle("active", i === idx)
  );
};

// ─── TOUCH/SWIPE SUPPORT FOR GALLERIES ──────────────────────────────────────
document.addEventListener("touchstart", e => {
  const wrap = e.target.closest(".product-gallery");
  if (!wrap) return;
  wrap._touchStartX = e.touches[0].clientX;
}, { passive: true });

document.addEventListener("touchend", e => {
  const wrap = e.target.closest(".product-gallery");
  if (!wrap || wrap._touchStartX == null) return;
  const dx = e.changedTouches[0].clientX - wrap._touchStartX;
  if (Math.abs(dx) > 40) {
    window.galleryNav(wrap.querySelector(".gallery-next"), dx < 0 ? 1 : -1);
  }
  wrap._touchStartX = null;
}, { passive: true });

// ─── PRODUCTS ───────────────────────────────────────────────────────────────
window.loadProducts = async function loadProducts() {
  if (!SUPABASE_URL || SUPABASE_URL.includes("PASTE_YOUR")) {
    if (typeof showDemo === "function") showDemo();
    return;
  }
  try {
    // Fetch active products ordered newest-first for new arrivals detection
    const products = await sb.from(
      "products",
      "id,name,description,category,price,discount_price,status,size,tags,slug,is_featured,is_sale,date_added,sort_order,video_url",
      { is_active: true },
      { order: "sort_order.asc,date_added.desc,created_at.desc" }
    );

    if (!products || products.length === 0) {
      if (typeof showDemo === "function") showDemo();
      return;
    }

    // Fetch all product images, grouped by product_id
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

    // Build normalized product list with ALL images attached
    window.allProducts = products.map(p => ({
      ...p,
      image:      (imgMap[p.id] && imgMap[p.id][0]) || "",
      image_link: (imgMap[p.id] && imgMap[p.id][0]) || "",
      _images:    imgMap[p.id] || [],          // ALL images for gallery
      video_url:  p.video_url || "",            // video URL if set
      price:      p.price ? String(p.price) : "",
      status:     p.status || "Available",
    }));

    if (typeof renderProducts === "function")    renderProducts(window.allProducts);
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
    const desktopNav = document.querySelector(".nav-links");
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
    console.warn("CMS navigation failed:", e.message);
  }
}

// ─── NEWSLETTER ──────────────────────────────────────────────────────────────
(function patchNewsletter() {
  document.addEventListener("DOMContentLoaded", () => {
    if (!window.subscribeNewsletter) return;
    const _orig = window.subscribeNewsletter;
    window.subscribeNewsletter = async function() {
      await _orig();
      if (!SUPABASE_URL || SUPABASE_URL.includes("PASTE_YOUR")) return;
      const email = document.getElementById("newsletterEmail")?.value?.trim();
      if (!email || !email.includes("@")) return;
      try {
        await sb.insert("newsletter_subscribers", { email, subscribed_at: new Date().toISOString() });
      } catch (e) { /* silent */ }
    };
  });
})();

// ─── UTILITY ─────────────────────────────────────────────────────────────────
function sanitize(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadSiteSettings();
  loadHomepageSections();
  loadNavigation();
});
