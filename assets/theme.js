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
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    header.classList.toggle('is-scrolled', scrollY > 10);
    /* Auto-hide header on scroll down, show on scroll up */
    if (scrollY > 200) {
      header.classList.toggle('is-hidden', scrollY > lastScroll && scrollY > 100);
    } else {
      header.classList.remove('is-hidden');
    }
    lastScroll = scrollY;
  }, { passive: true });
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
    btn.addEventListener('click', () => {
      const sublist = btn.closest('.mobile-nav__item')?.querySelector('.mobile-nav__sublist');
      if (!sublist) return;
      const open = sublist.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open);
    });
  });
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
    background:var(--color-accent, #C5A880); pointer-events:none;
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

/* ========== Init All ========== */
document.addEventListener('DOMContentLoaded', () => {
  initPageTransitions();
  initHeader();
  initMobileNav();
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
});

document.addEventListener('shopify:section:load', () => {
  initScrollAnimations();
  initAccordions();
  initTabs();
  initSliders();
  initQuantitySelectors();
});
