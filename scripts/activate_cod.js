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

async function run() {
  const prodId = 9554331861236;
  console.log('1. Setting COD Fee product to active...');

  const updateRes = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/products/${prodId}.json`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN
    },
    body: JSON.stringify({
      product: {
        id: prodId,
        status: 'active'
      }
    })
  });
  const updateData = await updateRes.json();
  console.log('Update HTTP status:', updateRes.status, 'New product status:', updateData.product?.status);

  console.log('2. Publishing COD Fee product to Online Store...');
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
        id: `gid://shopify/Product/${prodId}`,
        input: [{ publicationId: 'gid://shopify/Publication/205598064884' }]
      }
    })
  });
  const pubData = await pubRes.json();
  console.log('Publish result:', JSON.stringify(pubData));

  console.log('3. Testing /cart/add.js on storefront...');
  const addRes = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/cart/add.js`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0'
    },
    body: JSON.stringify({
      items: [{ id: 48862017716468, quantity: 1 }]
    })
  });
  console.log('Storefront /cart/add.js status:', addRes.status, addRes.statusText);
  const addText = await addRes.text();
  console.log('Response body:', addText);
}

run().catch(console.error);
