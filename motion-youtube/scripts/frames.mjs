// Grabs film frames through the player's render API for a visual check.
// Usage: node scripts/frames.mjs <url> <outDir> <seconds...>
import { chromium } from "/usr/local/lib/node_modules/playwright/index.mjs";

const [url, outDir, ...times] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));
await page.goto(`${url}?render-video`, { waitUntil: "networkidle" });
const info = await page.evaluate(() => window.__rorkMotionRender.ready);
console.log(`duration ${info.duration}s, ${info.audioTracks?.length ?? 0} audio tracks`);
console.log(JSON.stringify(info.scenes ?? Object.keys(info)));
for (const t of times) {
  const frame = Math.round(Number(t) * 30);
  await page.evaluate((f) => window.__rorkMotionRender.renderFrame(f), frame);
  await page.screenshot({ path: `${outDir}/f-${String(t).padStart(5, "0")}.png` });
}
console.log(JSON.stringify(errors.slice(0, 10)));
await browser.close();
