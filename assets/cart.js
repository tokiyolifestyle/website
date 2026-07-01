/* TOKIYO LIFESTYLE — cart.js */
'use strict';
class TokiyoCart {
  constructor() {
    this.drawer   = document.querySelector('[data-cart-drawer]');
    this.overlay  = document.querySelector('[data-cart-overlay]');
    this.bodyEl   = document.querySelector('[data-cart-body]');
    this.countEls = document.querySelectorAll('[data-cart-count]');
    this.threshold = parseFloat(document.querySelector('[data-free-shipping-threshold]')?.dataset.freeShippingThreshold || '0') * 100;
    this.bindEvents();
  }
  bindEvents() {
    document.addEventListener('click', e => {
      if (e.target.closest('[data-cart-drawer-toggle]')) { e.preventDefault(); this.openDrawer(); }
      if (e.target.closest('[data-cart-overlay],[data-cart-drawer-close]')) this.closeDrawer();
      const removeBtn = e.target.closest('[data-cart-remove]');
      if (removeBtn) { e.preventDefault(); this.updateItem(removeBtn.dataset.cartRemove, 0); }
      const qtyBtn = e.target.closest('[data-qty-change]');
      if (qtyBtn) {
        const item = qtyBtn.closest('[data-cart-item]');
        const input = item?.querySelector('[data-qty-input]');
        if (!input) return;
        const newQty = Math.max(0, (parseInt(input.value) || 0) + parseInt(qtyBtn.dataset.qtyChange));
        input.value = newQty;
        this.updateItem(item.dataset.cartItem, newQty);
      }
    });
    document.addEventListener('submit', e => {
      const form = e.target.closest('[data-add-to-cart-form]');
      if (!form) return;
      e.preventDefault();
      this.addFromForm(form);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.closeDrawer(); });
    const noteInput = document.querySelector('[data-cart-note]');
    if (noteInput) { let t; noteInput.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => this.updateNote(noteInput.value), 800); }); }
  }
  openDrawer() {
    this.drawer?.classList.add('is-open');
    this.overlay?.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    this.refreshDrawer();
  }
  closeDrawer() {
    this.drawer?.classList.remove('is-open');
    this.overlay?.classList.remove('is-open');
    document.body.style.overflow = '';
  }
  async getCart() { return (await fetch('/cart.js')).json(); }
  async addFromForm(form) {
    const btn = form.querySelector('[data-add-to-cart-btn]');
    const origText = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Adding...'; }
    try {
      const res = await fetch('/cart/add.js', { method: 'POST', headers: {'X-Requested-With':'XMLHttpRequest'}, body: new FormData(form) });
      if (!res.ok) throw new Error('Add failed');
      const cart = await this.getCart();
      this.updateCount(cart.item_count);
      await this.refreshDrawer();
      this.openDrawer();
    } catch(err) { console.error(err); }
    finally { if (btn) { btn.disabled = false; btn.textContent = origText; } }
  }
  async updateItem(key, qty) {
    const res = await fetch('/cart/change.js', { method: 'POST', headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'}, body: JSON.stringify({id:key,quantity:qty}) });
    const cart = await res.json();
    this.updateCount(cart.item_count);
    await this.refreshDrawer();
  }
  async updateNote(note) {
    await fetch('/cart/update.js', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({note}) });
  }
  updateCount(count) { this.countEls.forEach(el => el.textContent = count); }
  async refreshDrawer() {
    if (!this.bodyEl) return;
    try {
      const res = await fetch('/?sections=cart-drawer');
      const data = await res.json();
      if (data['cart-drawer']) {
        const doc = new DOMParser().parseFromString(data['cart-drawer'], 'text/html');
        const nb = doc.querySelector('[data-cart-body]');
        const nf = doc.querySelector('[data-cart-footer]');
        if (nb) this.bodyEl.innerHTML = nb.innerHTML;
        const footerEl = document.querySelector('[data-cart-footer]');
        if (footerEl && nf) footerEl.innerHTML = nf.innerHTML;
      }
    } catch(err) { console.error('Drawer refresh failed:', err); }
  }
}
document.addEventListener('DOMContentLoaded', () => { window.TokiyoCart = new TokiyoCart(); });
