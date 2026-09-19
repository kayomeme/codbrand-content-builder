#!/usr/bin/env node
/**
 * emit_block.cjs — ask WordPress what the correct markup is.
 *
 * Given a block name and its attribute JSON, prints the EXACT bytes WordPress's
 * save() produces — including every has-* class and the precise inline-style
 * property order. Use this INSTEAD of deriving markup from CSS knowledge.
 *
 * This is the strongest anti-derivation tool in the skill: snippets.md is a
 * cache of known-good primitives, but this generates ground truth for any
 * attribute combination on demand.
 *
 * USAGE
 *   node emit_block.cjs core/heading '{"level":2,"textAlign":"center"}' --content "Hello"
 *   node emit_block.cjs core/image   '{"url":"https://x/a.jpg","alt":"a","style":{"border":{"color":"#d4af37","width":"3px"}}}'
 *   echo '[{"name":"core/paragraph","attributes":{"align":"center"},"content":"Hi"}]' | node emit_block.cjs --stdin
 *
 * OPTIONS
 *   --content "text"   RichText content for blocks that take it (heading, paragraph, button…).
 *                      Equivalent to putting "content" (or "text" for buttons) in the attributes.
 *   --stdin            Read a JSON array of {name, attributes, content?} and emit each.
 *   --full             Also print the complete block comment wrapper (<!-- wp:x {...} --> … <!-- /wp:x -->).
 *
 * NOTE: attributes are passed straight to save(); schema defaults are NOT applied
 * (that only happens via parse()). If output looks empty or wrong, an attribute
 * with a default may be missing — see references/headless-validation.md gotcha #3.
 */

const fs = require("node:fs");
const path = require("node:path");

const argv = process.argv.slice(2);
if (!argv.length || argv.includes("--help") || argv.includes("-h")) {
  console.log(fs.readFileSync(__filename, "utf8").split("*/")[0].replace(/^#![^\n]*\n/, "").replace(/\/\*\*|^ \* ?/gm, ""));
  process.exit(0);
}
if (!fs.existsSync(path.join(__dirname, "node_modules", "@wordpress", "blocks"))) {
  console.error("Dependencies missing. Run: cd .claude/skills/codbrand-content-builder/scripts && npm install");
  process.exit(1);
}

/* DOM shim — see references/headless-validation.md */
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost", pretendToBeVisual: true });
dom.window.matchMedia = dom.window.matchMedia || (() => ({ matches:false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}, dispatchEvent(){ return false; } }));
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true, writable: true });
for (const k of ["self","HTMLElement","Element","Node","getComputedStyle","CustomEvent","MutationObserver","matchMedia","requestAnimationFrame","cancelAnimationFrame"]) {
  if (globalThis[k] === undefined) globalThis[k] = k === "self" ? dom.window : dom.window[k];
}
const REAL = { ...console }, MUTED = ["log","warn","error","info","groupCollapsed","groupEnd"];
const mute = () => MUTED.forEach(k => console[k] = () => {});
const unmute = () => MUTED.forEach(k => console[k] = REAL[k]);

mute();
require("@wordpress/block-editor");   // MUST precede registration: registers block-support filters
const { registerCoreBlocks } = require("@wordpress/block-library");
const B = require("@wordpress/blocks");
registerCoreBlocks();
unmute();

const wantFull = argv.includes("--full");

function emit({ name, attributes = {}, content }) {
  const type = B.getBlockType(name);
  if (!type) return { name, error: `unknown block type "${name}" — not a core block?` };

  const attrs = { ...attributes };
  if (content !== undefined) {
    // Blocks name their RichText attribute differently.
    if (name === "core/button") attrs.text = content;
    else if (name === "core/list-item" || name === "core/heading" || name === "core/paragraph" || name === "core/verse" || name === "core/preformatted") attrs.content = content;
    else if (attrs.content === undefined) attrs.content = content;
  }

  let html;
  try { mute(); html = B.getSaveContent(type, attrs); unmute(); }
  catch (e) { unmute(); return { name, error: e.message }; }

  const out = { name, html };
  if (wantFull) {
    const json = Object.keys(attributes).length ? " " + JSON.stringify(attributes) : "";
    out.full = `<!-- wp:${name.replace(/^core\//, "")}${json} -->\n${html}\n<!-- /wp:${name.replace(/^core\//, "")} -->`;
  }
  return out;
}

function print(res) {
  if (res.error) { console.error(`ERROR ${res.name}: ${res.error}`); process.exitCode = 1; return; }
  console.log(res.full !== undefined ? res.full : res.html);
}

if (argv.includes("--stdin")) {
  const raw = fs.readFileSync(0, "utf8");
  let items;
  try { items = JSON.parse(raw); } catch (e) { console.error("stdin is not valid JSON: " + e.message); process.exit(1); }
  for (const item of (Array.isArray(items) ? items : [items])) print(emit(item));
} else {
  const positional = [];
  let content;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--content") { content = argv[++i]; continue; }
    if (argv[i].startsWith("--")) continue;
    positional.push(argv[i]);
  }
  const [name, attrsRaw = "{}"] = positional;
  let attributes;
  try { attributes = JSON.parse(attrsRaw); }
  catch (e) { console.error(`attribute JSON does not parse: ${e.message}`); process.exit(1); }
  print(emit({ name, attributes, content }));
}
