/* TOKIYO LIFESTYLE — product-page.js */
'use strict';

/* ---- Variant picker ---- */
function initVariantPicker() {
  const picker = document.querySelector('[data-variant-picker]');
  if (!picker) return;

  const variantData = JSON.parse(document.querySelector('[data-variant-json]')?.textContent || '[]');
  const addBtn      = document.querySelector('[data-add-to-cart-btn]');
  const priceEl     = document.querySelector('[data-product-price]');
  const compareEl   = document.querySelector('[data-product-compare-price]');
  const stockEl     = document.querySelector('[data-stock-indicator]');
  const variantIdInput = document.querySelector('[name="id"]');

  function getCurrentVariant() {
    const selected = {};
    picker.querySelectorAll('[data-option-name]').forEach(input => {
      if (input.checked || input.tagName === 'SELECT') {
        selected[input.dataset.optionName] = input.tagName === 'SELECT' ? input.value : input.value;
      }
    });
    return variantData.find(v =>
      v.options.every((opt, i) => {
        const key = Object.keys(selected)[i];
        return selected[key] === opt;
      })
    ) || variantData.find(v => v.options.every((opt, i) => selected[Object.keys(selected)[i]] === opt));
  }

  function updateUI(variant) {
    if (!variant) {
      if (addBtn) { addBtn.disabled = true; addBtn.textContent = 'Unavailable'; }
      return;
    }
    if (variantIdInput) variantIdInput.value = variant.id;
    if (priceEl) priceEl.textContent = formatMoney(variant.price);
    if (compareEl) {
      compareEl.textContent = variant.compare_at_price > variant.price ? formatMoney(variant.compare_at_price) : '';
      compareEl.hidden = !(variant.compare_at_price > variant.price);
    }
    if (addBtn) {
      addBtn.disabled = !variant.available;
      addBtn.textContent = variant.available ? (addBtn.dataset.addText || 'Add to Cart') : 'Sold Out';
    }
    if (stockEl) {
      const qty = variant.inventory_quantity;
      const managed = variant.inventory_management === 'shopify';
      if (managed && qty <= 5 && qty > 0) {
        stockEl.textContent = `Only ${qty} left in stock`;
        stockEl.className = 'stock-indicator stock-indicator--low';
      } else if (managed && qty <= 0) {
        stockEl.textContent = 'Out of Stock';
        stockEl.className = 'stock-indicator stock-indicator--out';
      } else {
        stockEl.textContent = 'In Stock';
        stockEl.className = 'stock-indicator stock-indicator--in';
      }
    }
    /* Update URL without reload */
    const url = new URL(window.location);
    url.searchParams.set('variant', variant.id);
    history.replaceState({}, '', url);
  }

  picker.addEventListener('change', () => {
    const variant = getCurrentVariant();
    updateUI(variant);
  });

  /* Init with current variant */
  const urlVariant = new URLSearchParams(window.location.search).get('variant');
  const initial = urlVariant ? variantData.find(v => String(v.id) === urlVariant) : variantData.find(v => v.available) || variantData[0];
  if (initial) updateUI(initial);
}

