/* ==========================================================================
   TOKIYO LIFESTYLE — theme.js — Premium Animation Engine
   World-class scroll animations, parallax, page transitions, magnetic cursor
   ========================================================================== */
'use strict';
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ========== Header ========== */
function initHeader() {
  const header = $('[data-site-header]');
  if (!header) return;
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    header.classList.toggle('is-scrolled', scrollY > 10);
  }, { passive: true });

  // Mega menu click & hover handling for desktop
  $$('[data-mega-menu-trigger]').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const parent = trigger.closest('.has-dropdown');
      if (!parent) return;
      const isOpen = parent.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

      // Close other open dropdowns
      $$('.has-dropdown').forEach(other => {
        if (other !== parent) {
          other.classList.remove('is-open');
          const otherTrigger = other.querySelector('[data-mega-menu-trigger]');
          if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
        }
      });
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.has-dropdown')) {
      $$('.has-dropdown').forEach(item => {
        item.classList.remove('is-open');
        const trig = item.querySelector('[data-mega-menu-trigger]');
        if (trig) trig.setAttribute('aria-expanded', 'false');
      });
    }
  });
}

/* ========== Mobile Nav ========== */
function initMobileNav() {
  const toggle  = $('[data-mobile-nav-toggle]');
  const nav     = $('[data-mobile-nav]');
  const overlay = $('[data-mobile-nav-overlay]');
  const closeBtn = $('[data-mobile-nav-close]');
  if (!toggle || !nav) return;
  const openNav = () => {
    nav.classList.add('is-open');
    overlay && overlay.classList.add('is-open');
    toggle.setAttribute('aria-expanded','true');
    nav.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
  };
  const closeNav = () => {
    nav.classList.remove('is-open');
    overlay && overlay.classList.remove('is-open');
    toggle.setAttribute('aria-expanded','false');
    nav.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
  };
  toggle.addEventListener('click', openNav);
  closeBtn && closeBtn.addEventListener('click', closeNav);
  overlay  && overlay.addEventListener('click', closeNav);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });
  $$('[data-mobile-submenu-toggle]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const parentLi = btn.closest('.mobile-nav__item, .mobile-nav__subitem');
      if (!parentLi) return;
      const sublist = parentLi.querySelector(':scope > .mobile-nav__sublist');
      if (!sublist) return;
      const open = sublist.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open);
      btn.classList.toggle('is-open', open);
    });
  });
}

/* ========== Account Drawer ========== */
function initAccountDrawer() {
  const drawer  = $('[data-account-drawer]');
  if (!drawer) return;
  const openDrawer = () => {
    drawer.classList.add('is-open');
    drawer.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('account-drawer-open');
  };
  const closeDrawer = () => {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.body.classList.remove('account-drawer-open');
  };
  $$('[data-account-drawer-toggle]').forEach(btn => btn.addEventListener('click', (e) => {
    e.preventDefault();
    openDrawer();
  }));
  $$('[data-account-drawer-close]').forEach(btn => btn.addEventListener('click', closeDrawer));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
}

/* ========== Back to Top ========== */
function initBackToTop() {
  const btn = $('#BackToTop');
  if (!btn) return;
  window.addEventListener('scroll', () => btn.classList.toggle('is-visible', window.scrollY > 400), { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* ========== Advanced Scroll Animations ========== */
function initScrollAnimations() {
  if (!window.IntersectionObserver) return;

  /* Main observer for animate-on-scroll elements */
  const mainObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        /* Slight delay for better visual effect */
        const delay = parseInt(entry.target.dataset.animDelay || '0');
        setTimeout(() => {
          entry.target.classList.add('is-visible');
        }, delay);
        mainObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -80px 0px' });

  $$('.animate-on-scroll, .stagger-children, .section-clip-reveal, .image-reveal, .animated-line').forEach(el => {
    mainObserver.observe(el);
  });

  /* Counter animation observer */
  const counterObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  $$('[data-counter]').forEach(el => counterObserver.observe(el));
}

/* ========== Counter Animation ========== */
function animateCounter(element) {
  const target = parseInt(element.dataset.counter || element.textContent);
  const duration = parseInt(element.dataset.counterDuration || '2000');
  const suffix = element.dataset.counterSuffix || '';
  const prefix = element.dataset.counterPrefix || '';
  let start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    /* Ease out cubic */
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(eased * target);

    element.textContent = prefix + current.toLocaleString() + suffix;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.classList.add('is-counting');
    }
  }
  requestAnimationFrame(update);
}

/* ========== Advanced Parallax ========== */
function initParallax() {
  const els = $$('[data-parallax]');
  if (!els.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.innerWidth < 750) return; /* Disable parallax on mobile for performance */

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      els.forEach(el => {
        const rect = el.getBoundingClientRect();
        const inView = rect.top < window.innerHeight && rect.bottom > 0;
        if (!inView) return;
        const speed = parseFloat(el.dataset.parallax) || 0.3;
        const yOffset = (rect.top + rect.height / 2 - window.innerHeight / 2) * speed;
        el.style.transform = `translate3d(0, ${yOffset}px, 0)`;
      });
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ========== Magnetic Cursor Effect on Buttons ========== */
function initMagneticButtons() {
  if (window.innerWidth < 990 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  $$('.magnetic-btn, .button--solid, .button--outline').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      const strength = 0.15;
      btn.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
      btn.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      setTimeout(() => { btn.style.transition = ''; }, 400);
    });
  });
}

