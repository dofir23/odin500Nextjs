import fs from 'node:fs';
import path from 'node:path';

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx|ts|jsx|js|mjs)$/.test(entry.name)) {
      const c = fs.readFileSync(full, 'utf8');
      if (c.includes('@/views/')) {
        fs.writeFileSync(full, c.replaceAll('@/views/', '@/views/'));
      }
    }
  }
}

walk('src');
walk('scripts');
console.log('Updated imports to @/views/');
