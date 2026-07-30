const fs = require('fs');
const path = require('path');

const downloadsDir = 'C:/Users/lenovo/Downloads';

function run() {
  const files = fs.readdirSync(downloadsDir).filter(f => f.toLowerCase().endsWith('.csv') && f.toLowerCase().includes('tokiyo'));
  const charts = {};

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
      const type = cols[5]?.trim() || ''; 
      const title = cols[0]?.trim() || '';
      
      if (imageUrl && imageUrl.startsWith('http')) {
        const posInt = parseInt(imagePos, 10);
        if (posInt >= 5) {
          // Identify product group type from file name or title
          let category = 'Unknown';
          if (file.toLowerCase().includes('women oversized') || title.toLowerCase().includes('women oversized')) {
            category = 'Women Oversized';
          } else if (file.toLowerCase().includes('woman\'s regular') || title.toLowerCase().includes('women regular') || title.toLowerCase().includes('woman regular')) {
            category = 'Women Regular';
          } else if (file.toLowerCase().includes('man\'s regular') || title.toLowerCase().includes('men regular') || title.toLowerCase().includes('man regular')) {
            category = 'Men Regular';
          } else if (file.toLowerCase().includes('final skus') || title.toLowerCase().includes('men oversized') || title.toLowerCase().includes('oversized t-shirt')) {
            category = 'Men Oversized'; // 'Final SKUs' is Men Oversized
          }
          
          const key = `${category} | ${imageUrl}`;
          if (!charts[key]) {
            charts[key] = {
              category: category,
              url: imageUrl,
              file: file,
              sampleProduct: title
            };
          }
        }
      }
    }
  });
  
  console.log("\nDistinct Size Charts Found by Category:");
  Object.values(charts).forEach(c => {
    console.log(`Category: ${c.category}`);
    console.log(`  URL: ${c.url}`);
    console.log(`  Source File: ${c.file}`);
    console.log(`  Sample Product: ${c.sampleProduct}`);
  });
}

run();
