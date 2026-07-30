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

function parseCSVRow(text) {
  const result = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(field.trim());
      field = "";
    } else {
      field += char;
    }
  }
  result.push(field.trim());
  return result;
}

async function run() {
  // 1. Get all design codes from Shopify products
  const shopifyProductsQuery = `
    query GetProducts($cursor: String) {
      products(first: 100, after: $cursor) {
        edges {
          node {
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

  let hasNext = true;
  let cursor = null;
  const shopifyHandlesAndTitles = [];
  
  while (hasNext) {
    const data = await shopifyQuery(shopifyProductsQuery, { cursor });
    if (!data || !data.products) break;
    data.products.edges.forEach(e => {
      shopifyHandlesAndTitles.push({
        title: e.node.title,
        handle: e.node.handle
      });
    });
    hasNext = data.products.pageInfo.hasNextPage;
    cursor = data.products.pageInfo.endCursor;
  }

  // 2. Parse CSV design codes
  const csvPath = 'C:/Users/lenovo/Downloads/Tokiyo Lifestyle - image update.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split(/\r?\n/);
  const csvCodes = new Set();
  
  for (let i = 1; i < lines.length; i++) {
    const lineText = lines[i];
    if (!lineText.trim()) continue;
    const row = parseCSVRow(lineText);
    if (row[0]) csvCodes.add(row[0].trim());
  }

  const csvCodesArr = Array.from(csvCodes);
  console.log(`Unique design codes in CSV: ${csvCodesArr.length}`);

  const found = [];
  const missing = [];

  csvCodesArr.forEach(code => {
    const regex = new RegExp(`\\b${code}\\b`, 'i');
    const match = shopifyHandlesAndTitles.find(p => regex.test(p.title) || p.handle.includes(code.toLowerCase()));
    if (match) {
      found.push({ code, match: match.title });
    } else {
      missing.push(code);
    }
  });

  console.log(`\nProducts in CSV that exist on Shopify (${found.length}):`);
  found.forEach(f => console.log(`- ${f.code} (Title: "${f.match}")`));

  console.log(`\nProducts in CSV that DO NOT exist on Shopify (${missing.length}):`);
  missing.forEach(m => console.log(`- ${m}`));
}

run();