/* ========== Smooth Page Transitions ========== */
function initPageTransitions() {
  if (!window.themeSettings?.enablePageTransitions) return;
  /* Fade in on page load */
  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 0.35s ease';
  requestAnimationFrame(() => {
    document.body.style.opacity = '1';
  });

  /* Fade out on navigation */
  $$('a[href]:not([href^="#"]):not([href^="javascript"]):not([target="_blank"]):not([data-no-transition])').forEach(link => {
    link.addEventListener('click', e => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      /* Skip if modifier key held */
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      document.body.style.opacity = '0';
      setTimeout(() => { window.location.href = href; }, 300);
    });
  });
}

/* ========== Smooth Scroll Progress ========== */
function initScrollProgress() {
  const progressBar = $('[data-scroll-progress]');
  if (!progressBar) return;

  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = (scrollTop / docHeight) * 100;
    progressBar.style.width = scrollPercent + '%';
  }, { passive: true });
}

/* ========== Dark Mode Toggle ========== */
function initDarkMode() {
  const btn = $('[data-dark-mode-toggle]');
  if (!btn) return;
  if (localStorage.getItem('tokiyo-dark') === 'true') document.documentElement.classList.add('dark-mode');
  btn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark-mode');
    localStorage.setItem('tokiyo-dark', isDark);
  });
}

/* ========== Accordions ========== */
function initAccordions() {
  $$('[data-accordion-trigger]').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';
      const group = trigger.dataset.accordionGroup;
      if (group) {
        $$(`[data-accordion-trigger][data-accordion-group="${group}"]`).forEach(t => {
          t.setAttribute('aria-expanded','false');
          const p = document.getElementById(t.getAttribute('aria-controls'));
          if (p) p.hidden = true;
        });
      }
      trigger.setAttribute('aria-expanded', String(!isOpen));
      const panel = document.getElementById(trigger.getAttribute('aria-controls'));
      if (panel) panel.hidden = isOpen;
    });
  });
}

/* ========== Tabs ========== */
function initTabs() {
  $$('[data-tabs]').forEach(group => {
    const tabs   = $$('[data-tab]', group);
    const panels = $$('[data-tab-panel]', group);
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.setAttribute('aria-selected','false'));
        panels.forEach(p => { p.hidden = true; });
        tab.setAttribute('aria-selected','true');
        const panel = group.querySelector(`[data-tab-panel="${tab.dataset.tab}"]`);
        if (panel) panel.hidden = false;
      });
    });
  });
}

/* ========== Sliders ========== */
function initSliders() {
  $$('[data-slider]').forEach(slider => {
    const track = slider.querySelector('[data-slider-track]');
    const prev  = slider.querySelector('[data-slider-prev]');
    const next  = slider.querySelector('[data-slider-next]');
    if (!track) return;
    let index = 0;
    const getVisible = () => parseInt(slider.dataset.sliderVisible || '1');
    const getTotal   = () => track.children.length;
    const update = () => {
      const pct = (index / getTotal()) * 100;
      track.style.transform = `translateX(-${pct}%)`;
    };
    prev && prev.addEventListener('click', () => { index = Math.max(0, index - 1); update(); });
    next && next.addEventListener('click', () => { index = Math.min(getTotal() - getVisible(), index + 1); update(); });
  });
}

