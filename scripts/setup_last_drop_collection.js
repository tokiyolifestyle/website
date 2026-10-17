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

const publicationId = "gid://shopify/Publication/205598064884";

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

async function createLastDropCollection() {
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
    title: "The Last Drop",
    handle: "the-last-drop",
    descriptionHtml: "<p><strong>The Last Drop — Clearance Sale:</strong> Buy 2 — Get 20% OFF | Buy 4 — Get 30% OFF! Final archive quantities of iconic Tokiyo oversized streetwear fits.</p>",
    ruleSet: {
      appliedDisjunctively: true,
      rules: [
        {
          column: "TAG",
          relation: "EQUALS",
          condition: "the-last-drop"
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

async function publishCollection(collectionId) {
  const mutation = `
    mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) {
        publishable {
          availablePublicationsCount {
            count
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const res = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN },
    body: JSON.stringify({
      query: mutation,
      variables: {
        id: collectionId,
        input: [{ publicationId }]
      }
    })
  });
  return res.json();
}

async function main() {
  console.log('Tagging 8 men targets with the-last-drop...');
  for (const id of menTargets) {
    await addTags(id, ['the-last-drop', 'clearance-sale']);
    console.log(`Tagged ${id}`);
  }

  console.log('Creating Smart Collection The Last Drop...');
  const collRes = await createLastDropCollection();
  console.log('Collection Result:', JSON.stringify(collRes, null, 2));

  const collId = collRes.data?.collectionCreate?.collection?.id;
  if (collId) {
    console.log('Publishing to Online Store...');
    const pubRes = await publishCollection(collId);
    console.log('Publication Result:', JSON.stringify(pubRes, null, 2));
  }
}

main().catch(console.error);
