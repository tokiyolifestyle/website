/**
 * TOKIYO LIFESTYLE — Unified Google Sheets Form Integration Engine
 * Captures all website forms (Partner With Us, B2B Bulk Order, Contact, Newsletter)
 * and sends entries directly into Google Sheets via Google Apps Script Web App.
 */
(function() {
  'use strict';

  // Default / Configured Google Apps Script Web App Endpoint
  const DEFAULT_WEBHOOK_URL = window.themeSettings?.googleSheetsUrl || window.TOKIYO_GOOGLE_SHEET_URL || 'https://script.google.com/macros/s/AKfycbyC5nWFcJrhTEzyGCxO4rZ4xKSM-RCGF0W-fU80UXMSKwWJOjbs7IFwkq5xZkilHu0D/exec';

  /**
   * Helper function to post data to Google Apps Script Web App
   * Uses URL-encoded FormData or JSON with no-cors fallback
   */
  async function postToGoogleSheets(data, endpointUrl) {
    const url = endpointUrl || DEFAULT_WEBHOOK_URL;
    if (!url || url.trim() === '') {
      console.warn('[Tokiyo Google Sheets] Webhook URL not configured. Data recorded locally:', data);
      return { success: true, localOnly: true };
    }

    try {
      // Append standard metadata
      const payload = {
        ...data,
        timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        iso_date: new Date().toISOString(),
        page_url: window.location.href,
        user_agent: navigator.userAgent
      };

      // Send payload via fetch (mode: no-cors is required for Google Apps Script redirects)
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload)
      });

      console.log('[Tokiyo Google Sheets] Successfully submitted to Google Sheets:', payload.form_type);
      return { success: true };
    } catch (err) {
      console.error('[Tokiyo Google Sheets] Error sending data to Google Sheets:', err);
      return { success: false, error: err };
    }
  }

  // Expose global helper
  window.TokiyoSheets = {
    post: postToGoogleSheets,
    setUrl: function(url) {
      window.TOKIYO_GOOGLE_SHEET_URL = url;
    }
  };

  /**
   * Initialize and attach listeners to all forms on page load
   */
  function initAllForms() {
    initPartnerWithUsForm();
    initB2BForm();
    initContactForm();
    initNewsletterForms();
  }

  /* ─────────────────────────────────────────────────────────────
     1. PARTNER WITH US FORM (/pages/partner-with-us)
     ───────────────────────────────────────────────────────────── */
  function initPartnerWithUsForm() {
    const form = document.getElementById('TokiyoPartnerForm');
    if (!form) return;

    // Override the form submission
    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      const submitBtn = form.querySelector('.partner-submit-btn') || form.querySelector('button[type="submit"]');
      const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Submitting Application... ⏳</span>';
      }

      const formData = {
        form_type: 'partner_application',
        sheet_tab: 'Partner_Applications',
        brand_name: (form.querySelector('[name="brand_name"]')?.value || '').trim(),
        category: (form.querySelector('[name="category"]')?.value || '').trim(),
        contact_person: (form.querySelector('[name="contact_person"]')?.value || '').trim(),
        phone: (form.querySelector('[name="phone"]')?.value || '').trim(),
        email: (form.querySelector('[name="email"]')?.value || '').trim(),
        location: (form.querySelector('[name="location"]')?.value || '').trim(),
        vip_offer: (form.querySelector('[name="vip_offer"]')?.value || '').trim(),
        social_link: (form.querySelector('[name="social_link"]')?.value || '').trim(),
        message: (form.querySelector('[name="message"]')?.value || '').trim()
      };

      // Post to Google Sheets
      await postToGoogleSheets(formData);

      // Transition to success state
      const successBox = document.getElementById('PartnerFormSuccess');
      if (successBox) {
        form.style.display = 'none';
        successBox.style.display = 'block';
        successBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────
     2. B2B / BULK ORDERS FORM (/pages/bulk-order)
     ───────────────────────────────────────────────────────────── */
  function initB2BForm() {
    const form = document.getElementById('B2BForm');
    if (!form) return;

    form.addEventListener('submit', function() {
      const formData = {
        form_type: 'b2b_inquiry',
        sheet_tab: 'B2B_Inquiries',
        name: (form.querySelector('[name="contact[name]"]')?.value || '').trim(),
        company: (form.querySelector('[name="contact[company]"]')?.value || '').trim(),
        email: (form.querySelector('[name="contact[email]"]')?.value || '').trim(),
        phone: (form.querySelector('[name="contact[phone]"]')?.value || '').trim(),
        quantity: (form.querySelector('[name="contact[quantity]"]')?.value || '').trim(),
        styles: (form.querySelector('[name="contact[styles]"]')?.value || '').trim(),
        message: (form.querySelector('[name="contact[body]"]')?.value || '').trim()
      };

      // Send to Google Sheets asynchronously while letting Shopify form submit
      postToGoogleSheets(formData);
    });
  }

  /* ─────────────────────────────────────────────────────────────
     3. CONTACT US FORM (/pages/contact)
     ───────────────────────────────────────────────────────────── */
  function initContactForm() {
    const form = document.getElementById('ContactForm');
    if (!form) return;

    form.addEventListener('submit', function() {
      const formData = {
        form_type: 'contact_message',
        sheet_tab: 'Contact_Messages',
        name: (form.querySelector('[name="contact[name]"]')?.value || '').trim(),
        email: (form.querySelector('[name="contact[email]"]')?.value || '').trim(),
        phone: (form.querySelector('[name="contact[phone]"]')?.value || '').trim(),
        message: (form.querySelector('[name="contact[body]"]')?.value || '').trim()
      };

      postToGoogleSheets(formData);
    });
  }

  /* ─────────────────────────────────────────────────────────────
     4. NEWSLETTER FORMS (Footer, Section, Popup)
     ───────────────────────────────────────────────────────────── */
  function initNewsletterForms() {
    const newsletterForms = document.querySelectorAll('form[id*="Newsletter"], form[id*="newsletter"]');
    newsletterForms.forEach(form => {
      form.addEventListener('submit', function() {
        const emailInput = form.querySelector('input[type="email"]');
        if (!emailInput || !emailInput.value) return;

        const isPopup = form.id.toLowerCase().includes('popup');
        const formData = {
          form_type: 'newsletter',
          sheet_tab: 'Newsletter_Subscribers',
          email: emailInput.value.trim(),
          source: isPopup ? 'Popup Modal' : 'Footer Section'
        };

        postToGoogleSheets(formData);
      });
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllForms);
  } else {
    initAllForms();
  }

  // Also support Shopify Theme Editor section reloads
  document.addEventListener('shopify:section:load', initAllForms);
})();