/* ========== Cursor Dot (Desktop) ========== */
function initCursorDot() {
  if (window.innerWidth < 990 || 'ontouchstart' in window) return;

  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  dot.style.cssText = `
    position:fixed; width:8px; height:8px; border-radius:50%;
    background:var(--color-accent, #ff0000); pointer-events:none;
    z-index:9999; mix-blend-mode:difference; opacity:0;
    transition: width 0.3s ease, height 0.3s ease, opacity 0.3s ease, transform 0.15s ease;
    transform:translate(-50%,-50%);
  `;
  document.body.appendChild(dot);

  document.addEventListener('mousemove', e => {
    dot.style.left = e.clientX + 'px';
    dot.style.top = e.clientY + 'px';
    dot.style.opacity = '1';
  });

  /* Grow on hoverable elements */
  $$('a, button, .product-card, .fc-card, .catg__card').forEach(el => {
    el.addEventListener('mouseenter', () => {
      dot.style.width = '28px';
      dot.style.height = '28px';
      dot.style.opacity = '0.6';
    });
    el.addEventListener('mouseleave', () => {
      dot.style.width = '8px';
      dot.style.height = '8px';
      dot.style.opacity = '1';
    });
  });
}

/* ========== Quantity Selector (Cart items) ========== */
function initQuantitySelectors() {
  $$('[data-qty-change]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('[data-qty-input]');
      if (!input) return;
      const change = parseInt(btn.dataset.qtyChange);
      const newVal = Math.max(0, parseInt(input.value) + change);
      input.value = newVal;
    });
  });

  /* Product page qty */
  $$('[data-qty-dec]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('[data-qty-value]');
      if (!input) return;
      input.value = Math.max(1, parseInt(input.value) - 1);
    });
  });
  $$('[data-qty-inc]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('[data-qty-value]');
      if (!input) return;
      input.value = parseInt(input.value) + 1;
    });
  });
}

/* ========== Smooth Section Spacing on Scroll ========== */
function initSectionSpacing() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const sections = $$('section[class*="section-"]');
  if (!sections.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.transform = 'translateY(0)';
        entry.target.style.opacity = '1';
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -30px 0px' });

  sections.forEach(section => {
    if (!section.classList.contains('section-hero-carousel') &&
        !section.classList.contains('section-header')) {
      observer.observe(section);
    }
  });
}

/* ========== Live Viewers Indicator ========== */
function initLiveViewers() {
  /* Random number between min and max (inclusive) */
  function randBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /* Product Cards — assign a random viewer count to each card */
  $$('.product-card__live-viewers').forEach(badge => {
    const countEl = badge.querySelector('.live-count');
    if (!countEl) return;
    let base = randBetween(40, 100);
    countEl.textContent = base;
    /* Subtle fluctuation every 8-15s so it feels alive */
    setInterval(() => {
      const delta = randBetween(-3, 3);
      base = Math.max(40, Math.min(100, base + delta));
      countEl.textContent = base;
    }, randBetween(8000, 15000));
  });

  /* Product Detail Page — single live count */
  const pdpCount = document.getElementById('ProductLiveCount');
  if (pdpCount) {
    let pdpBase = randBetween(40, 100);
    pdpCount.textContent = pdpBase;
    setInterval(() => {
      const delta = randBetween(-2, 4);
      pdpBase = Math.max(40, Math.min(100, pdpBase + delta));
      pdpCount.textContent = pdpBase;
    }, randBetween(6000, 12000));
  }
}

/* ========== Init All ========== */
document.addEventListener('DOMContentLoaded', () => {
  initPageTransitions();
  initHeader();
  initMobileNav();
  initAccountDrawer();
  initBackToTop();
  initScrollAnimations();
  initParallax();
  initMagneticButtons();
  initScrollProgress();
  initDarkMode();
  initAccordions();
  initTabs();
  initSliders();
  initCursorDot();
  initQuantitySelectors();
  initSectionSpacing();
  initShareButtons();
  initQuickAddModal();
  initLiveViewers();
  initDynamicProductSorting();
});

