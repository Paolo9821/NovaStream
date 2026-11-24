// Captures stills of the hosted film at given seconds, for a visual layout check.
// Usage: node scripts/frames.mjs <url> <outDir> <width> <height> <sec,sec,...>
const [url, outDir, w, h, list] = process.argv.slice(2);
const { chromium } = await import(process.env.RORK_PLAYWRIGHT_MODULE ?? "/usr/local/lib/node_modules/playwright/index.mjs");
const { mkdir } = await import("node:fs/promises");
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
await page.goto(`${url}?render-video`, { waitUntil: "networkidle" });
const info = await page.evaluate(async () => {
  const api = window.__rorkMotionRender;
  const i = await api.ready;
  return { fps: api.fps, info: i };
});
console.log(JSON.stringify(info).slice(0, 400));
for (const s of list.split(",").map(Number)) {
  await page.evaluate(async (f) => window.__rorkMotionRender.renderFrame(f), Math.round(s * info.fps));
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${outDir}/f-${String(s).padStart(5, "0")}.jpg`, type: "jpeg", quality: 70 });
}
await browser.close();
