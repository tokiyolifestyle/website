const fs = require('fs');
const path = require('path');

const downloadsDir = 'C:/Users/lenovo/Downloads';

function run() {
  const files = fs.readdirSync(downloadsDir);
  const csvFiles = files.filter(f => f.toLowerCase().endsWith('.csv') && f.toLowerCase().includes('tokiyo'));
  
  console.log("Searching CSV files in Downloads:");
  csvFiles.forEach(file => {
    const filePath = path.join(downloadsDir, file);
    console.log(`- Reading ${file}...`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes('size') && line.toLowerCase().includes('chart')) {
        console.log(`  Line ${idx + 1}: ${line.substring(0, 150)}...`);
      }
      if (line.includes('drive.google.com') && line.toLowerCase().includes('size')) {
        console.log(`  Line ${idx + 1} (Drive URL & size): ${line.substring(0, 150)}...`);
      }
    });
  });
}

run();
