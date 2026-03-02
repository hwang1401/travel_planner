import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = `file://${path.join(__dirname, 'mockups.html')}`;

const SLIDE_COUNT = 6;

const SIZES = [
  // Google Play
  { name: 'phone',       width: 1080, height: 1920, dir: 'output' },
  { name: 'tablet7',     width: 1200, height: 1920, dir: 'output_tablet7' },
  { name: 'tablet10',    width: 1600, height: 2560, dir: 'output_tablet10' },
  // Apple App Store
  { name: 'iphone69',    width: 1320, height: 2868, dir: 'output_iphone69' },
  { name: 'iphone65',    width: 1284, height: 2778, dir: 'output_iphone65' },
  { name: 'ipad129',     width: 2048, height: 2732, dir: 'output_ipad129' },
];

async function main() {
  const browser = await puppeteer.launch({ headless: true });

  for (const size of SIZES) {
    const outDir = path.join(__dirname, size.dir);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

    const page = await browser.newPage();
    await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 });

    await page.goto(htmlPath, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.addStyleTag({
      content: `
        .slide { width: ${size.width}px !important; height: ${size.height}px !important; }
        ${size.name === 'ipad129' ? `
          .caption { padding: 160px 100px 40px !important; }
          .caption .main { font-size: 140px !important; letter-spacing: -4px !important; }
          .caption .sub { font-size: 48px !important; }
          .phone { width: 1000px !important; border-radius: 70px !important; }
          .phone-screen { border-radius: 56px !important; }
          .phone::before { width: 200px !important; height: 48px !important; top: 28px !important; }
          .phone-wrapper { bottom: -60px !important; }
        ` : size.name === 'iphone69' || size.name === 'iphone65' ? `
          .caption { padding: 120px 80px 30px !important; }
          .caption .main { font-size: 110px !important; letter-spacing: -3px !important; }
          .caption .sub { font-size: 38px !important; }
          .phone { width: 900px !important; border-radius: 64px !important; }
          .phone-screen { border-radius: 52px !important; }
          .phone::before { width: 180px !important; height: 44px !important; top: 26px !important; }
          .phone-wrapper { bottom: -80px !important; }
        ` : size.width >= 1400 ? `
          .caption { padding: 140px 80px 40px !important; }
          .caption .main { font-size: 110px !important; letter-spacing: -3px !important; }
          .caption .sub { font-size: 38px !important; }
          .phone { width: 760px !important; border-radius: 60px !important; }
          .phone-screen { border-radius: 48px !important; }
          .phone::before { width: 160px !important; height: 40px !important; }
        ` : size.width >= 1100 ? `
          .caption .main { font-size: 90px !important; }
          .caption .sub { font-size: 34px !important; }
          .phone { width: 660px !important; }
        ` : ''}
      `
    });

    await page.waitForFunction(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 2000));

    for (let i = 1; i <= SLIDE_COUNT; i++) {
      const el = await page.$(`#slide${i}`);
      if (!el) continue;
      const outputPath = path.join(outDir, `screenshot_${i}.png`);
      await el.screenshot({ path: outputPath, type: 'png' });
      console.log(`✓ [${size.name}] screenshot_${i}.png`);
    }

    await page.close();
  }

  await browser.close();
  console.log('\nDone! All images saved.');
}

main().catch(console.error);
