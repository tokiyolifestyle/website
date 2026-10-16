const fs = require('fs');
const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const womenTargets = [
  'gid://shopify/Product/9554551865588', // TOVWO003
  'gid://shopify/Product/9554551931124', // TOVWO005
  'gid://shopify/Product/9554551963892', // TOVWO006
  'gid://shopify/Product/9583520284916', // TOVWO009
  'gid://shopify/Product/9583523332340', // TOVWO011
  'gid://shopify/Product/9583523889396', // TOVWO012
  'gid://shopify/Product/9554552291572', // TOVWO020
  'gid://shopify/Product/9591350657268', // TOVWO025
  'gid://shopify/Product/9625604194548'  // TOVWO026
];

const menTargets = [
  'gid://shopify/Product/9554550882548', // TOTM002
  'gid://shopify/Product/9554551111924', // TOTM006
  'gid://shopify/Product/9554551177460', // TOTM008
  'gid://shopify/Product/9554551275764', // TOTM010
  'gid://shopify/Product/9591351443700', // TOTM021
  'gid://shopify/Product/9591352688884', // TOTM038
  'gid://shopify/Product/9591352721652', // TOTM039
  'gid://shopify/Product/9591352918260'  // TOTM041
];

async function addTags(productId, tagsToAdd) {
  const getQuery = `
    query {
      product(id: "${productId}") {
        id
        tags
      }
    }
  `;
  const getRes = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN },
    body: JSON.stringify({ query: getQuery })
  });
  const getData = await getRes.json();
  const currentTags = getData.data?.product?.tags || [];
  const updatedTags = Array.from(new Set([...currentTags, ...tagsToAdd]));

  const updateMutation = `
    mutation productUpdate($input: ProductInput!) {
      productUpdate(input: $input) {
        product {
          id
          tags
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  const updateRes = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN },
    body: JSON.stringify({
      query: updateMutation,
      variables: {
        input: {
          id: productId,
          tags: updatedTags
        }
      }
    })
  });
  return updateRes.json();
}

async function createFestiveCollection() {
  const mutation = `
    mutation collectionCreate($input: CollectionInput!) {
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

  const input = {
    title: "Durga Puja & Dussehra Special Drop",
    handle: "festive-special-drop",
    descriptionHtml: "<p><strong>Special Multi-Buy Offer:</strong> Buy Any 2 — Save ₹200 | Buy Any 3 — Save ₹350 | Buy Any 4+ — Save ₹500! Mix and match your favourite designs.</p>",
    ruleSet: {
      appliedDisjunctively: true,
      rules: [
        {
          column: "TAG",
          relation: "EQUALS",
          condition: "festive-special-drop"
        }
      ]
    }
  };

  const res = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN },
    body: JSON.stringify({ query: mutation, variables: { input } })
  });
  return res.json();
}

async function main() {
  console.log('Tagging women targets with festive-special-drop...');
  for (const id of womenTargets) {
    await addTags(id, ['festive-special-drop', 'dussehra-offer']);
    console.log(`Tagged ${id}`);
  }

  console.log('Creating Smart Collection...');
  const collRes = await createFestiveCollection();
  console.log('Collection Result:', JSON.stringify(collRes, null, 2));
}

main().catch(console.error);
