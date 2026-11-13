// Downloads real NASA images into <outpost>/assets/images under the exact filenames the frontend uses,
// and writes their credits/original URLs into <outpost>/data/image_metadata.json.
//   npm run fetch-images           (needs internet; no API key required)
// Optional: `npm i sharp` lets it resize/crop to the target size in the filename. Without sharp the
// original NASA file is saved as-is (may not match the dimensions in the filename).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { normalizeImages } from '../server/normalize.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPOST = path.resolve(process.env.OUTPOST_DIR || path.join(ROOT, '..'));

// Only photographic backgrounds come from NASA. nebula_layer_01.png and starfield_tile.png are
// transparent overlays, so they stay as generated assets.
export const SLOTS = [
  { filename: 'hero_nebula_3840x2160.jpg', query: 'nebula', w: 3840, h: 2160 },
  { filename: 'surface_mars_1920x1080.jpg', query: 'mars surface panorama', w: 1920, h: 1080 },
  { filename: 'surface_moon_1920x1080.jpg', query: 'moon surface', w: 1920, h: 1080 },
];

const getJson = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
};

async function bestAssetUrl(id) {
  const assets = await getJson(`https://images-api.nasa.gov/asset/${encodeURIComponent(id)}`);
  const hrefs = (assets.collection?.items ?? []).map((i) => i.href).filter((h) => /\.jpe?g$/i.test(h));
  for (const tag of ['~orig', '~large', '~medium']) {
    const hit = hrefs.find((h) => h.includes(tag));
    if (hit) return hit.replace('http://', 'https://');
  }
  return null;
}

export async function run({ outDir = path.join(OUTPOST, 'assets', 'images'), metaPath = path.join(OUTPOST, 'data', 'image_metadata.json') } = {}) {
  let sharp = null;
  try { sharp = (await import('sharp')).default; } catch { console.warn('sharp not installed: images will be saved at original size (npm i sharp to auto-resize).'); }
  await fs.mkdir(outDir, { recursive: true });
  let meta = [];
  try { meta = JSON.parse(await fs.readFile(metaPath, 'utf8')); } catch { /* first run */ }

  for (const slot of SLOTS) {
    const search = await getJson(`https://images-api.nasa.gov/search?q=${encodeURIComponent(slot.query)}&media_type=image&page_size=30`);
    let done = false;
    for (const c of normalizeImages(search, 10)) { // already filtered for display safety
      try {
        const url = await bestAssetUrl(c.id);
        if (!url) continue;
        const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
        if (!res.ok) continue;
        let buf = Buffer.from(await res.arrayBuffer());
        if (sharp) {
          const m = await sharp(buf).metadata();
          if ((m.width ?? 0) < slot.w * 0.5) continue; // too small to look good
          buf = await sharp(buf).resize(slot.w, slot.h, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
        }
        await fs.writeFile(path.join(outDir, slot.filename), buf);
        const entry = {
          filename: `assets/images/${slot.filename}`,
          source: 'NASA',
          credit: c.credit, // e.g. "NASA/JPL"
          license: 'public domain (NASA media usage guidelines; check the item page for exceptions)',
          original_url: `https://images.nasa.gov/details/${c.id}`,
          title: c.title,
          status: 'nasa',
        };
        meta = [...meta.filter((m) => m.filename !== entry.filename), entry];
        console.log(`OK  ${slot.filename} <- ${c.id} "${c.title}"`);
        done = true;
        break;
      } catch (e) {
        console.warn(`skip ${c.id}: ${e.message}`);
      }
    }
    if (!done) console.warn(`FAILED ${slot.filename}: no usable result for "${slot.query}" (placeholder kept)`);
  }
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n');
  return meta;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((e) => { console.error(e.message); process.exit(1); });
}
