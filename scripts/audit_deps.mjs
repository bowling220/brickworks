import fs from 'fs';
import path from 'path';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const deps = Object.keys(pkg.dependencies || {});


function searchDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    if (file === 'node_modules' || file === '.next' || file === 'dist' || file === '.git' || file === '.agents' || file === '.vinext' || file === '.wrangler') continue;
    if (fs.statSync(full).isDirectory()) {
      searchDir(full, fileList);
    } else if (/\.(ts|tsx|js|mjs|css)$/.test(file)) {
      fileList.push(full);
    }
  }
  return fileList;
}

const allFiles = searchDir('.');
const usedDeps = new Set();
const unusedDeps = [];

for (const dep of deps) {
  let found = false;
  for (const file of allFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes(`from "${dep}"`) ||
        content.includes(`from '${dep}'`) ||
        content.includes(`from "${dep}/`) ||
        content.includes(`from '${dep}/`) ||
        content.includes(`import("${dep}")`) ||
        content.includes(`import('${dep}')`) ||
        content.includes(`require("${dep}")`) ||
        content.includes(`require('${dep}')`) ||
        content.includes(`@import "${dep}`) ||
        content.includes(`@import '${dep}`)) {
      found = true;
      usedDeps.add(dep);
      break;
    }
  }
  if (!found) {
    unusedDeps.push(dep);
  }
}

console.log('Total Dependencies:', deps.length);
console.log('Used Dependencies (' + usedDeps.size + '):', Array.from(usedDeps).sort());
console.log('Unused Dependencies (' + unusedDeps.length + '):', unusedDeps.sort());
