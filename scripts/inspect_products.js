const fs = require('fs');
const path = require('path');

// Load env variables
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
  if (json.errors) {
    console.error("GraphQL errors:", JSON.stringify(json.errors, null, 2));
  }
  return json.data;
}

async function run() {
  const query = `
    query {
      products(first: 10) {
        edges {
          node {
            id
            title
            handle
            media(first: 20) {
              edges {
                node {
                  id
                  alt
                  mediaContentType
                  ... on MediaImage {
                    image {
                      url
                    }
                  }
                }
              }
            }
            variants(first: 50) {
              edges {
                node {
                  id
                  title
                  sku
                  selectedOptions {
                    name
                    value
                  }
                  image {
                    id
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

  console.log("Fetching first 10 products from Shopify...");
  const data = await shopifyQuery(query);
  if (data && data.products) {
    const products = data.products.edges.map(e => e.node);
    for (const p of products) {
      console.log(`\nProduct: ${p.title} (ID: ${p.id}, Handle: ${p.handle})`);
      console.log("Media:");
      p.media.edges.forEach(e => {
        const node = e.node;
        console.log(`  - Media ID: ${node.id}, Alt: ${node.alt}, Type: ${node.mediaContentType}, URL: ${node.image ? node.image.url.substring(0, 80) + '...' : 'none'}`);
      });
      console.log("Variants:");
      p.variants.edges.forEach(e => {
        const v = e.node;
        console.log(`  - Variant: ${v.title} (SKU: ${v.sku}, ID: ${v.id}) | Linked Image ID: ${v.image ? v.image.id : 'none'}`);
      });
    }
  } else {
    console.log("No product data returned.");
  }
}

run();
