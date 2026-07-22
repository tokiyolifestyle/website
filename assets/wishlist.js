/* TOKIYO LIFESTYLE — wishlist.js — localStorage-based wishlist */
'use strict';
const WishlistStore = {
  KEY: 'tokiyo-wishlist',
  get() { try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } catch { return []; } },
  set(items) { localStorage.setItem(this.KEY, JSON.stringify(items)); },
  has(id) { return this.get().includes(String(id)); },
  toggle(id) {
    id = String(id);
    const items = this.get();
    const idx = items.indexOf(id);
    if (idx > -1) { items.splice(idx, 1); } else { items.push(id); }
    this.set(items);
    return idx === -1;
  },
  count() { return this.get().length; }
};

function initWishlist() {
  /* Sync wishlist count badges */
  const updateBadges = () => {
    document.querySelectorAll('[data-wishlist-count]').forEach(el => { el.textContent = WishlistStore.count(); });
  };

  /* Toggle buttons */
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-wishlist-toggle]');
    if (!btn) return;
    e.preventDefault();
    const id  = btn.dataset.wishlistToggle;
    const added = WishlistStore.toggle(id);
    btn.classList.toggle('is-active', added);
    btn.setAttribute('aria-label', added ? 'Remove from Wishlist' : 'Add to Wishlist');
    updateBadges();
    if (typeof window.showToast === 'function') {
      window.showToast(added ? 'Added to wishlist ❤️' : 'Removed from wishlist');
    }
  });

  /* Mark already-wishlisted buttons on load */
  document.querySelectorAll('[data-wishlist-toggle]').forEach(btn => {
    if (WishlistStore.has(btn.dataset.wishlistToggle)) {
      btn.classList.add('is-active');
      btn.setAttribute('aria-label', 'Remove from Wishlist');
    }
  });

  /* Render wishlist page if present */
  const wishlistGrid = document.querySelector('[data-wishlist-grid]');
  if (wishlistGrid) renderWishlistPage(wishlistGrid);

  updateBadges();
}

async function renderWishlistPage(container) {
  const ids = WishlistStore.get();
  if (!ids.length) {
    container.innerHTML = '<p class="wishlist-empty">Your wishlist is empty. <a href="/collections/all">Browse products</a></p>';
    return;
  }
  container.innerHTML = '<p>Loading wishlist...</p>';
  try {
    const res  = await fetch(`/search?type=product&q=${ids.map(id => `id:${id}`).join(' OR ')}&view=wishlist-json`);
    /* Fallback: just link to products */
    container.innerHTML = ids.map(id => `<div class="wishlist-item"><a href="/products?id=${id}">Product #${id}</a></div>`).join('');
  } catch(err) {
    container.innerHTML = '<p>Could not load wishlist.</p>';
  }
}

document.addEventListener('DOMContentLoaded', initWishlist);
