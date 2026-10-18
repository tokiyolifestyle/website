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

const filesToUpload = [
  {
    localPath: 'assets/hero-durga-puja-desktop.jpg',
    filename: 'hero-durga-puja-desktop.jpg',
    mimeType: 'image/jpeg',
    alt: 'Durga Puja & Dussehra Special Drop Desktop'
  },
  {
    localPath: 'assets/hero-durga-puja-mobile.jpg',
    filename: 'hero-durga-puja-mobile.jpg',
    mimeType: 'image/jpeg',
    alt: 'Durga Puja & Dussehra Special Drop Mobile'
  },
  {
    localPath: 'assets/hero-last-drop-desktop.jpg',
    filename: 'hero-last-drop-desktop.jpg',
    mimeType: 'image/jpeg',
    alt: 'The Last Drop Clearance Desktop'
  },
  {
    localPath: 'assets/hero-last-drop-mobile.jpg',
    filename: 'hero-last-drop-mobile.jpg',
    mimeType: 'image/jpeg',
    alt: 'The Last Drop Clearance Mobile'
  }
];

async function shopifyGraphQL(query, variables = {}) {
  const res = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN
    },
    body: JSON.stringify({ query, variables })
  });
  return res.json();
}

async function uploadToShopify() {
  const stagedInputs = filesToUpload.map(f => ({
    filename: f.filename,
    mimeType: f.mimeType,
    resource: 'IMAGE',
    httpMethod: 'POST'
  }));

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

  console.log('1. Requesting Staged Uploads...');
  const stageRes = await shopifyGraphQL(stageMutation, { input: stagedInputs });
  const targets = stageRes.data?.stagedUploadsCreate?.stagedTargets;
  if (!targets) {
    console.error('Stage failed:', stageRes);
    return;
  }

  const fileCreateInputs = [];

  for (let i = 0; i < filesToUpload.length; i++) {
    const file = filesToUpload[i];
    const target = targets[i];
    const absPath = path.resolve(file.localPath);
    console.log(`2. Uploading ${file.filename} via curl...`);

    const curlArgs = ['-s', '-X', 'POST'];
    target.parameters.forEach(p => {
      curlArgs.push('-F', `${p.name}=${p.value}`);
    });
    curlArgs.push('-F', `file=@${absPath};type=${file.mimeType}`);
    curlArgs.push(target.url);

    execSync(`curl.exe ${curlArgs.map(a => `"${a}"`).join(' ')}`);

    fileCreateInputs.push({
      originalSource: target.resourceUrl,
      alt: file.alt
    });
  }

  console.log('3. Registering files with fileCreate mutation...');
  const fileCreateMutation = `
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
  `;

  const createRes = await shopifyGraphQL(fileCreateMutation, { files: fileCreateInputs });
  console.log('fileCreate Result:', JSON.stringify(createRes, null, 2));

  // Wait 3 seconds and query files by query
  console.log('4. Waiting 4 seconds for CDN processing...');
  await new Promise(r => setTimeout(r, 4000));

  const queryFiles = `
    query {
      files(first: 10, query: "hero-") {
        edges {
          node {
            ... on MediaImage {
              id
              alt
              image {
                url
              }
            }
          }
        }
      }
    }
  `;

  const queryRes = await shopifyGraphQL(queryFiles);
  console.log('Queried Files:', JSON.stringify(queryRes, null, 2));
}

uploadToShopify().catch(console.error);
