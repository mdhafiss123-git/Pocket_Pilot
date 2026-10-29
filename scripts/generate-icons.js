const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const standardSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ppGrad" x1="32" y1="32" x2="480" y2="480" gradientUnits="userSpaceOnUse">
      <stop stop-color="#10b981" />
      <stop offset="0.5" stop-color="#06b6d4" />
      <stop offset="1" stop-color="#3b82f6" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#ppGrad)" />
  <g filter="url(#shadow)">
    <path d="M112 256L400 128L272 416L224 288L112 256Z" fill="white" stroke="white" stroke-width="16" stroke-linejoin="round" />
    <path d="M224 288L400 128" stroke="rgba(16, 185, 129, 0.45)" stroke-width="16" stroke-linecap="round" />
  </g>
</svg>
`;

const maskableSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ppGradMask" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop stop-color="#10b981" />
      <stop offset="0.5" stop-color="#06b6d4" />
      <stop offset="1" stop-color="#3b82f6" />
    </linearGradient>
    <filter id="shadowMask" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="512" height="512" fill="url(#ppGradMask)" />
  <g filter="url(#shadowMask)" transform="translate(76.8, 76.8) scale(0.7)">
    <path d="M112 256L400 128L272 416L224 288L112 256Z" fill="white" stroke="white" stroke-width="16" stroke-linejoin="round" />
    <path d="M224 288L400 128" stroke="rgba(16, 185, 129, 0.45)" stroke-width="16" stroke-linecap="round" />
  </g>
</svg>
`;

async function generate() {
  const publicDir = path.resolve(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Generate 192x192
  await sharp(Buffer.from(standardSvg))
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-192x192.png'));

  // Generate 512x512
  await sharp(Buffer.from(standardSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-512x512.png'));

  // Generate 180x180 for apple-touch-icon
  await sharp(Buffer.from(standardSvg))
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // Generate maskable versions
  await sharp(Buffer.from(maskableSvg))
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-192x192.png'));

  await sharp(Buffer.from(maskableSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-512x512.png'));

  // Save the SVG itself for browsers supporting SVG favicons
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), standardSvg.trim());

  console.log('Successfully generated all PWA icons in public directory!');
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
