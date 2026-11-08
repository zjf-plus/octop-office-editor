// Copy the offline ONLYOFFICE editor (ranuts/document build) into
// public/editor-<version>/ and write ui/src/editor-build.ts pointing at it.
//
// Usage: node scripts/vendor-editor.mjs [path/to/ranuts-document/dist]
//
// - Keeps only what /editor.html needs; drops landing pages, the marketing
//   site's translations and the service worker (it would cache under Octop's
//   /api scope and serve stale bundles after upgrades).
// - Trims what a Chinese/English desktop never loads: the in-editor local AI
//   models (wllama / web-llm), UI translations other than zh/en, and Visio.
// - Stores files gzip-compressed (`<name>.gz`) when that saves >10%; Octop
//   serves them with `Content-Encoding: gzip`, so disk and download shrink and
//   the browser inflates them natively.
// - The directory name carries a content hash so Octop can mark every file
//   immutable: a new build is a new URL, never a stale cache hit.
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { brotliDecompressSync, gzipSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");
// ranuts/document build output: `npm run vendor:editor -- <dist>` or RANUTS_DOCUMENT_DIST.
const srcArg = process.argv[2] ?? process.env.RANUTS_DOCUMENT_DIST;
if (!srcArg) throw new Error("pass the ranuts/document dist dir as an argument or set RANUTS_DOCUMENT_DIST");
const src = resolve(srcArg);
const publicDir = join(root, "public");

if (!existsSync(join(src, "editor.html"))) {
  throw new Error(`editor.html not found under ${src} (build ranuts/document first)`);
}

const KEEP_DIRS = new Set(["assets", "sdkjs", "web-apps", "fonts", "libs", "icons", "licenses", "ran-fonts", "ranui-iife"]);
// No service workers: document_editor_service_worker.js is deliberately left out.
const KEEP_FILES = new Set(["editor.html", "LICENSE", "NOTICE", "manifest.json", "app-tokens.css", "theme-presentation.js", "plugins.json", "themes.json"]);
const isTokenCss = (name) => /^ran-tokens(\.[0-9a-f]+)?\.css$/.test(name);

/** Paths (relative, "/"-separated) dropped from the copy. */
function isTrimmed(rel) {
  // Local AI models for ranuts' optional assistant (lazy-loaded, unused here).
  if (/^assets\/(wllama-[^/]+\.wasm|webllm\.worker-[^/]+\.js)$/.test(rel)) return true;
  // Visio viewer (we do not register vsd*).
  if (rel.startsWith("sdkjs/visio/") || rel.startsWith("web-apps/apps/visioeditor/")) return true;
  // UI translations other than English / Chinese.
  const m = rel.match(/\/locale\/([^/]+)$/);
  if (m && !/^(en|zh)/i.test(m[1])) return true;
  return false;
}

const staging = join(publicDir, ".editor-staging");
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });

for (const name of readdirSync(src)) {
  const from = join(src, name);
  const keep = statSync(from).isDirectory() ? KEEP_DIRS.has(name) : KEEP_FILES.has(name) || isTokenCss(name);
  if (keep) {
    cpSync(from, join(staging, name), {
      recursive: true,
      filter: (p) => !isTrimmed(relative(src, p).split("\\").join("/")),
    });
  }
}

// License texts are linked from the viewer's About dialog: a .txt name makes
// browsers show them instead of downloading an extensionless file.
for (const name of ["LICENSE", "NOTICE"]) {
  const from = join(staging, name);
  if (!existsSync(from)) throw new Error(`${name} missing from the editor build`);
  cpSync(from, `${from}.txt`);
  unlinkSync(from);
}

// Octop serves plain bytes (+ optional gzip); decode the Brotli x2t payload.
const wasm = join(staging, "sdkjs", "common", "wasm", "x2t", "x2t.wasm.br");
const raw = brotliDecompressSync(readFileSync(wasm));
if (!raw.subarray(0, 4).equals(Buffer.from([0, 0x61, 0x73, 0x6d]))) {
  throw new Error("x2t payload is not a WASM module after Brotli decode");
}
writeFileSync(wasm, raw);

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

