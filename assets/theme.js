/* ==========================================================================
   TOKIYO LIFESTYLE — theme.js
   ========================================================================== */
'use strict';
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function initHeader() {
  const header = $('[data-site-header]');
  if (!header) return;
  window.addEventListener('scroll', () => {
    header.classList.toggle('is-scrolled', window.scrollY > 10);
  }, { passive: true });
}

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

function initAnnouncementBar() {
  const bar = $('[data-announcement-bar]');
  if (!bar) return;
  const items = $$('.announcement-bar__item', bar);
  const prev = $('.announcement-bar__prev', bar);
  const next = $('.announcement-bar__next', bar);
  if (items.length <= 1) return;
  let current = 0;
  let timer = null;
  const speed = parseInt(bar.dataset.autoRotate) || 5000;
  const goTo = idx => {
    items[current].classList.remove('is-active');
    current = (idx + items.length) % items.length;
    items[current].classList.add('is-active');
  };
  const start = () => { timer = setInterval(() => goTo(current + 1), speed); };
  if (bar.hasAttribute('data-auto-rotate')) start();
  prev && prev.addEventListener('click', () => { clearInterval(timer); goTo(current - 1); start(); });
  next && next.addEventListener('click', () => { clearInterval(timer); goTo(current + 1); start(); });
}

function initBackToTop() {
  const btn = $('#BackToTop');
  if (!btn) return;
  window.addEventListener('scroll', () => btn.classList.toggle('is-visible', window.scrollY > 400), { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function initScrollAnimations() {
  if (!window.IntersectionObserver) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  $$('.animate-on-scroll, .stagger-children').forEach(el => obs.observe(el));
}

function initParallax() {
  const els = $$('[data-parallax]');
  if (!els.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const onScroll = () => {
    els.forEach(el => {
      const rect = el.getBoundingClientRect();
      const speed = parseFloat(el.dataset.parallax) || 0.3;
      el.style.transform = `translateY(${(rect.top + rect.height / 2 - window.innerHeight / 2) * speed}px)`;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initDarkMode() {
  const btn = $('[data-dark-mode-toggle]');
  if (!btn) return;
  if (localStorage.getItem('tokiyo-dark') === 'true') document.documentElement.classList.add('dark-mode');
  btn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark-mode');
    localStorage.setItem('tokiyo-dark', isDark);
  });
}

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

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initMobileNav();
  initAnnouncementBar();
  initBackToTop();
  initScrollAnimations();
  initParallax();
  initDarkMode();
  initAccordions();
  initTabs();
  initSliders();
});

document.addEventListener('shopify:section:load', () => {
  initScrollAnimations();
  initAccordions();
  initTabs();
  initSliders();
});
