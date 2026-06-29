import fs from 'node:fs';
import path from 'node:path';

const skipDirs = new Set(['ssr-stubs', 'ssr']);

function shouldMarkClient(filePath, content) {
  if (filePath.includes('navigation/routeNavigationAbort')) return false;
  if (filePath.includes('lib/env')) return false;
  if (filePath.includes('utils/apiOrigin')) return false;
  if (
    /pages|components|context|hooks|App\.jsx|navigation\/appRouterCompat/.test(filePath)
  ) {
    return true;
  }
  return /useState|useEffect|useRef|useCallback|useMemo|useContext/.test(content);
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(jsx|js)$/.test(entry.name)) continue;
    let content = fs.readFileSync(full, 'utf8');
    if (content.startsWith("'use client'") || content.startsWith('"use client"')) continue;
    if (!shouldMarkClient(full, content)) continue;
    fs.writeFileSync(full, `'use client';\n${content}`);
  }
}

walk('src');
console.log('Added use client directives');
