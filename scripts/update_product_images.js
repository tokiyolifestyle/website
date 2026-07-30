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

const dryRun = process.argv.includes('--dry-run');
const testCode = process.argv.find(arg => arg.startsWith('--test='))?.split('=')[1];

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

function parseImageUpdateCSV() {
  const csvPath = 'C:/Users/lenovo/Downloads/Tokiyo Lifestyle - image update.csv';
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  console.log(`Parsing file: ${csvPath}`);
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split(/\r?\n/);
  
  const productsMap = {};

  for (let i = 1; i < lines.length; i++) {
    const lineText = lines[i];
    if (!lineText.trim()) continue;

    const row = parseCSVRow(lineText);
    if (row.length < 5 || !row[0]) continue;

    const designCode = row[0].trim();
    const colorName = row[1].trim();
    const skuCode = row[2].trim();
    
    // Read Image columns (4 to 7)
    const images = [];
    for (let colIdx = 4; colIdx <= 7; colIdx++) {
      if (row[colIdx] && row[colIdx].trim().startsWith('http')) {
        images.push(row[colIdx].trim());
      }
    }

    if (images.length === 0) continue;

    if (!productsMap[designCode]) {
      productsMap[designCode] = {
        designCode: designCode,
        colors: {}
      };
    }

    productsMap[designCode].colors[colorName] = {
      colorName: colorName,
      skuPrefix: skuCode,
      images: images
    };
  }

  const productsList = Object.values(productsMap);
  console.log(`Parsed ${productsList.length} unique products from CSV.`);
  return productsList;
}

