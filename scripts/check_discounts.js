const fs = require('fs');
const path = require('path');

const envPath = path.resolve('c:/Users/lenovo/Downloads/tokiyo-theme/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^\s*([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
});

const domain = env.SHOPIFY_STORE_DOMAIN;
let token = env.SHOPIFY_ACCESS_TOKEN;
const clientId = env.SHOPIFY_CLIENT_ID;
const clientSecret = env.SHOPIFY_CLIENT_SECRET;

async function getOAuthToken() {
  if (clientId && clientSecret) {
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
    if (response.ok) {
      const data = await response.json();
      if (data.access_token) return data.access_token;
    }
  }
  return token;
}

async function run() {
  const activeToken = await getOAuthToken();
  const query = `
    query {
      products(first: 20, query: "TOTM002 OR TOTM006 OR TOTM008 OR TOTM010 OR TOTM021 OR TOTM038 OR TOTM039 OR TOTM041") {
        edges {
          node {
            id
            title
            handle
            status
            tags
            variants(first: 10) {
              edges {
                node {
                  id
                  title
                  price
                  compareAtPrice
                  inventoryQuantity
                }
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch(`https://${domain}/admin/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': activeToken
    },
    body: JSON.stringify({ query })
  });

  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}

run().catch(console.error);
