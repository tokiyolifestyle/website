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

async function uploadSizeGuide() {
  console.log('Uploading hoodie size guide to Shopify product 15448870715636...');
  const fileBuffer = fs.readFileSync('assets/hoodie-size-guide.jpg');
  const payload = {
    image: {
      attachment: fileBuffer.toString('base64'),
      filename: 'tokiyo_hoodie_size_chart.jpg',
      alt: 'Size Guide'
    }
  };

  const res = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/products/15448870715636/images.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (data.image) {
    console.log('Successfully uploaded image ID:', data.image.id, 'src:', data.image.src);
  } else {
    console.error('Failed to upload image:', data);
  }
}

uploadSizeGuide();
