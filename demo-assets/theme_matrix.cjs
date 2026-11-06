// Theme matrix QA — environments + manual themes + mobile.
const { chromium } = require("playwright");
const OUT = "/Users/saichaitu/Desktop/edu/demo-assets/qa2";

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const pause = (ms) => page.waitForTimeout(ms);
  const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });

  // Fresh profile → onboarding (morning forced) → dashboard
  await page.goto("http://localhost:5173/?period=morning", { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => { localStorage.clear(); const dbs = await indexedDB.databases(); dbs.forEach(d => indexedDB.deleteDatabase(d.name)); }).catch(() => {});
  await page.reload({ waitUntil: "domcontentloaded" });
  await pause(1400);
  await shot("env-morning-onboarding");
  await page.getByText("Class 3", { exact: true }).first().click();
  await page.getByText("Maths", { exact: true }).first().click();
  await page.getByRole("button", { name: "Continue" }).click();
  await pause(700);
  await page.getByText("नमस्ते, मैडम!", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await pause(600);
  await page.getByText("I understand my attempts stay private. Only anonymised group trends are shared.").click();
  await page.getByRole("button", { name: "Create my practice space" }).click();
  await pause(1800);
  await shot("env-morning-home");

  // afternoon / evening / night environments
  for (const p of ["afternoon", "evening", "night"]) {
    await page.goto(`http://localhost:5173/?period=${p}#/home`, { waitUntil: "domcontentloaded" });
    await pause(1100);
    await shot(`env-${p}-home`);
  }

  // theme studio (auto mode, night)
  await page.goto("http://localhost:5173/?period=night#/themes", { waitUntil: "domcontentloaded" });
  await pause(1100);
  await shot("studio-night");
  await page.mouse.wheel(0, 700);
  await pause(500);
  await shot("studio-night-scrolled");

  // manual themes on home
  for (const th of ["glass-paradise", "sakura-dreams", "cyberpunk-city", "pixel-universe", "dragons-kingdom"]) {
    await page.evaluate((id) => {
      localStorage.setItem("abhyas.theme.v1", JSON.stringify({ mode: "manual", themeId: id }));
    }, th);
    await page.goto("http://localhost:5173/#/home", { waitUntil: "domcontentloaded" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await pause(1100);
    await shot(`theme-${th}`);
  }

  // mastery + feedback in one light theme
  await page.evaluate(() => {
    localStorage.setItem("abhyas.theme.v1", JSON.stringify({ mode: "manual", themeId: "tropical-paradise" }));
  });
  await page.goto("http://localhost:5173/#/mastery", { waitUntil: "domcontentloaded" });
  await pause(1000);
  await shot("theme-tropical-mastery");

  // mobile home (morning)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:5173/?period=morning#/home", { waitUntil: "domcontentloaded" });
  await pause(1000);
  await shot("m-morning-home");
  await page.goto("http://localhost:5173/?period=morning#/themes", { waitUntil: "domcontentloaded" });
  await pause(1000);
  await shot("m-studio");

  await browser.close();
  console.log("theme matrix QA done");
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
