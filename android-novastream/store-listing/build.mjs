/**
 * Renders the Google Play listing assets for NovaStream from generator.html.
 *
 * Usage: node android-novastream/store-listing/build.mjs
 *
 * Output (android-novastream/store-listing/out):
 *   phone-1..7.png     1080 x 1920  phoneScreenshots
 *   tv-1..5.png        1920 x 1080  tvScreenshots
 *   tv-banner.png      1280 x 720   tvBanner
 *   feature-graphic.png 1024 x 500  featureGraphic
 *   icon-512.png        512 x 512   icon
 *
 * All PNGs are flattened to 24-bit RGB (no alpha) as required by Play.
 */
import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const outDir = resolve(here, "out");
const fontDir = resolve(here, ".fonts");

/**
 * Brand artwork comes from the shipped app resources, never from a copy: the
 * listing icon has to be the very icon people see on their home screen.
 */
const appRes = resolve(repoRoot, "android-novastream/app/src/main/res");
/** Adaptive icon foreground (432x432, artwork fills the 288x288 mask area). */
const launcherForeground = resolve(appRes, "drawable-xxxhdpi/ic_launcher_foreground.png");
/** Adaptive icon background, from values/ic_launcher_background.xml. */
const launcherBackground = "#000615";
/** Full logo lockup used as the Android TV banner (960x540). */
const bannerArtwork = resolve(appRes, "drawable-xxhdpi/tv_banner.png");
const featureTagline = "Playlist m3u e Xtream su telefono, tablet e Android TV";

const FONTS = [
  {
    file: "roboto.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/roboto/Roboto%5Bwdth%2Cwght%5D.ttf",
  },
  {
    file: "material-symbols.ttf",
    url: "https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsRounded%5BFILL%2CGRAD%2Copsz%2Cwght%5D.ttf",
  },
];

/** Phone/TV slides are authored at half size and rendered at 2x. */
const HI_DPI_SLIDES = [
  { id: "phone-1", size: [1080, 1920] },
  { id: "phone-2", size: [1080, 1920] },
  { id: "phone-3", size: [1080, 1920] },
  { id: "phone-4", size: [1080, 1920] },
  { id: "phone-5", size: [1080, 1920] },
  { id: "phone-6", size: [1080, 1920] },
  { id: "phone-7", size: [1080, 1920] },
  { id: "tv-1", size: [1920, 1080] },
  { id: "tv-2", size: [1920, 1080] },
  { id: "tv-3", size: [1920, 1080] },
  { id: "tv-4", size: [1920, 1080] },
  { id: "tv-5", size: [1920, 1080] },
];

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
  ".ttf": "font/ttf",
};

/**
 * Chromium refuses to load file:// subresources, so the generator is served
 * from a throwaway localhost server rooted at the repository.
 */
function serve(html) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
    if (path === "/generator.html") {
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

/** Play rejects PNGs with an alpha channel, so flatten every export. */
function flatten(file) {
  execFileSync("magick", [file, "-background", "white", "-alpha", "remove", "-alpha", "off", "-define", "png:color-type=2", file]);
}

/**
 * Listing icon, feature graphic and TV banner, all rebuilt from the artwork the
 * app itself ships so the store never shows a logo the app no longer uses.
 */
function renderBrandAssets() {
  // The launcher shows the middle 288x288 of the foreground over the flat
  // background colour: same crop here, so the store icon matches the home screen.
  const iconOut = resolve(outDir, "icon-512.png");
  execFileSync("magick", [
    "-size", "512x512", `xc:${launcherBackground}`,
    "(", launcherForeground, "-crop", "288x288+72+72", "+repage", "-resize", "512x512", ")",
    "-composite",
    "-alpha", "remove", "-alpha", "off", "-define", "png:color-type=2",
    iconOut,
  ]);
  console.log("icon-512.png  512x512");

  // Feature graphic: the lockup sits slightly high, tagline underneath.
  const featureOut = resolve(outDir, "feature-graphic.png");
  execFileSync("magick", [
    bannerArtwork,
    "-filter", "Lanczos", "-resize", "1024x576!",
    "-gravity", "south", "-extent", "1024x500",
    "-gravity", "south",
    "-font", resolve(fontDir, "roboto.ttf"), "-pointsize", "29",
    "-fill", "#C7D2E4", "-annotate", "+0+52", featureTagline,
    "-alpha", "remove", "-alpha", "off", "-define", "png:color-type=2",
    featureOut,
  ]);
  console.log("feature-graphic.png  1024x500");

  // TV banner: same lockup at the size Play asks for.
  const bannerOut = resolve(outDir, "tv-banner.png");
  execFileSync("magick", [
    bannerArtwork,
    "-filter", "Lanczos", "-resize", "1280x720!",
    "-alpha", "remove", "-alpha", "off", "-define", "png:color-type=2",
    bannerOut,
  ]);
  console.log("tv-banner.png  1280x720");
}

async function main() {
  ensureFonts();
  mkdirSync(outDir, { recursive: true });

  const { chromium } = await import(pathToFileURL(resolve(repoRoot, "web-novastream/node_modules/playwright/index.mjs")).href);

  const html = readFileSync(resolve(here, "generator.html"), "utf8")
    .replaceAll("__FONTS__", "/android-novastream/store-listing/.fonts");

  const { server, port } = await serve(html);
  const pageUrl = `http://127.0.0.1:${port}/generator.html`;
  const browser = await chromium.launch();

  const context = await browser.newContext({
    viewport: { width: 1400, height: 1100 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto(pageUrl, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const iconFontReady = await page.evaluate(() => document.fonts.check("24px MaterialSymbolsRoundedLocal"));
  if (!iconFontReady) throw new Error("Material Symbols font did not load");
  await page.waitForTimeout(400);

  for (const slide of HI_DPI_SLIDES) {
    const file = resolve(outDir, `${slide.id}.png`);
    await page.locator(`#${slide.id}`).screenshot({ path: file });
    flatten(file);
    console.log(`${slide.id}.png  ${slide.size[0]}x${slide.size[1]}`);
  }
  await context.close();

  await browser.close();
  server.close();

  renderBrandAssets();

  writeFileSync(
    resolve(outDir, "README.txt"),
    [
      "NovaStream — Google Play listing assets (generated by build.mjs)",
      "",
      "phoneScreenshots : phone-1.png … phone-7.png (1080x1920)",
      "tvScreenshots    : tv-1.png … tv-5.png (1920x1080)",
      "tvBanner         : tv-banner.png (1280x720)",
      "featureGraphic   : feature-graphic.png (1024x500)",
      "icon             : icon-512.png (512x512)",
      "",
      "Locale: it-IT. Regenerate with: node android-novastream/store-listing/build.mjs",
      "",
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
