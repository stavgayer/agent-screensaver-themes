#!/usr/bin/env node
// Loads a preview URL in headless Chrome over the DevTools protocol, then saves
// a JPEG still and reports console errors and how many frames a second the
// canvases draw. Node 22 or later (it uses the global fetch and WebSocket), no
// packages. A hidden browser pane runs no animation frames, so use this for
// frame rates, "Reduce motion" and the stills in media/.
//
// Usage:
//   node shoot.mjs <preview URL> [--size 1440x900] [--reduce] [--out still.jpg]
//                  [--width 1440] [--wait 5000] [--measure 4000] [--lose-context]
//                  [--gif demo.gif]
//
//   --size          the screen to emulate, in CSS pixels (default 1440x900)
//   --reduce        emulate "Reduce motion" (prefers-reduced-motion: reduce)
//   --out           where to save the still (default: no still)
//   --width         the width of the still in pixels (default 1440, any --size)
//   --wait          ms to wait after load, so fades and fonts settle (default 5000)
//   --measure       ms to count drawn frames over (default 4000)
//   --lose-context  after the wait, lose the background's WebGL context and
//                   report whether one fresh canvas replaced it and draws again
//   --gif           record media/demo.gif: 9 s at 12 frames a second, 800 px wide.
//                   Load the preview with state=work: after 2 s the first task
//                   asks for approval, after 6 s it goes back. Needs ffmpeg.
//                   Without --size it records 1440x936, like the other demos.
//
// Set CHROME to the browser's path if it is not in /Applications.
// Exit code: 0 when the console stayed clean, 1 when it logged an error.
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const url = args.find((arg) => !arg.startsWith("--") && !isValue(arg));
function isValue(arg) {
  const at = args.indexOf(arg);
  return at > 0 && ["--size", "--out", "--width", "--wait", "--measure", "--gif"].includes(args[at - 1]);
}
function option(name, fallback) {
  const at = args.indexOf(name);
  return at === -1 ? fallback : args[at + 1];
}
if (!url) {
  console.error("usage: node shoot.mjs <preview URL> [--size 1440x900] [--reduce] [--out still.jpg] [--width 1440] [--wait 5000] [--measure 4000] [--lose-context] [--gif demo.gif]");
  process.exit(2);
}
const gif = option("--gif", undefined);
const [width, height] = option("--size", gif ? "1440x936" : "1440x900").split("x").map(Number);
const stillWidth = Number(option("--width", "1440"));
const waitMs = Number(option("--wait", "5000"));
const measureMs = Number(option("--measure", "4000"));
const out = option("--out", undefined);
const reduce = args.includes("--reduce");
const loseContext = args.includes("--lose-context");
const chromePath = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// For --gif: keeps the last state the preview sends, so the recording can change it live.
const KEEP_STATE = `(() => {
  let real;
  Object.defineProperty(window, "agentScreensaver", { configurable: true,
    get() { return real && { ...real, setState(json, display) { window.__shootLast = [json, display]; return real.setState(json, display); } }; },
    set(value) { real = value; window.__shootReal = value; } });
})();`;
const TO_APPROVAL = `(() => { const [json, display] = window.__shootLast; const state = JSON.parse(json); const card = state.cards[0];
  if (!card) return false; card.kind = "approval"; card.request = card.request || "npm run migrate"; card.approval_since_ms = Date.now() - 180000;
  window.__shootReal.setState(JSON.stringify(state), display); return true; })()`;
const TO_WORK = `(() => { const [json, display] = window.__shootLast; window.__shootReal.setState(json, display); return true; })()`;
const GIF_WIDTH = 800, GIF_MS = 9000, GIF_FRAME_MS = 83;

