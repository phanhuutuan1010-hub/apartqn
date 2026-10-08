/**
 * Preview the watermark (lib/watermark.ts) on the brightest, darkest and busiest local photos.
 *   node --import tsx scripts/watermark-samples.mts <outDir>
 */
import { readdirSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { renderPublic } from '../lib/watermark';

const out = process.argv[2] ?? 'wm-samples';
mkdirSync(out, { recursive: true });
const root = 'public/images/buildings';
const files = ['altara', 'flc', 'tms'].flatMap((d) => readdirSync(path.join(root, d)).filter((f) => f.endsWith('.webp')).map((f) => path.join(root, d, f)));
const stats = await Promise.all(files.map(async (f) => {
  // lower-middle band, where the logo sits
  const img = sharp(f);
  const { width = 1, height = 1 } = await img.metadata();
  const s = await img.extract({ left: Math.round(width * 0.3), top: Math.round(height * 0.6), width: Math.round(width * 0.4), height: Math.round(height * 0.2) }).greyscale().stats();
  return { f, mean: s.channels[0].mean, sd: s.channels[0].stdev };
}));
const pick = {
  bright: [...stats].sort((a, b) => b.mean - a.mean)[0],
  dark: [...stats].sort((a, b) => a.mean - b.mean)[0],
  busy: [...stats].sort((a, b) => b.sd - a.sd)[0],
};
for (const [k, s] of Object.entries(pick)) {
  const src = readFileSync(s.f);
  for (const size of ['full', 'thumb'] as const) {
    const r = await renderPublic(src, size, true);
    writeFileSync(path.join(out, `${k}-${size}.webp`), r.data);
    await sharp(r.data).png().toFile(path.join(out, `${k}-${size}.png`));
  }
  console.log(k, s.f, `mean=${s.mean.toFixed(0)} sd=${s.sd.toFixed(0)}`);
}