// No service workers: ONLYOFFICE's app pages self-register
// document_editor_service_worker.js. Turn that guard off so they never try.
// Matches both the minified ("serviceWorker"in navigator&&) and the readable
// ('serviceWorker' in navigator &&) guard in front of each registration.
const SW_GUARD = /(["'])serviceWorker\1\s*in\s+navigator\s*&&/g;
let swPatched = 0;
const swPages = [];
for (const f of walk(staging)) {
  if (!f.endsWith(".html")) continue;
  const text = readFileSync(f, "utf8");
  if (!text.includes("serviceWorker.register")) continue;
  const patched = text.replace(SW_GUARD, "false&&");
  if (patched === text) throw new Error(`unexpected service worker registration in ${relative(staging, f)}`);
  writeFileSync(f, patched);
  swPages.push(f);
  swPatched += 1;
}
// ranuts' own registration (assets/editor-*.js) is skipped in embed mode by
// patches/ranuts.patch; the HTML pages must all be guarded off now.
for (const f of walk(staging)) {
  if (f.endsWith(".html") && new RegExp(SW_GUARD.source).test(readFileSync(f, "utf8"))) {
    throw new Error(`service worker registration left in ${relative(staging, f)}`);
  }
}

// Neutral chrome, colour as accent only: the modern themes' tab row becomes
// white (one continuous header with the host's title bar) and the active-tab
// underline takes each app's brand colour (same palette as the host's
// file-type badge). Appended to each editor's stylesheet; `body.` raises
// specificity over the stock `:root .theme-*` rules.
const APP_ACCENT = {
  document: "#2f6bf2",
  spreadsheet: "#1fa463",
  presentation: "#f06a2b",
  pdf: "#e64545",
};
const accents = Object.entries(APP_ACCENT)
  .map(([app, c]) => `--highlight-header-tab-underline-${app}:${c};`)
  .join("");
const headerCss =
  "\n/* octop-office-editor: neutral header, app colour accents */\n" +
  ":root body.theme-white{" +
  Object.keys(APP_ACCENT).map((app) => `--toolbar-header-${app}:#fff;`).join("") +
  accents +
  "}\n:root body.theme-night{" +
  accents +
  "}\n" +
  // Save lives in the host title bar (same place for every format). Hide the
  // toolbar group holding Save and Print, and its separator; Print stays in
  // File > Print, and Ctrl/Cmd+S / Ctrl/Cmd+P keep working.
  ".group:has(> .elset > #slot-btn-save),.group:has(> .elset > #slot-btn-save)+.separator{display:none!important}\n";
// Fill gaps in the vendor's Chinese UI strings (shown untranslated otherwise).
const ZH_FIXES = {
  pdfeditor: { "PDFE.Views.Toolbar.textTabCollaboration": "协作" },
};
for (const [app, fixes] of Object.entries(ZH_FIXES)) {
  const file = join(staging, "web-apps", "apps", app, "main", "locale", "zh.json");
  const zh = JSON.parse(readFileSync(file, "utf8"));
  Object.assign(zh, fixes);
  writeFileSync(file, JSON.stringify(zh));
}

// Fonts: ship only what Chinese/English office documents need, no download.
// Every other family's row is re-pointed at the position of a shipped family
// (never copy files between positions: the family name inside the file at P
// must belong to a row that points at P), so documents naming them still
// render; text in scripts no shipped font covers shows as boxes.
const CORE_FONT_FAMILIES = new Set([
  "Noto Sans SC", "Noto Serif SC", // 宋体/黑体/微软雅黑/楷体/仿宋/等线 …
  "Liberation Sans", "Liberation Serif", "Liberation Mono", "Liberation Sans Narrow", // Arial/Times/Courier
  "Carlito", "Caladea", // Calibri/Cambria
  "DejaVu Sans", "DejaVu Serif", "DejaVu Sans Mono", // engine fallback
  "OpenSymbol", // bullets/symbols
]);
// Glyph fallback only (emoji, ✓ ★ ①): shipped, hidden from the font list.
const FALLBACK_FONT_FAMILIES = new Set(["Noto Emoji", "Symbola"]);
// The font list offers only these (each must render with a shipped family).
const OFFERED_FONT_NAMES = [
  "宋体", "黑体", "微软雅黑", "楷体", "仿宋", "等线",
  "Arial", "Times New Roman", "Calibri", "Courier New", "Georgia", "Verdana",
];
const remapTarget = (name) => {
  const cjk = /WenQuanYi|Droid Sans Fallback|AR PL|Takao|Nanum|Noto Sans KR/.test(name);
  if (/Mono/.test(name)) return "Liberation Mono";
  if (/Serif|Myeongjo|UKai/.test(name)) return cjk ? "Noto Serif SC" : "Liberation Serif";
  return cjk ? "Noto Sans SC" : "Liberation Sans";
};
let fontNamesOffered;
let keptFontFiles;
{
  const file = join(staging, "sdkjs", "common", "AllFonts.js");
  const text = readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const infosRe = /(window\["__fonts_infos"\]\s*=\s*)(\[[\s\S]*?\]);/;
  const fontFiles = JSON.parse(text.match(/window\["__fonts_files"\]\s*=\s*(\[[\s\S]*?\]);/)[1]);
  const rows = JSON.parse(text.match(infosRe)[2]);
  const byName = new Map(rows.map((r) => [r[0], r]));
  const positions = (row) => [1, 3, 5, 7].map((i) => row[i]).filter((p) => p >= 0);
  const kept = new Set();
  for (const name of [...CORE_FONT_FAMILIES, ...FALLBACK_FONT_FAMILIES]) {
    const row = byName.get(name);
    if (!row) throw new Error(`font family ${name} missing from AllFonts.js`);
    for (const p of positions(row)) kept.add(p);
  }
  const coreRegular = new Set([...CORE_FONT_FAMILIES].map((n) => byName.get(n)[1]));
  for (const name of OFFERED_FONT_NAMES) {
    if (!coreRegular.has(byName.get(name)?.[1])) throw new Error(`offered font ${name} is not a shipped family`);
  }
  fontNamesOffered = OFFERED_FONT_NAMES;
  let remapped = 0;
  for (const row of rows) {
    if (positions(row).every((p) => kept.has(p))) continue;
    const target = byName.get(remapTarget(row[0]));
    row.splice(1, 8, ...target.slice(1, 9));
    remapped += 1;
  }
  keptFontFiles = new Set([...kept].map((p) => fontFiles[p]));
  let dropped = 0;
  for (const name of readdirSync(join(staging, "fonts"))) {
    if (keptFontFiles.has(name)) continue;
    unlinkSync(join(staging, "fonts", name));
    dropped += 1;
  }
  const body = "[\n" + rows.map((r) => JSON.stringify(r)).join(",\n") + "\n]";
  writeFileSync(file, text.replace(infosRe, (_, head) => `${head}${body};`));
  console.log(`[vendor] fonts: ${keptFontFiles.size} files shipped, ${dropped} dropped, ${remapped} families re-pointed, ${fontNamesOffered.length} names in the font list`);
}

// Font list: offer only fontNamesOffered. Each entry keeps its own thumbnail
// index (asc_getFontThumbnail), so the picker's name sprites stay aligned.
{
  const FONT_LOOP = "_.each(e,(function(t){var e=t.asc_getFontId();";
  const guard = `_.each(e,(function(t){if(!${JSON.stringify(fontNamesOffered)}.includes(t.asc_getFontName()))return;var e=t.asc_getFontId();`;
  for (const app of ["documenteditor", "spreadsheeteditor", "presentationeditor", "pdfeditor"]) {
    const file = join(staging, "web-apps", "apps", app, "main", "app.js");
    const js = readFileSync(file, "utf8");
    if (js.split(FONT_LOOP).length !== 2) throw new Error(`font list loop not found once in ${app}/main/app.js`);
    writeFileSync(file, js.replace(FONT_LOOP, guard));
  }
}

// Some aliases list only a regular face (Calibri -> Carlito Regular). For bold
// or italic text the engine then lays out with that regular file, re-matches
// the file's own family name ("Carlito") to the real bold/italic face and
// draws glyphs from it -- different glyph order, garbled text (Word's heading
// and caption styles use Calibri bold/italic). Give such an alias the missing
// faces of the family that owns its regular file. Row layout: name, then
// (position, face index) for regular, italic, bold, bold italic.
{
  const file = join(staging, "sdkjs", "common", "AllFonts.js");
  const text = readFileSync(file, "utf8");
  const infosRe = /(window\["__fonts_infos"\]\s*=\s*)(\[[\s\S]*?\]);/;
  const rows = JSON.parse(text.match(infosRe)[2]);
  const faces = (row) => [3, 5, 7].filter((i) => row[i] >= 0).length;
  const owners = new Map();
  for (const row of rows) {
    const best = owners.get(row[1]);
    if (!best || faces(row) > faces(best)) owners.set(row[1], row);
  }
  const fixed = [];
  for (const row of rows) {
    const owner = owners.get(row[1]);
    let changed = false;
    for (const i of [3, 5, 7]) {
      if (row[i] < 0 && owner[i] >= 0) {
        row[i] = owner[i];
        row[i + 1] = owner[i + 1];
        changed = true;
      }
    }
    if (changed) fixed.push(`${row[0]}->${owner[0]}`);
  }
  if (!fixed.includes("Calibri->Carlito")) throw new Error("expected to fill Calibri's faces from Carlito");
  const body = "[\n" + rows.map((r) => JSON.stringify(r)).join(",\n") + "\n]";
  writeFileSync(file, text.replace(infosRe, (_, head) => `${head}${body};`));
  console.log(`[vendor] font aliases given missing faces: ${fixed.join(", ")}`);
}

let headerPatched = 0;
for (const app of ["documenteditor", "spreadsheeteditor", "presentationeditor", "pdfeditor"]) {
  const css = join(staging, "web-apps", "apps", app, "main", "resources", "css", "app.css");
  if (!existsSync(css)) throw new Error(`missing stylesheet ${relative(staging, css)}`);
  writeFileSync(css, readFileSync(css, "utf8") + headerCss);
  headerPatched += 1;
}

// AGPL section 5(a): the modified work carries prominent notices stating that
// it was modified and when. Every file changed above gets a header comment
// (JSON cannot hold one: the zh.json fixes are listed in NOTICE.txt), and
// NOTICE.txt gains a section listing all of our modifications.
{
  const MODIFIED = "2026-11";
  const SOURCE_URL = "https://github.com/zjf-plus/octop-office-editor";
  const note = (what) =>
    `Modified by octop-office-editor (${SOURCE_URL}), ${MODIFIED}: ${what}. ` +
    "Based on ONLYOFFICE by Ascensio System SIA, licensed under the GNU AGPL v3.";
  const marked = [];
  const mark = (file, what) => {
    const text = readFileSync(file, "utf8");
    const rel = relative(staging, file).split("\\").join("/");
    if (file.endsWith(".html")) {
      const comment = `<!-- ${note(what)} -->\n`;
      const doctype = text.match(/^\s*<!DOCTYPE[^>]*>\s*/i);
      writeFileSync(file, doctype ? doctype[0] + comment + text.slice(doctype[0].length) : comment + text);
    } else {
      writeFileSync(file, `/* ${note(what)} */\n${text}`);
    }
    marked.push(rel);
  };
  for (const f of swPages) mark(f, "service worker registration disabled");
  for (const app of ["documenteditor", "spreadsheeteditor", "presentationeditor", "pdfeditor"]) {
    mark(join(staging, "web-apps", "apps", app, "main", "app.js"), "font list limited to common fonts");
    mark(join(staging, "web-apps", "apps", app, "main", "resources", "css", "app.css"), "header colours, toolbar save/print group hidden");
  }
  mark(join(staging, "sdkjs", "common", "AllFonts.js"), "font registry trimmed to bundled fonts, other families re-pointed, alias faces filled in");

  const notice = join(staging, "NOTICE.txt");
  writeFileSync(
    notice,
    readFileSync(notice, "utf8") +
      `

Modifications in octop-office-editor (${MODIFIED})
${"-".repeat(40)}

This distribution is a modified version of ONLYOFFICE Docs 9.3.0.133
(Copyright (C) Ascensio System SIA), as packaged by ranuts/document, and is
licensed under the GNU AGPL v3 with ONLYOFFICE's additional terms. The
complete corresponding source, including the patch to ranuts/document and
the packaging script that produced these files, is available at:
  ${SOURCE_URL}

Changes made by the packaging script (scripts/vendor-editor.mjs):
- Removed: local AI models, Visio editor, UI languages other than English
  and Chinese, spell-check dictionaries, service worker script.
- Service worker registration disabled in the editor pages.
- x2t.wasm stored decompressed (Brotli decoded, content unchanged).
- Fonts: only common Chinese/English families plus emoji/symbol fallbacks
  are shipped; other families in sdkjs/common/AllFonts.js point at a bundled
  family of the same kind; missing bold/italic faces of aliases filled in.
- Font list in the four editors limited to 12 common names.
- Stylesheets: neutral header with per-format accent colours; toolbar
  save/print group hidden (save is in the host frame).
- Chinese UI strings added where missing (pdfeditor zh.json).
- LICENSE and NOTICE shipped as LICENSE.txt and NOTICE.txt.

Changes to ranuts/document (patches/ranuts.patch): macros disabled,
sub-path mounting, no service worker in embed mode, saves handed to the host
instead of downloaded, embed-mode theme and compact header, export kinds
separated (save / print / download), slide thumbnails button kept in sync on
narrow screens.

Files carrying a modification header: ${marked.length}.
`,
  );
  console.log(`[vendor] modification notices: ${marked.length} files marked, NOTICE.txt extended`);
}

// Content hash of the staged tree -> versioned directory name.
const hash = createHash("sha256");
const files = [...walk(staging)].sort();
for (const f of files) {
  hash.update(relative(staging, f));
  hash.update(readFileSync(f));
}
const version = hash.digest("hex").slice(0, 10);
const dirName = `editor-${version}`;

let rawBytes = 0;
let storedBytes = 0;
let gzCount = 0;
for (const f of [...walk(staging)].sort()) {
  const data = readFileSync(f);
  rawBytes += data.length;
  if (data.length >= 1024) {
    const gz = gzipSync(data, { level: 9 });
    if (gz.length < data.length * 0.9) {
      writeFileSync(`${f}.gz`, gz);
      unlinkSync(f);
      storedBytes += gz.length;
      gzCount += 1;
      continue;
    }
  }
  storedBytes += data.length;
}

// Swap in the new tree; drop older versions.
for (const name of readdirSync(publicDir)) {
  if (name === "editor" || name.startsWith("editor-")) rmSync(join(publicDir, name), { recursive: true, force: true });
}
cpSync(staging, join(publicDir, dirName), { recursive: true });
rmSync(staging, { recursive: true, force: true });

writeFileSync(
  join(root, "ui", "src", "editor-build.ts"),
  `// Generated by scripts/vendor-editor.mjs — do not edit.\nexport const EDITOR_DIR = ${JSON.stringify(dirName)};\n`,
);

const mb = (n) => (n / 1048576).toFixed(0);
console.log(`[vendor] ${dirName}: raw ${mb(rawBytes)} MB -> stored ${mb(storedBytes)} MB (${gzCount} gzipped); ${keptFontFiles.size} fonts bundled`);
console.log(`[vendor] service worker registration disabled in ${swPatched} ONLYOFFICE pages`);
