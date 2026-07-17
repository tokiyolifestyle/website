/* TOKIYO LIFESTYLE — cart.js */
'use strict';

// Define payment helper functions globally so they are always available
window.updatePaymentMethod = function(method) {
  localStorage.setItem('tokiyo_payment_method', method);
  if (typeof window.syncCartPayment === 'function') {
    window.syncCartPayment();
  }
};

window.updateCartPaymentMethod = function(method) {
  localStorage.setItem('tokiyo_payment_method', method);
  if (typeof window.syncCartPayment === 'function') {
    window.syncCartPayment();
  }
};

window.syncCartPayment = function() {
  const method = localStorage.getItem('tokiyo_payment_method') || 'prepaid';
  
  // Sync drawer cards
  const prepaidCard = document.getElementById('PrepaidOptionCard');
  const codCard = document.getElementById('CodOptionCard');
  const prepaidInput = document.querySelector('input[name="payment_method_choice"][value="prepaid"]');
  const codInput = document.querySelector('input[name="payment_method_choice"][value="cod"]');
  if (prepaidCard && codCard) {
    if (method === 'prepaid') {
      prepaidCard.classList.add('active');
      codCard.classList.remove('active');
      if (prepaidInput) prepaidInput.checked = true;
    } else {
      prepaidCard.classList.remove('active');
      codCard.classList.add('active');
      if (codInput) codInput.checked = true;
    }
  }

  // Sync cart page cards
  const cartPrepaidCard = document.getElementById('CartPrepaidOptionCard');
  const cartCodCard = document.getElementById('CartCodOptionCard');
  const cartPrepaidInput = document.querySelector('input[name="cart_payment_method_choice"][value="prepaid"]');
  const cartCodInput = document.querySelector('input[name="cart_payment_method_choice"][value="cod"]');
  if (cartPrepaidCard && cartCodCard) {
    if (method === 'prepaid') {
      cartPrepaidCard.classList.add('active');
      cartCodCard.classList.remove('active');
      if (cartPrepaidInput) cartPrepaidInput.checked = true;
    } else {
      cartPrepaidCard.classList.remove('active');
      cartCodCard.classList.add('active');
      if (cartCodInput) cartCodInput.checked = true;
    }
  }

  const subtotalCents = window.cartSubtotalCents || 0;
  const subtotalRs = subtotalCents / 100;
  
  let codFee = 0;
  if (method === 'cod') {
    if (subtotalRs < 1199) {
      codFee = 80;
    }
  }
  
  const totalDisplayPrice = subtotalRs + codFee;
  const formattedPrice = '₹' + totalDisplayPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const subtotalPriceEl = document.getElementById('DrawerTotalPriceDisplay');
  if (subtotalPriceEl) {
    subtotalPriceEl.innerText = formattedPrice;
  }
  const codFeeRow = document.getElementById('CartCodFeeRow');
  if (codFeeRow) {
    codFeeRow.style.display = (codFee > 0) ? 'flex' : 'none';
  }

  const cartTotalPriceEl = document.getElementById('CartTotalPriceDisplay');
  if (cartTotalPriceEl) {
    cartTotalPriceEl.innerText = formattedPrice;
  }
  const cartCodFeeRow = document.getElementById('CartCodFeeSummaryRow');
  if (cartCodFeeRow) {
    cartCodFeeRow.style.display = (codFee > 0) ? 'flex' : 'none';
  }

  const prepaidNotice = document.getElementById('PaymentPrepaidNotice');
  const codNotice = document.getElementById('PaymentCodNotice');
  if (prepaidNotice && codNotice) {
    if (method === 'prepaid') {
      prepaidNotice.style.display = 'block';
      codNotice.style.display = 'none';
    } else {
      prepaidNotice.style.display = 'none';
      codNotice.style.display = (subtotalRs < 1199) ? 'block' : 'none';
    }
  }

  const shippingMessageEls = document.querySelectorAll('[data-shipping-message]');
  const shippingProgressEls = document.querySelectorAll('[data-shipping-progress]');
  if (shippingMessageEls.length > 0 && shippingProgressEls.length > 0) {
    if (method === 'prepaid') {
      shippingMessageEls.forEach(el => el.innerHTML = 'Prepaid Order: <strong>FREE Shipping</strong> applied! 🎁');
      shippingProgressEls.forEach(el => el.style.width = '100%');
    } else {
      if (subtotalRs >= 1199) {
        shippingMessageEls.forEach(el => el.innerHTML = '<strong>FREE Shipping (COD)</strong> achieved! 🎉');
        shippingProgressEls.forEach(el => el.style.width = '100%');
      } else {
        const remaining = 1199 - subtotalRs;
        shippingMessageEls.forEach(el => el.innerHTML = 'Add <strong>₹' + Math.ceil(remaining) + '</strong> more for FREE Shipping (COD)!');
        const progressPct = Math.min(100, (subtotalRs / 1199) * 100);
        shippingProgressEls.forEach(el => el.style.width = progressPct + '%');
      }
    }
  }
};

