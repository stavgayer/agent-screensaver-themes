#!/usr/bin/env node
// Checks the themes before they are packed: every script parses, every
// manifest is valid and complete, every id a theme or layout points at is a
// part of the same theme or a builtin.* extension, and all parts of a theme
// share one version.
// With --since <tag>, a theme whose files changed since that tag must also
// have a new version, so an update always reaches the people who have it.
// Usage: node scripts/check.mjs [--since <tag>]
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const themesDir = join(root, "themes");
const since = process.argv.includes("--since") ? process.argv[process.argv.indexOf("--since") + 1] : undefined;
const TYPES = new Set(["theme", "layout", "background", "component"]);
const problems = [];

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

// Whether an x.y.z version is at least min, comparing each number.
function atLeast(version, min) {
  if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) return false;
  const [a, b] = [version, min].map((v) => v.split(".").map(Number));
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}

// The version of each extension folder of a theme, from the working tree or from a tag.
function versionsOf(theme, ref) {
  const versions = new Map();
  const folders = ref
    ? git("ls-tree", "--name-only", `${ref}:themes/${theme}`).split("\n").filter(Boolean)
    : readdirSync(join(themesDir, theme));
  for (const folder of folders) {
    let text;
    try {
      text = ref ? git("show", `${ref}:themes/${theme}/${folder}/extension.json`) : readFileSync(join(themesDir, theme, folder, "extension.json"), "utf8");
    } catch {
      continue; // not an extension folder (README.md, media)
    }
    versions.set(folder, JSON.parse(text).version);
  }
  return versions;
}

for (const theme of readdirSync(themesDir).sort()) {
  const dir = join(themesDir, theme);
  const folders = readdirSync(dir).filter((name) => existsSync(join(dir, name, "extension.json")));
  if (folders.length === 0) problems.push(`${theme}: no extension folders`);
  const own = new Set(folders);
  // An id a theme or layout points at must be one of this theme's folders or a built-in.
  const pointsAt = (where, what, id) => {
    if (typeof id !== "string" || id === "") problems.push(`${where}: ${what} has no id`);
    else if (!own.has(id) && !id.startsWith("builtin.")) problems.push(`${where}: ${what} "${id}" is not a part of ${theme} and not a builtin.* id`);
  };
  for (const folder of folders) {
    const where = `${theme}/${folder}`;
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(join(dir, folder, "extension.json"), "utf8"));
    } catch (err) {
      problems.push(`${where}/extension.json: ${err.message}`);
      continue;
    }
    if (manifest.id !== folder) problems.push(`${where}: id "${manifest.id}" is not the folder name`);
    if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? "")) problems.push(`${where}: version "${manifest.version}" is not x.y.z`);
    if (!TYPES.has(manifest.type)) problems.push(`${where}: type "${manifest.type}" is not one of ${[...TYPES].join(", ")}`);
    if (manifest.api !== 1 && manifest.api !== 2) problems.push(`${where}: api is ${manifest.api}, not 1 or 2`);
    if (manifest.requires !== undefined && !/^\d+\.\d+\.\d+$/.test(manifest.requires)) problems.push(`${where}: requires "${manifest.requires}" is not x.y.z`);
    // api 2 parts use the shared helpers from 0.5.0; requires gives people on 0.5+ a clear message.
    if (manifest.api === 2 && !atLeast(manifest.requires, "0.5.0")) problems.push(`${where}: api 2 needs "requires": "0.5.0" or later`);
    if (manifest.type === "theme") {
      pointsAt(where, "background", manifest.theme?.background?.id);
      pointsAt(where, "layout", manifest.theme?.layout);
    }
    if (manifest.type === "layout") {
      for (const [mode, regions] of Object.entries(manifest.layout?.modes ?? {})) {
        for (const [region, refs] of Object.entries(regions ?? {})) {
          for (const ref of Array.isArray(refs) ? refs : []) pointsAt(where, `component in ${mode}/${region}`, ref?.id);
        }
      }
    }
    if (manifest.entry) {
      const entry = join(dir, folder, manifest.entry);
      if (!existsSync(entry)) problems.push(`${where}: entry ${manifest.entry} is missing`);
      else {
        try {
          execFileSync(process.execPath, ["--check", entry], { stdio: "pipe" });
        } catch (err) {
          problems.push(`${where}/${manifest.entry} does not parse:\n${String(err.stderr).trim()}`);
        }
      }
    }
  }
  const versions = new Set(versionsOf(theme).values());
  if (versions.size > 1) problems.push(`${theme}: its parts have different versions (${[...versions].join(", ")})`);
  if (since) {
    let changed;
    try {
      changed = git("diff", "--name-only", since, "--", `themes/${theme}`).split("\n").some((file) => file && !file.endsWith("README.md") && !file.includes("/media/"));
    } catch (err) {
      problems.push(`cannot compare with ${since}: ${err.message}`);
      break;
    }
    if (!changed) continue;
    let before;
    try {
      before = versionsOf(theme, since);
    } catch {
      continue; // a new theme, not in the earlier release
    }
    for (const [folder, version] of versionsOf(theme)) {
      if (before.get(folder) === version) problems.push(`${theme}: its files changed since ${since}, but ${folder} is still ${version}`);
    }
  }
}

if (problems.length > 0) {
  console.error(problems.map((problem) => `- ${problem}`).join("\n"));
  process.exit(1);
}
console.log(`ok: ${readdirSync(themesDir).length} themes${since ? `, versions checked against ${since}` : ""}`);
