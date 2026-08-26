/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

import sharp from 'sharp';

const sourceUrl = new URL('../src/assets/social-card.svg', import.meta.url);
const previewUrl = new URL(
  '../../../docs/assets/dsh-console-preview.jpg',
  import.meta.url,
);
const outputUrl = new URL('../public/social-card.png', import.meta.url);
const manifestUrl = new URL(
  '../src/assets/social-card.generated.json',
  import.meta.url,
);
const renderSpec =
  'dsh-console-social-card-v3:1200x630:preview-composite:png-compression-9';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const [source, preview] = await Promise.all([
  readFile(sourceUrl),
  readFile(previewUrl),
]);
const sourceSha256 = sha256(source);
const previewSha256 = sha256(preview);

if (process.argv.includes('--check')) {
  const [output, manifestSource] = await Promise.all([
    readFile(outputUrl),
    readFile(manifestUrl, 'utf8'),
  ]);
  const manifest = JSON.parse(manifestSource);
  const metadata = await sharp(output).metadata();
  if (
    manifest.renderSpec !== renderSpec ||
    manifest.sourceSha256 !== sourceSha256 ||
    manifest.previewSha256 !== previewSha256 ||
    manifest.outputSha256 !== sha256(output) ||
    metadata.format !== 'png' ||
    metadata.width !== 1200 ||
    metadata.height !== 630
  ) {
    throw new Error(
      'social-card.png is stale; run `pnpm run docs:social-card`',
    );
  }
  console.log('social_card_check_ok=true');
  process.exit(0);
}

const [background, previewLayer] = await Promise.all([
  sharp(source, { density: 144 }).resize(1200, 630).png().toBuffer(),
  sharp(preview)
    .resize(464, 322, { fit: 'cover', position: 'center' })
    .png()
    .toBuffer(),
]);
const output = await sharp(background)
  .composite([{ input: previewLayer, left: 654, top: 124 }])
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer();
const manifest = {
  renderSpec,
  sourceSha256,
  previewSha256,
  outputSha256: sha256(output),
};
await Promise.all([
  writeFile(outputUrl, output),
  writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`),
]);
console.log('social_card_generated=true');
