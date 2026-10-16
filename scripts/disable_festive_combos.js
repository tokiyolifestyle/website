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

const productIds = [
  'gid://shopify/Product/9646083539188', // Men's Festive Duo
  'gid://shopify/Product/9646083571956', // Men's Festive Trio
  'gid://shopify/Product/9646083440884', // Women's Festive Duo
  'gid://shopify/Product/9646083342580'  // Women's Festive Trio
];

async function updateProductStatus(id, status) {
  const mutation = `
    mutation productUpdate($input: ProductInput!) {
      productUpdate(input: $input) {
        product {
          id
          title
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const res = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        input: {
          id,
          status
        }
      }
    })
  });

  const json = await res.json();
  return json;
}

async function main() {
  for (const id of productIds) {
    console.log(`Setting ${id} to DRAFT...`);
    const res = await updateProductStatus(id, 'DRAFT');
    const prod = res.data?.productUpdate?.product;
    const errors = res.data?.productUpdate?.userErrors;
    if (prod) {
      console.log(`SUCCESS: ${prod.title} is now ${prod.status}`);
    } else {
      console.error(`ERROR for ${id}:`, errors || res);
    }
  }
}

main().catch(console.error);
