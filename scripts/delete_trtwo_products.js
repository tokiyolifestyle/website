const fs = require('fs');
const path = require('path');

// Load environment variables from .env manually
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
let token = process.env.SHOPIFY_ACCESS_TOKEN;
const clientId = process.env.SHOPIFY_CLIENT_ID;
const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

async function getOAuthToken() {
  if (token && !token.includes('PASTE_YOUR_ADMIN') && token.startsWith('shpat_')) {
    return token;
  }
  if (clientId && clientSecret && !clientSecret.includes('PASTE_YOUR_CLIENT_SECRET')) {
    const url = `https://${domain}/admin/oauth/access_token`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.access_token) {
      token = data.access_token;
      return token;
    }
  }
  return null;
}

async function shopifyQuery(query, variables = {}) {
  const activeToken = await getOAuthToken();
  const url = `https://${domain}/admin/api/2024-10/graphql.json`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": activeToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json();
  return json.data;
}

async function run() {
  console.log("Starting cleanup of old TRTWO products...");

  const getProductsQuery = `
    query GetProducts($cursor: String) {
      products(first: 50, after: $cursor) {
        edges {
          node {
            id
            title
            handle
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const deleteMutation = `
    mutation DeleteProduct($id: ID!) {
      productDelete(input: { id: $id }) {
        deletedProductId
        userErrors {
          field
          message
        }
      }
    }
  `;

  let hasNext = true;
  let cursor = null;
  let count = 0;

  while (hasNext) {
    const data = await shopifyQuery(getProductsQuery, { cursor });
    if (!data || !data.products) break;
    const edges = data.products.edges;
    hasNext = data.products.pageInfo.hasNextPage;
    cursor = data.products.pageInfo.endCursor;

    for (const edge of edges) {
      const product = edge.node;
      // Match products ending with -trtwoXXX
      if (product.handle.match(/-trtwo\d+$/)) {
        console.log(`Deleting product: ${product.title} (${product.handle})`);
        const result = await shopifyQuery(deleteMutation, { id: product.id });
        if (result && result.productDelete) {
          const errors = result.productDelete.userErrors;
          if (errors.length > 0) {
            console.error(`- Failed to delete product:`, errors);
          } else {
            count++;
          }
        }
        await new Promise(r => setTimeout(r, 250));
      }
    }
  }

  console.log(`Successfully deleted ${count} TRTWO products.`);
}

run();