/* ========== Product Share Handler ========== */
function initShareButtons() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-share-product], [data-share-btn]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const url = btn.getAttribute('data-share-product') || window.location.href;
    const title = btn.getAttribute('data-share-title') || document.title;
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        if (typeof showToast === 'function') {
          showToast('Link copied to clipboard!');
        } else {
          alert('Link copied to clipboard!');
        }
      });
    }
  });
}

/* ========== Quick Add Modal Handler ========== */
function initQuickAddModal() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-quick-add-trigger]');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const productId = btn.dataset.productId;
    const title = btn.dataset.productTitle;
    const price = btn.dataset.productPrice;
    const compare = btn.dataset.productCompare;
    const image = btn.dataset.productImage;
    const hasOnlyDefault = btn.dataset.hasOnlyDefault === 'true';
    const defaultVariantId = btn.dataset.defaultVariantId;

    const parent = btn.closest('.product-card__quick-add');
    const jsonScript = parent ? parent.querySelector('.product-variants-json') : null;
    let variants = [];
    if (jsonScript) {
      try { variants = JSON.parse(jsonScript.textContent); } catch(err){}
    }

    if (hasOnlyDefault || variants.length <= 1) {
      quickAddToCart(defaultVariantId, 1, btn);
      return;
    }

    renderAndOpenQuickAddModal({ title, price, compare, image, variants }, btn);
  });
}

function quickAddToCart(variantId, quantity = 1, buttonEl = null) {
  const originalText = buttonEl ? buttonEl.innerHTML : '';
  if (buttonEl) {
    buttonEl.innerHTML = '<span>Adding...</span>';
    buttonEl.disabled = true;
  }

  fetch('/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ id: parseInt(variantId, 10), quantity: quantity }] })
  })
  .then(res => res.json())
  .then(data => {
    if (buttonEl) {
      buttonEl.innerHTML = '<span>Added ✓</span>';
      setTimeout(() => {
        buttonEl.innerHTML = originalText;
        buttonEl.disabled = false;
      }, 1500);
    }
    const cartToggle = document.querySelector('[data-cart-drawer-toggle]');
    if (cartToggle) cartToggle.click();
    closeQuickAddModal();
  })
  .catch(err => {
    console.error('Cart add error:', err);
    if (buttonEl) {
      buttonEl.innerHTML = originalText;
      buttonEl.disabled = false;
    }
  });
}

// Color map for visual swatch dots
function getQuickAddSwatchColor(name) {
  const n = (name || '').toLowerCase().trim();
  if (n.includes('white')) return '#FFFFFF';
  if (n.includes('beige')) return '#E4D5B7';
  if (n.includes('pista')) return '#C1F8C2';
  if (n.includes('airforce') || n.includes('air force') || n.includes('blue')) return '#5F8A96';
  if (n.includes('peach')) return '#FFE5B4';
  if (n.includes('lavender')) return '#E6E6FA';
  if (n.includes('mustard')) return '#E1AD01';
  if (n.includes('onion')) return '#D1A3A4';
  if (n.includes('wine')) return '#722F37';
  if (n.includes('grey') || n.includes('gray')) return '#666666';
  if (n.includes('black')) return '#111111';
  if (n.includes('olive') || n.includes('green')) return '#556B2F';
  if (n.includes('navy')) return '#000080';
  if (n.includes('red') || n.includes('maroon')) return '#800000';
  return '#888888';
}

