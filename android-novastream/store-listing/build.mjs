/**
 * Renders the Google Play listing assets for NovaStream from generator.html.
 *
 * Usage: node android-novastream/store-listing/build.mjs
 *
 * Output (android-novastream/store-listing/out):
 *   phone-1..6.png     1080 x 1920  phoneScreenshots
 *   tv-1..4.png        1920 x 1080  tvScreenshots
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
  { id: "tv-1", size: [1920, 1080] },
  { id: "tv-2", size: [1920, 1080] },
  { id: "tv-3", size: [1920, 1080] },
  { id: "tv-4", size: [1920, 1080] },
];

const ONE_X_SLIDES = [
  { id: "feature-graphic", size: [1024, 500] },
  { id: "tv-banner", size: [1280, 720] },
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

async function main() {
  ensureFonts();
  mkdirSync(outDir, { recursive: true });

  const { chromium } = await import(pathToFileURL(resolve(repoRoot, "web-novastream/node_modules/playwright/index.mjs")).href);

  const html = readFileSync(resolve(here, "generator.html"), "utf8")
    .replaceAll("__FONTS__", "/android-novastream/store-listing/.fonts")
    .replaceAll("__ICON__", "/web-novastream/public/icon.png");

  const { server, port } = await serve(html);
  const pageUrl = `http://127.0.0.1:${port}/generator.html`;
  const browser = await chromium.launch();

  for (const [scale, slides] of [[2, HI_DPI_SLIDES], [1, ONE_X_SLIDES]]) {
    const context = await browser.newContext({
      viewport: { width: 1400, height: 1100 },
      deviceScaleFactor: scale,
    });
    const page = await context.newPage();
    await page.goto(pageUrl, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const iconFontReady = await page.evaluate(() => document.fonts.check("24px MaterialSymbolsRoundedLocal"));
    if (!iconFontReady) throw new Error("Material Symbols font did not load");
    await page.waitForTimeout(400);

    for (const slide of slides) {
      const file = resolve(outDir, `${slide.id}.png`);
      await page.locator(`#${slide.id}`).screenshot({ path: file });
      flatten(file);
      console.log(`${slide.id}.png  ${slide.size[0]}x${slide.size[1]}`);
    }
    await context.close();
  }

  await browser.close();
  server.close();

  // 512x512 listing icon straight from the app icon artwork.
  const iconOut = resolve(outDir, "icon-512.png");
  execFileSync("magick", [
    resolve(repoRoot, "web-novastream/public/icon.png"),
    "-resize", "512x512",
    "-background", "white", "-alpha", "remove", "-alpha", "off",
    "PNG32:" + iconOut,
  ]);
  console.log("icon-512.png  512x512");

  writeFileSync(
    resolve(outDir, "README.txt"),
    [
      "NovaStream — Google Play listing assets (generated by build.mjs)",
      "",
      "phoneScreenshots : phone-1.png … phone-6.png (1080x1920)",
      "tvScreenshots    : tv-1.png … tv-4.png (1920x1080)",
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
