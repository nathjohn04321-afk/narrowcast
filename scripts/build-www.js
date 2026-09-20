#!/usr/bin/env node
/*
 * Copies the web app into www/, which is what Capacitor bundles into the APK.
 *
 * The app itself stays at the repository root so the hosting routes in README.md
 * (Netlify Drop, GitHub Pages) keep working from a plain checkout. www/ is only
 * ever a copy; never edit it by hand.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'www');

const FILES = ['index.html', 'manifest.webmanifest', 'sw.js'];
const GLOB_PREFIX = 'icon-';

fs.mkdirSync(outDir, { recursive: true });

const icons = fs
  .readdirSync(root)
  .filter((f) => f.startsWith(GLOB_PREFIX) && f.endsWith('.png'));

const copied = [];
for (const name of [...FILES, ...icons]) {
  const from = path.join(root, name);
  if (!fs.existsSync(from)) {
    console.error(`missing: ${name}`);
    process.exit(1);
  }
  fs.copyFileSync(from, path.join(outDir, name));
  copied.push(name);
}

console.log(`www/: ${copied.length} files (${copied.join(', ')})`);
