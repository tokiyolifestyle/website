const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

async function setup() {
  console.log('1. Checking or creating Hoodies collection...');
  const createColMutation = `
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

  const pubMutation = `
    mutation PublishResource($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) {
        userErrors {
          field
          message
        }
      }
    }
  `;

  const colRes = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN
    },
    body: JSON.stringify({
      query: createColMutation,
      variables: {
        input: {
          title: 'Hoodies',
          handle: 'hoodies',
          descriptionHtml: '<p>Explore Tokiyo Lifestyle\'s signature heavyweight oversized hoodies. 380+ GSM ultra-soft combed cotton fleece with 3D embossed puff typography and premium streetwear fit.</p>',
          ruleSet: {
            appliedDisjunctively: true,
            rules: [
              { column: 'TYPE', relation: 'EQUALS', condition: 'Hoodie' },
              { column: 'TAG', relation: 'EQUALS', condition: 'Hoodie' }
            ]
          }
        }
      }
    })
  });

  const colData = await colRes.json();
  console.log('Collection create response:', JSON.stringify(colData, null, 2));

  let collectionId = colData.data?.collectionCreate?.collection?.id;
  if (!collectionId) {
    // Might already exist, query it
    const checkQuery = `query { collectionByHandle(handle: "hoodies") { id title } }`;
    const checkRes = await (await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN
      },
      body: JSON.stringify({ query: checkQuery })
    })).json();
    collectionId = checkRes.data?.collectionByHandle?.id;
  }

  if (collectionId) {
    console.log(`2. Publishing collection ${collectionId} to Online Store...`);
    const pubRes = await (await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN
      },
      body: JSON.stringify({
        query: pubMutation,
        variables: {
          id: collectionId,
          input: [{ publicationId: 'gid://shopify/Publication/205598064884' }]
        }
      })
    })).json();
    console.log('Publish collection response:', JSON.stringify(pubRes, null, 2));
  }

  console.log('3. Staging and uploading hero banner images to Shopify Files CDN...');
  const filesToUpload = [
    {
      localPath: 'assets/hero-hoodie-desktop.jpg',
      filename: 'hero-hoodie-desktop.jpg',
      mimeType: 'image/jpeg',
      alt: 'Tokiyo Lifestyle Signature Oversized Hoodie Desktop Hero'
    },
    {
      localPath: 'assets/hero-hoodie-mobile.jpg',
      filename: 'hero-hoodie-mobile.jpg',
      mimeType: 'image/jpeg',
      alt: 'Tokiyo Lifestyle Signature Oversized Hoodie Mobile Hero'
    }
  ];

  const stageMutation = `
    mutation generateStagedUploads($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const stageRes = await (await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN
    },
    body: JSON.stringify({
      query: stageMutation,
      variables: {
        input: filesToUpload.map(f => ({
          filename: f.filename,
          mimeType: f.mimeType,
          resource: 'IMAGE',
          httpMethod: 'POST'
        }))
      }
    })
  })).json();

  const targets = stageRes.data?.stagedUploadsCreate?.stagedTargets;
  const cdnUrls = {};

  if (targets) {
    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      const target = targets[i];
      const absPath = path.resolve(file.localPath);
      console.log(`- Uploading ${file.filename} via curl...`);

      const curlArgs = ['-s', '-X', 'POST'];
      target.parameters.forEach(p => {
        curlArgs.push('-F', `${p.name}=${p.value}`);
      });
      curlArgs.push('-F', `file=@${absPath};type=${file.mimeType}`);
      curlArgs.push(target.url);

      execSync(`curl.exe ${curlArgs.map(a => `"${a}"`).join(' ')}`);

      const fileCreateRes = await (await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN
        },
        body: JSON.stringify({
          query: `
            mutation fileCreate($files: [FileCreateInput!]!) {
              fileCreate(files: $files) {
                files {
                  id
                  alt
                  ... on MediaImage {
                    image {
                      url
                    }
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          variables: {
            files: [{ originalSource: target.resourceUrl, alt: file.alt }]
          }
        })
      })).json();

      const createdFile = fileCreateRes.data?.fileCreate?.files?.[0];
      cdnUrls[file.filename] = createdFile?.image?.url || target.resourceUrl;
      console.log(`Uploaded ${file.filename}: ${cdnUrls[file.filename]}`);
    }
  }

  console.log('\n=== SETUP COMPLETE ===');
  console.log('CDN URLs:', cdnUrls);
}

setup().catch(console.error);