function renderAndOpenQuickAddModal(productData, triggerBtn) {
  const overlay = document.getElementById('QuickAddOverlay');
  const modal = document.getElementById('QuickAddModal');
  const content = document.getElementById('QuickAddContent');
  if (!modal || !content) return;

  const { title, price, compare, image, variants } = productData;

  const sizeKeywords = ['xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', '3xl', '4xl', 'free size'];
  const rawOpt1List = [...new Set(variants.map(v => v.option1).filter(Boolean))];
  const rawOpt2List = [...new Set(variants.map(v => v.option2).filter(Boolean))];

  let hasColorAndSize = false;
  let colors = [];
  let sizes = [];
  let colorOptKey = 'option1';
  let sizeOptKey = 'option2';

  if (rawOpt1List.length > 0 && rawOpt2List.length > 0) {
    hasColorAndSize = true;
    const opt1IsSize = rawOpt1List.some(val => sizeKeywords.includes(val.toLowerCase().trim()));
    if (opt1IsSize) {
      sizeOptKey = 'option1';
      colorOptKey = 'option2';
      sizes = rawOpt1List;
      colors = rawOpt2List;
    } else {
      colorOptKey = 'option1';
      sizeOptKey = 'option2';
      colors = rawOpt1List;
      sizes = rawOpt2List;
    }
  } else if (rawOpt1List.length > 0) {
    sizes = rawOpt1List;
    sizeOptKey = 'option1';
  }

  let selectedVariant = variants.find(v => v.available) || variants[0];
  let activeColor = hasColorAndSize ? selectedVariant[colorOptKey] : null;
  let activeSize = selectedVariant[sizeOptKey];
  let currentSelectedId = selectedVariant.id;
  let currentImage = selectedVariant.image || image;

  let optionsHtml = '';

  if (hasColorAndSize && colors.length > 1) {
    const colorPills = colors.map(col => {
      const isSelected = col === activeColor;
      const hex = getQuickAddSwatchColor(col);
      return `
        <button type="button" class="color-pill ${isSelected ? 'is-selected' : ''}" data-color-name="${col}">
          <span class="color-pill-dot" style="background-color:${hex};"></span>
          <span>${col}</span>
        </button>
      `;
    }).join('');

    optionsHtml += `
      <div class="quick-add-modal__option-group">
        <label>Color: <span class="selected-opt-label" id="ModalColorLabel" style="font-weight:700; color:#ff0000; margin-left:4px;">${activeColor}</span></label>
        <div class="color-buttons-row" id="ModalColorRow">
          ${colorPills}
        </div>
      </div>
    `;
  }

  function generateSizePills(forColor) {
    return sizes.map(sz => {
      const matchingVariant = variants.find(v => {
        if (hasColorAndSize && forColor) {
          return v[colorOptKey] === forColor && v[sizeOptKey] === sz;
        }
        return v[sizeOptKey] === sz;
      });

      const isAvail = matchingVariant ? matchingVariant.available : false;
      const isSelected = sz === activeSize;

      return `
        <button
          type="button"
          class="size-pill ${isSelected ? 'is-selected' : ''} ${!isAvail ? 'is-disabled' : ''}"
          data-size-name="${sz}"
          ${!matchingVariant ? 'disabled' : ''}>
          ${sz}
        </button>
      `;
    }).join('');
  }

  optionsHtml += `
    <div class="quick-add-modal__option-group">
      <label>Size: <span class="selected-opt-label" id="ModalSizeLabel" style="font-weight:700; color:#111111; margin-left:4px;">${activeSize || ''}</span></label>
      <div class="size-buttons-row" id="ModalSizeRow">
        ${generateSizePills(activeColor)}
      </div>
    </div>
  `;

  content.innerHTML = `
    <div class="quick-add-modal__grid">
      <div class="quick-add-modal__media">
        <img src="${currentImage}" alt="${title}" class="quick-add-modal__img" id="ModalProductImg">
      </div>
      <div class="quick-add-modal__info">
        <span class="quick-add-modal__vendor">TOKIYO LIFESTYLE</span>
        <h2 class="quick-add-modal__title">${title}</h2>
        <div class="quick-add-modal__price">
          <span class="price-current" id="ModalPriceCurrent">${selectedVariant.price || price}</span>
          ${(selectedVariant.compare_at_price || compare) && (selectedVariant.compare_at_price || compare) !== (selectedVariant.price || price) ? `<span class="price-compare" id="ModalPriceCompare">${selectedVariant.compare_at_price || compare}</span>` : ''}
        </div>

        ${optionsHtml}

        <div class="quick-add-modal__qty">
          <label>Quantity:</label>
          <div class="qty-picker">
            <button type="button" class="qty-btn" id="ModalQtyMinus">-</button>
            <input type="number" id="ModalQtyInput" value="1" min="1" class="qty-input" readonly>
            <button type="button" class="qty-btn" id="ModalQtyPlus">+</button>
          </div>
        </div>

        <button type="button" class="quick-add-modal__submit-btn" id="ModalSubmitBtn">
          <span>Add to Cart →</span>
        </button>
      </div>
    </div>
  `;

  function updateSubmitButtonState(isAvailable) {
    const submitBtn = content.querySelector('#ModalSubmitBtn');
    if (!submitBtn) return;
    if (isAvailable) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-sold-out');
      submitBtn.innerHTML = '<span>Add to Cart →</span>';
      submitBtn.style.background = '#111111';
      submitBtn.style.cursor = 'pointer';
      submitBtn.style.opacity = '1';
    } else {
      submitBtn.disabled = true;
      submitBtn.classList.add('is-sold-out');
      submitBtn.innerHTML = '<span>Sold Out / Out of Stock ✕</span>';
      submitBtn.style.background = '#888888';
      submitBtn.style.cursor = 'not-allowed';
      submitBtn.style.opacity = '0.7';
    }
  }

  function bindSizeEvents() {
    content.querySelectorAll('.size-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        if (pill.classList.contains('is-disabled')) return;
        content.querySelectorAll('.size-pill').forEach(p => p.classList.remove('is-selected'));
        pill.classList.add('is-selected');
        activeSize = pill.dataset.sizeName;
        const sizeLabel = content.querySelector('#ModalSizeLabel');
        if (sizeLabel) sizeLabel.textContent = activeSize;

        const match = variants.find(v => {
          if (hasColorAndSize && activeColor) {
            return v[colorOptKey] === activeColor && v[sizeOptKey] === activeSize;
          }
          return v[sizeOptKey] === activeSize;
        });

        if (match) {
          currentSelectedId = match.id;
          if (match.image) {
            const imgEl = content.querySelector('#ModalProductImg');
            if (imgEl) imgEl.src = match.image;
          }
          if (match.price) {
            const priceEl = content.querySelector('#ModalPriceCurrent');
            if (priceEl) priceEl.textContent = match.price;
          }
          updateSubmitButtonState(match.available);
        } else {
          updateSubmitButtonState(false);
        }
      });
    });
  }

  bindSizeEvents();
  updateSubmitButtonState(selectedVariant ? selectedVariant.available : false);

  if (hasColorAndSize) {
    content.querySelectorAll('.color-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        content.querySelectorAll('.color-pill').forEach(p => p.classList.remove('is-selected'));
        pill.classList.add('is-selected');
        activeColor = pill.dataset.colorName;

        const colorLabel = content.querySelector('#ModalColorLabel');
        if (colorLabel) colorLabel.textContent = activeColor;

        const colorVariant = variants.find(v => v[colorOptKey] === activeColor && v.image);
        if (colorVariant && colorVariant.image) {
          const imgEl = content.querySelector('#ModalProductImg');
          if (imgEl) imgEl.src = colorVariant.image;
        }

        const sizeRow = content.querySelector('#ModalSizeRow');
        if (sizeRow) {
          sizeRow.innerHTML = generateSizePills(activeColor);
          bindSizeEvents();
        }

        // Try to find available size in newly selected color
        let currentMatch = variants.find(v => v[colorOptKey] === activeColor && v[sizeOptKey] === activeSize && v.available);
        if (!currentMatch) {
          // If previous size is out of stock in this color, switch to first available size
          currentMatch = variants.find(v => v[colorOptKey] === activeColor && v.available);
        }

        if (currentMatch) {
          activeSize = currentMatch[sizeOptKey];
          currentSelectedId = currentMatch.id;
          const sizeLabel = content.querySelector('#ModalSizeLabel');
          if (sizeLabel) sizeLabel.textContent = activeSize;
          content.querySelectorAll('.size-pill').forEach(p => {
            p.classList.toggle('is-selected', p.dataset.sizeName === activeSize && !p.classList.contains('is-disabled'));
          });
          if (currentMatch.price) {
            const priceEl = content.querySelector('#ModalPriceCurrent');
            if (priceEl) priceEl.textContent = currentMatch.price;
          }
          updateSubmitButtonState(true);
        } else {
          // Entire color is sold out across all sizes
          content.querySelectorAll('.size-pill').forEach(p => p.classList.remove('is-selected'));
          const sizeLabel = content.querySelector('#ModalSizeLabel');
          if (sizeLabel) sizeLabel.textContent = 'None Available';
          updateSubmitButtonState(false);
        }
      });
    });
  }

  const qtyInput = content.querySelector('#ModalQtyInput');
  content.querySelector('#ModalQtyMinus')?.addEventListener('click', () => {
    let val = parseInt(qtyInput.value, 10) || 1;
    if (val > 1) qtyInput.value = val - 1;
  });
  content.querySelector('#ModalQtyPlus')?.addEventListener('click', () => {
    let val = parseInt(qtyInput.value, 10) || 1;
    qtyInput.value = val + 1;
  });

  const submitBtn = content.querySelector('#ModalSubmitBtn');
  submitBtn?.addEventListener('click', () => {
    if (submitBtn.disabled) return;
    const match = variants.find(v => v.id === parseInt(currentSelectedId, 10));
    if (match && !match.available) return;

    const qty = parseInt(qtyInput.value, 10) || 1;
    quickAddToCart(currentSelectedId, qty, submitBtn);
  });

  if (overlay) {
    overlay.style.display = 'block';
    requestAnimationFrame(() => overlay.classList.add('is-open'));
  }
  if (modal) {
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
    });
  }
  document.body.style.overflow = 'hidden';
}

