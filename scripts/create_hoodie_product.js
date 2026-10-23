const fs = require('fs');
const path = require('path');

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const brainDir = 'C:/Users/lenovo/.gemini/antigravity-ide/brain/b2df8bb4-0b6f-4de4-ad8f-e59bf1e07101';

const imageFiles = [
  {
    path: path.join(brainDir, '.user_uploaded/media_1792743674218.jpg'),
    filename: 'tokiyo_hoodie_duo_editorial_1.jpg',
    alt: 'Tokiyo Lifestyle Oversized Hoodie - Cream Duo Editorial Lookbook'
  },
  {
    path: path.join(brainDir, 'hoodie_male_front_1792744231369.jpg'),
    filename: 'tokiyo_hoodie_male_front.jpg',
    alt: 'Tokiyo Lifestyle Oversized Hoodie - Cream Male Front View'
  },
  {
    path: path.join(brainDir, 'hoodie_female_front_1792744254351.jpg'),
    filename: 'tokiyo_hoodie_female_front.jpg',
    alt: 'Tokiyo Lifestyle Oversized Hoodie - Cream Female Front View'
  },
  {
    path: path.join(brainDir, 'hoodie_detail_chest_1792744280238.jpg'),
    filename: 'tokiyo_hoodie_detail_chest.jpg',
    alt: 'Tokiyo Lifestyle Oversized Hoodie - Cream Embossed Chest Print Detail'
  },
  {
    path: path.join(brainDir, 'hoodie_back_view_1792744310719.jpg'),
    filename: 'tokiyo_hoodie_back_view.jpg',
    alt: 'Tokiyo Lifestyle Oversized Hoodie - Cream Back and Hood Embroidery'
  },
  {
    path: path.join(brainDir, 'hoodie_duo_editorial_1792744335028.jpg'),
    filename: 'tokiyo_hoodie_duo_seated.jpg',
    alt: 'Tokiyo Lifestyle Oversized Hoodie - Cream Editorial Studio Duo'
  },
  {
    path: path.join(brainDir, 'hoodie_male_profile_1792744354742.jpg'),
    filename: 'tokiyo_hoodie_male_hood_up.jpg',
    alt: 'Tokiyo Lifestyle Oversized Hoodie - Cream Male Profile Hood Up'
  }
];

async function createHoodie() {
  console.log('1. Preparing product images (Base64 encoding)...');
  const imagesPayload = imageFiles.map((img, idx) => {
    const fileBuffer = fs.readFileSync(img.path);
    return {
      attachment: fileBuffer.toString('base64'),
      filename: img.filename,
      alt: img.alt,
      position: idx + 1
    };
  });

  const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
  const variants = sizes.map((size, idx) => ({
    title: size,
    price: '1700.00',
    compare_at_price: '2199.00',
    option1: size,
    sku: `TOHD001_CR_${size}`,
    inventory_management: 'shopify',
    inventory_policy: 'deny',
    inventory_quantity: 15,
    requires_shipping: true,
    taxable: true,
    grams: 750,
    weight: 0.75,
    weight_unit: 'kg',
    position: idx + 1
  }));

  const productData = {
    product: {
      title: 'Tokiyo Lifestyle Signature Oversized Hoodie - Cream',
      body_html: `
<p><strong>The Tokiyo Signature Heavyweight Fleece Hoodie</strong> is engineered for an effortless oversized drape, superior warmth, and minimalist street luxury.</p>

<p>Crafted from premium 380+ GSM ultra-soft combed cotton fleece, featuring our signature 3D embossed puff print across the chest and high-density branding embroidered on the hood.</p>

<h3>Product Highlights:</h3>
<ul>
  <li><strong>Fabric:</strong> 100% Combed Heavyweight Cotton Fleece (380+ GSM)</li>
  <li><strong>Fit:</strong> Relaxed, streetwear-tailored oversized drop shoulder</li>
  <li><strong>Details:</strong> Signature 3D puff chest branding, embroidered hood detailing</li>
  <li><strong>Pouch:</strong> Roomy reinforced front kangaroo pocket with ribbed trims</li>
  <li><strong>Unisex:</strong> Designed to look effortlessly iconic on both men and women</li>
</ul>

<p><em>Care Instructions: Machine wash cold inside out with like colors. Do not iron directly over the 3D puff branding. Flat dry in shade.</em></p>
      `.trim(),
      vendor: 'TOKIYO LIFESTYLE',
      product_type: 'Hoodie',
      tags: 'Hoodie, Oversized Hoodie, Winterwear, Streetwear, Unisex, Men, Women, no-discount, New Arrival',
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

  console.log('2. Creating product on Shopify Admin API...');
  const res = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/products.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN
    },
    body: JSON.stringify(productData)
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Failed to create product:', JSON.stringify(data, null, 2));
    return;
  }

  const createdProduct = data.product;
  console.log(`Product created successfully! ID: ${createdProduct.id}, Handle: ${createdProduct.handle}`);

  console.log('3. Publishing product to Online Store Sales Channel...');
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
  const pubRes = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN
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

  console.log('4. Setting inventory levels for variants...');
  for (const v of createdProduct.variants) {
    if (v.inventory_item_id) {
      try {
        const invLevelsRes = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/inventory_levels.json?inventory_item_ids=${v.inventory_item_id}`, {
          headers: { 'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN }
        });
        const invLevels = await invLevelsRes.json();
        const loc = invLevels.inventory_levels?.[0];
        if (loc) {
          await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/inventory_levels/set.json`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN
            },
            body: JSON.stringify({
              location_id: loc.location_id,
              inventory_item_id: v.inventory_item_id,
              available: 15
            })
          });
          console.log(`- Variant ${v.title} (${v.sku}) stock set to 15`);
        }
      } catch (err) {
        console.warn(`Could not set stock for variant ${v.title}:`, err.message);
      }
    }
  }

  console.log(`\n=== ALL DONE! Product live at: https://${env.SHOPIFY_STORE_DOMAIN}/products/${createdProduct.handle} ===`);
}

createHoodie().catch(console.error);
