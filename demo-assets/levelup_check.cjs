// Verify the LevelUpOverlay: two distinct passes at L1 → level 2.
const { chromium } = require("playwright");
const OUT = "/Users/saichaitu/Desktop/edu/demo-assets/qa";

const RESP = {
  "हासिल के साथ जोड़":
    "अच्छी कोशिश, अनु, पर देखो — इकाई पहले: 7 और 6 = 13। 3 लिखो, 1 दस ऊपर हासिल होता है। अब दहाई: 4 और 2, और वह 1 हासिल — 7। तो 47 और 26 = 73। चलो बत्ती से दिखाते हैं — 4 बंडल, 6 एक-एक, फिर 2 बंडल और 6 एक-एक — सात बंडल और 3 खुली बत्ती।",
  "3 × 4 का मतलब क्या?":
    "बहुत अच्छी कोशिश, अनु! चलो एक-एक करके गिनते हैं। तीन का एक समूह — 3। फिर एक और समूह — 6। फिर एक और — 9। और एक और समूह चाहिए, क्योंकि हमें चार समूह मिले हैं: 3+3+3+3 = 12। तुम्हारा तरीका सही था, बस एक समूह कम गिना गया था।",
};

async function doRehearsal(page) {
  const pause = (ms) => page.waitForTimeout(ms);
  const startBtn = page.getByRole("button", { name: /अभ्यास शुरू करें|अभ्यास करें/ }).first();
  await startBtn.click({ timeout: 15000 });
  await pause(1800);
  const title = await page.locator(".session-head strong, header strong").first().innerText().catch(() => "");
  await page.getByRole("button", { name: "टाइप करें" }).click();
  await pause(300);
  const resp = Object.entries(RESP).find(([k]) => title.includes(k))?.[1] ?? Object.values(RESP)[0];
  await page.locator("textarea, input[type='text']").first().fill(resp);
  await page.getByRole("button", { name: "भेजें" }).click();
  await pause(2600);
  await page.getByRole("button", { name: "जो सुना गया उसे देखें" }).click();
  await pause(1200);
  await page.getByText("मैं पुष्टि करती हूँ कि मैंने यही कहा था।").click();
  await pause(500);
  await page.getByRole("button", { name: "मेरी कोशिश को अंक दें" }).click();
  await pause(3000);
  return title;
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const pause = (ms) => page.waitForTimeout(ms);

  await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => { localStorage.clear(); const dbs = await indexedDB.databases(); dbs.forEach(d => indexedDB.deleteDatabase(d.name)); }).catch(() => {});
  await page.reload({ waitUntil: "domcontentloaded" });
  await pause(1200);
  await page.getByText("Class 3", { exact: true }).first().click();
  await pause(250);
  await page.getByText("Maths", { exact: true }).first().click();
  await page.getByRole("button", { name: "Continue" }).click();
  await pause(900);
  await page.getByText("नमस्ते, मैडम!", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await pause(800);
  await page.getByText("I understand my attempts stay private. Only anonymised group trends are shared.").click();
  await page.getByRole("button", { name: "Create my practice space" }).click();
  await pause(2000);

  const s1 = await doRehearsal(page);
  console.log("pass 1 on:", s1);
  // back home for the next quest
  await page.getByRole("button", { name: /होम पर वापस|होम/ }).first().click().catch(() => {});
  await pause(1200);
  const s2 = await doRehearsal(page);
  console.log("pass 2 on:", s2);
  await pause(1500);
  const overlay = await page.locator(".realm-overlay").count();
  console.log("realm overlay visible:", overlay > 0);
  await page.screenshot({ path: `${OUT}/16-realm-unlock.png` });
  await browser.close();
  console.log("done");
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
