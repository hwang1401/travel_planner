const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const LOGO_SRC = path.join(__dirname, "..", "public", "icons", "logo-original.png");
const SPLASH_LOGO_SRC = path.join(__dirname, "..", "public", "icons", "logo-splash.png");
const OUT_DIR = path.join(__dirname, "..", "public", "icons");
const PUBLIC_DIR = path.join(__dirname, "..", "public");

// 흰색 계열 배경 & 테마 컬러
const BG_COLOR = "#ffffff";
const THEME_COLOR = "#8b7bff";

// iOS splash screen sizes (portrait) — covers most modern iPhones & iPads
const SPLASH_SCREENS = [
  // iPhone 15 Pro Max, 14 Pro Max
  { w: 1290, h: 2796, media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" },
  // iPhone 15 Pro, 15, 14 Pro
  { w: 1179, h: 2556, media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" },
  // iPhone 14, 13, 13 Pro, 12, 12 Pro
  { w: 1170, h: 2532, media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" },
  // iPhone 13 mini, 12 mini, X, XS, 11 Pro
  { w: 1125, h: 2436, media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" },
  // iPhone 11, XR
  { w: 828, h: 1792, media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" },
  // iPhone 11 Pro Max, XS Max
  { w: 1242, h: 2688, media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)" },
  // iPhone 8 Plus, 7 Plus, 6s Plus
  { w: 1242, h: 2208, media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)" },
  // iPhone 8, 7, 6s, SE 2nd/3rd
  { w: 750, h: 1334, media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" },
  // iPhone SE 1st
  { w: 640, h: 1136, media: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)" },
];

async function generateLogo(size, kernel = "lanczos3") {
  return sharp(LOGO_SRC)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel,
    })
    .png()
    .toBuffer();
}

/** 로고 이미지를 흰색(RGB=255)으로 바꾸고 알파는 유지 (primary 배경용) */
async function logoToWhite(pngBuffer) {
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
  }
  return sharp(Buffer.from(data), { raw: info }).png().toBuffer();
}

async function generate() {
  const meta = await sharp(LOGO_SRC).metadata();
  console.log(`Original logo: ${meta.width}x${meta.height}`);

  // Ensure splash output dir exists
  const splashDir = path.join(OUT_DIR, "splash");
  if (!fs.existsSync(splashDir)) fs.mkdirSync(splashDir, { recursive: true });

  // ── PWA App Icons (192, 512): primary 배경 + 흰색 로고 ──
  for (const size of [192, 512]) {
    const logoSize = Math.round(size * 0.55);
    const radius = Math.round(size * 0.22);

    const logo = await logoToWhite(await generateLogo(logoSize));

    const bg = Buffer.from(
      `<svg width="${size}" height="${size}">
        <rect width="${size}" height="${size}" rx="${radius}" fill="${THEME_COLOR}"/>
      </svg>`
    );

    const output = path.join(OUT_DIR, `app-icon-${size}.png`);
    await sharp(bg)
      .composite([{ input: logo, gravity: "centre" }])
      .png()
      .toFile(output);

    console.log(`Created: app-icon-${size}.png`);
  }

  // ── Favicon (32x32): primary 배경 + 흰색 로고 ──
  const faviconSize = 32;
  const faviconLogoSize = Math.round(faviconSize * 0.6);
  const faviconLogo = await logoToWhite(await generateLogo(faviconLogoSize));

  const faviconBg = Buffer.from(
    `<svg width="32" height="32"><rect width="32" height="32" rx="6" fill="${THEME_COLOR}"/></svg>`
  );

  await sharp(faviconBg)
    .composite([{ input: faviconLogo, gravity: "centre" }])
    .png()
    .toFile(path.join(PUBLIC_DIR, "favicon.png"));
  console.log("Created: favicon.png");

  // ── Apple Touch Icon (180x180): primary 배경 + 흰색 로고 ──
  const appleSize = 180;
  const appleLogo = await logoToWhite(await generateLogo(Math.round(appleSize * 0.55)));

  const appleBg = Buffer.from(
    `<svg width="${appleSize}" height="${appleSize}"><rect width="${appleSize}" height="${appleSize}" fill="${THEME_COLOR}"/></svg>`
  );

  await sharp(appleBg)
    .composite([{ input: appleLogo, gravity: "centre" }])
    .png()
    .toFile(path.join(OUT_DIR, "apple-touch-icon.png"));
  console.log("Created: apple-touch-icon.png");

  // ── iOS Splash Screens: primary 배경 (index.html / React SplashScreen과 동일) ──
  const splashMeta = await sharp(SPLASH_LOGO_SRC).metadata();
  console.log(`Splash logo: ${splashMeta.width}x${splashMeta.height}`);

  for (const screen of SPLASH_SCREENS) {
    // Logo height = ~18% of screen height for balanced look
    const logoH = Math.round(screen.h * 0.18);
    const logoW = Math.round(logoH * (splashMeta.width / splashMeta.height));

    const logoRaw = await sharp(SPLASH_LOGO_SRC)
      .resize(logoW, logoH, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel: "lanczos3",
      })
      .png()
      .toBuffer();
    const logo = await logoToWhite(logoRaw);

    const bg = Buffer.from(
      `<svg width="${screen.w}" height="${screen.h}">
        <rect width="${screen.w}" height="${screen.h}" fill="${THEME_COLOR}"/>
      </svg>`
    );

    const filename = `splash-${screen.w}x${screen.h}.png`;
    await sharp(bg)
      .composite([{ input: logo, gravity: "centre" }])
      .png()
      .toFile(path.join(splashDir, filename));

    console.log(`Created: splash/${filename}`);
  }

  console.log("\nAll icons and splash screens generated!");

  // Output link tags for index.html
  console.log("\n--- Copy these into <head> ---\n");
  SPLASH_SCREENS.forEach((s) => {
    console.log(`<link rel="apple-touch-startup-image" href="/icons/splash/splash-${s.w}x${s.h}.png" media="${s.media} and (orientation: portrait)" />`);
  });
}

generate().catch(console.error);
