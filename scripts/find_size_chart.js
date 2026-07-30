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
  if (json.errors) {
    console.error("GraphQL errors:", JSON.stringify(json.errors, null, 2));
  }
  return json.data;
}

async function run() {
  const query = `
    query {
      files(first: 100, query: "size") {
        edges {
          node {
            id
            alt
            createdAt
            ... on MediaImage {
              image {
                url
              }
            }
          }
        }
      }
    }
  `;

  console.log("Searching Shopify files for 'size'...");
  const data = await shopifyQuery(query);
  if (data && data.files) {
    data.files.edges.forEach(e => {
      const node = e.node;
      console.log(`File ID: ${node.id} | Alt: ${node.alt} | URL: ${node.image ? node.image.url : 'none'}`);
    });
  } else {
    console.log("No files found.");
  }
}

run();
