// Builds the demo playlist used to film the NovaStream 1.3.5 tutorial:
// public/demo/novastream-demo.m3u, public/demo/guide.xml, channel logos and posters.
// Usage: node scripts/make-demo.mjs <public base url> [<generated posters dir>]
import { mkdir, writeFile, copyFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "/usr/local/lib/node_modules/playwright/index.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public/demo");
const base = (process.argv[2] ?? "https://motion-youtube.rork.app").replace(/\/$/, "") + "/demo";
const genDir = process.argv[3];
const art = join(root, "../android-novastream/store-listing/art");
const STREAM = "http://stream.demo-provider.invalid";

const channels = [
  ["News", "World News 24", "WN", "#E5484D"],
  ["News", "Nova News", "NN", "#2F7BFF"],
  ["News", "Business Live", "BL", "#F5A524"],
  ["News", "Metro Today", "MT", "#38D5F5"],
  ["Sport", "Sport Arena FHD", "SA", "#34E0A1"],
  ["Sport", "Goal TV", "GT", "#22C55E"],
  ["Sport", "Motor Channel", "MC", "#F97316"],
  ["Sport", "Tennis Plus", "T+", "#EAB308"],
  ["Sport", "Fight Night HD", "FN", "#DC2626"],
  ["Movies", "Cinema Classic HD", "CC", "#C084FC"],
  ["Movies", "Action Max", "AM", "#EF4444"],
  ["Movies", "Premiere One", "P1", "#2F7BFF"],
  ["Movies", "Comedy Central Hub", "CH", "#FACC15"],
  ["Documentary", "Planet Wild", "PW", "#16A34A"],
  ["Documentary", "History Vault", "HV", "#A16207"],
  ["Documentary", "Science Now", "SN", "#0EA5E9"],
  ["Kids", "Toon Town", "TT", "#F472B6"],
  ["Kids", "Junior Club", "JC", "#FB923C"],
  ["Music", "Hits FM TV", "HF", "#A855F7"],
  ["Music", "Jazz Lounge", "JL", "#14B8A6"],
  ["Entertainment", "Nova One HD", "N1", "#2F7BFF"],
  ["Entertainment", "Nova Two", "N2", "#38D5F5"],
  ["Entertainment", "Prime Drama", "PD", "#E11D48"],
  ["Entertainment", "Travel & Taste", "TV", "#F59E0B"],
];

const shows = {
  News: ["Morning Briefing", "World Report", "Market Watch", "Evening News", "Global Desk", "Weather Live"],
  Sport: ["Matchday Live", "Champions Night", "Grand Prix Qualifying", "Highlights", "Sports Center", "Pre-Match Show"],
  Movies: ["Northern Lights", "Harbor Lights", "Neon Run", "Summit", "Deep Blue", "Last Lap", "Dune Sea"],
  Documentary: ["Wild Oceans", "Planet Earth Diaries", "Ancient Empires", "Into the Jungle", "Cosmos Explained"],
  Kids: ["Bubble Friends", "Space Pups", "Dino Day", "Little Builders", "Story Time"],
  Music: ["Top 40 Countdown", "Live Sessions", "Late Night Jazz", "Chart Hits", "Acoustic Hour"],
  Entertainment: ["The Big Quiz", "Kitchen Masters", "Talk of the Town", "City Stories", "Weekend Live", "Road Trip"],
};

const movies = [
  ["Action", "Neon Run (2025)", "poster-neon.jpg"],
  ["Action", "Last Lap (2024)", "poster-racing.jpg"],
  ["Action", "Iron Bridge (2025)", "poster_ironbridge"],
  ["Action", "Midnight Express (2023)", "poster_midnight"],
  ["Drama", "Harbor Lights (2024)", "poster-harbor.jpg"],
  ["Drama", "Paper Moon (2022)", "poster_papermoon"],
  ["Drama", "The Lighthouse (2025)", "poster_lighthouse"],
  ["Drama", "The Quiet Forest (2023)", "poster-forest.jpg"],
  ["Adventure", "Summit (2024)", "poster-mountain.jpg"],
  ["Adventure", "Dune Sea (2023)", "poster-desert.jpg"],
  ["Adventure", "Red Canyon (2025)", "poster_canyon"],
  ["Sci-Fi", "Glass City (2025)", "poster_glasscity"],
  ["Sci-Fi", "Northern Lights (2024)", "poster-aurora.jpg"],
  ["Sci-Fi", "Deep Blue (2023)", "poster-ocean.jpg"],
  // A duplicate on purpose: 1.3.5 keeps only one.
  ["Action", "Neon Run (2025)", "poster-neon.jpg"],
];

