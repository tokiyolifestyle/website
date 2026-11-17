const fs = require('fs');
const path = require('path');

// Load .env if present
const env = {};
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .forEach(l => {
      const idx = l.indexOf('=');
      env[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
    });
}

const domain = process.env.SHOPIFY_STORE_DOMAIN || env.SHOPIFY_STORE_DOMAIN || process.argv[2] || 'tokiyolifestyle.myshopify.com';
const token = process.env.SHOPIFY_ACCESS_TOKEN || env.SHOPIFY_ACCESS_TOKEN || process.argv[3];

if (!token) {
  console.error('\n[ERROR] Shopify Admin Access Token is required.');
  console.log('Usage: node scripts/create_cargo_product.js [store_domain] [access_token]');
  console.log('Or add SHOPIFY_ACCESS_TOKEN to .env file.');
  process.exit(1);
}

const assetsDir = path.resolve(__dirname, '../assets');

const imageFiles = [
  {
    path: path.join(assetsDir, 'cargo-pants-heather-grey-flatlay.jpg'),
    filename: 'tokiyo_cargo_pants_heather_grey_flatlay.jpg',
    alt: 'Tokiyo Lifestyle Relaxed Baggy Cargo Pants - Heather Grey Flat Lay'
  },
  {
    path: path.join(assetsDir, 'cargo-size-guide.jpg'),
    filename: 'tokiyo_cargo_pants_size_guide.jpg',
    alt: 'Tokiyo Lifestyle Cargo Pants Relaxed Baggy Fit Size Guide'
  },
  {
    path: path.join(assetsDir, 'cargo-pants-heather-grey-model-front.jpg'),
    filename: 'tokiyo_cargo_pants_model_front.jpg',
    alt: 'Tokiyo Lifestyle Relaxed Baggy Cargo Pants - Model Front View'
  },
  {
    path: path.join(assetsDir, 'cargo-pants-heather-grey-model-side.jpg'),
    filename: 'tokiyo_cargo_pants_model_side.jpg',
    alt: 'Tokiyo Lifestyle Relaxed Baggy Cargo Pants - Model Side View'
  },
  {
    path: path.join(assetsDir, 'cargo-pants-heather-grey-detail.jpg'),
    filename: 'tokiyo_cargo_pants_detail.jpg',
    alt: 'Tokiyo Lifestyle Relaxed Baggy Cargo Pants - Pocket & Fabric Detail'
  }
];

