const fs = require('fs');

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const prodId = 15448870715636;

const bodyHtml = `
<p><strong>The Tokiyo Signature Heavyweight Fleece Hoodie</strong> is engineered for an effortless oversized drape, superior winter warmth, and minimalist street luxury.</p>

<h3>✦ Fabric &amp; Specifications:</h3>
<ul>
  <li><strong>Fabric Weight:</strong> Ultra-Heavyweight 380+ GSM Combed Cotton Fleece</li>
  <li><strong>Composition:</strong> 100% Super-Combed Long-Staple Cotton</li>
  <li><strong>Interior Finish:</strong> Plush brushed fleece lining for cloud-soft warmth and breathable insulation</li>
  <li><strong>Fabric Treatment:</strong> Bio-washed &amp; pre-shrunk for anti-pilling longevity and zero shrinkage</li>
  <li><strong>Drape &amp; Silhouette:</strong> Dense, structured drape that holds a boxy drop-shoulder shape without clinging or sagging</li>
  <li><strong>Branding Details:</strong> Signature high-density 3D embossed puff chest logo &amp; precision embroidered hood typography</li>
  <li><strong>Pocket &amp; Hood:</strong> Double-layered self-fabric lined hood and deep reinforced front kangaroo pocket with heavy 2x2 ribbed cuffs &amp; hem</li>
  <li><strong>Fit &amp; Sizing:</strong> Unisex streetwear oversized fit. Suitable for both men and women.</li>
</ul>

<h3>✦ Wash &amp; Care Guide:</h3>
<p>Machine wash cold inside out with like colors on gentle cycle. Do not bleach or tumble dry high. Cool iron inside out (do not iron directly on the 3D puff branding). Dry flat in shade.</p>
`.trim();

async function updateDescription() {
  console.log('Updating hoodie description on Shopify Admin API...');
  const res = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/products/${prodId}.json`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN
    },
    body: JSON.stringify({
      product: {
        id: prodId,
        body_html: bodyHtml
      }
    })
  });

  const data = await res.json();
  if (res.ok && data.product) {
    console.log('Product description updated successfully!');
    console.log('New Body HTML length:', data.product.body_html.length);
  } else {
    console.error('Failed to update product description:', data);
  }
}

updateDescription();
