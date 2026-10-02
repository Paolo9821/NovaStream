/**
 * Renders the English Google Play screenshots for NovaStream from generator-en.html.
 *
 * Usage: node android-novastream/store-listing/build-en.mjs
 *
 * Output:
 *   store-listing/foto Smartphone store/  phone-1..8.png (1080x1920) + feature-graphic.png (1024x500)
 *   store-listing/foto TV store/          tv-1..7.png    (1920x1080) + tv-banner.png (1280x720)
 *
 * Every PNG is flattened to 24-bit RGB (no alpha), as Play requires.
 */
import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const fontDir = resolve(here, ".fonts");
const phoneDir = resolve(here, "foto Smartphone store");
const tvDir = resolve(here, "foto TV store");

const appRes = resolve(repoRoot, "android-novastream/app/src/main/res");
const bannerArtwork = resolve(appRes, "drawable-xxhdpi/tv_banner.png");
const featureTagline = "Your m3u and Xtream playlists on phone, tablet and Android TV";

const FONTS = [
  { file: "roboto.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/roboto/Roboto%5Bwdth%2Cwght%5D.ttf" },
  { file: "material-symbols.ttf", url: "https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsRounded%5BFILL%2CGRAD%2Copsz%2Cwght%5D.ttf" },
  { file: "bricolage.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/bricolagegrotesque/BricolageGrotesque%5Bopsz%2Cwdth%2Cwght%5D.ttf" },
];

const PHONE_SLIDES = ["phone-1", "phone-2", "phone-3", "phone-4", "phone-5", "phone-6", "phone-7", "phone-8"];
const TV_SLIDES = ["tv-1", "tv-2", "tv-3", "tv-4", "tv-5", "tv-6", "tv-7"];

function ensureFonts() {
  mkdirSync(fontDir, { recursive: true });
  for (const font of FONTS) {
    const target = resolve(fontDir, font.file);
    if (existsSync(target)) continue;
    console.log(`downloading ${font.file}…`);
    execFileSync("curl", ["-sSL", "-o", target, font.url], { stdio: "inherit" });
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
};

/** Chromium refuses file:// subresources, so the page is served from localhost. */
function serve(html) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
    if (path === "/generator-en.html") {
      res.writeHead(200, { "content-type": MIME[".html"] });
      res.end(html);
      return;
    }
    const file = resolve(repoRoot, "." + path);
    if (!file.startsWith(repoRoot) || !existsSync(file)) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((done) => {
    server.listen(0, "127.0.0.1", () => done({ server, port: server.address().port }));
  });
}

function flatten(file) {
  execFileSync("magick", [file, "-background", "#0B0F1A", "-alpha", "remove", "-alpha", "off", "-define", "png:color-type=2", file]);
}

function renderBrandAssets() {
  const featureOut = resolve(phoneDir, "feature-graphic.png");
  execFileSync("magick", [
    bannerArtwork,
    "-filter", "Lanczos", "-resize", "1024x576!",
    "-gravity", "south", "-extent", "1024x500",
    "-gravity", "south",
    "-font", resolve(fontDir, "roboto.ttf"), "-pointsize", "27",
    "-fill", "#C7D2E4", "-annotate", "+0+52", featureTagline,
    "-alpha", "remove", "-alpha", "off", "-define", "png:color-type=2",
    featureOut,
  ]);
  console.log("feature-graphic.png  1024x500");

  const bannerOut = resolve(tvDir, "tv-banner.png");
  execFileSync("magick", [
    bannerArtwork, "-filter", "Lanczos", "-resize", "1280x720!",
    "-alpha", "remove", "-alpha", "off", "-define", "png:color-type=2", bannerOut,
  ]);
  console.log("tv-banner.png  1280x720");
}

async function main() {
  ensureFonts();
  mkdirSync(phoneDir, { recursive: true });
  mkdirSync(tvDir, { recursive: true });

  const { chromium } = await import(pathToFileURL(resolve(repoRoot, "web-novastream/node_modules/playwright/index.mjs")).href);
  const html = readFileSync(resolve(here, "generator-en.html"), "utf8")
    .replaceAll("__FONTS__", "/android-novastream/store-listing/.fonts")
    .replaceAll("__ART__", "/android-novastream/store-listing/art");

  const { server, port } = await serve(html);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1400, height: 1100 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/generator-en.html`, { waitUntil: "networkidle" });
  // The icon font is ~15 MB: wait for every face explicitly instead of trusting
  // document.fonts.ready, which can resolve before a large font finishes.
  for (const family of ["MaterialSymbolsRoundedLocal", "BricolageLocal", "RobotoLocal"]) {
    const ok = await page.evaluate(async (f) => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await document.fonts.load(`24px ${f}`).catch(() => []);
        if (document.fonts.check(`24px ${f}`)) return true;
        await new Promise((r) => setTimeout(r, 1500));
      }
      return false;
    }, family);
    if (!ok) throw new Error(`${family} did not load`);
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);

  for (const id of PHONE_SLIDES) {
    const file = resolve(phoneDir, `${id}.png`);
    await page.locator(`#${id}`).screenshot({ path: file });
    flatten(file);
    console.log(`${id}.png  1080x1920`);
  }
  for (const id of TV_SLIDES) {
    const file = resolve(tvDir, `${id}.png`);
    await page.locator(`#${id}`).screenshot({ path: file });
    flatten(file);
    console.log(`${id}.png  1920x1080`);
  }

  await context.close();
  await browser.close();
  server.close();
  renderBrandAssets();

  writeFileSync(resolve(phoneDir, "README.txt"), [
    "NovaStream — Google Play, phone screenshots (English, en-US)",
    "",
    "phoneScreenshots : phone-1.png … phone-8.png (1080x1920, 24-bit PNG)",
    "featureGraphic   : feature-graphic.png (1024x500)",
    "",
    "1 Home · 2 Live TV + guide · 3 Movies · 4 Series/resume · 5 Audio & subtitles",
    "6 Up next · 7 Manage playlists from the website · 8 Settings & privacy",
    "",
    "Regenerate with: node android-novastream/store-listing/build-en.mjs",
    "",
  ].join("\n"));
  writeFileSync(resolve(tvDir, "README.txt"), [
    "NovaStream — Google Play, Android TV screenshots (English, en-US)",
    "",
    "tvScreenshots : tv-1.png … tv-7.png (1920x1080, 24-bit PNG)",
    "tvBanner      : tv-banner.png (1280x720)",
    "",
    "1 Home · 2 Live TV + guide · 3 Movies · 4 Series/resume · 5 Player",
    "6 Audio, subtitles and picture · 7 Manage playlists with QR code",
    "",
    "Regenerate with: node android-novastream/store-listing/build-en.mjs",
    "",
  ].join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