async function findProductOnShopify(designCode) {
  const query = `
    query FindProduct($query: String!) {
      products(first: 5, query: $query) {
        edges {
          node {
            id
            title
            handle
            media(first: 100) {
              edges {
                node {
                  id
                }
              }
            }
            variants(first: 250) {
              edges {
                node {
                  id
                  title
                  sku
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  // Search by title or handle containing the design code
  const result = await shopifyQuery(query, { query: designCode });
  const edges = result.products?.edges || [];
  
  // Find the exact match where the title contains designCode (e.g. " - TOTM001")
  const regex = new RegExp(`\\b${designCode}\\b`, 'i');
  const exactMatch = edges.find(edge => regex.test(edge.node.title) || edge.node.handle.includes(designCode.toLowerCase()));
  
  return exactMatch ? exactMatch.node : null;
}

async function updateProductImages(productData) {
  const { designCode, colors } = productData;
  console.log(`\n==================================================`);
  console.log(`Processing Design Code: ${designCode}`);
  
  const shopifyProduct = await findProductOnShopify(designCode);
  if (!shopifyProduct) {
    console.warn(`Product not found on Shopify for Design Code: ${designCode}`);
    return;
  }

  console.log(`Found product: "${shopifyProduct.title}" (ID: ${shopifyProduct.id})`);
  
  if (dryRun) {
    console.log(`[DRY RUN] Would delete ${shopifyProduct.media.edges.length} existing media items.`);
    Object.keys(colors).forEach(colorName => {
      const colorInfo = colors[colorName];
      console.log(`[DRY RUN] Color "${colorName}": Would upload ${colorInfo.images.length} images.`);
      console.log(`[DRY RUN] Variants affected:`, shopifyProduct.variants.edges.filter(e => {
        const cOpt = e.node.selectedOptions.find(o => o.name === 'Color');
        return cOpt && cOpt.value.toLowerCase() === colorName.toLowerCase();
      }).map(e => `${e.node.title} (SKU: ${e.node.sku})`));
    });
    return;
  }

  // 1. Delete all existing media
  const existingMediaIds = shopifyProduct.media.edges.map(e => e.node.id);
  if (existingMediaIds.length > 0) {
    console.log(`Deleting ${existingMediaIds.length} existing product images...`);
    const deleteMutation = `
      mutation deleteMedia($productId: ID!, $mediaIds: [ID!]!) {
        productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
          deletedMediaIds
          userErrors {
            field
            message
          }
        }
      }
    `;
    const delResult = await shopifyQuery(deleteMutation, { productId: shopifyProduct.id, mediaIds: existingMediaIds });
    const delErrors = delResult.productDeleteMedia?.userErrors || [];
    if (delErrors.length > 0) {
      console.error(`Errors deleting media:`, delErrors);
    } else {
      console.log(`Successfully deleted existing media.`);
    }
  }

  // 2. Upload new media color-wise
  const mediaInput = [];
  const colorMap = {}; // Keep track of which URL belongs to which color/image index
  
  Object.keys(colors).forEach(colorName => {
    const colorInfo = colors[colorName];
    colorInfo.images.forEach((url, idx) => {
      const altText = `${shopifyProduct.title} - ${colorName} - Image ${idx + 1}`;
      mediaInput.push({
        originalSource: url,
        mediaContentType: "IMAGE",
        alt: altText
      });
      colorMap[url] = { colorName, index: idx + 1 };
    });
  });

  if (mediaInput.length === 0) {
    console.log("No new images to upload.");
    return;
  }

  console.log(`Uploading ${mediaInput.length} new product images...`);
  const createMediaMutation = `
    mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media {
          id
          alt
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  let createdMedia = [];
  try {
    const mediaResult = await shopifyQuery(createMediaMutation, { productId: shopifyProduct.id, media: mediaInput });
    const mediaErrors = mediaResult.productCreateMedia?.userErrors || [];
    if (mediaErrors.length > 0) {
      console.error(`Errors uploading media:`, mediaErrors);
    }
    createdMedia = mediaResult.productCreateMedia?.media || [];
    console.log(`Initiated upload for ${createdMedia.length} product images.`);
  } catch (err) {
    console.error(`Failed uploading media:`, err.message);
    return;
  }

  // Wait a few seconds for Shopify to process external Drive image URLs
  console.log("Waiting 3 seconds for Shopify CDN to process images...");
  await new Promise(r => setTimeout(r, 3000));

  // Fetch updated product media to get full list of IDs and their alt texts
  const checkProductQuery = `
    query checkProduct($id: ID!) {
      product(id: $id) {
        media(first: 100) {
          edges {
            node {
              id
              alt
            }
          }
        }
      }
    }
  `;
  
  const checkResult = await shopifyQuery(checkProductQuery, { id: shopifyProduct.id });
  const updatedMediaEdges = checkResult.product?.media?.edges || [];
  
  // 3. Map uploaded Media IDs to each color's "Image 1"
  const colorToMediaIdMap = {};
  updatedMediaEdges.forEach(edge => {
    const node = edge.node;
    if (node.alt) {
      // Look for suffix like " - ColorName - Image 1"
      Object.keys(colors).forEach(colorName => {
        if (node.alt.toLowerCase().includes(`${colorName.toLowerCase()} - image 1`)) {
          colorToMediaIdMap[colorName.toLowerCase()] = node.id;
        }
      });
    }
  });

  // 4. Update variants to link to their corresponding color's Image 1
  const variantsInput = [];
  shopifyProduct.variants.edges.forEach(edge => {
    const variant = edge.node;
    const colorOption = variant.selectedOptions.find(o => o.name === 'Color');
    if (colorOption) {
      const colorVal = colorOption.value.toLowerCase();
      const targetMediaId = colorToMediaIdMap[colorVal];
      if (targetMediaId) {
        variantsInput.push({
          id: variant.id,
          mediaId: targetMediaId
        });
      }
    }
  });

  if (variantsInput.length > 0) {
    console.log(`Linking ${variantsInput.length} variants to their respective color-wise Image 1...`);
    const bulkUpdateMutation = `
      mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants {
            id
            title
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    try {
      const varResult = await shopifyQuery(bulkUpdateMutation, { productId: shopifyProduct.id, variants: variantsInput });
      const varErrors = varResult.productVariantsBulkUpdate?.userErrors || [];
      if (varErrors.length > 0) {
        console.error(`Errors linking variants:`, varErrors);
      } else {
        console.log(`Successfully linked variants to images.`);
      }
    } catch (err) {
      console.error(`Failed linking variants:`, err.message);
    }
  } else {
    console.warn(`No variants matched the uploaded colors to link media.`);
  }

  // Sleep to avoid rate limits
  await new Promise(r => setTimeout(r, 1000));
}

async function main() {
  console.log(`Starting Image Update Script...`);
  if (dryRun) console.log(`[DRY RUN MODE ENABLED - No changes will be saved]`);
  if (testCode) console.log(`[TESTING SINGLE PRODUCT: ${testCode}]`);

  try {
    const productsList = parseImageUpdateCSV();
    
    let filteredList = productsList;
    if (testCode) {
      filteredList = productsList.filter(p => p.designCode.toLowerCase() === testCode.toLowerCase());
      if (filteredList.length === 0) {
        console.error(`Design code "${testCode}" not found in CSV!`);
        process.exit(1);
      }
    }

    for (const prodData of filteredList) {
      try {
        await updateProductImages(prodData);
      } catch (err) {
        console.error(`Failed to process design ${prodData.designCode}:`, err);
      }
    }

    console.log(`\nAll processing completed.`);
  } catch (err) {
    console.error(`Execution failed:`, err);
  }
}

main();
