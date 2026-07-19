const fs = require('fs');
const path = require('path');

// Load environment variables from .env manually if not set
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

let domain = process.env.SHOPIFY_STORE_DOMAIN;
let token = process.env.SHOPIFY_ACCESS_TOKEN;
const clientId = process.env.SHOPIFY_CLIENT_ID;
const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

const dryRun = process.argv.includes('--dry-run');

// Helper to determine token using Client Credentials Grant if needed
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
    } else {
      throw new Error(`Invalid response from token exchange: ${JSON.stringify(data)}`);
    }
  }
  
  throw new Error("No valid SHOPIFY_ACCESS_TOKEN or SHOPIFY_CLIENT_ID/SECRET combination found in .env.");
}

// Helper to execute GraphQL queries
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

// Simple CSV row parser (handles quoted values, commas, and double quotes)
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

// Retrieve primary location ID for inventory management
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
  console.log("Fetching location list...");
  const data = await shopifyQuery(query);
  const locations = data.locations.edges.map(e => e.node);
  const activeLocation = locations.find(l => l.isActive) || locations[0];
  if (!activeLocation) {
    throw new Error("No active Shopify location found to track inventory!");
  }
  console.log(`Using primary location: ${activeLocation.name} (${activeLocation.id})`);
  return activeLocation.id;
}

// Retrieve publications/sales channels
async function getPublications() {
  const query = `
    query {
      publications(first: 10) {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  `;
  console.log("Fetching publications list...");
  const data = await shopifyQuery(query);
  return data.publications.edges.map(e => e.node);
}

// Parse CSV file and group by product design key
function parseProductsCSV() {
  console.log("\n=== PARSING CSV CATALOG ===");
  const productsMap = {};
  
  const csvPath = 'C:/Users/lenovo/Downloads/Tokiyo Lifestyle - Consolidated SKUs.csv';
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  console.log(`Parsing file: ${csvPath}`);
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split(/\r?\n/);

  let currentProduct = null;

  for (let i = 1; i < lines.length; i++) {
    const lineText = lines[i];
    if (!lineText.trim()) continue;

    const row = parseCSVRow(lineText);
    if (row.length < 2 || !row[0]) continue;

    const title = row[0];
    const handle = row[1];
    const sku = row[9];
    const optionValue = row[12];
    const imageUrl = row[36];
    const imagePos = row[37];
    const imageAlt = row[38];
    const variantImageUrl = row[39];

    if (sku) {
      // Variant row
      const skuParts = sku.split('_');
      const size = skuParts.pop(); // last part is XS, S, M, L, etc.
      const colorCode = skuParts.pop(); // second to last is color prefix
      const designCode = skuParts.join('_'); // remaining is design code, e.g. "TRTWO001"

      const colorName = row[43] || colorCode || 'Default';

      if (!productsMap[designCode]) {
        // Clean title and handle by removing color suffix
        const baseTitle = title.split(' - ')[0];
        const formattedTitle = `${baseTitle} - ${designCode}`;

        const baseHandle = handle.replace(/-black|-airforce|-beige|-pista|-peach|-lavender|-onion-pink|-mustard|-white/gi, '');
        const uniqueHandle = `${baseHandle}-${designCode.toLowerCase()}`;

        productsMap[designCode] = {
          key: designCode,
          title: formattedTitle,
          handle: uniqueHandle,
          description: row[2],
          vendor: row[3] || 'TOKIYO LIFESTYLE',
          category: row[4],
          type: row[5] || 'Women Regular T-Shirt',
          tags: row[6] ? row[6].split(',').map(t => t.trim()) : [],
          variants: [],
          images: []
        };
      }
      currentProduct = productsMap[designCode];

      const isDuplicate = currentProduct.variants.some(v => v.color === colorName && v.size === (optionValue || size));
      if (!isDuplicate) {
        // Retrieve prices directly from CSV
        const price = parseFloat(row[20] || '599').toFixed(2);
        const compareAtPrice = parseFloat(row[21] || '999').toFixed(2);
        const finalInventory = row[30] ? parseInt(row[30], 10) : 10;

        currentProduct.variants.push({
          sku: sku,
          size: optionValue || size,
          color: colorName,
          price: price,
          compareAtPrice: compareAtPrice,
          cost: row[22] || '250',
          weight: row[32] ? parseFloat(row[32]) : 250,
          weightUnit: row[33] || 'g',
          inventory: finalInventory,
          variantImageUrl: variantImageUrl
        });
      }
    } else if (imageUrl) {
      // Image row
      if (currentProduct) {
        currentProduct.images.push({
          url: imageUrl,
          position: imagePos ? parseInt(imagePos, 10) : currentProduct.images.length + 1,
          alt: imageAlt || currentProduct.title
        });
      }
    }
  }

  const products = Object.values(productsMap);
  console.log(`Parsed ${products.length} unique consolidated products.`);
  return products;
}

