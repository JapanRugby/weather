import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.SITE_URL || "http://127.0.0.1:4173";
const lat = process.env.WEATHER_LAT || "31.9077";
const lon = process.env.WEATHER_LON || "131.4202";
const name = process.env.WEATHER_NAME || "Miyazaki";
const nameJa = process.env.WEATHER_NAME_JA || "宮崎市";
const timezone = process.env.WEATHER_TIMEZONE || "Asia/Tokyo";
const mode = process.env.WEATHER_MODE || "auto";
const output = process.env.PDF_OUTPUT || "pdf/latest.pdf";

const params = new URLSearchParams({ lat, lon, name, nameJa, timezone, mode });
const launchOptions = { headless: true };
if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
  launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
}
const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({
  viewport: { width: 1600, height: 1100 },
  deviceScaleFactor: 1
});

try {
  await page.goto(`${baseUrl}/?${params}`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForFunction(() => document.querySelector("#weather-report")?.dataset.ready === "true", null, { timeout: 90_000 });
  await page.emulateMedia({ media: "print" });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  await fs.mkdir(path.dirname(output), { recursive: true });
  await page.pdf({
    path: output,
    width: "297mm",
    height: "210mm",
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
    margin: { top: "0", right: "0", bottom: "0", left: "0" }
  });
  console.log(`Generated ${output}`);
} finally {
  await browser.close();
}
