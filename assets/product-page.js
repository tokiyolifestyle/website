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
        const pos = parseInt(input.getAttribute('data-option-position') || '1', 10) - 1;
        selected[pos] = input.value;
      }
    });
    return variantData.find(v =>
      v.options.every((opt, i) => {
        return selected[i] === opt;
      })
    );
  }

  function updateAvailability() {
    const selected = {};
    picker.querySelectorAll('[data-option-name]').forEach(input => {
      if (input.checked || input.tagName === 'SELECT') {
        const pos = parseInt(input.getAttribute('data-option-position') || '1', 10) - 1;
        selected[pos] = input.value;
      }
    });

    const optionInputs = picker.querySelectorAll('[data-option-name]');
    optionInputs.forEach(input => {
      const pos = parseInt(input.getAttribute('data-option-position') || '1', 10) - 1;
      const testSelected = Object.assign({}, selected, { [pos]: input.value });
      
      const match = variantData.find(v =>
        v.options.every((opt, i) => {
          return testSelected[i] === opt;
        })
      );
      
      const wrapper = input.closest('.size-button, .color-swatch');
      if (wrapper) {
        wrapper.classList.toggle('is-unavailable', !match || !match.available);
      }
    });
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
    const buyNowBtn = document.querySelector('.product-info__buy-now');
    if (buyNowBtn) {
      buyNowBtn.disabled = !variant.available;
      buyNowBtn.style.display = variant.available ? '' : 'none';
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

    // Update the color name text under the label:
    const selectedColorInput = picker.querySelector('input[data-option-name="Color"]:checked, input[name="Color"]:checked');
    if (selectedColorInput) {
      document.querySelectorAll('[data-selected-color-name]').forEach(el => {
        el.textContent = selectedColorInput.value;
      });
    }

    // Scroll to the variant's featured media image if it exists:
    if (variant.featured_media && variant.featured_media.id) {
      const targetThumb = document.querySelector(`[data-gallery-thumbs] [data-media-id="${variant.featured_media.id}"]`);
      if (targetThumb) {
        targetThumb.click();
      }
    } else if (variant.featured_image && variant.featured_image.id) {
      const targetThumb = document.querySelector(`[data-gallery-thumbs] [data-media-id="${variant.featured_image.id}"]`);
      if (targetThumb) {
        targetThumb.click();
      }
    } else if (variant.options && variant.options[0]) {
      // Fallback: filter by first option if it is color option
      const checkColorInput = picker.querySelector('[data-option-name="Color"]');
      if (checkColorInput) {
        const pos = parseInt(checkColorInput.getAttribute('data-option-position') || '1', 10) - 1;
        const colorVal = variant.options[pos];
        if (colorVal) {
          filterGalleryByColor(colorVal);
        }
      }
    }

    /* Update URL without reload */
    const url = new URL(window.location);
    url.searchParams.set('variant', variant.id);
    history.replaceState({}, '', url);

    updateAvailability();
  }

  picker.addEventListener('change', () => {
    const variant = getCurrentVariant();
    updateUI(variant);
  });

  /* Init with current variant */
  const urlVariant = new URLSearchParams(window.location.search).get('variant');
  const initial = urlVariant ? variantData.find(v => String(v.id) === urlVariant) : variantData.find(v => v.available) || variantData[0];
  if (initial) updateUI(initial);
  updateAvailability();
}