/* ---- Image gallery ---- */
function initGallery() {
  const gallery    = document.querySelector('[data-product-gallery]');
  const thumbs     = document.querySelector('[data-gallery-thumbs]');
  const track      = document.querySelector('[data-gallery-track]');
  const zoomBtn    = document.querySelector('[data-zoom-toggle]');
  const zoomModal  = document.querySelector('[data-zoom-modal]');
  if (!gallery || !track) return;

  const slides = [...track.querySelectorAll('.product-gallery__slide')];
  const allThumbs = thumbs ? [...thumbs.querySelectorAll('[data-thumb]')] : [];
  let currentIndex = 0;
  let autoPlayTimer = null;

  function goToSlide(index) {
    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;
    
    currentIndex = index;
    
    // Shift track
    track.style.transform = `translateX(-${currentIndex * 100}%)`;
    
    // Update active slide class
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === currentIndex);
    });

    // Update active thumbnail class
    allThumbs.forEach((thumb, i) => {
      thumb.classList.toggle('is-active', i === currentIndex);
    });

    // Scroll active thumbnail into view
    if (allThumbs[currentIndex]) {
      allThumbs[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  // Thumb clicks
  allThumbs.forEach((thumb, i) => {
    thumb.addEventListener('click', () => {
      resetTimer();
      goToSlide(i);
    });
  });

  // Swipe events
  let touchStartX = 0;
  let touchEndX = 0;
  
  gallery.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });
  
  gallery.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });

  function handleSwipe() {
    const swipeThreshold = 50;
    if (touchStartX - touchEndX > swipeThreshold) {
      // Swiped left -> next slide
      resetTimer();
      goToSlide(currentIndex + 1);
    } else if (touchEndX - touchStartX > swipeThreshold) {
      // Swiped right -> prev slide
      resetTimer();
      goToSlide(currentIndex - 1);
    }
  }

  // Autoplay
  function startTimer() {
    autoPlayTimer = setInterval(() => {
      goToSlide(currentIndex + 1);
    }, 3000); // 3 seconds interval
  }

  function resetTimer() {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer);
      startTimer();
    }
  }

  startTimer();

  // Zoom Modal integration
  if (zoomBtn && zoomModal) {
    zoomBtn.addEventListener('click', () => {
      const activeImg = slides[currentIndex]?.querySelector('img');
      const zoomImg = zoomModal.querySelector('img');
      if (activeImg && zoomImg) {
        zoomImg.src = activeImg.src;
      }
      zoomModal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    });
    
    zoomModal.addEventListener('click', e => {
      if (!e.target.closest('[data-zoom-image]')) {
        zoomModal.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    });
    
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        zoomModal.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    });
  }
}

/* ---- Delivery checker ---- */
function initDeliveryChecker() {
  const form    = document.querySelector('[data-delivery-check-form]');
  const input   = document.querySelector('[data-pincode-input]');
  const result  = document.querySelector('[data-delivery-result]');
  if (!form || !input || !result) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const pin = input.value.trim();
    if (pin.length !== 6 || isNaN(pin)) {
      result.textContent = 'Please enter a valid 6-digit pincode.';
      result.className = 'delivery-result delivery-result--error';
      return;
    }
    /* Simulate delivery check */
    result.textContent = 'Checking...';
    setTimeout(() => {
      result.textContent = `Delivery available to ${pin} — Estimated 3–5 business days`;
      result.className = 'delivery-result delivery-result--success';
    }, 800);
  });
}

/* ---- Sticky add to cart ---- */
function initStickyBar() {
  const bar       = document.querySelector('[data-sticky-atc]');
  const sentinel  = document.querySelector('[data-sticky-sentinel]');
  if (!bar || !sentinel) return;
  const obs = new IntersectionObserver(entries => {
    bar.classList.toggle('is-visible', !entries[0].isIntersecting);
  }, { threshold: 0 });
  obs.observe(sentinel);
}

/* ---- Quantity selector ---- */
function initQtySelector() {
  document.querySelectorAll('[data-qty-selector]').forEach(sel => {
    const input = sel.querySelector('[data-qty-value]');
    sel.querySelector('[data-qty-dec]')?.addEventListener('click', () => {
      const v = Math.max(1, parseInt(input.value) - 1);
      input.value = v;
    });
    sel.querySelector('[data-qty-inc]')?.addEventListener('click', () => {
      input.value = parseInt(input.value) + 1;
    });
  });
}

/* ---- Format money ---- */
function formatMoney(cents) {
  return '₹' + (cents / 100).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

document.addEventListener('DOMContentLoaded', () => {
  initVariantPicker();
  initGallery();
  initDeliveryChecker();
  initStickyBar();
  initQtySelector();
});
