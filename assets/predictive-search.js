/* TOKIYO LIFESTYLE — predictive-search.js */
'use strict';
class PredictiveSearch {
  constructor() {
    this.drawer    = document.querySelector('[data-search-drawer]');
    this.overlay   = document.querySelector('[data-search-overlay]');
    this.input     = document.querySelector('[data-search-input]');
    this.results   = document.querySelector('[data-search-results]');
    this.bindEvents();
  }
  bindEvents() {
    document.addEventListener('click', e => {
      if (e.target.closest('[data-search-drawer-toggle]')) { e.preventDefault(); this.open(); }
      if (e.target.closest('[data-search-overlay],[data-search-close]')) this.close();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });
    if (this.input) {
      let debounce;
      this.input.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => this.fetch(this.input.value.trim()), 300);
      });
    }
  }
  open() {
    this.drawer?.classList.add('is-open');
    this.overlay?.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => this.input?.focus(), 100);
  }
  close() {
    this.drawer?.classList.remove('is-open');
    this.overlay?.classList.remove('is-open');
    document.body.style.overflow = '';
    if (this.results) this.results.innerHTML = '';
    if (this.input)   this.input.value = '';
  }
  async fetch(query) {
    if (!this.results) return;
    if (query.length < 2) { this.results.innerHTML = ''; return; }
    try {
      const res  = await fetch(`/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=6`);
      const data = await res.json();
      this.render(data.resources?.results?.products || []);
    } catch(err) { console.error('Search error:', err); }
  }
  render(products) {
    if (!this.results) return;
    if (!products.length) { this.results.innerHTML = '<p class="search-drawer__no-results">No results found.</p>'; return; }
    this.results.innerHTML = products.map(p => `
      <a href="${p.url}" class="search-result-item">
        <div class="search-result-item__image">
          ${p.featured_image?.url ? `<img src="${p.featured_image.url}&width=80" alt="${p.title}" loading="lazy" width="80">` : ''}
        </div>
        <div class="search-result-item__info">
          <p class="search-result-item__title">${p.title}</p>
          <p class="search-result-item__price">${this.formatMoney(p.price)}</p>
        </div>
      </a>`).join('');
  }
  formatMoney(cents) {
    return '₹' + (cents / 100).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
}
document.addEventListener('DOMContentLoaded', () => { window.PredictiveSearch = new PredictiveSearch(); });
