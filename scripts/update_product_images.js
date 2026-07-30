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
  if (!activeLocation) {
    throw new Error("No active Shopify location found to track inventory!");
  }
  return activeLocation.id;
}

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
  const data = await shopifyQuery(query);
  return data.publications.edges.map(e => e.node);
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

function getWomensOversizedPrices(designCode, size) {
  const womensOversized = {
    TOTWO008: { sml: 649, xlxxl: 699, mrp: 1099 },
    TOTWO009: { sml: 699, xlxxl: 749, mrp: 1299 },
    TOTWO010: { sml: 649, xlxxl: 699, mrp: 1099 },
    TOTWO011: { sml: 649, xlxxl: 699, mrp: 1099 },
    TOTWO012: { sml: 649, xlxxl: 699, mrp: 1099 },
    TOTWO013: { sml: 649, xlxxl: 699, mrp: 1099 },
    TOTWO014: { sml: 599, xlxxl: 649, mrp: 599 },
    TOTWO015: { sml: 649, xlxxl: 699, mrp: 1099 }
  };
  const norm = designCode.toUpperCase().replace('TOVWO', 'TOTWO');
  const pricing = womensOversized[norm] || { sml: 649, xlxxl: 699, mrp: 1099 };
  const sizeUpper = size.toUpperCase().trim();
  const isSML = sizeUpper === 'XS' || sizeUpper === 'S' || sizeUpper === 'M' || sizeUpper === 'L';
  return {
    price: (isSML ? pricing.sml : pricing.xlxxl).toFixed(2),
    compareAtPrice: pricing.mrp.toFixed(2)
  };
}