function closeQuickAddModal() {
  const overlay = document.getElementById('QuickAddOverlay');
  const modal = document.getElementById('QuickAddModal');
  if (overlay) overlay.classList.remove('is-open');
  if (modal) {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }
  setTimeout(() => {
    if (overlay && !overlay.classList.contains('is-open')) overlay.style.display = 'none';
    if (modal && !modal.classList.contains('is-open')) modal.style.display = 'none';
  }, 300);
  document.body.style.overflow = '';
}

/* ========== Dynamic Click-Weighted & Auto-Sorted Products Engine ========== */
function initDynamicProductSorting() {
  const STORAGE_KEY = 'tokiyo_product_clicks_v2';
  
  function getClickStats() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function recordProductClick(productId) {
    if (!productId) return;
    try {
      const stats = getClickStats();
      stats[productId] = (stats[productId] || 0) + 1;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {}
  }

  // Real-time Card Click Tracker
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.product-card[data-product-id]');
    if (card) {
      const pId = card.getAttribute('data-product-id');
      recordProductClick(pId);
    }
  });

  // Track if customer is browsing Product Detail Page
  const pdpForm = document.querySelector('[data-product-form], form[action*="/cart/add"]');
  if (pdpForm) {
    const currentId = pdpForm.querySelector('[name="id"]')?.value;
    if (currentId) recordProductClick(currentId);
  }

  // 1. BESTSELLERS: Auto-sort cards by highest click volume & popularity
  const bestsellersGrids = document.querySelectorAll('[data-grid-type="bestsellers"], [data-section-type="bestsellers"] [data-product-grid]');
  const clickStats = getClickStats();

  bestsellersGrids.forEach(grid => {
    const cards = Array.from(grid.querySelectorAll('.product-card[data-product-id]'));
    if (cards.length <= 1) return;

    cards.sort((a, b) => {
      const idA = a.getAttribute('data-product-id');
      const idB = b.getAttribute('data-product-id');
      const clicksA = clickStats[idA] || 0;
      const clicksB = clickStats[idB] || 0;

      // Higher clicks first
      if (clicksB !== clicksA) {
        return clicksB - clicksA;
      }
      return 0;
    });

    cards.forEach(card => grid.appendChild(card));
  });

  // 2. NEW ARRIVALS: Ensure newest Shopify product ID is always at position #1
  const newArrivalsGrids = document.querySelectorAll('[data-grid-type="new-arrivals"], [data-section-type="new-arrivals"] [data-product-grid]');
  newArrivalsGrids.forEach(grid => {
    const cards = Array.from(grid.querySelectorAll('.product-card[data-product-id]'));
    if (cards.length <= 1) return;

    cards.sort((a, b) => {
      const idA = parseInt(a.getAttribute('data-product-id'), 10) || 0;
      const idB = parseInt(b.getAttribute('data-product-id'), 10) || 0;
      return idB - idA;
    });

    cards.forEach(card => grid.appendChild(card));
  });
}

document.addEventListener('shopify:section:load', () => {
  initScrollAnimations();
  initAccordions();
  initTabs();
  initSliders();
  initQuantitySelectors();
  initQuickAddModal();
  initLiveViewers();
  initDynamicProductSorting();
});