// Bulk Upload products and publish
async function uploadProducts(products, locationId, publications) {
  console.log("\n=== UPLOADING PRODUCTS TO SHOPIFY ===");

  const productCreateMutation = `
    mutation CreateProduct($input: ProductCreateInput!) {
      productCreate(product: $input) {
        product {
          id
          title
          handle
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const optionsCreateMutation = `
    mutation CreateProductOptions($productId: ID!, $options: [OptionCreateInput!]!) {
      productOptionsCreate(productId: $productId, options: $options) {
        product {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variantsCreateMutation = `
    mutation CreateProductVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkCreate(productId: $productId, variants: $variants, strategy: REMOVE_STANDALONE_VARIANT) {
        productVariants {
          id
          title
          sku
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const mediaCreateMutation = `
    mutation CreateProductMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const publishMutation = `
    mutation PublishResource($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) {
        userErrors {
          field
          message
        }
      }
    }
  `;

  const pubInputs = publications.map(p => ({ publicationId: p.id }));

  for (let idx = 0; idx < products.length; idx++) {
    const prod = products[idx];
    console.log(`\n[${idx + 1}/${products.length}] Uploading product: ${prod.title} (SKU Prefix: ${prod.key})`);
    
    // 1. Create the Product base
    const productInput = {
      title: prod.title,
      handle: prod.handle,
      descriptionHtml: prod.description,
      vendor: prod.vendor,
      productType: prod.type,
      status: "ACTIVE",
      tags: prod.tags
    };

    let productId;
    try {
      const prodResult = await shopifyQuery(productCreateMutation, { input: productInput });
      const prodErrors = prodResult.productCreate.userErrors;
      if (prodErrors.length > 0) {
        console.error(`- Error creating product container:`, prodErrors);
        continue;
      }
      productId = prodResult.productCreate.product.id;
      console.log(`- Base product created successfully. ID: ${productId}`);
    } catch (err) {
      console.error(`- Failed to create base product:`, err.message);
      continue;
    }

    // 2. Create "Color" and "Size" options
    const uniqueColors = Array.from(new Set(prod.variants.map(v => v.color)));
    const uniqueSizes = Array.from(new Set(prod.variants.map(v => v.size)));

    const optionsInput = [
      {
        name: "Color",
        values: uniqueColors.map(c => ({ name: c }))
      },
      {
        name: "Size",
        values: uniqueSizes.map(s => ({ name: s }))
      }
    ];

    try {
      const optResult = await shopifyQuery(optionsCreateMutation, { productId, options: optionsInput });
      const optErrors = optResult.productOptionsCreate.userErrors;
      if (optErrors.length > 0) {
        console.error(`- Error creating product options:`, optErrors);
      } else {
        console.log(`- Product options "Color" and "Size" linked successfully.`);
      }
    } catch (err) {
      console.error(`- Failed to create options:`, err.message);
    }

    // 3. Create product media gallery first and map images to media IDs
    const mediaIdMap = {};
    if (prod.images.length > 0) {
      const mediaInput = prod.images.map(img => ({
        originalSource: img.url,
        mediaContentType: "IMAGE",
        alt: img.alt
      }));

      try {
        const mediaResult = await shopifyQuery(mediaCreateMutation, { productId, media: mediaInput });
        const mediaErrors = mediaResult.productCreateMedia.userErrors;
        if (mediaErrors.length > 0) {
          console.error(`- Error creating media gallery:`, mediaErrors);
        } else {
          const createdMedia = mediaResult.productCreateMedia.media;
          console.log(`- Initiated upload for ${createdMedia.length} product images.`);
          for (let i = 0; i < prod.images.length; i++) {
            if (createdMedia[i]) {
              mediaIdMap[prod.images[i].url] = createdMedia[i].id;
            }
          }
        }
      } catch (err) {
        console.error(`- Failed to add media gallery:`, err.message);
      }
    }

    // 4. Create variants in bulk, linking to pre-created media IDs
    const variantsInput = prod.variants.map(v => {
      let matchingMediaId = null;
      if (prod.images.length > 0) {
        const matchingImg = prod.images.find(img => {
          if (!img.alt) return false;
          return img.alt.toLowerCase().includes(v.color.toLowerCase());
        });
        if (matchingImg && mediaIdMap[matchingImg.url]) {
          matchingMediaId = mediaIdMap[matchingImg.url];
        }
      }

      const vInput = {
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        optionValues: [
          { optionName: "Color", name: v.color },
          { optionName: "Size", name: v.size }
        ],
        inventoryItem: {
          sku: v.sku,
          tracked: true,
          cost: v.cost
        },
        inventoryQuantities: [{
          locationId: locationId,
          availableQuantity: v.inventory
        }]
      };
      
      if (matchingMediaId) {
        vInput.mediaId = matchingMediaId;
      }
      return vInput;
    });

    try {
      const varResult = await shopifyQuery(variantsCreateMutation, { productId, variants: variantsInput });
      const varErrors = varResult.productVariantsBulkCreate.userErrors;
      if (varErrors.length > 0) {
        console.error(`- Error creating variants:`, varErrors);
      } else {
        const variantsCreated = varResult.productVariantsBulkCreate.productVariants;
        console.log(`- Bulk created ${variantsCreated.length} variants successfully.`);
      }
    } catch (err) {
      console.error(`- Failed bulk variants creation:`, err.message);
    }

    // 5. Publish product to all sales channels
    try {
      console.log(`- Publishing product to sales channels...`);
      const pubResult = await shopifyQuery(publishMutation, { id: productId, input: pubInputs });
      const pubErrors = pubResult.publishablePublish.userErrors;
      if (pubErrors.length > 0) {
        console.error(`- Failed to publish product:`, pubErrors);
      } else {
        console.log(`- Product successfully published to sales channels.`);
      }
    } catch (err) {
      console.error(`- Failed publishing product:`, err.message);
    }

    // Delay to prevent throttling
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log("\nCatalog upload complete!");
}

// Main runner function
async function run() {
  console.log("Starting Shopify Women Regular T-Shirt Catalog Upload script...");

  try {
    const parsedProducts = parseProductsCSV();

    if (dryRun) {
      console.log("\n=== DRY RUN MODE: PREVIEWING GROUPED PRODUCTS ===");
      for (const p of parsedProducts) {
        console.log(`Product: ${p.title} (${p.key})`);
        console.log(`  Handle: ${p.handle}`);
        console.log(`  Variants count: ${p.variants.length}`);
        console.log(`  Unique Colors: ${Array.from(new Set(p.variants.map(v => v.color))).join(', ')}`);
        console.log(`  Unique Sizes: ${Array.from(new Set(p.variants.map(v => v.size))).join(', ')}`);
        console.log(`  Images count: ${p.images.length}`);
      }
      console.log("\nDry run complete. No modifications were made to the live Shopify database.");
      return;
    }

    const locationId = await getPrimaryLocationId();
    const publications = await getPublications();

    await uploadProducts(parsedProducts, locationId, publications);

  } catch (error) {
    console.error("Script execution failed:", error);
    process.exit(1);
  }
}

run();
