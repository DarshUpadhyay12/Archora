const esbuild = require('esbuild');
const path = require('path');
const rootDir = path.resolve(__dirname, '..');

console.log('[Archora Build] Compiling fast backend server bundle...');
const start = Date.now();
try {
  esbuild.buildSync({
    entryPoints: [path.join(rootDir, 'server/index.ts')],
    outfile: path.join(rootDir, 'server/dist/index.js'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
  });
  console.log(`[Archora Build] Backend compiled successfully in ${Date.now() - start}ms: server/dist/index.js`);
} catch (err) {
  console.error('[Archora Build] Failed to compile backend:', err);
  process.exit(1);
}

