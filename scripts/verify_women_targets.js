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

const targetCodes = [
  'TOVWO003',
  'TOVWO005',
  'TOVWO006',
  'TOVWO009',
  'TOVWO011',
  'TOVWO012',
  'TOVWO020',
  'TOVWO025',
  'TOVWO026'
];

async function run() {
  const query = `
    query {
      products(first: 50, query: "TOVWO") {
        edges {
          node {
            id
            title
            handle
            tags
            status
          }
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
    body: JSON.stringify({ query })
  });

  const json = await res.json();
  const products = json.data.products.edges.map(e => e.node);
  
  targetCodes.forEach(code => {
    const found = products.find(p => p.title.includes(code) || p.tags.includes(code));
    if (found) {
      console.log(`[FOUND] ${code} -> ${found.title} (ID: ${found.id}, Handle: ${found.handle})`);
    } else {
      console.log(`[MISSING] ${code}`);
    }
  });
}

run().catch(console.error);
