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

async function getPrimaryLocationId() {
  const query = `
    query GetLocations {
      locations(first: 10) {
        edges {
          node {
            id
            name
            isActive
          }
        }
      }
    }
  `;
  const data = await shopifyQuery(query);
  const locations = data.locations.edges.map(e => e.node);
  const activeLocation = locations.find(l => l.isActive) || locations[0];
  return activeLocation.id;
}

async function run() {
  const targetCodes = [
    'TOVWO008', 'TOVWO009', 'TOVWO010', 'TOVWO011',
    'TOVWO012', 'TOVWO013', 'TOVWO014', 'TOVWO015'
  ];

  console.log("Starting stock adjustments (Only Black = 10, other colors = 0) for:", targetCodes.join(', '));
  
  const locationId = await getPrimaryLocationId();
  console.log(`Using Location ID: ${locationId}`);

  for (const code of targetCodes) {
    console.log(`\nQuerying variants for product code: ${code}...`);
    const productQuery = `
      query FindProduct($query: String!) {
        products(first: 1, query: $query) {
          edges {
            node {
              id
              title
              variants(first: 250) {
                edges {
                  node {
                    id
                    title
                    selectedOptions {
                      name
                      value
                    }
                    inventoryItem {
                      id
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const result = await shopifyQuery(productQuery, { query: code });
    const product = result.products?.edges[0]?.node;
    if (!product) {
      console.warn(`Product not found on Shopify for code: ${code}`);
      continue;
    }

    console.log(`Product: "${product.title}"`);
    
    const setQuantities = [];
    product.variants.edges.forEach(edge => {
      const variant = edge.node;
      const colorOption = variant.selectedOptions.find(o => o.name === 'Color');
      const colorVal = colorOption ? colorOption.value.toLowerCase() : '';
      const isBlack = colorVal === 'black';
      
      setQuantities.push({
        inventoryItemId: variant.inventoryItem.id,
        locationId: locationId,
        quantity: isBlack ? 10 : 0
      });
    });

    if (setQuantities.length === 0) {
      console.log("No variants found to update.");
      continue;
    }

    console.log(`Adjusting inventory for ${setQuantities.length} variants...`);
    const updateMutation = `
      mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
        inventorySetQuantities(input: $input) {
          userErrors {
            field
            message
          }
        }
      }
    `;

    try {
      const updateResult = await shopifyQuery(updateMutation, {
        input: {
          reason: "correction",
          name: "available",
          ignoreCompareQuantity: true,
          quantities: setQuantities
        }
      });
      const errors = updateResult.inventorySetQuantities?.userErrors || [];
      if (errors.length > 0) {
        console.error(`- Errors setting quantities:`, errors);
      } else {
        console.log(`- Successfully set Black variants to 10 and other color variants to 0.`);
      }
    } catch (err) {
      console.error(`- Failed setting quantities:`, err.message);
    }

    // Small delay to prevent throttling
    await new Promise(r => setTimeout(r, 500));
  }

  console.log("\nStock adjustment task complete!");
}

run();
