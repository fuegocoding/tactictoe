const fs = require('fs');
const path = require('path');

const dir = 'apps/web/src/components/board/';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx')).map(f => path.join(dir, f));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Replace gridTemplateColumns: 'repeat(3, 1fr)' with minmax
  content = content.replace(/gridTemplateColumns:\s*(['"`])repeat\((.*?),\s*1fr\)\1/g, 'gridTemplateColumns: $1repeat($2, minmax(0, 1fr))$1');
  
  // Replace gridTemplateRows: 'repeat(3, 1fr)' with minmax
  content = content.replace(/gridTemplateRows:\s*(['"`])repeat\((.*?),\s*1fr\)\1/g, 'gridTemplateRows: $1repeat($2, minmax(0, 1fr))$1');

  // Replace aspectRatio: '1', with minWidth: 0, minHeight: 0, padding: 0,
  content = content.replace(/aspectRatio:\s*'1',/g, "aspectRatio: '1',\n                  minWidth: 0,\n                  minHeight: 0,\n                  padding: 0,");

  fs.writeFileSync(file, content, 'utf8');
});

console.log('Done!');
