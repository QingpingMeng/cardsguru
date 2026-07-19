// Copies the canonical catalog (src/data/catalog.json) to public/catalog/catalog.json
// so the deployed app serves its own catalog at /catalog/catalog.json for the update module.
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'src/data/catalog.json');
const dest = resolve(root, 'public/catalog/catalog.json');

await mkdir(dirname(dest), { recursive: true });
await copyFile(src, dest);
console.log(`Synced catalog -> ${dest}`);
