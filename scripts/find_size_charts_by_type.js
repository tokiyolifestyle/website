const fs = require('fs');
const path = require('path');

const downloadsDir = 'C:/Users/lenovo/Downloads';

function run() {
  const files = fs.readdirSync(downloadsDir).filter(f => f.toLowerCase().endsWith('.csv') && f.toLowerCase().includes('tokiyo'));
  
  files.forEach(file => {
    const filePath = path.join(downloadsDir, file);
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
      const type = cols[5]?.trim(); // Product Type
      const title = cols[0]?.trim();
      
      if (imageUrl && imageUrl.startsWith('http')) {
        const posInt = parseInt(imagePos, 10);
        if (posInt >= 5) {
          console.log(`File: ${file} | Product: ${title} | Type: ${type} | Pos: ${imagePos} | URL: ${imageUrl} | Alt: ${imageAlt}`);
        }
      }
    }
  });
}

run();
