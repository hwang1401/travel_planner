const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const LOGO_SRC = path.join(__dirname, "..", "public", "icons", "logo-original.png");
const OUT_DIR = path.join(__dirname, "..", "public", "icons");

async function generate() {
  // Read original logo metadata
  const meta = await sharp(LOGO_SRC).metadata();
  console.log(`Original: ${meta.width}x${meta.height}`);

  // Generate PWA icons (logo centered on rounded-rect primary color background)
  for (const size of [192, 512]) {
    const logoSize = Math.round(size * 0.5); // logo takes 50% of icon
    const radius = Math.round(size * 0.22);

    // Upscale logo with crisp nearest-neighbor for small source
    const logo = await sharp(LOGO_SRC)
      .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "nearest" })
      .png()
      .toBuffer();

    // Create background with rounded corners
    const bg = Buffer.from(
      `<svg width="${size}" height="${size}">
        <rect width="${size}" height="${size}" rx="${radius}" fill="#8b7bff"/>
      </svg>`
    );

    const output = path.join(OUT_DIR, `app-icon-${size}.png`);
    await sharp(bg)
      .composite([{ input: logo, gravity: "centre" }])
      .png()
      .toFile(output);

    console.log(`Created: app-icon-${size}.png`);
  }

  // Generate favicon (32x32) - logo on purple bg
  const faviconSize = 32;
  const faviconLogoSize = Math.round(faviconSize * 0.55);
  const faviconLogo = await sharp(LOGO_SRC)
    .resize(faviconLogoSize, faviconLogoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "nearest" })
    .png()
    .toBuffer();

  const faviconBg = Buffer.from(
    `<svg width="32" height="32"><rect width="32" height="32" rx="6" fill="#8b7bff"/></svg>`
  );

  await sharp(faviconBg)
    .composite([{ input: faviconLogo, gravity: "centre" }])
    .png()
    .toFile(path.join(__dirname, "..", "public", "favicon.png"));
  console.log("Created: favicon.png");

  // Generate apple-touch-icon (180x180)
  const appleSize = 180;
  const appleLogo = await sharp(LOGO_SRC)
    .resize(Math.round(appleSize * 0.5), Math.round(appleSize * 0.5), { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "nearest" })
    .png()
    .toBuffer();

  const appleBg = Buffer.from(
    `<svg width="${appleSize}" height="${appleSize}"><rect width="${appleSize}" height="${appleSize}" fill="#8b7bff"/></svg>`
  );

  await sharp(appleBg)
    .composite([{ input: appleLogo, gravity: "centre" }])
    .png()
    .toFile(path.join(OUT_DIR, "apple-touch-icon.png"));
  console.log("Created: apple-touch-icon.png");

  console.log("\nAll icons generated successfully!");
}

generate().catch(console.error);