const series = [
  ["Drama", "Coastline", "poster_coastline", 3, 8],
  ["Mystery", "The Archive", "poster_archive", 2, 6],
  ["Sci-Fi", "Frontier", "poster_frontier", 2, 8],
  ["Thriller", "Signal", "poster_signal", 1, 10],
  ["Drama", "Harbor Lights: The Series", "poster-harbor.jpg", 2, 6],
  ["Sci-Fi", "Northern Lights: Origins", "poster-aurora.jpg", 1, 8],
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function posterFile(name) {
  await mkdir(join(out, "posters"), { recursive: true });
  if (name.endsWith(".jpg")) {
    await copyFile(join(art, name), join(out, "posters", name));
    return name;
  }
  const files = genDir ? await readdir(genDir) : [];
  const hit = files.find((f) => f.startsWith(name) && /\.(png|jpe?g|webp)$/.test(f));
  if (!hit) throw new Error(`missing generated poster ${name}`);
  const target = `${name.replace(/_/g, "-")}${hit.slice(hit.lastIndexOf("."))}`;
  await copyFile(join(genDir, hit), join(out, "posters", target));
  return target;
}

async function logos() {
  await mkdir(join(out, "logos"), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 256, height: 256 } });
  for (const [, name, mark, color] of channels) {
    await page.setContent(`<html><body style="margin:0;background:transparent">
      <div style="width:256px;height:256px;border-radius:56px;background:linear-gradient(150deg,${color},#0A1124 140%);
        display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Arial Black,Arial,sans-serif;color:#fff">
        <div style="font-size:104px;font-weight:900;letter-spacing:-4px;line-height:1">${mark}</div>
        <div style="font-size:22px;font-weight:700;margin-top:10px;opacity:.9;text-transform:uppercase;letter-spacing:1px">${name.replace(/ (HD|FHD)$/, "").slice(0, 16)}</div>
      </div></body></html>`);
    await page.locator("div").first().screenshot({ path: join(out, "logos", `${slug(name)}.png`), omitBackground: true });
  }
  await browser.close();
}

function xmltvTime(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}00 +0000`;
}

function guide() {
  const hour = 3_600_000;
  const start = Math.floor(Date.now() / hour) * hour - 24 * hour;
  const end = start + 96 * hour;
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv generator-info-name="NovaStream demo">\n`;
  channels.forEach(([group, name]) => {
    xml += `  <channel id="${slug(name)}"><display-name>${esc(name)}</display-name></channel>\n`;
  });
  channels.forEach(([group, name], ci) => {
    const list = shows[group];
    let t = start;
    let i = ci;
    while (t < end) {
      const len = (group === "Movies" ? 120 : [30, 60, 60, 90][i % 4]) * 60_000;
      const title = list[i % list.length];
      xml += `  <programme channel="${slug(name)}" start="${xmltvTime(t)}" stop="${xmltvTime(t + len)}"><title>${esc(title)}</title><desc>${esc(`${title} on ${name}.`)}</desc></programme>\n`;
      t += len;
      i += 1;
    }
  });
  return xml + "</tv>\n";
}

await mkdir(out, { recursive: true });
await logos();
let m3u = `#EXTM3U url-tvg="${base}/guide.xml"\n`;
channels.forEach(([group, name], i) => {
  m3u += `#EXTINF:-1 tvg-id="${slug(name)}" tvg-name="${name}" tvg-logo="${base}/logos/${slug(name)}.png" group-title="${group}",${name}\n${STREAM}/live/demo/demo/${100 + i}.ts\n`;
});
for (const [i, [group, title, poster]] of movies.entries()) {
  const file = await posterFile(poster);
  const id = 2000 + (title === "Neon Run (2025)" ? 0 : i);
  m3u += `#EXTINF:-1 tvg-name="${title}" tvg-logo="${base}/posters/${file}" group-title="${group}",${title}\n${STREAM}/movie/demo/demo/${id}.mp4\n`;
}
let ep = 5000;
for (const [group, name, poster, seasons, perSeason] of series) {
  const file = await posterFile(poster);
  for (let s = 1; s <= seasons; s++) {
    for (let e = 1; e <= perSeason; e++) {
      const code = `S${String(s).padStart(2, "0")}E${String(e).padStart(2, "0")}`;
      m3u += `#EXTINF:-1 tvg-name="${name} ${code}" tvg-logo="${base}/posters/${file}" group-title="${group}",${name} ${code}\n${STREAM}/series/demo/demo/${ep++}.mkv\n`;
    }
  }
}
await writeFile(join(out, "novastream-demo.m3u"), m3u);
await writeFile(join(out, "guide.xml"), guide());
console.log(`demo playlist: ${base}/novastream-demo.m3u`);
