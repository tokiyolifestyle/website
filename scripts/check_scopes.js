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

fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/oauth/access_scopes.json`, {
  headers: { 'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN }
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
