/* TOKIYO LIFESTYLE — predictive-search.js */
'use strict';

class PredictiveSearch {
  constructor() {
    this.drawer    = document.querySelector('[data-search-drawer]');
    this.overlay   = document.querySelector('[data-search-overlay]');
    this.input     = document.querySelector('[data-search-input]');
    this.results   = document.querySelector('[data-search-results]');
    this.isOpen    = false;
    this.bindEvents();
  }

  ensureElements() {
    if (!this.drawer)  this.drawer  = document.querySelector('[data-search-drawer]');
    if (!this.overlay) this.overlay = document.querySelector('[data-search-overlay]');
    if (!this.input)   this.input   = document.querySelector('[data-search-input]');
    if (!this.results) this.results = document.querySelector('[data-search-results]');
  }

  bindEvents() {
    // Delegated click on trigger buttons or search overlays/close
    document.addEventListener('click', e => {
      const toggle = e.target.closest('[data-search-drawer-toggle]');
      if (toggle) {
        e.preventDefault();
        e.stopPropagation();
        this.open();
        return;
      }

      const closeTrigger = e.target.closest('[data-search-overlay], [data-search-close]');
      if (closeTrigger) {
        e.preventDefault();
        this.close();
      }
    });

    // Mobile touch handling
    document.addEventListener('touchend', e => {
      const toggle = e.target.closest('[data-search-drawer-toggle]');
      if (toggle && !this.isOpen) {
        e.preventDefault();
        this.open();
      }
    }, { passive: false });

    // Keyboard Escape to close
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Predictive live search input with debounce
    if (this.input) {
      this.attachInputListener();
    } else {
      setTimeout(() => {
        this.ensureElements();
        if (this.input) this.attachInputListener();
      }, 500);
    }
  }

  attachInputListener() {
    if (!this.input || this.input._hasSearchListener) return;
    this.input._hasSearchListener = true;
    let debounceTimer;
    this.input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.fetch(this.input.value.trim());
      }, 250);
    });
  }

  open() {
    this.ensureElements();
    if (!this.drawer) return;

    this.isOpen = true;
    this.drawer.classList.add('is-open');
    this.drawer.style.transform = 'translateX(0)';
    this.drawer.style.visibility = 'visible';
    this.drawer.style.pointerEvents = 'auto';

    if (this.overlay) {
      this.overlay.classList.add('is-open');
      this.overlay.style.opacity = '1';
      this.overlay.style.visibility = 'visible';
      this.overlay.style.pointerEvents = 'auto';
    }

    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      this.input?.focus();
    }, 120);
  }

  close() {
    this.ensureElements();
    this.isOpen = false;

    if (this.drawer) {
      this.drawer.classList.remove('is-open');
      this.drawer.style.transform = 'translateX(100%)';
      this.drawer.style.visibility = 'hidden';
      this.drawer.style.pointerEvents = 'none';
    }

    if (this.overlay) {
      this.overlay.classList.remove('is-open');
      this.overlay.style.opacity = '0';
      this.overlay.style.visibility = 'hidden';
      this.overlay.style.pointerEvents = 'none';
    }

    document.body.style.overflow = '';
    if (this.results) this.results.innerHTML = '';
    if (this.input)   this.input.value = '';
  }

  async fetch(query) {
    this.ensureElements();
    if (!this.results) return;

    if (query.length < 2) {
      this.results.innerHTML = '';
      return;
    }

    this.results.innerHTML = '<div style="text-align:center;padding:1.5rem;color:#888;">Searching...</div>';

    try {
      const res  = await fetch(`/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=8`);
      const data = await res.json();
      this.render(data.resources?.results?.products || []);
    } catch(err) {
      console.error('Search error:', err);
      this.results.innerHTML = '<p class="search-drawer__no-results">Unable to load results. Press enter to search full catalog.</p>';
    }
  }

  render(products) {
    this.ensureElements();
    if (!this.results) return;

    if (!products.length) {
      this.results.innerHTML = '<p class="search-drawer__no-results">No matching products found.</p>';
      return;
    }

    this.results.innerHTML = products.map(p => {
      const imgTag = p.featured_image?.url
        ? `<img src="${p.featured_image.url}&width=120" alt="${p.title}" loading="lazy" width="56" height="56">`
        : '';
      return `
        <a href="${p.url}" class="search-result-item">
          <div class="search-result-item__image">
            ${imgTag}
          </div>
          <div class="search-result-item__info">
            <p class="search-result-item__title">${p.title}</p>
            <p class="search-result-item__price">${this.formatMoney(p.price)}</p>
          </div>
        </a>
      `;
    }).join('');
  }

  formatMoney(cents) {
    if (!cents && cents !== 0) return '';
    return '₹' + (cents / 100).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
}

// Immediate + DOMContentLoaded execution guard
function initPredictiveSearch() {
  if (!window.predictiveSearchInstance) {
    window.predictiveSearchInstance = new PredictiveSearch();
    window.PredictiveSearch = window.predictiveSearchInstance;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPredictiveSearch);
} else {
  initPredictiveSearch();
}
