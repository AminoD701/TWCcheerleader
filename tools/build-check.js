import { access, readFile } from 'node:fs/promises';

const html = await readFile('index.html', 'utf8');
const required = ['./src/app/navigation.js', './src/app/navigation.css', './src/storage/legacy-storage.js', './src/services/data-loader.js', './sw.js', './manifest.json'];
for (const path of required) {
  await access(path);
  if (path.startsWith('./src/') && !html.includes(path)) throw new Error(`index.html does not reference ${path}`);
}
JSON.parse(await readFile('manifest.json', 'utf8'));
console.log(`Static build check passed (${required.length} required assets).`);
