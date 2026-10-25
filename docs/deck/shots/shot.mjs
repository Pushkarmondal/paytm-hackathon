// Full-page screenshots of the running app at 800px width, device scale 2, driven over the DevTools protocol.
// usage: node shot.mjs <outDir> <scenarios.json>
// scenario: { name, steps: [ ["nav", url], ["tab", "Coverage Twin"], ["clickText", "button", "Open the question sheet"],
//             ["clickAria", "Surgeon fees"], ["select", "<aria-label or option text>", "<value>"], ["wait", ms], ["shot", "name", "full"|"view"] ] }
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [outDir, scenarioFile] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const scenarios = JSON.parse(readFileSync(scenarioFile, "utf8"));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9333;
const profile = mkdtempSync(join(tmpdir(), "claim-sach-shot-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=2",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--window-size=800,1000", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targetUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("Chrome did not expose a page target");
}

const ws = new WebSocket(await targetUrl());
await new Promise((r) => (ws.onopen = r));
let nextId = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) => new Promise((res) => { const id = ++nextId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text + " " + JSON.stringify(r.result.exceptionDetails.exception?.description));
  return r.result?.result?.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 800, height: 1000, deviceScaleFactor: 2, mobile: false });

const helpers = `
  window.__cs = {
    byText(sel, text) { return [...document.querySelectorAll(sel)].find(el => (el.textContent || "").trim().includes(text)); },
    click(sel, text) { const el = this.byText(sel, text); if (!el) throw new Error("no " + sel + " with text " + text); el.click(); return true; },
    clickAria(prefix, contains) { const el = [...document.querySelectorAll("[aria-label]")].find(el => el.getAttribute("aria-label").startsWith(prefix) && (!contains || el.getAttribute("aria-label").includes(contains))); if (!el) throw new Error("no aria-label starting " + prefix); el.click(); return true; },
    select(key, value) {
      let el = [...document.querySelectorAll("select")].find(s => (s.getAttribute("aria-label") || "").includes(key) || [...s.options].some(o => o.textContent.includes(key)));
      if (!el) throw new Error("no select for " + key);
      const opt = [...el.options].find(o => o.value === value || o.textContent.includes(value));
      if (!opt) throw new Error("no option " + value + " in " + [...el.options].map(o => o.value).join("|"));
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
      setter.call(el, opt.value);
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return opt.value;
    },
    type(key, text) {
      const el = [...document.querySelectorAll("input, textarea")].find(i => (i.placeholder || "").includes(key) || (i.getAttribute("aria-label") || "").includes(key));
      if (!el) throw new Error("no input for " + key);
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    },
    height() { return document.documentElement.scrollHeight; }
  }; true;`;

async function shot(name, mode) {
  await evaluate("document.querySelectorAll('nextjs-portal').forEach(e => e.remove()); window.scrollTo(0,0); true");
  await sleep(300);
  const height = mode === "view" ? 1000 : await evaluate("window.__cs.height()");
  const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: mode !== "view", clip: { x: 0, y: 0, width: 800, height, scale: 1 } });
  writeFileSync(join(outDir, `${name}.png`), Buffer.from(r.result.data, "base64"));
  console.log(`${name}.png 1600x${height * 2}`);
}

for (const sc of scenarios) {
  for (const step of sc.steps) {
    const [op, a, b] = step;
    if (op === "nav") { await send("Page.navigate", { url: a }); await sleep(3000); await evaluate(helpers); }
    else if (op === "tab") { await evaluate(`window.__cs.click("nav button, [role=tablist] button, button", ${JSON.stringify(a)})`); await sleep(600); }
    else if (op === "clickText") { await evaluate(`window.__cs.click(${JSON.stringify(a)}, ${JSON.stringify(b)})`); await sleep(600); }
    else if (op === "clickAria") { await evaluate(`window.__cs.clickAria(${JSON.stringify(a)}, ${JSON.stringify(b || "")})`); await sleep(600); }
    else if (op === "select") { const v = await evaluate(`window.__cs.select(${JSON.stringify(a)}, ${JSON.stringify(b)})`); console.log(`  select ${a} -> ${v}`); await sleep(600); }
    else if (op === "type") { await evaluate(`window.__cs.type(${JSON.stringify(a)}, ${JSON.stringify(b)})`); await sleep(700); }
    else if (op === "wait") { await sleep(a); }
    else if (op === "shot") { await shot(a, b || "full"); }
    else throw new Error("unknown step " + op);
  }
}
ws.close();
chrome.kill();
