const fs = require('fs');
const path = require('path');

// Load environment variables from .env
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
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to exchange client credentials: HTTP ${response.status} - ${text}`);
    }
    
    const data = await response.json();
    if (data.access_token) {
      token = data.access_token;
      return token;
    }
  }
  throw new Error("No valid SHOPIFY_ACCESS_TOKEN or SHOPIFY_CLIENT_ID/SECRET combination found in .env.");
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
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP error ${response.status}: ${text}`);
  }
  const json = await response.json();
  if (json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors, null, 2)}`);
  }
  return json.data;
}

async function inspectProducts(codes) {
  for (const code of codes) {
    console.log(`\n=================== INSPECTING ${code} ===================`);
    const query = `
      query GetProduct($query: String!) {
        products(first: 5, query: $query) {
          edges {
            node {
              id
              title
              handle
              media(first: 20) {
                edges {
                  node {
                    id
                    mediaContentType
                    alt
                    ... on MediaImage {
                      image {
                        id
                        url
                        altText
                      }
                    }
                  }
                }
              }
              variants(first: 20) {
                edges {
                  node {
                    id
                    title
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

    const data = await shopifyQuery(query, { query: `title:*${code}*` });
    const products = data.products.edges.map(e => e.node);
    if (products.length === 0) {
      console.log(`No products found for query "${code}"`);
      continue;
    }

    for (const prod of products) {
      console.log(`Product ID: ${prod.id}`);
      console.log(`Title: ${prod.title}`);
      console.log(`Handle: ${prod.handle}`);
      console.log(`Media (${prod.media.edges.length}):`);
      prod.media.edges.forEach((m, idx) => {
        console.log(`  [${idx}] Media ID: ${m.node.id}, Type: ${m.node.mediaContentType}, Image URL: ${m.node.image?.url}`);
      });
      console.log(`Variants (${prod.variants.edges.length}):`);
      prod.variants.edges.forEach((v, idx) => {
        console.log(`  [${idx}] Variant ID: ${v.node.id}, Title: ${v.node.title}, Image ID: ${v.node.image?.id}`);
      });
    }
  }
}

inspectProducts(['TOTM038', 'TOTM043', 'TOTM044', 'TOTM006']).catch(console.error);