// Runs in the page before its own scripts: marks a frame as drawn when any
// canvas draws in it, and counts those frames.
const COUNTER = `(() => {
  let drew = false, frames = 0;
  const mark = (proto, names) => { if (!proto) return; for (const name of names) { const real = proto[name]; if (typeof real !== "function") continue; proto[name] = function (...a) { drew = true; return real.apply(this, a); }; } };
  mark(window.WebGLRenderingContext && WebGLRenderingContext.prototype, ["drawArrays", "drawElements"]);
  mark(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype, ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]);
  mark(window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype, ["fillRect", "strokeRect", "clearRect", "fill", "stroke", "drawImage", "putImageData", "fillText", "strokeText"]);
  const loop = () => { if (drew) frames++; drew = false; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  window.__shootFrames = () => frames;
})();`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = mkdtempSync(join(tmpdir(), "shoot-"));
const port = 9300 + Math.floor(Math.random() * 600);
const chrome = spawn(chromePath, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--hide-scrollbars", "--no-first-run", "about:blank"], { stdio: "ignore" });

let socket;
try {
  let page;
  for (let i = 0; i < 60 && !page; i++) {
    await sleep(200);
    try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((target) => target.type === "page"); } catch { /* not up yet */ }
  }
  if (!page) throw new Error(`Chrome did not start (CHROME=${chromePath})`);
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve); socket.addEventListener("error", reject); });

  let id = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); return; }
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
    if (message.method === "Log.entryAdded" && message.params.entry.level === "error") errors.push(`${message.params.entry.text} ${message.params.entry.url || ""}`.trim());
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, (message) => (message.error ? reject(new Error(`${method}: ${message.error.message}`)) : resolve(message.result)));
    socket.send(JSON.stringify({ id: n, method, params }));
  });
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;

  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: reduce ? "reduce" : "no-preference" }] });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: COUNTER });
  if (gif) await send("Page.addScriptToEvaluateOnNewDocument", { source: KEEP_STATE });
  await send("Page.navigate", { url });
  await sleep(waitMs);

  const before = await evaluate("window.__shootFrames()");
  await sleep(measureMs);
  const drawn = (await evaluate("window.__shootFrames()")) - before;
  const report = {
    url, size: `${width}x${height}`, reduce,
    reducedMotionMatches: await evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"),
    framesPerSecond: Math.round((drawn / (measureMs / 1000)) * 10) / 10,
    canvases: await evaluate("[...document.querySelectorAll('#background canvas')].map((c) => c.width + 'x' + c.height)"),
  };

  if (loseContext) {
    report.loseContext = await evaluate(`(async () => {
      const first = document.querySelector("#background canvas");
      if (!first) return "no canvas in #background";
      const gl = first.getContext("webgl2") || first.getContext("webgl");
      if (!gl) return "the background canvas has no WebGL context";
      gl.getExtension("WEBGL_lose_context").loseContext();
      await new Promise((r) => setTimeout(r, 1500));
      const next = document.querySelector("#background canvas");
      const start = window.__shootFrames();
      await new Promise((r) => setTimeout(r, 3000));
      const same = document.querySelector("#background canvas") === next;
      const nextGl = next && (next.getContext("webgl2") || next.getContext("webgl"));
      return { canvases: document.querySelectorAll("#background canvas").length, replaced: next !== first, sameAfter3s: same, lost: nextGl ? nextGl.isContextLost() : "no context", framesPerSecondAfter: Math.round(((window.__shootFrames() - start) / 3) * 10) / 10 };
    })()`);
  }

  if (out) {
    // Render at the still's width whatever the screen size, so every still is the same width.
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: stillWidth / width, mobile: false });
    await sleep(800);
    const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 82 });
    writeFileSync(out, Buffer.from(shot.data, "base64"));
    report.still = { out, width: stillWidth, height: Math.round((height * stillWidth) / width), bytes: Buffer.from(shot.data, "base64").length };
  }

  if (gif) report.gif = await recordGif(send, evaluate);

  report.consoleErrors = errors;
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = errors.length > 0 ? 1 : 0;

  // Captures frames on their real clock, then lets ffmpeg build one palette for them.
  async function recordGif(send, evaluate) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: GIF_WIDTH / width, mobile: false });
    await sleep(800);
    const dir = mkdtempSync(join(tmpdir(), "shoot-gif-"));
    try {
      const frames = [];
      const start = Date.now();
      let step = 0;
      while (Date.now() - start < GIF_MS) {
        const t = Date.now() - start;
        if (step === 0 && t > 2000) { if (!(await evaluate(TO_APPROVAL))) throw new Error("--gif needs a preview with tasks: use state=work"); step = 1; }
        if (step === 1 && t > 6000) { await evaluate(TO_WORK); step = 2; }
        const shot = await send("Page.captureScreenshot", { format: "png" });
        const file = join(dir, `f${String(frames.length).padStart(4, "0")}.png`);
        writeFileSync(file, Buffer.from(shot.data, "base64"));
        frames.push({ file, t: Date.now() - start });
        await sleep(Math.max(0, frames.length * GIF_FRAME_MS - (Date.now() - start)));
      }
      const list = frames.map((frame, i) => `file '${frame.file}'\nduration ${(((frames[i + 1]?.t ?? frame.t + GIF_FRAME_MS) - frame.t) / 1000).toFixed(3)}`).join("\n");
      writeFileSync(join(dir, "list.txt"), `${list}\nfile '${frames.at(-1).file}'\n`);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"),
        "-vf", `fps=12,scale=${GIF_WIDTH}:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
        "-loop", "0", gif]);
      return { out: gif, frames: frames.length, ms: frames.at(-1).t };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
} catch (err) {
  console.error(String(err && err.message ? err.message : err));
  process.exitCode = 2;
} finally {
  try { socket?.close(); } catch { /* already closed */ }
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
