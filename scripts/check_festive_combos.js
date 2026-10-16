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

const handles = [
  'mens-festive-duo-buy-2',
  'mens-festive-trio-buy-3',
  'womens-festive-duo-buy-2',
  'womens-festive-trio-buy-3'
];

async function run() {
  for (const handle of handles) {
    const query = `
      query {
        productByHandle(handle: "${handle}") {
          id
          title
          status
        }
      }
    `;

    const res = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN
      },
      body: JSON.stringify({ query })
    });

    const json = await res.json();
    console.log(handle, json.data?.productByHandle);
  }
}

run().catch(console.error);
