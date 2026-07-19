const fs = require('fs');

function parseCSVRow(text) {
  const result = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(field.trim());
      field = "";
    } else {
      field += char;
    }
  }
  result.push(field.trim());
  return result;
}

const csvPath = 'C:/Users/lenovo/Downloads/Tokiyo Lifestyle - Consolidated SKUs.csv';
const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.split(/\r?\n/);

const sizePrices = new Set();
for (let i = 1; i < lines.length; i++) {
  const row = parseCSVRow(lines[i]);
  const sku = row[9];
  if (sku && sku.startsWith('TRTWO')) {
    sizePrices.add(`Size=${row[12]} Price=${row[20]} Compare=${row[21]} Cost=${row[22]}`);
  }
}
console.log(Array.from(sizePrices));
