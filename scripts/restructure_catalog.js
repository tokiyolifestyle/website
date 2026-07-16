const fs = require('fs');
const path = require('path');

let domain = process.env.SHOPIFY_STORE_DOMAIN;
let token = process.env.SHOPIFY_ACCESS_TOKEN;
const clientId = process.env.SHOPIFY_CLIENT_ID;
const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

const dryRun = process.argv.includes('--dry-run');

// Helper to retrieve token using Client Credentials Grant if needed
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

const csvFilePath = path.join(__dirname, '..', 'tokyo_consolidated_skus.csv');

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

// Fetch all products page by page and delete them (except COD Fee)
async function deleteAllCatalogProducts() {
  console.log("\n=== STEP 1: DELETING EXISTING CATALOG PRODUCTS ===");
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
    mutation DeleteProduct($input: ProductDeleteInput!) {
      productDelete(input: $input) {
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
      // Skip COD Fee product so it remains intact
      if (product.title.toLowerCase() === 'cod fee') {
        console.log(`Skipping special product: ${product.title}`);
        continue;
      }
      
      console.log(`Deleting product: ${product.title} (${product.id})`);
      const deleteResult = await shopifyQuery(deleteMutation, {
        input: { id: product.id }
      });
      
      const errors = deleteResult.productDelete.userErrors;
      if (errors.length > 0) {
        console.error(`Failed to delete product ${product.title}:`, errors);
      } else {
        count++;
      }
      // Small delay to prevent rate limit
      await new Promise(r => setTimeout(r, 200));
    }
  }
  console.log(`Deleted ${count} catalog products.`);
}

