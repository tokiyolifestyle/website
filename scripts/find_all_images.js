const fs = require('fs');
const path = require('path');

const downloadsDir = 'C:/Users/lenovo/Downloads';

function run() {
  const file = 'Tokiyo Lifestyle - Consolidated SKUs.csv';
  const filePath = path.join(downloadsDir, file);
  
  if (!fs.existsSync(filePath)) {
    console.error("Consolidated SKUs CSV not found");
    return;
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const uniqueImages = {};
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Parse fields simply
    const cols = line.split(',');
    if (cols.length < 40) continue;
    
    const imageUrl = cols[36]?.trim();
    const imagePos = cols[37]?.trim();
    const imageAlt = cols[38]?.trim();
    
    if (imageUrl && imageUrl.startsWith('http')) {
      if (!uniqueImages[imageUrl]) {
        uniqueImages[imageUrl] = {
          pos: imagePos,
          alt: imageAlt
        };
      }
    }
  }
  
  console.log("Analyzing unique images from Consolidated CSV:");
  Object.keys(uniqueImages).forEach(url => {
    const info = uniqueImages[url];
    if (info.alt && info.alt.toLowerCase().includes('size')) {
      console.log(`URL: ${url} | Pos: ${info.pos} | Alt: ${info.alt}`);
    }
  });
}

run();