/* ---- Filter Gallery by Color ---- */
function filterGalleryByColor(selectedColor) {
  const track = document.querySelector('[data-gallery-track]');
  const thumbs = document.querySelector('[data-gallery-thumbs]');
  if (!track) return;

  const slides = [...track.querySelectorAll('.product-gallery__slide')];
  const allThumbs = thumbs ? [...thumbs.querySelectorAll('[data-thumb]')] : [];

  const cleanColor = selectedColor ? selectedColor.toLowerCase().trim() : '';

  // Filter slides
  slides.forEach(slide => {
    const imgColor = slide.getAttribute('data-color') ? slide.getAttribute('data-color').toLowerCase().trim() : '';
    if (!imgColor || imgColor === cleanColor) {
      slide.classList.remove('is-hidden');
      slide.style.display = '';
    } else {
      slide.classList.add('is-hidden');
      slide.style.display = 'none';
    }
  });

  // Filter thumbs
  allThumbs.forEach(thumb => {
    const imgColor = thumb.getAttribute('data-color') ? thumb.getAttribute('data-color').toLowerCase().trim() : '';
    if (!imgColor || imgColor === cleanColor) {
      thumb.classList.remove('is-hidden');
      thumb.style.display = '';
    } else {
      thumb.classList.add('is-hidden');
      thumb.style.display = 'none';
    }
  });

  // Re-sync slider track
  const visibleThumbs = allThumbs.filter(t => !t.classList.contains('is-hidden'));
  if (visibleThumbs.length > 0) {
    visibleThumbs[0].click();
  }
}

