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

async function checkAssets() {
  // Get main theme id
  const themesRes = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/themes.json`, {
    headers: { 'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN }
  });
  const themes = await themesRes.json();
  const mainTheme = themes.themes.find(t => t.role === 'main');
  console.log('Main Theme:', mainTheme.id, mainTheme.name);

  // List assets
  const assetsRes = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/themes/${mainTheme.id}/assets.json`, {
    headers: { 'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN }
  });
  const assets = await assetsRes.json();
  const heroAssets = assets.assets.filter(a => a.key.includes('hero'));
  console.log('Hero Assets on Theme:');
  console.log(heroAssets);
}

checkAssets().catch(console.error);