// List and delete existing collections
async function deleteExistingCollections() {
  console.log("\n=== STEP 2: CLEARING/DELETING EXISTING COLLECTIONS ===");
  const getCollectionsQuery = `
    query GetCollections {
      collections(first: 100) {
        edges {
          node {
            id
            title
            handle
          }
        }
      }
    }
  `;

  const deleteMutation = `
    mutation DeleteCollection($id: ID!) {
      collectionDelete(input: { id: $id }) {
        deletedCollectionId
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await shopifyQuery(getCollectionsQuery);
  const collections = data.collections.edges.map(e => e.node);
  
  // Collections user wants deleted/cleared: Home page, New Arrivals, Best Sellers, Accessories, Apparel
  const collectionsToDelete = ["home-page", "new-arrivals", "best-sellers", "accessories", "apparel", "frontpage"];

  for (const collection of collections) {
    if (collectionsToDelete.includes(collection.handle) || collection.title.toLowerCase() === 'home page') {
      console.log(`Deleting collection: ${collection.title} (${collection.id})`);
      const result = await shopifyQuery(deleteMutation, { id: collection.id });
      const errors = result.collectionDelete.userErrors;
      if (errors.length > 0) {
        console.warn(`Could not delete collection ${collection.title} directly:`, errors[0].message);
        console.log("Adding a note: Some system default collections cannot be deleted but can be cleared manually.");
      }
      await new Promise(r => setTimeout(r, 200));
    }
  }
}

// Create 4 automated collections
async function createAutomatedCollections() {
  console.log("\n=== STEP 3: CREATING 4 AUTOMATED COLLECTIONS ===");
  const createMutation = `
    mutation CreateCollection($input: CollectionInput!) {
      collectionCreate(input: $input) {
        collection {
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

  const styles = [
    { title: "Graphic Print", tag: "graphic-print" },
    { title: "Anime", tag: "anime" },
    { title: "Streetwear", tag: "streetwear" },
    { title: "Story Wear", tag: "story-wear" },
    { title: "Minimal", tag: "minimal" },
    { title: "Solid Basics", tag: "solid-basics" }
  ];

  const collectionSpecs = [
    {
      title: "Men Oversized",
      rules: [
        { column: "TAG", relation: "EQUALS", condition: "men" },
        { column: "TAG", relation: "EQUALS", condition: "oversized" }
      ]
    },
    {
      title: "Men Regular",
      rules: [
        { column: "TAG", relation: "EQUALS", condition: "men" },
        { column: "TAG", relation: "EQUALS", condition: "regular" }
      ]
    },
    {
      title: "Women Oversized",
      rules: [
        { column: "TAG", relation: "EQUALS", condition: "women" },
        { column: "TAG", relation: "EQUALS", condition: "oversized" }
      ]
    },
    {
      title: "Women Regular",
      rules: [
        { column: "TAG", relation: "EQUALS", condition: "women" },
        { column: "TAG", relation: "EQUALS", condition: "regular" }
      ]
    }
  ];

  const genders = [
    { prefix: "Men", tag: "men" },
    { prefix: "Women", tag: "women" }
  ];
  const fits = [
    { prefix: "Oversized", tag: "oversized" },
    { prefix: "Regular", tag: "regular" }
  ];

  for (const gender of genders) {
    for (const fit of fits) {
      for (const style of styles) {
        collectionSpecs.push({
          title: `${gender.prefix} ${fit.prefix} ${style.title}`,
          rules: [
            { column: "TAG", relation: "EQUALS", condition: gender.tag },
            { column: "TAG", relation: "EQUALS", condition: fit.tag },
            { column: "TAG", relation: "EQUALS", condition: style.tag }
          ]
        });
      }
    }
  }

  for (const spec of collectionSpecs) {
    console.log(`Creating automated collection: "${spec.title}"`);
    const variables = {
      input: {
        title: spec.title,
        ruleSet: {
          appliedDisjunctively: false, // AND logic
          rules: spec.rules
        }
      }
    };

    const result = await shopifyQuery(createMutation, variables);
    const errors = result.collectionCreate.userErrors;
    if (errors.length > 0) {
      console.error(`Failed to create collection "${spec.title}":`, errors);
    } else {
      console.log(`Collection created: ${result.collectionCreate.collection.title} (${result.collectionCreate.collection.id})`);
    }
    await new Promise(r => setTimeout(r, 200));
  }
}

// Parse CSV files and group by product key
function parseProductsCSV() {
  console.log("\n=== STEP 4: PARSING CSV CATALOG ===");
  const productsMap = {};

  const csvFiles = [
    { path: 'C:\\Users\\lenovo\\Downloads\\Tokyo - Consolidated SKUs.csv', defaultType: 'Oversized T-Shirt' },
    { path: 'C:\\Users\\lenovo\\Downloads\\Tokiyo Lifestyle - Regular category.csv', defaultType: 'Regular T-Shirt' },
    { path: 'C:\\Users\\lenovo\\Downloads\\Tokiyo Lifestyle - Women Oversized.csv', defaultType: 'Oversized T-Shirt' }
  ];

  for (const fileInfo of csvFiles) {
    if (!fs.existsSync(fileInfo.path)) {
      console.warn(`Warning: CSV file not found at ${fileInfo.path}. Skipping.`);
      continue;
    }
    console.log(`Parsing file: ${fileInfo.path}`);
    const csvContent = fs.readFileSync(fileInfo.path, 'utf-8');
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
        const size = skuParts.pop(); // last part is XS, S, M, L, XL, XXL
        const colorCode = skuParts.pop(); // second to last is BL, AI, etc.
        const designCode = skuParts.join('_'); // remaining is prefix e.g. "TOTM001"

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
            type: row[5] || fileInfo.defaultType,
            tags: row[6] ? row[6].split(',').map(t => t.trim()) : [],
            variants: [],
            images: []
          };
        }
        currentProduct = productsMap[designCode];

        const isDuplicate = currentProduct.variants.some(v => v.color === colorName && v.size === (optionValue || size));
        if (!isDuplicate) {
          currentProduct.variants.push({
            sku: sku,
            size: optionValue || size,
            color: colorName,
            price: row[20],
            compareAtPrice: row[21],
            cost: row[22],
            weight: row[32] ? parseFloat(row[32]) : 250,
            weightUnit: row[33] || 'g',
            inventory: row[30] ? parseInt(row[30], 10) : 10,
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
  }

  const products = Object.values(productsMap);
  console.log(`Parsed ${products.length} unique consolidated products.`);
  return products;
}

// Bulk Upload products
async function uploadProducts(products, locationId) {
  console.log("\n=== STEP 5: UPLOADING PRODUCTS TO SHOPIFY ===");

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

  for (let idx = 0; idx < products.length; idx++) {
    const prod = products[idx];
    console.log(`\n[${idx + 1}/${products.length}] Uploading product: ${prod.title} (SKU Prefix: ${prod.key})`);
    
    // 1. Create the Product base
    // Force status to ACTIVE
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
    // Collect unique colors and sizes
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

    // 3. Create variants in bulk
    const variantsInput = prod.variants.map(v => {
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
      
      // Associate variant image directly if present in CSV
      if (v.variantImageUrl) {
        vInput.mediaSrc = [v.variantImageUrl];
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

    // 4. Create product media gallery
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
          console.log(`- Initiated upload for ${prod.images.length} product images.`);
        }
      } catch (err) {
        console.error(`- Failed to add media gallery:`, err.message);
      }
    }

    // Delay to prevent throttling
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log("\nCatalog upload complete!");
}

// Main runner function
async function run() {
  console.log("Starting Shopify Catalog Restructure script...");
  const dryRun = process.argv.includes('--dry-run');

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

    // Step 1: Delete old catalog products (except COD Fee)
    await deleteAllCatalogProducts();

    // Step 2: Delete old collections
    await deleteExistingCollections();

    // Step 3: Create smart collections
    await createAutomatedCollections();

    // Step 4 & 5: Upload new products
    await uploadProducts(parsedProducts, locationId);

  } catch (error) {
    console.error("Script execution failed:", error);
    process.exit(1);
  }
}

run();
