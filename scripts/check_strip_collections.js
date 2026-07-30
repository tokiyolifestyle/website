const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      if (key && !key.startsWith('#')) {
        process.env[key] = val;
      }
    }
  });
}

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_ACCESS_TOKEN;

async function shopifyQuery(query, variables = {}) {
  const url = `https://${domain}/admin/api/2024-10/graphql.json`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json();
  return json.data;
}

async function run() {
  const query = `
    query GetCollections {
      collections(first: 50) {
        edges {
          node {
            title
            handle
            productsCount
            products(first: 1) {
              edges {
                node {
                  title
                  featuredImage {
                    url
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  console.log("Checking Shopify collections and first product images...");
  const data = await shopifyQuery(query);
  if (data && data.collections) {
    data.collections.edges.forEach(e => {
      const c = e.node;
      console.log(`Collection: "${c.title}" (Handle: ${c.handle}) | Count: ${c.productsCount}`);
      const firstProd = c.products.edges[0]?.node;
      if (firstProd) {
        console.log(`  First Product: "${firstProd.title}" | Image: ${firstProd.featuredImage ? firstProd.featuredImage.url.substring(0, 80) : 'none'}`);
      } else {
        console.log(`  First Product: none`);
      }
    });
  } else {
    console.log("No collection data returned.");
  }
}

run();