// Function to create a product from scratch on Shopify
async function createNewProduct(productData, locationId, publications) {
  const { designCode, colors } = productData;
  console.log(`\n==================================================`);
  console.log(`Creating New Product for Design Code: ${designCode}`);

  const title = `Tokiyo Lifestyle Women Oversized T-Shirt - ${designCode}`;
  const handle = `tokiyo-lifestyle-women-oversized-t-shirt-${designCode.toLowerCase()}`;
  const firstColor = Object.keys(colors)[0] || 'Beige';
  const description = `<p>Step up your everyday fit with the Tokiyo Lifestyle Women Oversized T-Shirt. Made from premium 240 GSM cotton fabric, it's soft, breathable, and built for all-day comfort. The relaxed oversized silhouette gives you an easy, streetwear-ready look that pairs effortlessly with joggers, cargos, or denim. A wardrobe staple for anyone who wants comfort without compromising on style.</p>`;
  
  const productInput = {
    title: title,
    handle: handle,
    descriptionHtml: description,
    vendor: "TOKIYO LIFESTYLE",
    productType: "Oversized T-Shirt",
    status: "ACTIVE",
    tags: ["women", "oversized", "t-shirt", "Premium", "Cotton", "240 GSM", "Streetwear", "Casual Wear", "Tokiyo Lifestyle", "minimal"]
  };

  if (dryRun) {
    console.log(`[DRY RUN] Would create product "${title}" with handle "${handle}"`);
    console.log(`[DRY RUN] Colors:`, Object.keys(colors));
    console.log(`[DRY RUN] Variants (XS-XXL) would be bulk created.`);
    return;
  }

  // 1. Create product container
  const productCreateMutation = `
    mutation CreateProduct($input: ProductCreateInput!) {
      productCreate(product: $input) {
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
  
  let productId;
  try {
    const prodResult = await shopifyQuery(productCreateMutation, { input: productInput });
    const prodErrors = prodResult.productCreate.userErrors || [];
    if (prodErrors.length > 0) {
      console.error(`- Error creating product:`, prodErrors);
      return;
    }
    productId = prodResult.productCreate.product.id;
    console.log(`- Product container created successfully. ID: ${productId}`);
  } catch (err) {
    console.error(`- Failed to create base product:`, err.message);
    return;
  }

  // 2. Link options
  const optionsCreateMutation = `
    mutation CreateProductOptions($productId: ID!, $options: [OptionCreateInput!]!) {
      productOptionsCreate(productId: $productId, options: $options) {
        userErrors {
          field
          message
        }
      }
    }
  `;

  const uniqueColors = Object.keys(colors);
  const uniqueSizes = ["XS", "S", "M", "L", "XL", "XXL"];

  const optionsInput = [
    { name: "Color", values: uniqueColors.map(c => ({ name: c })) },
    { name: "Size", values: uniqueSizes.map(s => ({ name: s })) }
  ];

  try {
    const optResult = await shopifyQuery(optionsCreateMutation, { productId, options: optionsInput });
    const optErrors = optResult.productOptionsCreate?.userErrors || [];
    if (optErrors.length > 0) {
      console.error(`- Error creating options:`, optErrors);
    }
  } catch (err) {
    console.error(`- Failed to create options:`, err.message);
  }

  // 3. Upload media (4 color photos + size chart as 5th image for each color)
  const sizeChartUrl = 'https://drive.google.com/uc?id=1CEwBUsw3YWl_9832IzGeB5kXeOh-W-sL';
  const mediaInput = [];
  
  Object.keys(colors).forEach(colorName => {
    const colorInfo = colors[colorName];
    colorInfo.images.forEach((url, idx) => {
      mediaInput.push({
        originalSource: url,
        mediaContentType: "IMAGE",
        alt: `${title} - ${colorName} - Image ${idx + 1}`
      });
    });
    // Add Size Chart as Image 5 for this color way
    mediaInput.push({
      originalSource: sizeChartUrl,
      mediaContentType: "IMAGE",
      alt: `${title} - ${colorName} - Image 5`
    });
  });

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

  try {
    const mediaResult = await shopifyQuery(createMediaMutation, { productId, media: mediaInput });
    const mediaErrors = mediaResult.productCreateMedia?.userErrors || [];
    if (mediaErrors.length > 0) {
      console.error(`- Error creating media:`, mediaErrors);
    }
    console.log(`- Upload initiated for ${mediaInput.length} product images.`);
  } catch (err) {
    console.error(`- Failed uploading media:`, err.message);
  }

  // Wait 3 seconds for Shopify CDN
  await new Promise(r => setTimeout(r, 3000));

  // Query updated media to map IDs
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
  const checkResult = await shopifyQuery(checkProductQuery, { id: productId });
  const updatedMediaEdges = checkResult.product?.media?.edges || [];
  
  const colorToMediaIdMap = {};
  updatedMediaEdges.forEach(edge => {
    const node = edge.node;
    if (node.alt) {
      Object.keys(colors).forEach(colorName => {
        if (node.alt.toLowerCase().includes(`${colorName.toLowerCase()} - image 1`)) {
          colorToMediaIdMap[colorName.toLowerCase()] = node.id;
        }
      });
    }
  });

  // 4. Create variants and link media
  const variantsInput = [];
  Object.keys(colors).forEach(colorName => {
    const colorInfo = colors[colorName];
    const targetMediaId = colorToMediaIdMap[colorName.toLowerCase()];
    
    uniqueSizes.forEach(size => {
      const pricing = getWomensOversizedPrices(designCode, size);
      const sku = `${colorInfo.skuPrefix}_${size}`;
      
      const vInput = {
        price: pricing.price,
        compareAtPrice: pricing.compareAtPrice,
        optionValues: [
          { optionName: "Color", name: colorName },
          { optionName: "Size", name: size }
        ],
        inventoryItem: {
          sku: sku,
          tracked: true,
          cost: "250"
        },
        inventoryQuantities: [{
          locationId: locationId,
          availableQuantity: 10
        }]
      };
      
      if (targetMediaId) {
        vInput.mediaId = targetMediaId;
      }
      variantsInput.push(vInput);
    });
  });

  const variantsCreateMutation = `
    mutation CreateProductVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkCreate(productId: $productId, variants: $variants, strategy: REMOVE_STANDALONE_VARIANT) {
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const varResult = await shopifyQuery(variantsCreateMutation, { productId, variants: variantsInput });
    const varErrors = varResult.productVariantsBulkCreate?.userErrors || [];
    if (varErrors.length > 0) {
      console.error(`- Error creating variants:`, varErrors);
    } else {
      console.log(`- Created ${variantsInput.length} variants successfully.`);
    }
  } catch (err) {
    console.error(`- Failed bulk variants creation:`, err.message);
  }

  // 5. Publish to sales channels
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
  try {
    const pubResult = await shopifyQuery(publishMutation, { id: productId, input: pubInputs });
    const pubErrors = pubResult.publishablePublish?.userErrors || [];
    if (pubErrors.length > 0) {
      console.error(`- Failed publishing product:`, pubErrors);
    } else {
      console.log(`- Product successfully published to sales channels.`);
    }
  } catch (err) {
    console.error(`- Failed publishing:`, err.message);
  }

  await new Promise(r => setTimeout(r, 1000));
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
      console.log(`[DRY RUN] Color "${colorName}": Would upload ${colorInfo.images.length + 1} images (including Size Chart).`);
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

  // Resolve correct size chart URL
  let sizeChartUrl = null;
  const isWomen = shopifyProduct.title.toLowerCase().includes('women') || 
                  shopifyProduct.handle.toLowerCase().includes('women') || 
                  designCode.toLowerCase().includes('tovwo') || 
                  designCode.toLowerCase().includes('trtwo');
  
  if (isWomen) {
    sizeChartUrl = 'https://drive.google.com/uc?id=1CEwBUsw3YWl_9832IzGeB5kXeOh-W-sL';
  } else {
    sizeChartUrl = 'https://drive.google.com/uc?id=1JgmlUH0mQVT7xpwIOQxStP4YxKO0vlAB';
  }
  
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
    
    // Add Size Chart as Image 5 for this color way
    mediaInput.push({
      originalSource: sizeChartUrl,
      mediaContentType: "IMAGE",
      alt: `${shopifyProduct.title} - ${colorName} - Image 5`
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
    const locationId = await getPrimaryLocationId();
    const publications = await getPublications();
    
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
        const shopifyProduct = await findProductOnShopify(prodData.designCode);
        if (shopifyProduct) {
          await updateProductImages(prodData);
        } else {
          // If the product doesn't exist, CREATE it!
          await createNewProduct(prodData, locationId, publications);
        }
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
