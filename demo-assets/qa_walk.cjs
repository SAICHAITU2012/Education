// QA walkthrough — capture every screen after the gameverse redesign.
const { chromium } = require("playwright");
const OUT = "/Users/saichaitu/Desktop/edu/demo-assets/qa";

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const pause = (ms) => page.waitForTimeout(ms);
  const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });

  // fresh state → onboarding
  await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { localStorage.clear(); return indexedDB.databases?.() ?? []; }).catch(() => {});
  await page.evaluate(async () => { const dbs = await indexedDB.databases(); dbs.forEach(d => indexedDB.deleteDatabase(d.name)); }).catch(() => {});
  await page.reload({ waitUntil: "domcontentloaded" });
  await pause(1500);
  await shot("01-onboarding-1");
  await page.getByText("Class 3", { exact: true }).first().click();
  await pause(300);
  await page.getByText("Maths", { exact: true }).first().click();
  await pause(400);
  await shot("02-onboarding-1-filled");
  await page.getByRole("button", { name: "Continue" }).click();
  await pause(1200);
  await shot("03-onboarding-2");
  await page.getByText("नमस्ते, मैडम!", { exact: true }).click();
  await pause(300);
  await page.getByRole("button", { name: "Continue" }).click();
  await pause(1000);
  await shot("04-onboarding-3");
  await page.getByText("I understand my attempts stay private. Only anonymised group trends are shared.").click();
  await pause(300);
  await page.getByRole("button", { name: "Create my practice space" }).click();
  await pause(2200);
  await shot("05-dashboard");

  // rehearsal
  await page.getByRole("button", { name: /अभ्यास शुरू करें|अभ्यास करें/ }).first().click({ timeout: 15000 });
  await pause(2600);
  await shot("06-rehearsal-question");
  await page.getByRole("button", { name: "टाइप करें" }).click();
  await pause(300);
  await page.locator("textarea, input[type='text']").first().fill("अच्छी कोशिश, अनु, पर देखो — इकाई पहले: 7 और 6 = 13। 3 लिखो, 1 दस ऊपर हासिल होता है। अब दहाई: 4 और 2, और वह 1 हासिल — 7। तो 47 और 26 = 73।");
  await pause(400);
  await shot("07-typed");
  await page.getByRole("button", { name: "भेजें" }).click();
  await pause(3000);
  await shot("08-reply");
  await page.getByRole("button", { name: /देखें/ }).first().click();
  await pause(1500);
  await shot("09-review-gate");
  await page.getByText("मैं पुष्टि करती हूँ कि मैंने यही कहा था।").click();
  await pause(600);
  await page.getByRole("button", { name: /अंक दें/ }).click();
  await pause(3500);
  await shot("10-feedback");
  await page.mouse.wheel(0, 500);
  await pause(800);
  await shot("11-feedback-scrolled");

  // mastery / cohort / settings
  await page.evaluate(() => (location.hash = "#/mastery"));
  await pause(1200);
  await shot("12-mastery");
  await page.evaluate(() => (location.hash = "#/cohort"));
  await pause(1200);
  await shot("13-cohort");
  await page.evaluate(() => (location.hash = "#/settings"));
  await pause(1200);
  await shot("14-settings");

  // EN toggle for key screens
  await page.evaluate(() => (location.hash = "#/home"));
  await pause(600);
  const en = page.getByText("EN", { exact: true });
  if (await en.count()) { await en.click().catch(() => {}); await pause(800); await shot("15-home-en"); }

  // mobile pass
  await page.setViewportSize({ width: 390, height: 844 });
  await pause(900);
  await shot("m1-home");
  await page.evaluate(() => (location.hash = "#/mastery"));
  await pause(900);
  await shot("m2-mastery");
  await page.evaluate(() => (location.hash = "#/feedback"));
  await pause(900);
  await shot("m3-feedback");

  await browser.close();
  console.log("QA walk done");
})().catch((e) => { console.error("QA FAILED:", e.message); process.exit(1); });