/* ---- Image gallery ---- */
function initGallery() {
  const gallery    = document.querySelector('[data-product-gallery]');
  const thumbs     = document.querySelector('[data-gallery-thumbs]');
  const track      = document.querySelector('[data-gallery-track]');
  const zoomBtn    = document.querySelector('[data-zoom-toggle]');
  const zoomModal  = document.querySelector('[data-zoom-modal]');
  if (!gallery || !track) return;

  function getVisibleSlides() {
    return [...track.querySelectorAll('.product-gallery__slide:not(.is-hidden)')];
  }
  function getVisibleThumbs() {
    return thumbs ? [...thumbs.querySelectorAll('[data-thumb]:not(.is-hidden)')] : [];
  }

  let currentIndex = 0;

  function goToSlide(index) {
    const visibleSlides = getVisibleSlides();
    const visibleThumbs = getVisibleThumbs();
    if (visibleSlides.length === 0) return;

    if (index < 0) index = visibleSlides.length - 1;
    if (index >= visibleSlides.length) index = 0;
    
    currentIndex = index;
    
    // Shift track
    track.style.transform = `translateX(-${currentIndex * 100}%)`;
    
    // Update active slide class
    const allSlides = [...track.querySelectorAll('.product-gallery__slide')];
    allSlides.forEach(slide => slide.classList.remove('is-active'));
    if (visibleSlides[currentIndex]) {
      visibleSlides[currentIndex].classList.add('is-active');
    }

    // Update active thumbnail class
    const allThumbs = thumbs ? [...thumbs.querySelectorAll('[data-thumb]')] : [];
    allThumbs.forEach(thumb => thumb.classList.remove('is-active'));
    if (visibleThumbs[currentIndex]) {
      visibleThumbs[currentIndex].classList.add('is-active');
    }

    // Scroll active thumbnail horizontally inside container only (does NOT scroll window/page)
    if (visibleThumbs[currentIndex] && thumbs) {
      const thumb = visibleThumbs[currentIndex];
      thumbs.scrollTo({
        left: thumb.offsetLeft - (thumbs.clientWidth / 2) + (thumb.clientWidth / 2),
        behavior: 'smooth'
      });
    }
  }

  // Thumb clicks delegated to data-gallery-thumbs wrapper
  if (thumbs) {
    thumbs.addEventListener('click', e => {
      const clickedThumb = e.target.closest('[data-thumb]');
      if (!clickedThumb || clickedThumb.classList.contains('is-hidden')) return;
      const visibleThumbs = getVisibleThumbs();
      const visibleIndex = visibleThumbs.indexOf(clickedThumb);
      if (visibleIndex !== -1) {
        goToSlide(visibleIndex);
      }
    });
  }

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
      goToSlide(currentIndex + 1);
    } else if (touchEndX - touchStartX > swipeThreshold) {
      goToSlide(currentIndex - 1);
    }
  }

  // Zoom Modal integration
  if (zoomModal) {
    const zoomImg = zoomModal.querySelector('[data-zoom-image]');

    function openZoomModal(imgSrc) {
      if (!imgSrc || !zoomImg) return;
      zoomImg.src = imgSrc;
      zoomModal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      if (typeof stopAutoSlide === 'function') stopAutoSlide();
    }

    function closeZoomModal() {
      zoomModal.classList.remove('is-open');
      document.body.style.overflow = '';
      if (typeof startAutoSlide === 'function') startAutoSlide();
    }

    if (gallery) {
      gallery.addEventListener('click', e => {
        const zoomToggle = e.target.closest('[data-zoom-toggle]');
        const mainImg = e.target.closest('.product-gallery__main-image');
        if (zoomToggle || mainImg) {
          const visibleSlides = getVisibleSlides();
          const activeSlide = visibleSlides && visibleSlides.length ? visibleSlides[currentIndex] : document.querySelector('.product-gallery__slide.is-active');
          const activeImg = activeSlide ? activeSlide.querySelector('img') : null;
          if (activeImg) {
            openZoomModal(activeImg.src || activeImg.getAttribute('src'));
          }
        }
      });
    }

    zoomModal.addEventListener('click', e => {
      if (!e.target.closest('[data-zoom-image]') || e.target.closest('.product-gallery__zoom-close') || e.target.closest('[data-zoom-backdrop]')) {
        closeZoomModal();
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && zoomModal.classList.contains('is-open')) {
        closeZoomModal();
      }
    });
  }

  /* ---- Auto-slide every 4 seconds ---- */
  let autoSlideTimer = null;
  let resumeTimer = null;

  function startAutoSlide() {
    stopAutoSlide();
    const visibleSlides = getVisibleSlides();
    if (visibleSlides.length <= 1) return;
    autoSlideTimer = setInterval(() => {
      // Only auto-slide if gallery is currently visible in viewport
      const rect = gallery.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        goToSlide(currentIndex + 1);
      }
    }, 4000);
  }

  function stopAutoSlide() {
    if (autoSlideTimer) { clearInterval(autoSlideTimer); autoSlideTimer = null; }
    if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
  }

  function pauseAndResume() {
    stopAutoSlide();
    resumeTimer = setTimeout(startAutoSlide, 8000);
  }

  // Pause auto-slide on user interaction (swipe or thumb click)
  gallery.addEventListener('touchstart', pauseAndResume, { passive: true });
  if (thumbs) {
    thumbs.addEventListener('click', pauseAndResume);
  }

  // Start auto-slide on load
  startAutoSlide();
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
      result.textContent = `Delivery available to ${pin} — Estimated 3–7 working days`;
      result.className = 'delivery-result delivery-result--success';
    }, 800);
  });
}

/* ---- Sticky add to cart ---- */
function initStickyBar() {
  const bar       = document.querySelector('[data-sticky-atc]');
  const sentinel  = document.querySelector('[data-sticky-sentinel]');
  const footer    = document.querySelector('footer, .site-footer, #shopify-section-footer, .footer');
  if (!bar || !sentinel) return;

  let isSentinelPassed = false;
  let isFooterVisible = false;

  function updateVisibility() {
    if (isSentinelPassed && !isFooterVisible) {
      bar.classList.add('is-visible');
    } else {
      bar.classList.remove('is-visible');
    }
  }

  const sentinelObs = new IntersectionObserver(entries => {
    isSentinelPassed = !entries[0].isIntersecting && entries[0].boundingClientRect.top < 0;
    updateVisibility();
  }, { threshold: 0 });
  sentinelObs.observe(sentinel);

  if (footer) {
    const footerObs = new IntersectionObserver(entries => {
      isFooterVisible = entries[0].isIntersecting;
      updateVisibility();
    }, { threshold: 0.05 });
    footerObs.observe(footer);
  }
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
