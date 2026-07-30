const fs = require('fs');
const path = require('path');

const downloadsDir = 'C:/Users/lenovo/Downloads';

function run() {
  const files = fs.readdirSync(downloadsDir).filter(f => f.toLowerCase().endsWith('.csv') && f.toLowerCase().includes('tokiyo'));
  const uniqueImages = {};
  
  files.forEach(file => {
    const filePath = path.join(downloadsDir, file);
    console.log(`Scanning file: ${file}`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const cols = line.split(',');
      if (cols.length < 40) continue;
      
      const imageUrl = cols[36]?.trim();
      const imagePos = cols[37]?.trim();
      const imageAlt = cols[38]?.trim();
      
      if (imageUrl && imageUrl.startsWith('http')) {
        const posInt = parseInt(imagePos, 10);
        if (posInt >= 5 || imageAlt.toLowerCase().includes('chart') || imageUrl.toLowerCase().includes('chart')) {
          if (!uniqueImages[imageUrl]) {
            uniqueImages[imageUrl] = {
              file: file,
              pos: imagePos,
              alt: imageAlt
            };
          }
        }
      }
    }
  });
  
  console.log("\nFound size charts or high-position images:");
  Object.keys(uniqueImages).forEach(url => {
    const info = uniqueImages[url];
    console.log(`URL: ${url} | Pos: ${info.pos} | Alt: ${info.alt} | File: ${info.file}`);
  });
}

run();
