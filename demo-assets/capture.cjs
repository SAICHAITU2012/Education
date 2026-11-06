// Final capture: landing (Day→Dusk) → click through to app → onboarding → theme studio live
// switch → rehearsal → mission report → realm unlock → theme montage → realm map.
const { chromium } = require("playwright");

const RESP1 =
  "अच्छी कोशिश, अनु, पर देखो — इकाई पहले: 7 और 6 = 13। 3 लिखो, 1 दस ऊपर हासिल होता है। अब दहाई: 4 और 2, और वह 1 हासिल — 7। तो 47 और 26 = 73। चलो बत्ती से दिखाते हैं — 4 बंडल, 6 एक-एक, फिर 2 बंडल और 6 एक-एक — सात बंडल और 3 खुली बत्ती।";
const RESP2 =
  "बहुत अच्छी कोशिश, अनु! चलो एक-एक करके गिनते हैं। तीन का एक समूह — 3। फिर एक और समूह — 6। फिर एक और — 9। और एक और समूह चाहिए, क्योंकि हमें चार समूह मिले हैं: 3+3+3+3 = 12।";

(async () => {
  const outDir = "/Users/saichaitu/Desktop/edu/demo-assets/footage";
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    recordVideo: { dir: outDir, size: { width: 1280, height: 800 } },
  });
  const page = await ctx.newPage();
  const t0 = Date.now();
  const mark = (l) => console.log(`[t+${((Date.now() - t0) / 1000).toFixed(2)}s] ${l}`);
  const pause = (ms) => page.waitForTimeout(ms);

  // ── landing (Day) → env switch → Press Start ────────────────────────────────
  await page.goto("http://localhost:8930/", { waitUntil: "domcontentloaded" });
  await pause(2600);
  mark("landing");
  await page.evaluate(() => document.querySelector('[data-e="dusk"]').click());
  mark("dusk");
  await pause(2400);
  await page.evaluate(() => document.querySelector('.hero .cta .btn.primary').click());
  mark("clicked-start");

  // ── app onboarding (morning) → home ─────────────────────────────────────────
  await page.waitForURL("**/localhost:5173/**", { timeout: 20000 });
  await pause(2000);
  mark("onboarding");
  await page.getByText("Class 3", { exact: true }).first().click();
  await pause(350);
  await page.getByText("Maths", { exact: true }).first().click();
  await pause(450);
  await page.getByRole("button", { name: "Continue" }).click();
  await pause(850);
  await page.getByText("नमस्ते, मैडम!", { exact: true }).click();
  await pause(250);
  await page.getByRole("button", { name: "Continue" }).click();
  await pause(750);
  await page.getByText("I understand my attempts stay private. Only anonymised group trends are shared.").click();
  await pause(250);
  await page.getByRole("button", { name: "Create my practice space" }).click();
  mark("home");
  await pause(3600);

  // ── Theme Studio + LIVE SWITCH to cyberpunk ─────────────────────────────────
  await page.evaluate(() => (location.hash = "#/themes"));
  mark("studio");
  await pause(3800);
  await page.getByRole("button", { name: "Cyberpunk City" }).first().click();
  mark("switched");
  await pause(2600);

  // ── rehearsal 1 (cyberpunk) ─────────────────────────────────────────────────
  await page.evaluate(() => (location.hash = "#/home"));
  mark("home-cyber");
  await pause(1600);
  await page.getByRole("button", { name: /अभ्यास शुरू करें|अभ्यास करें/ }).first().click({ timeout: 15000 });
  mark("rehearsal1");
  await pause(3200);
  await page.getByRole("button", { name: "टाइप करें" }).click();
  await pause(350);
  await page.locator("textarea, input[type='text']").first().type(RESP1, { delay: 25 });
  mark("typed");
  await pause(1000);
  await page.getByRole("button", { name: "भेजें" }).click();
  mark("sent");
  await pause(6000);
  mark("reply-shown");

  // ── review + score ───────────────────────────────────────────────────────────
  await page.getByRole("button", { name: "जो सुना गया उसे देखें" }).click();
  mark("review");
  await pause(6200);
  await page.getByText("मैं पुष्टि करती हूँ कि मैंने यही कहा था।").click();
  mark("confirmed");
  await pause(1900);
  await page.getByRole("button", { name: "मेरी कोशिश को अंक दें" }).click();
  mark("scoring");
  await pause(1400);
  await pause(4300);
  mark("feedback");
  await page.mouse.wheel(0, 420);
  await pause(2300);

  // ── realm unlock (second quest fast) ─────────────────────────────────────────
  await page.getByRole("button", { name: /होम पर वापस/ }).click();
  mark("home2");
  await pause(1700);
  await page.getByRole("button", { name: /अभ्यास शुरू करें|अभ्यास करें/ }).first().click({ timeout: 15000 });
  mark("rehearsal2");
  await pause(1500);
  await page.getByRole("button", { name: "टाइप करें" }).click();
  await pause(250);
  await page.locator("textarea, input[type='text']").first().fill(RESP2);
  await page.getByRole("button", { name: "भेजें" }).click();
  await pause(1700);
  await page.getByRole("button", { name: "जो सुना गया उसे देखें" }).click();
  await pause(1300);
  await page.getByText("मैं पुष्टि करती हूँ कि मैंने यही कहा था।").click();
  await pause(350);
  await page.getByRole("button", { name: "मेरी कोशिश को अंक दें" }).click();
  mark("scoring2");
  await pause(2000);
  console.log("overlay:", (await page.locator(".realm-overlay").count()) > 0 ? "VISIBLE" : "MISSING");
  mark("overlay");
  await pause(4600);

  // ── theme montage ────────────────────────────────────────────────────────────
  await page.evaluate(() => (location.hash = "#/themes"));
  mark("montage");
  await pause(1500);
  for (const name of ["Sakura Dreams", "Dragon", "Aurora", "Ocean"]) {
    await page.getByRole("button", { name: new RegExp(name) }).first().click();
    mark(`switch-${name.split(" ")[0].toLowerCase()}`);
    await pause(1500);
  }

  // ── realm map finale ─────────────────────────────────────────────────────────
  await page.evaluate(() => (location.hash = "#/mastery"));
  mark("mastery");
  await pause(4200);

  await ctx.close();
  await browser.close();
  console.log("capture done");
})().catch((e) => {
  console.error("CAPTURE FAILED:", e.message);
  process.exit(1);
});
