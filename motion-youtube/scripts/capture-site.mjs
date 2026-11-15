// Captures the NovaStream website pages shown in the YouTube video.
// The licence API is mocked with the emulator's device so the pages show a real,
// consistent state without touching production data. No prices are shown.
// Usage: node scripts/capture-site.mjs <out dir>
import { chromium } from "/usr/local/lib/node_modules/playwright/index.mjs";

const OUT = process.argv[2] ?? "public/media";
const SITE = "https://novastreamapp.com";
const API = "https://crea-un-applicazione-di-iptv-che-accetta-backend.rork.app/api/";
const MAC = "1E68F3154AC3";
const NEW_ID = "cbf55cc96217c6ce";
const now = Date.now();
const year = now + 365 * 86_400_000;

const captchaSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="84"><rect width="260" height="84" fill="#0B1220"/><text x="130" y="56" font-family="monospace" font-size="38" font-weight="700" fill="#9FC3FF" text-anchor="middle" letter-spacing="10">7K4QX</text></svg>`;
const captcha = { token: "t", image: `data:image/svg+xml;base64,${Buffer.from(captchaSvg).toString("base64")}`, expiresAt: now + 600_000 };

const playlists = [
  { id: "p1", name: "My TV", type: "m3u", host: "motion-youtube.rork.app", status: "installed", origin: "app", createdAt: now - 3600_000 },
  { id: "p2", name: "Sports", type: "xtream", host: "panel.example.tv", status: "pending", origin: "web", createdAt: now - 60_000 },
];
const view = { ok: true, lastSeenAt: now - 120_000, playlists, limit: 5 };

const answers = {
  "license/status": { found: true, status: "active", plan: "annual", expiresAt: year, note: "", serverTime: now },
  "device/open": { ...view, session: "s", sessionExpiresAt: now + 1800_000 },
  "device/view": view,
  captcha,
  "license/transfer": { ok: true, fromId: MAC, toId: NEW_ID.toUpperCase(), plan: "annual", expiresAt: year },
};

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1.5,
  locale: "en-US",
  colorScheme: "dark",
});
await context.addInitScript(() => {
  try {
    for (const k of Object.keys(localStorage)) if (/lang|locale/i.test(k)) localStorage.removeItem(k);
  } catch {}
});
await context.route(`${API}**`, async (route) => {
  const req = route.request();
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  const path = req.url().slice(API.length).split("?")[0];
  const body = answers[path];
  if (!body) {
    console.log("unmocked", path);
    return route.fulfill({ status: 404, headers: cors, contentType: "application/json", body: "{}" });
  }
  await new Promise((r) => setTimeout(r, 150));
  return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify(body) });
});

const page = await context.newPage();
// Tall pages get a tall viewport instead of a full-page shot, so the fixed
// background covers the whole picture without a seam.
const shot = async (name, height = 800) => {
  await page.setViewportSize({ width: 1280, height });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(900);
  // The hosting badge is not part of the product.
  await page.addStyleTag({ content: "#rork-watermark-badge{display:none!important}" });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/site-${name}-v1.jpg`, type: "jpeg", quality: 90 });
  console.log("saved", name);
};

// Device hub with the licence status.
await page.goto(`${SITE}/device?device=${MAC}`, { waitUntil: "networkidle" });
await page.getByText(/active/i).first().waitFor();
await shot("device", 800);

// Playlists: open with the 6-character key, then the list and the add form.
await page.goto(`${SITE}/playlist`, { waitUntil: "networkidle" });
await page.evaluate(() => sessionStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.fill("#pl-device", "1E:68:F3:15:4A:C3");
await page.fill("#pl-key", "J4VV9D");
await shot("pl-open");
await page.locator("form button[type=submit]").click();
await page.getByText("My TV").first().waitFor();
await page.fill("#pl-name", "Movies night");
await page.fill("#pl-m3u", "https://example.com/playlist.m3u").catch(() => {});
await shot("pl-list", 1520);

// Transfer: the filled form, then the success screen.
await page.goto(`${SITE}/transfer`, { waitUntil: "networkidle" });
await page.fill("#tr-from", "1E:68:F3:15:4A:C3");
await page.fill("#tr-from-key", "J4VV9D");
await page.fill("#tr-to", NEW_ID);
await page.fill("#tr-to-key", "R7M2KP");
const answer = page.locator("form input").last();
await answer.fill("7K4QX");
await shot("tr-form", 1520);
await page.locator("form button[type=submit]").click();
await page.waitForTimeout(600);
await shot("tr-done");

// Support.
await page.goto(`${SITE}/support`, { waitUntil: "networkidle" });
await page.locator("input[type=email]").first().fill("alex@example.com").catch(() => {});
await shot("support", 1120);

await browser.close();
