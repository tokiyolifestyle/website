/**
 * TOKIYO LIFESTYLE - Out of Stock Inventory Sync Script
 * 
 * Rules:
 * 1. Airforce Color -> XL & XXL: Set quantity = 0 (Out of Stock)
 * 2. Black Color -> XXL: Set quantity = 0 (Out of Stock)
 */

const fs = require('fs');
const path = require('path');

// Load environment variables if available
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

async function updateOutOfStock() {
  if (!domain || !token) {
    console.log("Note: SHOPIFY_STORE_DOMAIN or SHOPIFY_ACCESS_TOKEN not found in environment.");
    console.log("The storefront theme has already been updated to enforce:");
    console.log(" - Airforce: XL & XXL -> Out of Stock / Sold Out");
    console.log(" - Black: XXL -> Out of Stock / Sold Out");
    return;
  }

  console.log(`Connecting to Shopify: ${domain}...`);
  const locationId = await getPrimaryLocationId();
  console.log(`Using Location ID: ${locationId}`);

  let hasNextPage = true;
  let cursor = null;
  let totalUpdated = 0;

  while (hasNextPage) {
    const productsQuery = `
      query GetProducts($cursor: String) {
        products(first: 50, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              title
              handle
              variants(first: 100) {
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

    const data = await shopifyQuery(productsQuery, { cursor });
    const productEdges = data?.products?.edges || [];
    hasNextPage = data?.products?.pageInfo?.hasNextPage || false;
    cursor = data?.products?.pageInfo?.endCursor;

    for (const prodEdge of productEdges) {
      const product = prodEdge.node;
      const setQuantities = [];

      for (const varEdge of product.variants.edges) {
        const variant = varEdge.node;
        const colorOpt = variant.selectedOptions.find(o => o.name.toLowerCase() === 'color');
        const sizeOpt = variant.selectedOptions.find(o => o.name.toLowerCase() === 'size');

        const colorVal = (colorOpt ? colorOpt.value : '').toLowerCase().trim();
        const sizeVal = (sizeOpt ? sizeOpt.value : '').toLowerCase().trim();

        const isAirforce = colorVal === 'airforce' || colorVal === 'air force' || colorVal.includes('airforce');
        const isBlack = colorVal === 'black';
        const isXL = sizeVal === 'xl';
        const isXXL = sizeVal === 'xxl' || sizeVal === '2xl';

        if ((isAirforce && (isXL || isXXL)) || (isBlack && isXXL)) {
          setQuantities.push({
            inventoryItemId: variant.inventoryItem.id,
            locationId: locationId,
            quantity: 0
          });
          console.log(`Setting ${product.title} [${colorOpt?.value || ''} / ${sizeOpt?.value || ''}] -> Out of Stock (0)`);
        }
      }

      if (setQuantities.length > 0) {
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
          const res = await shopifyQuery(updateMutation, {
            input: {
              reason: "correction",
              name: "available",
              ignoreCompareQuantity: true,
              quantities: setQuantities
            }
          });
          const errs = res?.inventorySetQuantities?.userErrors || [];
          if (errs.length === 0) {
            totalUpdated += setQuantities.length;
          } else {
            console.error("Errors:", errs);
          }
        } catch (e) {
          console.error("Mutation failed:", e.message);
        }
      }
    }
  }

  console.log(`\nSuccessfully updated ${totalUpdated} variants to Out of Stock on Shopify.`);
}

updateOutOfStock().catch(console.error);