class TokiyoCart {
  constructor() {
    this.drawer   = document.querySelector('[data-cart-drawer]');
    this.overlay  = document.querySelector('[data-cart-overlay]');
    this.bodyEl   = document.querySelector('[data-cart-body]');
    this.countEls = document.querySelectorAll('[data-cart-count]');
    this.threshold = parseFloat(document.querySelector('[data-free-shipping-threshold]')?.dataset.freeShippingThreshold || '0') * 100;
    this.codFeeVariantId = 48862017716468;
    this.bindEvents();
    
    // Initial sync and recovery on page load
    this.recoverPaymentMethod();
    this.syncCodFeeInCart();
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
    document.addEventListener('change', e => {
      if (e.target.name === 'payment_method_choice' || e.target.name === 'cart_payment_method_choice') {
        this.syncCodFeeInCart().then(() => {
          this.refreshCart();
        });
      }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.closeDrawer(); });
    const noteInput = document.querySelector('[data-cart-note]');
    if (noteInput) { let t; noteInput.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => this.updateNote(noteInput.value), 800); }); }
    
    // Sync cart when returning via back button from checkout (bfcache restore)
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) {
        this.recoverPaymentMethod();
        this.syncCodFeeInCart().then(() => {
          this.refreshCart();
        });
      }
    });
  }
  recoverPaymentMethod() {
    const savedMethod = localStorage.getItem('tokiyo_payment_method') || 'prepaid';
    const drawerRadioBtn = document.querySelector(`input[name="payment_method_choice"][value="${savedMethod}"]`);
    if (drawerRadioBtn) {
      drawerRadioBtn.checked = true;
    }
    const cartPageRadioBtn = document.querySelector(`input[name="cart_payment_method_choice"][value="${savedMethod}"]`);
    if (cartPageRadioBtn) {
      cartPageRadioBtn.checked = true;
    }
    if (typeof window.syncCartPayment === 'function') {
      window.syncCartPayment();
    }
  }
  async openDrawer() {
    this.drawer?.classList.add('is-open');
    this.overlay?.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    
    const cart = await this.getCart();
    await this.syncCodFeeInCart(cart);
    await this.refreshCart();
  }
  closeDrawer() {
    this.drawer?.classList.remove('is-open');
    this.overlay?.classList.remove('is-open');
    document.body.style.overflow = '';
  }
  async getCart() { return (await fetch('/cart.js?v=' + Date.now())).json(); }
  async addFromForm(form) {
    const btn = form.querySelector('[data-add-to-cart-btn]');
    const origText = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Adding...'; }
    try {
      const res = await fetch('/cart/add.js', { method: 'POST', headers: {'X-Requested-With':'XMLHttpRequest'}, body: new FormData(form) });
      if (!res.ok) throw new Error('Add failed');
      const cart = await this.getCart();
      this.updateCount(cart);
      
      // Open drawer will sync COD fee and refresh cart layout
      await this.openDrawer();
    } catch(err) { console.error(err); }
    finally { if (btn) { btn.disabled = false; btn.textContent = origText; } }
  }
  async updateItem(key, qty) {
    const res = await fetch('/cart/change.js', { method: 'POST', headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'}, body: JSON.stringify({id:key,quantity:qty}) });
    const cart = await res.json();
    this.updateCount(cart);
    
    // Sync COD fee and refresh cart
    await this.syncCodFeeInCart(cart);
    await this.refreshCart();
  }
  async updateNote(note) {
    await fetch('/cart/update.js', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({note}) });
  }
  
  updateCount(cart) {
    let count = 0;
    if (cart && cart.items) {
      cart.items.forEach(item => {
        if (Number(item.variant_id) !== Number(this.codFeeVariantId)) {
          count += item.quantity;
        }
      });
    }
    this.countEls.forEach(el => el.textContent = count);
  }
  
  async syncCodFeeInCart(cart = null) {
    const checkoutBtns = document.querySelectorAll('button[name="checkout"], .cart-checkout-btn');
    try {
      checkoutBtns.forEach(btn => {
        btn.disabled = true;
        if (!btn.dataset.originalText) {
          btn.dataset.originalText = btn.innerHTML;
        }
        btn.innerHTML = 'Syncing payment...';
      });

      if (!cart) {
        cart = await this.getCart();
      }
      const method = localStorage.getItem('tokiyo_payment_method') || 'prepaid';
      
      let subtotalCents = 0;
      let hasCodFee = false;
      
      cart.items.forEach(item => {
        if (Number(item.variant_id) === Number(this.codFeeVariantId)) {
          hasCodFee = true;
        } else {
          subtotalCents += item.final_line_price;
        }
      });

      const subtotalRs = subtotalCents / 100;
      const needsCodFee = (method === 'cod' && subtotalRs < 1199);

      // Force live update of the subtotal cents variable read by sync scripts
      window.cartSubtotalCents = subtotalCents;
      if (typeof window.syncCartPayment === 'function') {
        window.syncCartPayment();
      }

      let cartChanged = false;
      if (needsCodFee && !hasCodFee) {
        await fetch('/cart/add.js', {
          method: 'POST',
          headers: {'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'},
          body: JSON.stringify({ items: [{ id: this.codFeeVariantId, quantity: 1 }] })
        });
        cartChanged = true;
      } else if (!needsCodFee && hasCodFee) {
        await fetch('/cart/change.js', {
          method: 'POST',
          headers: {'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'},
          body: JSON.stringify({ id: String(this.codFeeVariantId), quantity: 0 })
        });
        cartChanged = true;
      }
      
      return cartChanged;
    } catch(err) {
      console.error('COD Fee sync failed:', err);
      return false;
    } finally {
      checkoutBtns.forEach(btn => {
        btn.disabled = false;
        if (btn.dataset.originalText) {
          btn.innerHTML = btn.dataset.originalText;
        }
      });
    }
  }

  async refreshCart() {
    const sectionsToFetch = ['cart-drawer'];
    const cartForm = document.getElementById('CartForm');
    if (cartForm) {
      sectionsToFetch.push('main-cart');
    }

    try {
      const res = await fetch(`/?sections=${sectionsToFetch.join(',')}`);
      const data = await res.json();

      if (data['cart-drawer']) {
        const currentDrawerForm = document.getElementById('CartDrawerForm');
        if (currentDrawerForm) {
          const doc = new DOMParser().parseFromString(data['cart-drawer'], 'text/html');
          const newForm = doc.getElementById('CartDrawerForm');
          if (newForm) {
            currentDrawerForm.innerHTML = newForm.innerHTML;
            this.bodyEl = document.querySelector('[data-cart-body]');
          }
        }
      }

      if (data['main-cart'] && cartForm) {
        const doc = new DOMParser().parseFromString(data['main-cart'], 'text/html');
        const newCartForm = doc.getElementById('CartForm');
        if (newCartForm) {
          cartForm.innerHTML = newCartForm.innerHTML;
        }
        this.threshold = parseFloat(document.querySelector('[data-free-shipping-threshold]')?.dataset.freeShippingThreshold || '0') * 100;
      }

      // Re-update message & progress displays on page
      this.recoverPaymentMethod();
    } catch(err) {
      console.error('Cart refresh failed:', err);
    }
  }
}
document.addEventListener('DOMContentLoaded', () => { window.TokiyoCart = new TokiyoCart(); });
