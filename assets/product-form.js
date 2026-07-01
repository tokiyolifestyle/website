/**
 * TOKIYO LIFESTYLE — product-form.js
 * Variant selection (color/size), gallery sync, image zoom, sticky add-to-cart,
 * quantity selector, delivery pincode checker.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    initVariantSelectors();
    initGallery();
    initQuantitySelector();
    initStickyAddToCart();
    initDeliveryChecker();
    initImageZoom();
  });

  /* ---------------- Variant Selection ---------------- */
  function initVariantSelectors() {
    var form = document.querySelector('[data-product-form]');
    if (!form) return;

    var variantDataEl = document.querySelector('[data-product-variants]');
    if (!variantDataEl) return;
    var variants;
    try {
      variants = JSON.parse(variantDataEl.textContent);
    } catch (e) { return; }

    var optionInputs = form.querySelectorAll('[data-option-input]');

    function getSelectedOptions() {
      var groups = {};
      optionInputs.forEach(function (input) {
        if (input.type === 'radio' && !input.checked) return;
        var pos = parseInt(input.getAttribute('data-option-position'), 10);
        groups[pos] = input.value;
      });
      var keys = Object.keys(groups).map(Number);
      var maxPos = keys.length ? Math.max.apply(null, keys) : 0;
      var selected = [];
      for (var i = 1; i <= maxPos; i++) selected.push(groups[i]);
      return selected;
    }

    function findMatchingVariant(selectedOptions) {
      return variants.find(function (variant) {
        return variant.options.every(function (opt, idx) {
          return opt === selectedOptions[idx];
        });
      });
    }

    function updateAvailability() {
      var selected = getSelectedOptions();
      optionInputs.forEach(function (input) {
        var pos = parseInt(input.getAttribute('data-option-position'), 10);
        var testOptions = selected.slice();
        testOptions[pos - 1] = input.value;
        var match = variants.find(function (v) {
          return v.options.every(function (opt, idx) { return opt === testOptions[idx]; });
        });
        var wrapper = input.closest('.size-button, .color-swatch');
        if (wrapper) {
          wrapper.classList.toggle('is-unavailable', !match || !match.available);
        }
      });
    }

    function updateUI() {
      var selected = getSelectedOptions();
      var variant = findMatchingVariant(selected);
      var priceEl = document.querySelector('[data-product-price]');
      var comparePriceEl = document.querySelector('[data-product-compare-price]');
      var addToCartBtn = form.querySelector('[data-add-to-cart-button]');
      var stockIndicator = document.querySelector('[data-stock-indicator]');
      var variantIdInput = form.querySelector('[name="id"]');

      if (!variant) {
        if (addToCartBtn) {
          addToCartBtn.disabled = true;
          addToCartBtn.textContent = 'Unavailable';
        }
        return;
      }

      if (variantIdInput) variantIdInput.value = variant.id;
      if (priceEl) priceEl.textContent = variant.price_formatted || formatPrice(variant.price);
      if (comparePriceEl) {
        if (variant.compare_at_price && variant.compare_at_price > variant.price) {
          comparePriceEl.textContent = variant.compare_at_price_formatted || formatPrice(variant.compare_at_price);
          comparePriceEl.style.display = '';
        } else {
          comparePriceEl.style.display = 'none';
        }
      }

      if (addToCartBtn) {
        addToCartBtn.disabled = !variant.available;
        addToCartBtn.textContent = variant.available ? (addToCartBtn.getAttribute('data-add-text') || 'Add to Cart') : 'Sold Out';
      }

      if (stockIndicator) {
        var qty = variant.inventory_quantity;
        stockIndicator.classList.remove('is-low', 'is-out');
        var textEl = stockIndicator.querySelector('[data-stock-text]');
        if (!variant.available) {
          stockIndicator.classList.add('is-out');
          if (textEl) textEl.textContent = 'Out of Stock';
        } else if (typeof qty === 'number' && qty > 0 && qty <= (parseInt(stockIndicator.getAttribute('data-low-threshold'), 10) || 5)) {
          stockIndicator.classList.add('is-low');
          if (textEl) textEl.textContent = 'Only ' + qty + ' left in stock';
        } else if (textEl) {
          textEl.textContent = 'In Stock';
        }
      }

      var mediaId = variant.featured_media_id;
      if (mediaId) {
        var targetThumb = document.querySelector('[data-media-id="' + mediaId + '"]');
        targetThumb && targetThumb.click();
      }

      updateAvailability();
      document.dispatchEvent(new CustomEvent('variant:changed', { detail: variant }));
    }

    optionInputs.forEach(function (input) {
      input.addEventListener('change', updateUI);
    });

    updateAvailability();
  }

  function formatPrice(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  /* ---------------- Gallery ---------------- */
  function initGallery() {
    var thumbs = document.querySelectorAll('[data-gallery-thumb]');
    var mainImage = document.querySelector('[data-gallery-main-image]');
    if (!thumbs.length || !mainImage) return;

    thumbs.forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        thumbs.forEach(function (t) { t.classList.remove('is-active'); });
        thumb.classList.add('is-active');
        var fullSrc = thumb.getAttribute('data-full-src');
        var img = mainImage.querySelector('img');
        if (img && fullSrc) {
          img.src = fullSrc;
          img.removeAttribute('srcset');
        }
      });
    });
  }

  /* ---------------- Image Zoom ---------------- */
  function initImageZoom() {
    var mainImage = document.querySelector('[data-gallery-main-image]');
    if (!mainImage) return;
    mainImage.addEventListener('mousemove', function (e) {
      if (window.innerWidth < 990) return;
      var rect = mainImage.getBoundingClientRect();
      var x = ((e.clientX - rect.left) / rect.width) * 100;
      var y = ((e.clientY - rect.top) / rect.height) * 100;
      var img = mainImage.querySelector('img');
      if (img) img.style.transformOrigin = x + '% ' + y + '%';
    });
    mainImage.addEventListener('mouseenter', function () {
      if (window.innerWidth < 990) return;
      mainImage.classList.add('is-zoomed');
    });
    mainImage.addEventListener('mouseleave', function () {
      mainImage.classList.remove('is-zoomed');
    });
  }

  /* ---------------- Quantity Selector ---------------- */
  function initQuantitySelector() {
    document.querySelectorAll('[data-quantity-selector]').forEach(function (selector) {
      var input = selector.querySelector('input');
      var decrease = selector.querySelector('[data-quantity-decrease]');
      var increase = selector.querySelector('[data-quantity-increase]');
      if (!input) return;

      decrease && decrease.addEventListener('click', function () {
        input.value = Math.max(1, parseInt(input.value, 10) - 1);
        input.dispatchEvent(new Event('change'));
      });
      increase && increase.addEventListener('click', function () {
        input.value = parseInt(input.value, 10) + 1;
        input.dispatchEvent(new Event('change'));
      });
    });
  }

  /* ---------------- Sticky Add To Cart ---------------- */
  function initStickyAddToCart() {
    var stickyBar = document.querySelector('[data-sticky-atc]');
    var triggerEl = document.querySelector('[data-product-form]');
    if (!stickyBar || !triggerEl || !('IntersectionObserver' in window)) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        stickyBar.classList.toggle('is-visible', !entry.isIntersecting && entry.boundingClientRect.top < 0);
      });
    }, { threshold: 0 });

    observer.observe(triggerEl);

    var stickyBtn = stickyBar.querySelector('[data-sticky-add-to-cart]');
    stickyBtn && stickyBtn.addEventListener('click', function () {
      var mainSubmit = triggerEl.querySelector('[type="submit"]');
      mainSubmit && mainSubmit.click();
    });
  }

  /* ---------------- Delivery Pincode Checker ---------------- */
  function initDeliveryChecker() {
    var checker = document.querySelector('[data-delivery-checker]');
    if (!checker) return;
    var input = checker.querySelector('input');
    var button = checker.querySelector('[data-delivery-check-button]');
    var result = checker.querySelector('[data-delivery-result]');

    button && button.addEventListener('click', function () {
      var value = input.value.trim();
      if (!/^\d{4,6}$/.test(value)) {
        result.textContent = 'Please enter a valid pincode.';
        result.style.color = 'var(--color-error, #D72638)';
        return;
      }
      result.textContent = 'Delivery available — estimated 3–5 business days.';
      result.style.color = 'var(--color-success, #3BB273)';
    });
  }
})();