async function createCargoProduct() {
  console.log('1. Preparing product images (Base64 encoding)...');
  const imagesPayload = [];
  for (const img of imageFiles) {
    if (fs.existsSync(img.path)) {
      const fileBuffer = fs.readFileSync(img.path);
      imagesPayload.push({
        attachment: fileBuffer.toString('base64'),
        filename: img.filename,
        alt: img.alt
      });
      console.log(`- Loaded: ${img.filename} (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
    } else {
      console.warn(`- Warning: Image not found at ${img.path}`);
    }
  }

  const sizes = ['S', 'M', 'L', 'XL'];
  const variants = sizes.map(size => ({
    option1: size,
    price: '1249.00',
    compare_at_price: '2149.00',
    sku: `TK-CRG-GRY-${size}`,
    inventory_management: 'shopify',
    inventory_policy: 'deny',
    fulfillment_service: 'manual',
    requires_shipping: true,
    taxable: true
  }));

  const productData = {
    product: {
      title: 'Tokiyo Lifestyle Relaxed Baggy Cargo Pants - Heather Grey',
      handle: 'tokiyo-lifestyle-relaxed-baggy-cargo-pants-heather-grey',
      body_html: `
<p>Elevate your streetwear rotation with the <strong>Tokiyo Lifestyle Relaxed Baggy Cargo Pants</strong> in Heather Grey.</p>

<h3>✦ Key Highlights:</h3>
<ul>
  <li><strong>Relaxed Baggy Fit:</strong> Wide-leg Japanese streetwear silhouette designed to fall cleanly over sneakers.</li>
  <li><strong>Custom Elastic Comfort:</strong> Ribbed elasticated waistband with adjustable braided drawstring cord.</li>
  <li><strong>Dual Utility Cargo Pockets:</strong> Spacious side thigh cargo flap pockets for everyday essentials.</li>
  <li><strong>Premium Cotton Blend Fabric:</strong> Breathable, soft-touch French terry cotton blend that retains structured shape.</li>
</ul>

<h3>✦ Size Guide (Inches):</h3>
<ul>
  <li><strong>S:</strong> Waist 28 - 30 | Length 38</li>
  <li><strong>M:</strong> Waist 30 - 32 | Length 39</li>
  <li><strong>L:</strong> Waist 32 - 34 | Length 40</li>
  <li><strong>XL:</strong> Waist 34 - 36 | Length 40 - 41</li>
</ul>

<p><em>Care Instructions: Machine wash cold inside out with like colors. Do not bleach. Cool iron inside out. Hang dry in shade.</em></p>
      `.trim(),
      vendor: 'Tokiyo Lifestyle',
      product_type: 'Cargo Pants',
      tags: 'Cargo Pants, Bottomwear, Relaxed Baggy Fit, Wide Leg, Heather Grey, Cotton Blend, Tokiyo Lifestyle, Winter Drop, New Arrival, Streetwear, no-discount',
      status: 'active',
      options: [
        {
          name: 'Size',
          values: sizes
        }
      ],
      variants: variants,
      images: imagesPayload
    }
  };

  console.log(`\n2. Creating product on Shopify Admin API (${domain})...`);
  const res = await fetch(`https://${domain}/admin/api/2024-01/products.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token
    },
    body: JSON.stringify(productData)
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Failed to create product:', JSON.stringify(data, null, 2));
    return;
  }

  const createdProduct = data.product;
  console.log(`\n[SUCCESS] Product created! ID: ${createdProduct.id}, Handle: ${createdProduct.handle}`);

  console.log('\n3. Publishing product to Online Store Sales Channel...');
  try {
    const pubMutation = `
      mutation PublishResource($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) {
          userErrors {
            field
            message
          }
        }
      }
    `;
    const pubRes = await fetch(`https://${domain}/admin/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token
      },
      body: JSON.stringify({
        query: pubMutation,
        variables: {
          id: `gid://shopify/Product/${createdProduct.id}`,
          input: [{ publicationId: 'gid://shopify/Publication/205598064884' }]
        }
      })
    });
    const pubData = await pubRes.json();
    console.log('Publish result:', JSON.stringify(pubData));
  } catch (pubErr) {
    console.warn('Publish warning (product is already active):', pubErr.message);
  }

  console.log('\n4. Setting initial inventory levels for variants...');
  for (const v of createdProduct.variants) {
    if (v.inventory_item_id) {
      try {
        const invLevelsRes = await fetch(`https://${domain}/admin/api/2024-01/inventory_levels.json?inventory_item_ids=${v.inventory_item_id}`, {
          headers: { 'X-Shopify-Access-Token': token }
        });
        const invLevels = await invLevelsRes.json();
        const loc = invLevels.inventory_levels?.[0];
        if (loc) {
          await fetch(`https://${domain}/admin/api/2024-01/inventory_levels/set.json`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': token
            },
            body: JSON.stringify({
              location_id: loc.location_id,
              inventory_item_id: v.inventory_item_id,
              available: 20
            })
          });
          console.log(`- Variant ${v.title} (${v.sku}) stock set to 20`);
        }
      } catch (err) {
        console.warn(`Could not set stock for variant ${v.title}:`, err.message);
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`ALL DONE! Product is now LIVE at:`);
  console.log(`https://${domain}/products/${createdProduct.handle}`);
  console.log(`======================================================`);
}

createCargoProduct().catch(console.error);

